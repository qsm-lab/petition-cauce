from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_admin
from app.limiter import limiter
from app.models.user import User
from app.scheduler import acquire_retention_lock, release_retention_lock
from app.services.retention_service import run_retention

router = APIRouter()


@router.post("/retention/run")
@limiter.limit("10/minute")
async def run_retention_manual(
    request: Request,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Corrida bajo demanda del job de retención, para pruebas o ejecución manual (R9)."""
    token = await acquire_retention_lock()
    if token is None:
        raise HTTPException(status_code=409, detail="Ya hay una corrida de retención en curso")
    try:
        run = await run_retention(db, trigger="manual")
    finally:
        await release_retention_lock(token)

    return {
        "id": str(run.id),
        "started_at": run.started_at.isoformat(),
        "finished_at": run.finished_at.isoformat() if run.finished_at else None,
        "trigger": run.trigger,
        "campaigns_evaluated": run.campaigns_evaluated,
        "signatures_anonymized": run.signatures_anonymized,
        "detail": run.detail,
    }
