import os
import uuid
from pathlib import Path
from fastapi import APIRouter, File, UploadFile, HTTPException
from app.core.privacy import strip_image_exif
from app.config import get_settings

router = APIRouter(prefix="/media", tags=["Media & Privacy (Feature 5)"])

settings = get_settings()

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload")
async def upload_and_sanitize_image(file: UploadFile = File(...)):
    """
    Feature 5: Automatic Image Redaction & EXIF Stripper
    
    Receives citizen photo uploads, strips all EXIF metadata (GPS coordinates,
    camera make/model, timestamps) to protect reporter safety, and stores
    the sanitized image.
    """
    if file.content_type not in ["image/jpeg", "image/png", "image/webp", "image/jpg"]:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are supported")

    raw_bytes = await file.read()
    if len(raw_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image exceeds maximum 10MB limit")

    try:
        clean_bytes = strip_image_exif(raw_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image processing failed: {str(e)}")

    # Save to local uploads directory (can be backed by S3/Cloudinary in prod)
    ext = ".jpg" if "jpeg" in file.content_type or "jpg" in file.content_type else ".png"
    filename = f"{uuid.uuid4().hex}{ext}"
    target_path = UPLOADS_DIR / filename
    target_path.write_bytes(clean_bytes)

    media_url = f"/uploads/{filename}"

    return {
        "media_url": media_url,
        "filename": filename,
        "sanitized": True,
        "exif_stripped": True,
        "message": "Metadata and GPS tags successfully stripped for citizen privacy."
    }
