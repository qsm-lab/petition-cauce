from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.limiter import limiter
from app.services.domain_service import resolve_domain as _resolve

router = APIRouter()


@router.get("/resolve-domain")
@limiter.limit("60/minute")
async def resolve_domain(request: Request, host: str, db: AsyncSession = Depends(get_db)):
    result = await _resolve(db, host)
    if not result:
        raise HTTPException(status_code=404, detail="Dominio no registrado")
    return result
