from typing import List, Optional
from fastapi import APIRouter, Header, Query, status
from app.models.hex_stats import HexRatingCreate, HexStatResponse
from app.services.reporter_service import get_or_create_reporter
from app.core.h3_utils import latlng_to_h3, get_h3_neighbors
from app.db.pool import get_db_pool, is_db_pool_ready
from app.services.memory_store import memory_list_hex_stats

router = APIRouter(prefix="/hex-stats", tags=["Area Intelligence & Ratings"])


@router.get("", response_model=List[HexStatResponse])
async def list_hex_stats(
    lat: Optional[float] = Query(None, ge=-90.0, le=90.0),
    lng: Optional[float] = Query(None, ge=-180.0, le=180.0),
    ring_k: int = Query(3, ge=1, le=6, description="H3 neighborhood radius around (lat, lng)"),
):
    """
    Returns H3 hexagon intelligence (ACLED/NEMA prior risk + resident ratings).
    If (lat, lng) is supplied, returns stats for nearby Resolution-8 hexagons
    plus any stored hexes in the database so the map renders an immediate H3 overlay.
    """
    if not is_db_pool_ready():
        return memory_list_hex_stats(lat, lng, ring_k)

    pool = await get_db_pool()
    async with pool.acquire() as conn:
        if lat is not None and lng is not None:
            center_hex = latlng_to_h3(lat, lng, resolution=8)
            nearby_hexes = get_h3_neighbors(center_hex, k=ring_k)
            rows = await conn.fetch("""
                SELECT h3_index, lga_name, state_name,
                       historical_security_risk, historical_flood_risk,
                       community_safety_score, community_power_score, community_livability_score,
                       active_incident_count, total_historical_reports, updated_at
                FROM hex_stats
                WHERE h3_index = ANY($1) OR active_incident_count > 0
                ORDER BY active_incident_count DESC, updated_at DESC
                LIMIT 200;
            """, nearby_hexes)
        else:
            rows = await conn.fetch("""
                SELECT h3_index, lga_name, state_name,
                       historical_security_risk, historical_flood_risk,
                       community_safety_score, community_power_score, community_livability_score,
                       active_incident_count, total_historical_reports, updated_at
                FROM hex_stats
                ORDER BY active_incident_count DESC, updated_at DESC
                LIMIT 200;
            """)
        return [dict(r) for r in rows]


@router.post("/{h3_index}/rate", response_model=HexStatResponse, status_code=status.HTTP_200_OK)
async def rate_area_hexagon(
    h3_index: str,
    rating_in: HexRatingCreate,
    x_reporter_token: str = Header(default="anonymous-dev-device", description="Device token of resident")
):
    """
    Core Feature 4: Area Ratings (Safety, Power Supply, Livability).
    One rating per device per H3 hexagon (UPSERT), then recomputes the hexagon's
    community averages in hex_stats.
    """
    reporter = await get_or_create_reporter(x_reporter_token)
    pool = await get_db_pool()

    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("""
                INSERT INTO hex_ratings (
                    h3_index, reporter_id, safety_rating, power_rating, livability_rating, comment, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, now())
                ON CONFLICT (h3_index, reporter_id)
                DO UPDATE SET
                    safety_rating = EXCLUDED.safety_rating,
                    power_rating = EXCLUDED.power_rating,
                    livability_rating = EXCLUDED.livability_rating,
                    comment = EXCLUDED.comment,
                    updated_at = now();
            """, h3_index, reporter["id"],
                 rating_in.safety_rating, rating_in.power_rating,
                 rating_in.livability_rating, rating_in.comment)

            avg_row = await conn.fetchrow("""
                SELECT 
                    ROUND(AVG(safety_rating)::numeric, 2) AS avg_safety,
                    ROUND(AVG(power_rating)::numeric, 2) AS avg_power,
                    ROUND(AVG(livability_rating)::numeric, 2) AS avg_livability
                FROM hex_ratings
                WHERE h3_index = $1;
            """, h3_index)

            stat_row = await conn.fetchrow("""
                INSERT INTO hex_stats (
                    h3_index, lga_name, state_name,
                    community_safety_score, community_power_score, community_livability_score,
                    updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, now())
                ON CONFLICT (h3_index)
                DO UPDATE SET
                    lga_name = COALESCE(EXCLUDED.lga_name, hex_stats.lga_name),
                    state_name = COALESCE(EXCLUDED.state_name, hex_stats.state_name),
                    community_safety_score = EXCLUDED.community_safety_score,
                    community_power_score = EXCLUDED.community_power_score,
                    community_livability_score = EXCLUDED.community_livability_score,
                    updated_at = now()
                RETURNING h3_index, lga_name, state_name,
                          historical_security_risk, historical_flood_risk,
                          community_safety_score, community_power_score, community_livability_score,
                          active_incident_count, total_historical_reports, updated_at;
            """, h3_index, rating_in.lga_name, rating_in.state_name,
                 avg_row["avg_safety"], avg_row["avg_power"], avg_row["avg_livability"])

            return dict(stat_row)
