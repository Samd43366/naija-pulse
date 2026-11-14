from functools import lru_cache
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    # Production must set LIVE_MODE=true. In that mode database failure is a
    # startup error and seed data is never presented as current information.
    LIVE_MODE: bool = False
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: str = "naija_pulse_dev_secret_key_2026_super_secure"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173"

    # Database (works with native Windows PostgreSQL or Docker)
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres_dev_password"
    POSTGRES_DB: str = "naija_pulse"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str = "postgresql://postgres:postgres_dev_password@localhost:5432/naija_pulse"

    # Uber H3 Spatial Resolution Configurations
    # Res 7: ~1.2km edge (LGA & Regional Risk Heatmaps)
    # Res 8: ~460m edge (Neighborhood Dedup & Community Verification)
    # Res 9: ~174m edge (Street / Junction Level)
    H3_CLUSTER_RESOLUTION: int = 8
    H3_AGGREGATE_RESOLUTION: int = 7

    # Optional Cloudinary Configuration
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Optional Gemini API Key (if provided, supercharges PulseAI RAG responses; works 100% keylessly without it)
    GEMINI_API_KEY: str = ""

    # Reads from root `.env` (naija-pulse/.env) OR `backend/.env` regardless of working directory
    model_config = SettingsConfigDict(
        env_file=(str(PROJECT_ROOT / ".env"), str(BACKEND_DIR / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
