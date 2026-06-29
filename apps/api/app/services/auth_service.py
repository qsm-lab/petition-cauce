import logging
import uuid
from datetime import datetime, timedelta, timezone

import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import bcrypt
from jose import jwt

from app.models.user import User
from app.models.login_audit import LoginAudit
from app.config import settings
from app.crypto import compute_hmac

logger = logging.getLogger(__name__)

_LOCKOUT_KEY = "forms:lockout:{}"
_ATTEMPTS_KEY = "forms:login_attempts:{}"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(data: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    return jwt.encode({**data, "exp": expire}, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


async def check_lockout(redis: aioredis.Redis, email_hmac: str) -> bool:
    return await redis.exists(_LOCKOUT_KEY.format(email_hmac)) == 1


async def record_failed_attempt(
    redis: aioredis.Redis,
    email_hmac: str,
    max_attempts: int,
    lockout_minutes: int,
) -> bool:
    """Incrementa el contador de fallos. Retorna True si se activa el lockout."""
    key = _ATTEMPTS_KEY.format(email_hmac)
    ttl_seconds = lockout_minutes * 60
    count = await redis.incr(key)
    await redis.expire(key, ttl_seconds)
    if count >= max_attempts:
        await redis.setex(_LOCKOUT_KEY.format(email_hmac), ttl_seconds, "1")
        return True
    return False


async def reset_attempts(redis: aioredis.Redis, email_hmac: str) -> None:
    await redis.delete(_ATTEMPTS_KEY.format(email_hmac))


async def write_audit_log(
    db: AsyncSession,
    email_hmac: str,
    ip_hmac: str,
    user_agent: str,
    result: str,
    user_id: uuid.UUID | None = None,
) -> None:
    try:
        entry = LoginAudit(
            email_hmac=email_hmac,
            ip_hmac=ip_hmac,
            user_agent=user_agent,
            result=result,
            user_id=user_id,
        )
        db.add(entry)
        await db.commit()
    except Exception:
        logger.error("Error al escribir audit log de login", exc_info=True)
        await db.rollback()


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        return None
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    return user
