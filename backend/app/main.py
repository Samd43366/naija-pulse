from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db.pool import init_db_pool, close_db_pool, is_db_pool_ready
from app.api.v1.incidents import router as incidents_router
from app.api.v1.monitors import router as monitors_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.webhooks import router as webhooks_router
from app.api.v1.media import router as media_router
from app.api.v1.hex_stats import router as hex_stats_router
from app.api.v1.chat import router as chat_router
from app.api.v1.news import router as news_router

settings = get_settings()

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager: initializes database pool on startup and cleans up on shutdown."""
    print("Initializing Naija Pulse database connection pool...")
    try:
        await init_db_pool()
        print("Database connection pool established successfully.")
    except Exception as e:
        print(f"Notice: PostgreSQL pool unavailable ({e}). Running in JSON Seed + PulseAI Live Mode.")

    yield

    print("Closing database connection pool...")
    await close_db_pool()


app = FastAPI(
    title="Naija Pulse API",
    description="Real-Time Crowdsourced Community Reporting, Agency Command & PulseAI Intelligence for Nigeria",
    version="1.1.0",
    lifespan=lifespan,
)

# Allow both localhost and LAN hotspot phone origins cleanly
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.include_router(incidents_router, prefix=settings.API_V1_PREFIX)
app.include_router(monitors_router, prefix=settings.API_V1_PREFIX)
app.include_router(alerts_router, prefix=settings.API_V1_PREFIX)
app.include_router(webhooks_router, prefix=settings.API_V1_PREFIX)
app.include_router(media_router, prefix=settings.API_V1_PREFIX)
app.include_router(hex_stats_router, prefix=settings.API_V1_PREFIX)
app.include_router(chat_router, prefix=settings.API_V1_PREFIX)
app.include_router(news_router, prefix=settings.API_V1_PREFIX)


from app.services.memory_store import memory_get_incidents_count

@app.get("/health", tags=["Health"])
async def health_check():
    db_ok = is_db_pool_ready()
    return {
        "status": "online",
        "db_connected": db_ok,
        "storage": "postgres" if db_ok else "in_memory_seed",
        "platform": "Naija Pulse",
        "environment": settings.ENVIRONMENT,
        "h3_cluster_res": settings.H3_CLUSTER_RESOLUTION,
        "incidents_count": memory_get_incidents_count() if not db_ok else "postgres_live",
    }


@app.get("/", tags=["Health"])
async def root():
    return {
        "project": "Naija Pulse",
        "description": "Crowdsourced Real-Time Community Reporting, Agency HQ & PulseAI for Nigeria",
        "docs_url": "/docs",
    }
