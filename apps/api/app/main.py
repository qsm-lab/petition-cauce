import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

logging.getLogger("app").setLevel(logging.INFO)
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.limiter import limiter
from app.redis_client import init_redis, close_redis
from app.routers import auth, forms, campaigns, public, dashboard, exports, domains
from app.routers import public_campaign
from app.routers import admin_signatures
from app.routers import categories, privacy_policies, organizaciones
from app.routers import admin_retention
from app.routers import arco
from app.routers import media
from app.scheduler import start_scheduler, shutdown_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_redis()
    start_scheduler()
    yield
    shutdown_scheduler()
    await close_redis()


app = FastAPI(
    title="QSM Forms API",
    version="1.0.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Cookie", "Authorization"],
)

app.include_router(auth.router, prefix="/v1/auth", tags=["auth"])
app.include_router(forms.router, prefix="/v1/forms", tags=["forms"])
app.include_router(campaigns.router, prefix="/v1/campaigns", tags=["campaigns"])
app.include_router(public.router, prefix="/v1/public", tags=["public"])
app.include_router(dashboard.router, prefix="/v1/dashboard", tags=["dashboard"])
app.include_router(exports.router, prefix="/v1/exports", tags=["exports"])
app.include_router(domains.router, prefix="/v1/domains", tags=["domains"])
app.include_router(public_campaign.router, prefix="/v1/public-campaign", tags=["public-campaign"])
app.include_router(admin_signatures.router, prefix="/v1/admin", tags=["admin"])
app.include_router(categories.router, prefix="/v1/admin", tags=["categories"])
app.include_router(privacy_policies.router, prefix="/v1/admin", tags=["privacy-policies"])
app.include_router(organizaciones.router, prefix="/v1/admin", tags=["organizaciones"])
app.include_router(admin_retention.router, prefix="/v1/admin", tags=["admin-retention"])
app.include_router(arco.router, prefix="/v1/arco", tags=["arco"])
app.include_router(media.router, prefix="/media", tags=["media"])


@app.get("/health", tags=["health"])
async def health_check():
    from app.database import check_db_health
    from app.config import settings
    import redis.asyncio as aioredis

    db_ok = await check_db_health()

    try:
        r = aioredis.from_url(settings.redis_url)
        await r.ping()
        await r.aclose()
        redis_ok = True
    except Exception:
        redis_ok = False

    status = "ok" if (db_ok and redis_ok) else "degraded"
    return {
        "status": status,
        "db": "ok" if db_ok else "error",
        "redis": "ok" if redis_ok else "error",
        "version": "1.0.0",
    }
