from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime, timezone
import asyncpg
from app.db.pool import get_db_pool, is_db_pool_ready
from app.models.report import ReportCreate
from app.core.h3_utils import latlng_to_h3
from app.core.privacy import get_public_location
from app.core.trust_math import calculate_incident_trust_score, calculate_reporter_reputation
from app.services.alert_service import trigger_alerts_for_incident
from app.services.memory_store import (
    memory_create_or_merge_report,
    memory_list_active_incidents,
    memory_get_incident_with_reports,
)


async def create_or_merge_report(report_in: ReportCreate, reporter: Dict[str, Any]) -> Dict[str, Any]:
    """
    Core Incident Ingestion & Deduplication Pipeline:
    1. Look up category rules (TTL, dedup radius, sensitivity).
    2. Compute Uber H3 spatial indexes (Res 7, 8, 9).
    3. Check for existing active incident of same category within dedup radius.
    4. If found -> MERGE: Attach report, extend TTL, increment report count, update trust.
    5. If not found -> CREATE: New canonical incident, apply public coordinate blurring if sensitive.
    6. Fire alert triggers for matching user route / location monitors.
    """
    if not is_db_pool_ready():
        return memory_create_or_merge_report(report_in, reporter)

    pool = await get_db_pool()
    lat = report_in.latitude
    lng = report_in.longitude
    
    # 1. Compute H3 keys
    h3_7 = latlng_to_h3(lat, lng, resolution=7)
    h3_8 = latlng_to_h3(lat, lng, resolution=8)
    h3_9 = latlng_to_h3(lat, lng, resolution=9)
    
    reporter_id = reporter["id"]
    reporter_rep = calculate_reporter_reputation(
        reporter.get("reports_confirmed", 0),
        reporter.get("reports_disputed", 0)
    )

    async with pool.acquire() as conn:
        # Fetch category parameters
        cat_row = await conn.fetchrow("""
            SELECT code, name, default_ttl, dedup_radius_m, is_sensitive, blur_radius_m
            FROM categories WHERE code = $1;
        """, report_in.category_code)
        
        if not cat_row:
            raise ValueError(f"Invalid category code: {report_in.category_code}")
            
        dedup_radius = cat_row["dedup_radius_m"]
        ttl = cat_row["default_ttl"]
        is_sensitive = cat_row["is_sensitive"]

        # Deduplication query: look for an active, unexpired incident of same category nearby
        # Note: ST_MakePoint takes (longitude, latitude)
        existing_incident = await conn.fetchrow("""
            SELECT id, title, h3_res8, report_count, trust_score, status
            FROM incidents
            WHERE category_code = $1
              AND status IN ('unconfirmed', 'active')
              AND expires_at > now()
              AND ST_DWithin(exact_location, ST_MakePoint($2, $3)::geography, $4)
            ORDER BY ST_Distance(exact_location, ST_MakePoint($2, $3)::geography) ASC
            LIMIT 1;
        """, report_in.category_code, lng, lat, dedup_radius)

        if existing_incident:
            # --- MERGE INTO EXISTING INCIDENT ---
            incident_id = existing_incident["id"]
            
            # Insert individual citizen report
            report_row = await conn.fetchrow("""
                INSERT INTO reports (incident_id, reporter_id, h3_index, location, gps_accuracy_m, description, media_url, observed_at)
                VALUES ($1, $2, $3, ST_MakePoint($4, $5)::geography, $6, $7, $8, COALESCE($9, now()))
                RETURNING id, incident_id, h3_index, description, media_url, observed_at, created_at;
            """, incident_id, reporter_id, h3_8, lng, lat, report_in.gps_accuracy_m, report_in.description, report_in.media_url, report_in.observed_at)

            # Update parent incident
            updated_incident = await conn.fetchrow("""
                UPDATE incidents
                SET report_count = report_count + 1,
                    last_activity_at = now(),
                    expires_at = now() + $2,
                    trust_score = LEAST(1.0, trust_score + 0.100),
                    status = CASE WHEN (trust_score + 0.100) >= 0.65 THEN 'active' ELSE status END
                WHERE id = $1
                RETURNING id, category_code, title, summary, h3_res7, h3_res8, h3_res9,
                          ST_Y(public_location::geometry) as latitude,
                          ST_X(public_location::geometry) as longitude,
                          status, trust_score, report_count, confirm_count, dispute_count,
                          first_reported_at, last_activity_at, expires_at, source;
            """, incident_id, ttl)

            result_incident = dict(updated_incident)
        else:
            # --- CREATE NEW INCIDENT ---
            pub_lat, pub_lng = get_public_location(lat, lng, is_sensitive=is_sensitive)
            initial_trust = 0.35 if reporter_rep >= 0.5 else 0.20
            
            # Title: truncate description
            title = (report_in.description[:60] + "...") if len(report_in.description) > 60 else report_in.description

            new_incident = await conn.fetchrow("""
                INSERT INTO incidents (
                    category_code, title, summary,
                    h3_res7, h3_res8, h3_res9,
                    exact_location, public_location,
                    status, trust_score, report_count,
                    first_reported_at, last_activity_at, expires_at,
                    source
                )
                VALUES (
                    $1, $2, $3,
                    $4, $5, $6,
                    ST_MakePoint($7, $8)::geography, ST_MakePoint($9, $10)::geography,
                    'unconfirmed', $11, 1,
                    now(), now(), now() + $12,
                    'crowd'
                )
                RETURNING id, category_code, title, summary, h3_res7, h3_res8, h3_res9,
                          ST_Y(public_location::geometry) as latitude,
                          ST_X(public_location::geometry) as longitude,
                          status, trust_score, report_count, confirm_count, dispute_count,
                          first_reported_at, last_activity_at, expires_at, source;
            """, report_in.category_code, title, report_in.description,
                 h3_7, h3_8, h3_9,
                 lng, lat, pub_lng, pub_lat,
                 initial_trust, ttl)

            incident_id = new_incident["id"]

            # Insert first report
            report_row = await conn.fetchrow("""
                INSERT INTO reports (incident_id, reporter_id, h3_index, location, gps_accuracy_m, description, media_url, observed_at)
                VALUES ($1, $2, $3, ST_MakePoint($4, $5)::geography, $6, $7, $8, COALESCE($9, now()))
                RETURNING id, incident_id, h3_index, description, media_url, observed_at, created_at;
            """, incident_id, reporter_id, h3_8, lng, lat, report_in.gps_accuracy_m, report_in.description, report_in.media_url, report_in.observed_at)

            result_incident = dict(new_incident)

    # Trigger alerts for overlapping monitors (asynchronous background notification pattern)
    try:
        await trigger_alerts_for_incident(result_incident)
    except Exception as e:
        print(f"Warning: Failed to trigger alerts: {e}")

    return {
        "incident": result_incident,
        "report": dict(report_row)
    }


async def list_active_incidents(
    category_code: Optional[str] = None,
    h3_res7: Optional[str] = None,
    min_trust: float = 0.0,
    within_hours: Optional[int] = None,
    include_historical: bool = False,
) -> List[Dict[str, Any]]:
    """
    Returns public list of active, unexpired incidents for live map display.
    Supports filtering by category, H3 area, trust score, and recency (hours).
    """
    if not is_db_pool_ready():
        return memory_list_active_incidents(
            category_code=category_code,
            h3_res7=h3_res7,
            min_trust=min_trust,
            within_hours=within_hours,
            include_historical=include_historical,
        )

    pool = await get_db_pool()
    if include_historical:
        conditions = ["status IN ('unconfirmed', 'active', 'historical')", "trust_score >= $1"]
    else:
        conditions = ["status IN ('unconfirmed', 'active')", "expires_at > now()", "trust_score >= $1"]
    params: List[Any] = [min_trust]

    if category_code:
        params.append(category_code)
        conditions.append(f"category_code = ${len(params)}")

    if h3_res7:
        params.append(h3_res7)
        conditions.append(f"h3_res7 = ${len(params)}")

    if within_hours is not None and within_hours > 0:
        params.append(within_hours)
        conditions.append(f"last_activity_at >= now() - (${len(params)} * INTERVAL '1 hour')")

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT 
            id, category_code, title, summary,
            h3_res7, h3_res8,
            ST_Y(public_location::geometry) as latitude,
            ST_X(public_location::geometry) as longitude,
            status, trust_score, report_count, confirm_count, dispute_count,
            first_reported_at, last_activity_at, expires_at, source
        FROM incidents
        WHERE {where_clause}
        ORDER BY last_activity_at DESC
        LIMIT 200;
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return [dict(r) for r in rows]


async def get_incident_with_reports(incident_id: UUID) -> Optional[Dict[str, Any]]:
    """
    Fetches a single incident along with the citizen reports merged into it.
    Exact report coordinates are NEVER exposed; only H3 index, description, photo, and timestamps.
    """
    if not is_db_pool_ready():
        return memory_get_incident_with_reports(incident_id)

    pool = await get_db_pool()
    async with pool.acquire() as conn:
        inc_row = await conn.fetchrow("""
            SELECT 
                id, category_code, title, summary,
                h3_res7, h3_res8,
                ST_Y(public_location::geometry) as latitude,
                ST_X(public_location::geometry) as longitude,
                status, trust_score, report_count, confirm_count, dispute_count,
                first_reported_at, last_activity_at, expires_at, source
            FROM incidents
            WHERE id = $1;
        """, incident_id)

        if not inc_row:
            return None

        report_rows = await conn.fetch("""
            SELECT id, incident_id, h3_index, description, media_url, observed_at, created_at
            FROM reports
            WHERE incident_id = $1
            ORDER BY created_at DESC
            LIMIT 25;
        """, incident_id)

        result = dict(inc_row)
        result["reports"] = [dict(r) for r in report_rows]
        return result
