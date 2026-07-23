import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, true
from sqlalchemy.orm import selectinload

from app.crypto import PIIDecryptError, decrypt_pii
from app.models.campaign import Campaign
from app.models.consent import Consent
from app.models.lifecycle_event import LifecycleEvent
from app.models.organization import Organization
from app.models.signature import Signature
from app.models.form import Form
from app.models.question import Question
from app.models.user import User
from app.schemas.campaign import CampaignCreate, CampaignUpdate, SocialLinksUpdate, ThankYouUpdate, WelcomeConfigUpdate, CampaignInfoUpdate, _META_FIELDS
from app.schemas.form import FormResponse


class CampaignService:
    @staticmethod
    async def list_campaigns(db: AsyncSession, org_id: uuid.UUID | None) -> list[Campaign]:
        # org_id None = admin de plataforma (multi-org); RLS respalda el acceso
        stmt = select(Campaign).order_by(Campaign.created_at.desc())
        if org_id is not None:
            stmt = stmt.where(Campaign.org_id == org_id)
        result = await db.execute(stmt)
        return result.scalars().all()

    @staticmethod
    async def get_campaign(db: AsyncSession, campaign_id: str, org_id: uuid.UUID | None = None) -> Campaign | None:
        if org_id is not None:
            result = await db.execute(
                select(Campaign)
                .where(Campaign.id == campaign_id, Campaign.org_id == org_id)
            )
        else:
            result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_campaign_by_slug(db: AsyncSession, slug: str) -> Campaign | None:
        result = await db.execute(select(Campaign).where(Campaign.slug == slug))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_campaign_by_form_slug(db: AsyncSession, form_slug: str) -> tuple["Campaign | None", "Form | None"]:
        """Busca un formulario por su slug y retorna (campaign, form)."""
        result = await db.execute(
            select(Form)
            .where(Form.slug == form_slug)
            .options(selectinload(Form.questions).selectinload(Question.options))
        )
        form = result.scalar_one_or_none()
        if not form or not form.campaign_id:
            return None, form
        campaign_result = await db.execute(
            select(Campaign).where(Campaign.id == form.campaign_id)
        )
        return campaign_result.scalar_one_or_none(), form

    @staticmethod
    async def get_campaign_full(db: AsyncSession, campaign: Campaign, form: "Form | None" = None) -> dict:
        if form is None:
            if not campaign.form_id:
                return {"campaign": {}, "form": None}
            result = await db.execute(
                select(Form)
                .where(Form.id == campaign.form_id)
                .options(selectinload(Form.questions).selectinload(Question.options))
            )
            form = result.scalar_one_or_none()
        return {
            "campaign": {
                "id": str(campaign.id),
                "form_id": str(campaign.form_id),
                "title": campaign.title,
                "slug": campaign.slug,
                "status": campaign.status,
                "access_mode": campaign.access_mode,
                "social_links": campaign.social_links,
                "share_text": campaign.share_text,
                "thank_you_title": campaign.thank_you_title,
                "thank_you_body": campaign.thank_you_body,
                "welcome_logo_url": campaign.welcome_logo_url,
                "welcome_title": campaign.welcome_title,
                "welcome_title_size": campaign.welcome_title_size,
                "welcome_description": campaign.welcome_description,
                "welcome_slogan": campaign.welcome_slogan,
                "welcome_slogan_size": campaign.welcome_slogan_size,
            },
            "form": FormResponse.model_validate(form).model_dump(mode="json") if form else None,
        }

    @staticmethod
    async def create_campaign(db: AsyncSession, data: CampaignCreate, user: User) -> Campaign:
        payload = data.model_dump(exclude_none=True)
        if "petition_body" not in payload:
            payload["petition_body"] = {}
        # org_id del usuario tiene precedencia; solo se sobreescribe si se pasa explícitamente
        payload["org_id"] = payload.get("org_id") or user.org_id
        # Extraer campos meta antes de construir el modelo
        meta_fields = {k: payload.pop(k) for k in list(payload) if k in _META_FIELDS}
        campaign = Campaign(created_by=user.id, **payload)
        if meta_fields:
            meta: dict = {}
            if "form_config" in meta_fields:
                meta["form_config"] = meta_fields.pop("form_config")
            meta.update(meta_fields)
            campaign.meta = meta
        db.add(campaign)
        await db.commit()
        await db.refresh(campaign)
        return campaign

    @staticmethod
    async def update_campaign(db: AsyncSession, campaign_id: str, data: CampaignUpdate) -> Campaign | None:
        result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
        campaign = result.scalar_one_or_none()
        if not campaign:
            return None
        dumped = data.model_dump(exclude_none=True)
        meta_updates = {k: dumped.pop(k) for k in list(dumped) if k in _META_FIELDS}
        for k, v in dumped.items():
            setattr(campaign, k, v)
        if meta_updates:
            current_meta = dict(campaign.meta or {})
            if "form_config" in meta_updates:
                current_fc = dict(current_meta.get("form_config", {}))
                current_fc.update(meta_updates.pop("form_config"))
                current_meta["form_config"] = current_fc
            current_meta.update(meta_updates)
            campaign.meta = current_meta
        await db.commit()
        await db.refresh(campaign)
        return campaign

    @staticmethod
    async def archive_campaign(
        db: AsyncSession,
        campaign_id: str,
        org_id: uuid.UUID | None,
        user_id: uuid.UUID,
    ) -> Campaign | None:
        stmt = select(Campaign).where(Campaign.id == campaign_id)
        if org_id is not None:
            stmt = stmt.where(Campaign.org_id == org_id)
        result = await db.execute(stmt)
        campaign = result.scalar_one_or_none()
        if not campaign:
            return None
        if campaign.status in ("active", "online"):
            raise ValueError("campaign_activa")
        campaign.archived_at = datetime.now(timezone.utc)
        campaign.archived_by = user_id
        await db.commit()
        await db.refresh(campaign)
        return campaign

    @staticmethod
    async def update_status(db: AsyncSession, campaign_id: str, new_status: str) -> Campaign:
        result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
        campaign = result.scalar_one()
        campaign.status = new_status
        await db.commit()
        await db.refresh(campaign)
        return campaign

    @staticmethod
    async def update_info(db: AsyncSession, campaign_id: str, data: CampaignInfoUpdate) -> Campaign | None:
        result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
        campaign = result.scalar_one_or_none()
        if not campaign:
            return None
        meta = dict(campaign.meta or {})
        if data.description is not None:
            meta["description"] = data.description
        if data.data_protection_level is not None:
            meta["data_protection_level"] = data.data_protection_level
        campaign.meta = meta
        await db.commit()
        await db.refresh(campaign)
        return campaign

    @staticmethod
    async def update_social_links(db: AsyncSession, campaign_id: str, data: SocialLinksUpdate) -> Campaign | None:
        result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
        campaign = result.scalar_one_or_none()
        if not campaign:
            return None
        current_meta = dict(campaign.meta or {})
        link_keys = {"instagram", "facebook", "x", "tiktok", "whatsapp", "newsletter", "website", "email"}
        current_meta["social_links"] = {k: v for k, v in data.model_dump().items() if k in link_keys and v is not None}
        if data.share_text is not None:
            current_meta["share_text"] = data.share_text
        campaign.meta = current_meta
        await db.commit()
        await db.refresh(campaign)
        return campaign

    @staticmethod
    async def update_thank_you(db: AsyncSession, campaign_id: str, data: ThankYouUpdate) -> Campaign | None:
        result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
        campaign = result.scalar_one_or_none()
        if not campaign:
            return None
        current_meta = dict(campaign.meta or {})
        if data.thank_you_title is not None:
            current_meta["thank_you_title"] = data.thank_you_title
        if data.thank_you_body is not None:
            current_meta["thank_you_body"] = data.thank_you_body
        campaign.meta = current_meta
        await db.commit()
        await db.refresh(campaign)
        return campaign

    @staticmethod
    async def update_welcome_config(db: AsyncSession, campaign_id: str, data: WelcomeConfigUpdate) -> Campaign | None:
        result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
        campaign = result.scalar_one_or_none()
        if not campaign:
            return None
        current_meta = dict(campaign.meta or {})
        welcome_fields = ["welcome_logo_url", "welcome_title", "welcome_title_size",
                          "welcome_description", "welcome_slogan", "welcome_slogan_size",
                          "welcome_title_color", "welcome_slogan_color"]
        for field in welcome_fields:
            value = getattr(data, field)
            if value is not None:
                current_meta[field] = value
        campaign.meta = current_meta
        if data.slug is not None:
            campaign.slug = data.slug
        if data.status is not None:
            campaign.status = data.status
        await db.commit()
        await db.refresh(campaign)
        return campaign

    @staticmethod
    async def get_campaign_with_lifecycle(
        db: AsyncSession,
        campaign_id: str,
        org_id: uuid.UUID | None,
    ) -> tuple[Campaign | None, Organization | None]:
        stmt = (
            select(Campaign)
            .where(Campaign.id == campaign_id)
            .options(
                selectinload(Campaign.lifecycle_events)
            )
        )
        if org_id is not None:
            stmt = stmt.where(Campaign.org_id == org_id)
        result = await db.execute(stmt)
        campaign = result.scalar_one_or_none()
        if not campaign:
            return None, None
        org_result = await db.execute(
            select(Organization).where(Organization.id == campaign.org_id)
        )
        org = org_result.scalar_one_or_none()
        return campaign, org

    @staticmethod
    async def update_lifecycle_stage(
        db: AsyncSession,
        campaign: Campaign,
        new_stage: int,
        notes: str | None,
        user_id: uuid.UUID,
    ) -> LifecycleEvent:
        # Valores que acepta el CHECK constraint de la BD (sin tildes, minúsculas)
        _STAGE_NAMES = ["lanzada", "recoleccion", "entrega", "dialogo", "decision"]
        event = LifecycleEvent(
            campaign_id=campaign.id,
            stage=_STAGE_NAMES[new_stage],
            stage_index=new_stage,
            notes=notes,
            registered_by=user_id,
        )
        campaign.lifecycle_stage = new_stage
        db.add(event)
        await db.commit()
        await db.refresh(event)
        await db.refresh(campaign)
        return event

    @staticmethod
    async def get_signer_emails_for_notify(
        db: AsyncSession,
        campaign_id: uuid.UUID,
    ) -> list[str]:
        result = await db.execute(
            select(Signature.id, Signature.email_encrypted)
            .join(Consent, Consent.signature_id == Signature.id)
            .where(
                Consent.campaign_id == campaign_id,
                Consent.notify_updates.is_(True),
                Signature.status == "confirmed",
                Signature.archived_at.is_(None),
            )
        )
        emails: list[str] = []
        for sig_id, enc in result.all():
            if not enc:
                continue
            try:
                emails.append(decrypt_pii(enc, ref=str(sig_id)))
            except PIIDecryptError:
                continue  # ya logueado en decrypt_pii; no aborta el envío al resto
        return emails

    @staticmethod
    async def _decrypt_confirmed_emails(db: AsyncSession, filters: list) -> list[str]:
        result = await db.execute(select(Signature.id, Signature.email_encrypted).where(*filters))
        emails: list[str] = []
        for sig_id, enc in result.all():
            if not enc:
                continue
            try:
                emails.append(decrypt_pii(enc, ref=str(sig_id)))
            except PIIDecryptError:
                continue  # ya logueado en decrypt_pii; no aborta el envío al resto
        return emails

    @staticmethod
    async def get_signer_emails_and_names_nacional_confirmed(
        db: AsyncSession,
        campaign_id: uuid.UUID,
    ) -> list[tuple[str, str]]:
        """(email, name) de firmas confirmed + país nulo (nacional) — para
        personalizar la invitación al evento. Sin filtro notify_updates —
        ver comunicaciones-cierre-campana/requirements.md (nunca se capturó)."""
        result = await db.execute(
            select(Signature.id, Signature.email_encrypted, Signature.name).where(
                Signature.campaign_id == campaign_id,
                Signature.status == "confirmed",
                Signature.country.is_(None),
            )
        )
        recipients: list[tuple[str, str]] = []
        for sig_id, enc, name in result.all():
            if not enc:
                continue
            try:
                email = decrypt_pii(enc, ref=str(sig_id))
            except PIIDecryptError:
                continue
            recipients.append((email, name or ""))
        return recipients

    @staticmethod
    async def get_signer_emails_nacional_confirmed(
        db: AsyncSession,
        campaign_id: uuid.UUID,
    ) -> list[str]:
        """Firmas confirmed + país nulo (nacional). Sin filtro notify_updates —
        ver comunicaciones-cierre-campana/requirements.md (nunca se capturó)."""
        recipients = await CampaignService.get_signer_emails_and_names_nacional_confirmed(db, campaign_id)
        return [email for email, _ in recipients]

    @staticmethod
    async def get_signer_emails_and_names_todos_confirmed(
        db: AsyncSession,
        campaign_id: uuid.UUID,
    ) -> list[tuple[str, str]]:
        """(email, name) de TODAS las firmas confirmed, nacional + internacional
        — para personalizar el aviso de cierre."""
        result = await db.execute(
            select(Signature.id, Signature.email_encrypted, Signature.name).where(
                Signature.campaign_id == campaign_id,
                Signature.status == "confirmed",
            )
        )
        recipients: list[tuple[str, str]] = []
        for sig_id, enc, name in result.all():
            if not enc:
                continue
            try:
                email = decrypt_pii(enc, ref=str(sig_id))
            except PIIDecryptError:
                continue
            recipients.append((email, name or ""))
        return recipients

    @staticmethod
    async def get_signer_emails_todos_confirmed(
        db: AsyncSession,
        campaign_id: uuid.UUID,
    ) -> list[str]:
        """Todas las firmas confirmed de la campaña, nacional + internacional."""
        recipients = await CampaignService.get_signer_emails_and_names_todos_confirmed(db, campaign_id)
        return [email for email, _ in recipients]

    @staticmethod
    async def get_qr(db: AsyncSession, campaign_id: str) -> dict:
        result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
        campaign = result.scalar_one()
        return {"slug": campaign.slug, "qr_code_data": campaign.qr_code_data}

    @staticmethod
    async def list_with_counts(db: AsyncSession, org_id: uuid.UUID | None) -> list[dict]:
        stmt = (
            select(Campaign, func.count(Signature.id).label("confirmed_signatures"))
            .outerjoin(Signature, and_(
                Signature.campaign_id == Campaign.id,
                Signature.status == "confirmed",
            ))
            .group_by(Campaign.id)
            .order_by(Campaign.created_at.desc())
        )
        if org_id is not None:
            stmt = stmt.where(Campaign.org_id == org_id)
        result = await db.execute(stmt)
        return [
            {
                "id": str(campaign.id),
                "title": campaign.title,
                "slug": campaign.slug,
                "status": campaign.status,
                "confirmed_signatures": confirmed_signatures,
                "goal_count": campaign.goal_count,
                "ends_at": campaign.ends_at.isoformat() if campaign.ends_at else None,
                "created_at": campaign.created_at.isoformat() if campaign.created_at else None,
            }
            for campaign, confirmed_signatures in result.all()
        ]

    @staticmethod
    async def get_dashboard_summary(db: AsyncSession, org_id: uuid.UUID | None) -> dict:
        # org_id None = admin de plataforma: métricas de todas las organizaciones
        sig_org = (Signature.org_id == org_id) if org_id is not None else true()
        camp_org = (Campaign.org_id == org_id) if org_id is not None else true()

        sig_result = await db.execute(
            select(func.count(Signature.id))
            .where(sig_org, Signature.status == "confirmed")
        )
        total_confirmed = sig_result.scalar_one()

        status_result = await db.execute(
            select(Campaign.status, func.count(Campaign.id))
            .where(camp_org, Campaign.archived_at.is_(None))
            .group_by(Campaign.status)
        )
        by_status = {row[0]: row[1] for row in status_result.all()}

        goal_result = await db.execute(
            select(func.sum(Campaign.goal_count))
            .where(camp_org, Campaign.status == "active")
        )
        total_goal = goal_result.scalar_one()

        recent_result = await db.execute(
            select(Campaign, func.count(Signature.id).label("confirmed_signatures"))
            .outerjoin(Signature, and_(
                Signature.campaign_id == Campaign.id,
                Signature.status == "confirmed",
            ))
            .where(camp_org)
            .group_by(Campaign.id)
            .order_by(Campaign.created_at.desc())
            .limit(5)
        )
        recent_campaigns = [
            {
                "id": str(campaign.id),
                "title": campaign.title,
                "slug": campaign.slug,
                "status": campaign.status,
                "confirmed_signatures": confirmed_signatures,
                "goal_count": campaign.goal_count,
                "ends_at": campaign.ends_at.isoformat() if campaign.ends_at else None,
            }
            for campaign, confirmed_signatures in recent_result.all()
        ]

        return {
            "total_confirmed_signatures": total_confirmed,
            "active_campaigns": by_status.get("active", 0),
            "draft_campaigns": by_status.get("draft", 0),
            "total_goal": int(total_goal) if total_goal else None,
            "recent_campaigns": recent_campaigns,
        }

    @staticmethod
    async def get_stats(db: AsyncSession, campaign_id: str) -> dict:
        total_result = await db.execute(
            select(func.count()).where(Response.campaign_id == campaign_id)
        )
        total_opened = total_result.scalar_one()

        completed_result = await db.execute(
            select(func.count()).where(Response.campaign_id == campaign_id, Response.status == "completed")
        )
        total_completed = completed_result.scalar_one()

        abandoned_result = await db.execute(
            select(func.count()).where(Response.campaign_id == campaign_id, Response.status == "abandoned")
        )
        total_abandoned = abandoned_result.scalar_one()

        completion_rate = (total_completed / total_opened * 100) if total_opened > 0 else 0

        avg_result = await db.execute(
            select(func.avg(Response.time_spent_seconds))
            .where(Response.campaign_id == campaign_id, Response.status == "completed")
        )
        avg_time = int(avg_result.scalar_one() or 0)

        platform_result = await db.execute(
            select(Response.platform_source, func.count(Response.id))
            .where(Response.campaign_id == campaign_id)
            .group_by(Response.platform_source)
        )
        responses_by_platform = {(row[0] or "unknown"): row[1] for row in platform_result.all()}

        time_result = await db.execute(
            select(func.date(Response.started_at), func.count(Response.id))
            .where(Response.campaign_id == campaign_id, Response.status == "completed")
            .group_by(func.date(Response.started_at))
            .order_by(func.date(Response.started_at))
        )
        responses_over_time = [{"date": str(row[0]), "count": row[1]} for row in time_result.all()]

        abandon_result = await db.execute(
            select(Response.current_question_idx, func.count(Response.id))
            .where(Response.campaign_id == campaign_id, Response.status == "abandoned")
            .group_by(Response.current_question_idx)
            .order_by(Response.current_question_idx)
        )
        abandonment_by_question = [{"question_index": row[0], "count": row[1]} for row in abandon_result.all()]

        return {
            "total_opened": total_opened,
            "total_completed": total_completed,
            "total_abandoned": total_abandoned,
            "completion_rate": round(completion_rate, 2),
            "avg_time_seconds": avg_time,
            "abandonment_by_question": abandonment_by_question,
            "responses_by_platform": responses_by_platform,
            "responses_over_time": responses_over_time,
        }
