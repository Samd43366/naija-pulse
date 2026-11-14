from uuid import UUID
from typing import Dict, Any, List
from app.db.pool import get_db_pool, is_db_pool_ready


async def trigger_alerts_for_incident(incident: Dict[str, Any]) -> int:
    """
    Sub-millisecond alert matching using H3 GIN array queries.
    
    Concept:
    Instead of running expensive ST_DWithin on every single saved location,
    we do an array containment check:
    WHERE monitored_hexes @> ARRAY[incident_h3_res8]
    """
    if not is_db_pool_ready():
        return 0

    pool = await get_db_pool()
    h3_res8 = incident["h3_res8"]
    category_code = incident["category_code"]
    title = incident["title"]
    incident_id = incident["id"]

    query = """
        INSERT INTO alerts (reporter_id, monitor_id, incident_id, title, message)
        SELECT 
            m.reporter_id, 
            m.id, 
            $1, 
            $2, 
            'Incident reported in your monitored zone: ' || $3
        FROM monitors m
        WHERE m.is_active = TRUE
          AND m.monitored_hexes @> ARRAY[$4]
          AND (m.category_filter IS NULL OR $5 = ANY(m.category_filter))
        ON CONFLICT (monitor_id, incident_id) DO NOTHING
        RETURNING id;
    """
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, incident_id, f"Alert: {title}", title, h3_res8, category_code)
        return len(rows)


async def get_reporter_alerts(reporter_id: UUID) -> List[Dict[str, Any]]:
    if not is_db_pool_ready():
        return []

    pool = await get_db_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                a.id, a.title, a.message, a.created_at, a.read_at,
                i.id as incident_id, i.category_code, i.trust_score, i.status
            FROM alerts a
            JOIN incidents i ON a.incident_id = i.id
            WHERE a.reporter_id = $1
            ORDER BY a.created_at DESC
            LIMIT 50;
        """, reporter_id)
        return [dict(r) for r in rows]
