from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user
from app.limiter import limiter
from app.redis_client import get_redis
from app.schemas.auth import LoginRequest, UserResponse
from app.crypto import compute_hmac
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    check_lockout,
    record_failed_attempt,
    reset_attempts,
    write_audit_log,
)
from app.config import settings
from app.models.user import User

router = APIRouter()


@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, data: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    ip = request.headers.get("X-Real-IP") or request.client.host
    user_agent = (request.headers.get("User-Agent") or "")[:512]
    hmac_email = compute_hmac(data.email)
    hmac_ip = compute_hmac(ip)
    redis = get_redis()

    if await check_lockout(redis, hmac_email):
        await write_audit_log(db, hmac_email, hmac_ip, user_agent, "locked")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cuenta bloqueada por demasiados intentos fallidos. Intente nuevamente en {settings.login_lockout_minutes} minutos.",
        )

    user = await authenticate_user(db, data.email, data.password)
    if not user:
        await record_failed_attempt(redis, hmac_email, settings.login_max_attempts, settings.login_lockout_minutes)
        await write_audit_log(db, hmac_email, hmac_ip, user_agent, "failure")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas")

    await reset_attempts(redis, hmac_email)
    await write_audit_log(db, hmac_email, hmac_ip, user_agent, "success", user_id=user.id)

    token = create_access_token({"sub": str(user.id)})
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        max_age=settings.jwt_access_token_expire_minutes * 60,
    )
    return UserResponse.model_validate(user)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"ok": True}


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user
