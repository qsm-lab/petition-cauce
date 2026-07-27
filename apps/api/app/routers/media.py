import os
import re
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.config import settings

router = APIRouter()

# Nombre generado por save_comms_upload: <uuid4>.<ext> — cualquier otra forma
# se rechaza sin tocar el filesystem (evita path traversal vía el filename).
_FILENAME_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|gif|webp)$"
)
_CONTENT_TYPES = {"jpg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp"}


@router.get("/{org_id}/{campaign_id}/{filename}")
async def get_media(org_id: uuid.UUID, campaign_id: uuid.UUID, filename: str):
    """Sirve las imágenes del centro de comunicaciones (Fase 2, Opción A del
    design.md: FastAPI sirve el volumen directamente, sin tocar nginx).
    Público y sin auth a propósito — las imágenes se embeben en emails que se
    abren en cualquier cliente de correo, no en una sesión autenticada.
    org_id/campaign_id ya vienen validados como UUID por FastAPI; el filename
    se valida contra el patrón exacto que genera `save_comms_upload` (R19:
    nombre no adivinable, y acá además no explotable como traversal)."""
    if not _FILENAME_RE.match(filename):
        raise HTTPException(status_code=404)
    path = os.path.join(settings.uploads_dir, str(org_id), str(campaign_id), filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404)
    ext = filename.rsplit(".", 1)[1]
    return FileResponse(
        path,
        media_type=_CONTENT_TYPES[ext],
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
