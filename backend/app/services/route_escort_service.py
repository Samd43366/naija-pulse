from typing import List, Tuple, Dict, Any
from app.db.pool import get_db_pool, is_db_pool_ready
from app.core.h3_utils import route_to_h3_corridor
from app.services.memory_store import memory_check_route_safety


async def analyze_commute_route_safety(
    route_coords: List[Tuple[float, float]],
    buffer_ring: int = 1
) -> Dict[str, Any]:
    """
    Feature 2: Route Safety Escort (Commute Risk Advisor)
    
    Converts a planned commute polyline into an H3 hexagonal corridor,
    then intersects it against:
    1. Active live crowdsourced incidents (robbery, flood, power outage, road block).
    2. Historical ACLED / NEMA prior risk data stored in hex_stats.
    
    Produces a real-time safety score and actionable advisory before setting out.
    """
    if not is_db_pool_ready():
        return memory_check_route_safety(route_coords, buffer_ring)

    if not route_coords:
        return {
            "route_hexes": [],
            "overall_safety_rating": "CLEAR",
            "average_historical_risk": 0.0,
            "active_incidents_count": 0,
            "active_incidents": [],
            "safety_advisory": "No route points provided."
        }

    # 1. Generate H3 corridor array
    corridor_hexes = route_to_h3_corridor(
        route_coords,
        resolution=8,
        corridor_ring_buffer=buffer_ring
    )

    pool = await get_db_pool()

    async with pool.acquire() as conn:
        # 2. Query active incidents in any of the corridor hexes
        incident_rows = await conn.fetch("""
            SELECT 
                id, category_code, title, summary,
                h3_res7, h3_res8,
                ST_Y(public_location::geometry) as latitude,
                ST_X(public_location::geometry) as longitude,
                status, trust_score, report_count, confirm_count, dispute_count,
                first_reported_at, last_activity_at, expires_at, source
            FROM incidents
            WHERE h3_res8 = ANY($1)
              AND status IN ('unconfirmed', 'active')
              AND expires_at > now()
            ORDER BY trust_score DESC, last_activity_at DESC;
        """, corridor_hexes)

        active_incidents = [dict(r) for r in incident_rows]

        # 3. Query historical risk baseline from hex_stats
        stats_rows = await conn.fetch("""
            SELECT historical_security_risk, historical_flood_risk
            FROM hex_stats
            WHERE h3_index = ANY($1);
        """, corridor_hexes)

    # 4. Compute composite risk metrics
    sec_risks = [float(r["historical_security_risk"]) for r in stats_rows] if stats_rows else [0.1]
    avg_hist_risk = round(sum(sec_risks) / max(len(sec_risks), 1), 3)

    has_critical_security = any(
        inc["category_code"] == "kidnapping_security" and inc["trust_score"] >= 0.4
        for inc in active_incidents
    )
    has_severe_flood = any(
        inc["category_code"] == "flood" and inc["trust_score"] >= 0.5
        for inc in active_incidents
    )

    if has_critical_security:
        rating = "HIGH_ALERT"
        advisory = "CRITICAL: Active security/kidnapping incident reported along this corridor. Consider alternative routes or delaying travel."
    elif has_severe_flood:
        rating = "MODERATE_RISK"
        advisory = "CAUTION: Flooding reported along this route. Low-clearance vehicles should avoid."
    elif len(active_incidents) > 0:
        rating = "MODERATE_RISK"
        advisory = f"NOTICE: {len(active_incidents)} active incident(s) reported along your route (e.g. road hazards or traffic disruptions)."
    elif avg_hist_risk > 0.4:
        rating = "MODERATE_RISK"
        advisory = "This corridor has an elevated historical crime index in ACLED records. Exercise heightened vigilance after dark."
    else:
        rating = "CLEAR"
        advisory = "Route appears clear. No active hazards or elevated risks reported."

    return {
        "route_hexes": corridor_hexes,
        "overall_safety_rating": rating,
        "average_historical_risk": avg_hist_risk,
        "active_incidents_count": len(active_incidents),
        "active_incidents": active_incidents,
        "safety_advisory": advisory
    }
