from typing import Optional, Dict, Any
import asyncpg
from app.db.pool import get_db_pool, is_db_pool_ready
from app.services.memory_store import memory_get_or_create_reporter


async def get_or_create_reporter(device_token: str, display_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Zero-Friction Authentication (Ghost Profile):
    If the device_token exists, update last_seen_at and return the reporter.
    If it does not exist, silently register a new anonymous reporter profile.
    """
    if not is_db_pool_ready():
        return memory_get_or_create_reporter(device_token, display_name)

    pool = await get_db_pool()
    name_to_use = display_name if display_name else "Bystander"

    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO reporters (device_token, display_name, last_seen_at)
            VALUES ($1, $2, now())
            ON CONFLICT (device_token) 
            DO UPDATE SET last_seen_at = now()
            RETURNING id, device_token, display_name, role, reports_confirmed, reports_disputed, trust_points, is_banned;
        """, device_token, name_to_use)
        
        return dict(row)
