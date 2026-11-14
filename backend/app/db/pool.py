import asyncpg
from typing import Optional
from app.config import get_settings

settings = get_settings()

_pool: Optional[asyncpg.Pool] = None


async def init_db_pool() -> asyncpg.Pool:
    """Initialize the global asyncpg connection pool."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            database=settings.POSTGRES_DB,
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
            min_size=2,
            max_size=10,
        )
    return _pool


async def get_db_pool() -> asyncpg.Pool:
    """Return the active database pool, initializing if necessary."""
    global _pool
    if _pool is None:
        return await init_db_pool()
    return _pool


def is_db_pool_ready() -> bool:
    """Return True if the PostgreSQL asyncpg pool is currently connected."""
    return _pool is not None


async def close_db_pool() -> None:
    """Gracefully close all connections in the pool."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
