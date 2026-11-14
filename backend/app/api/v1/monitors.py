from typing import List
from uuid import UUID
from fastapi import APIRouter, Header, HTTPException, status
from app.models.monitor import (
    MonitorCreate,
    MonitorResponse,
    RouteSafetyCheckRequest,
    RouteSafetyCheckResponse,
)
from app.services.reporter_service import get_or_create_reporter
from app.services.route_escort_service import analyze_commute_route_safety
from app.core.h3_utils import latlng_to_h3, get_h3_neighbors, route_to_h3_corridor
from app.db.pool import get_db_pool, is_db_pool_ready
from app.services.memory_store import memory_create_monitor, memory_list_monitors

router = APIRouter(prefix="/monitors", tags=["Saved Locations & Route Watch"])


@router.post("", response_model=MonitorResponse, status_code=status.HTTP_201_CREATED)
async def create_location_or_route_monitor(
    monitor_in: MonitorCreate,
    x_reporter_token: str = Header(default="anonymous-dev-device", description="Device token of user")
):
    """
    Save personal watch locations (Home, Office, Child's School) OR Commute Corridors.
    Automatically calculates the covered H3 hex set so alert matching is instantaneous.
    """
    reporter = await get_or_create_reporter(x_reporter_token)
    reporter_id = reporter["id"]

    if not is_db_pool_ready():
        return memory_create_monitor(monitor_in, reporter_id)

    if monitor_in.monitor_type == "point":
        if monitor_in.latitude is None or monitor_in.longitude is None:
            raise HTTPException(status_code=400, detail="Latitude and longitude required for point monitors")
        
        center_hex = latlng_to_h3(monitor_in.latitude, monitor_in.longitude, resolution=8)
        # 1 ring = ~460m, 2 rings = ~1.2km
        ring_k = 2 if (monitor_in.radius_m or 1500) > 1000 else 1
        monitored_hexes = get_h3_neighbors(center_hex, k=ring_k)
        
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("""
                INSERT INTO monitors (
                    reporter_id, label, monitor_type, center_point, radius_m,
                    monitored_hexes, category_filter
                )
                VALUES (
                    $1, $2, 'point', ST_MakePoint($3, $4)::geography, $5,
                    $6, $7
                )
                RETURNING id, label, monitor_type, array_length(monitored_hexes, 1) as monitored_hex_count,
                          category_filter, is_active, created_at;
            """, reporter_id, monitor_in.label, monitor_in.longitude, monitor_in.latitude,
                 monitor_in.radius_m, monitored_hexes, monitor_in.category_filter)

            return dict(row)

    elif monitor_in.monitor_type == "corridor":
        if not monitor_in.route_coordinates or len(monitor_in.route_coordinates) < 2:
            raise HTTPException(status_code=400, detail="At least 2 route coordinates required for commute corridor")

        corridor_hexes = route_to_h3_corridor(
            monitor_in.route_coordinates,
            resolution=8,
            corridor_ring_buffer=monitor_in.corridor_ring_buffer or 1
        )

        pool = await get_db_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("""
                INSERT INTO monitors (
                    reporter_id, label, monitor_type,
                    monitored_hexes, category_filter
                )
                VALUES ($1, $2, 'corridor', $3, $4)
                RETURNING id, label, monitor_type, array_length(monitored_hexes, 1) as monitored_hex_count,
                          category_filter, is_active, created_at;
            """, reporter_id, monitor_in.label, corridor_hexes, monitor_in.category_filter)

            return dict(row)

    raise HTTPException(status_code=400, detail="Invalid monitor_type")


@router.post("/route-check", response_model=RouteSafetyCheckResponse)
async def check_route_safety_before_departure(
    check_in: RouteSafetyCheckRequest
):
    """
    Feature 2: Route Safety Escort (Commute Risk Advisor)
    Call this before driving or commuting. Analyzes all active incidents and
    historical ACLED hazard clusters along the planned route.
    """
    result = await analyze_commute_route_safety(
        check_in.route_coordinates,
        buffer_ring=check_in.buffer_ring
    )
    return result


@router.get("", response_model=List[MonitorResponse])
async def list_user_monitors(
    x_reporter_token: str = Header(default="anonymous-dev-device")
):
    reporter = await get_or_create_reporter(x_reporter_token)
    if not is_db_pool_ready():
        return memory_list_monitors(reporter["id"])

    pool = await get_db_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, label, monitor_type, array_length(monitored_hexes, 1) as monitored_hex_count,
                   category_filter, is_active, created_at
            FROM monitors
            WHERE reporter_id = $1
            ORDER BY created_at DESC;
        """, reporter["id"])
        return [dict(r) for r in rows]
