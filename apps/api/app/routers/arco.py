from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.limiter import limiter
from app.schemas.arco import (
    ArcoAccessRequest,
    ArcoCampaignProfileRequest,
    ArcoConfirmRequest,
    ArcoDataResponse,
    ArcoDeleteRequest,
    ArcoGenericResponse,
    ArcoOpposeRequest,
    ArcoPersonalDataRequest,
    ArcoPersonalDataResponse,
    ArcoPortalSessionResponse,
    ArcoVerifyRequest,
    ArcoVisibilityRequest,
)
from app.services import arco_service
from app.services.turnstile_service import verify_turnstile

router = APIRouter()

_portal_bearer = HTTPBearer(auto_error=True)


async def get_arco_session(
    credentials: HTTPAuthorizationCredentials = Depends(_portal_bearer),
) -> dict:
    try:
        return arco_service.decode_portal_session(credentials.credentials)
    except ValueError:
        raise HTTPException(status_code=401, detail={"error": "sesion_invalida"})


@router.post("/request-access", response_model=ArcoGenericResponse)
@limiter.limit("3/hour")
async def request_access(
    request: Request,
    data: ArcoAccessRequest,
    db: AsyncSession = Depends(get_db),
):
    if not await verify_turnstile(data.cf_turnstile_token):
        raise HTTPException(status_code=422, detail={"error": "turnstile_failed"})
    await arco_service.request_access(db, data.email, data.cedula, data.origin_campaign_id)
    return ArcoGenericResponse()


@router.post("/verify", response_model=ArcoPortalSessionResponse)
@limiter.limit("10/hour")
async def verify(
    request: Request,
    data: ArcoVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    session = await arco_service.verify_token(db, data.token, data.origin_campaign_id)
    if session is None:
        raise HTTPException(status_code=401, detail={"error": "token_invalido_o_expirado"})
    portal_token, expires_at = session
    return ArcoPortalSessionResponse(portal_token=portal_token, expires_at=expires_at.isoformat())


@router.get("/data", response_model=ArcoDataResponse)
async def get_data(
    db: AsyncSession = Depends(get_db),
    session: dict = Depends(get_arco_session),
):
    try:
        data = await arco_service.get_subject_data(db, session)
    except ValueError:
        raise HTTPException(status_code=404, detail={"error": "no_encontrada"})
    return ArcoDataResponse(**data)


@router.patch("/personal-data", response_model=ArcoPersonalDataResponse)
async def personal_data(
    data: ArcoPersonalDataRequest,
    db: AsyncSession = Depends(get_db),
    session: dict = Depends(get_arco_session),
):
    try:
        result = await arco_service.rectify_personal_data(db, session, data)
    except ValueError as e:
        raise HTTPException(status_code=422, detail={"error": str(e)})
    conflicts = result["conflicts"]
    message = (
        "Tus datos personales fueron actualizados en todas tus campañas."
        if not conflicts
        else "Actualizamos tus datos donde fue posible — algunas campañas no se pudieron actualizar (ver detalle)."
    )
    return ArcoPersonalDataResponse(message=message, conflicts=conflicts)


@router.patch("/visibility", response_model=ArcoGenericResponse)
async def visibility(
    data: ArcoVisibilityRequest,
    db: AsyncSession = Depends(get_db),
    session: dict = Depends(get_arco_session),
):
    try:
        await arco_service.set_visibility(db, session, data.signature_id, data.visibility)
    except ValueError as e:
        raise HTTPException(status_code=422, detail={"error": str(e)})
    return ArcoGenericResponse(message="Visibilidad actualizada.")


@router.patch("/campaign-profile", response_model=ArcoGenericResponse)
async def campaign_profile(
    data: ArcoCampaignProfileRequest,
    db: AsyncSession = Depends(get_db),
    session: dict = Depends(get_arco_session),
):
    try:
        await arco_service.update_campaign_profile(db, session, data.signature_id, data)
    except ValueError as e:
        code = str(e)
        status_code = 409 if code == "perfil_no_editable" else 422
        raise HTTPException(status_code=status_code, detail={"error": code})
    return ArcoGenericResponse(message="Detalle de la firma actualizado.")


@router.patch("/oppose", response_model=ArcoGenericResponse)
async def oppose(
    data: ArcoOpposeRequest,
    db: AsyncSession = Depends(get_db),
    session: dict = Depends(get_arco_session),
):
    try:
        await arco_service.oppose(db, session, data.signature_id, data)
    except ValueError as e:
        raise HTTPException(status_code=422, detail={"error": str(e)})
    return ArcoGenericResponse(message="Tus preferencias fueron actualizadas.")


@router.post("/confirm", response_model=ArcoGenericResponse)
async def confirm(
    data: ArcoConfirmRequest,
    db: AsyncSession = Depends(get_db),
    session: dict = Depends(get_arco_session),
):
    try:
        await arco_service.confirm_pending(db, session, data.signature_id)
    except ValueError as e:
        code = str(e)
        status_code = 409 if code in ("ya_confirmada", "campana_cerrada") else 422
        raise HTTPException(status_code=status_code, detail={"error": code})
    return ArcoGenericResponse(message="Tu firma fue confirmada.")


@router.get("/export")
async def export_data(
    format: str = Query("json", pattern="^(json|csv)$"),
    db: AsyncSession = Depends(get_db),
    session: dict = Depends(get_arco_session),
):
    try:
        content, media_type, filename = await arco_service.export_data(db, session, format)
    except ValueError:
        raise HTTPException(status_code=404, detail={"error": "no_encontrada"})
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/subject", response_model=ArcoGenericResponse)
async def delete_subject(
    data: ArcoDeleteRequest,
    db: AsyncSession = Depends(get_db),
    session: dict = Depends(get_arco_session),
):
    try:
        await arco_service.delete_subject(db, session, data.signature_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail={"error": str(e)})
    return ArcoGenericResponse(message="Tus datos fueron eliminados definitivamente de esta campaña.")
