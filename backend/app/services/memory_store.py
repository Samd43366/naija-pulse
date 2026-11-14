"""
In-Memory Incident, Verification & Monitor Store for Naija Pulse.
Provides zero-configuration, lightning-fast fallback when native PostgreSQL / PostGIS
is not yet configured or when running in lightweight development / edge environments.
Hydrates all 836 nationwide seeded incidents across 36 states and the FCT.
"""

from datetime import datetime, timezone, timedelta
import json
import math
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import uuid
from uuid import UUID

from app.core.h3_utils import latlng_to_h3, get_h3_neighbors, route_to_h3_corridor
from app.core.privacy import get_public_location
from app.core.trust_math import (
    calculate_reporter_reputation,
    calculate_effective_vote_weight,
    calculate_incident_trust_score,
)
from app.models.report import ReportCreate
from app.models.verification import VerificationCreate

# Default categories and parameters
CATEGORY_CONFIG = {
    "power_outage": {"name": "Power Outage", "ttl_hours": 2.0, "dedup_m": 1500, "is_sensitive": False},
    "flood": {"name": "Flood & Drainage", "ttl_hours": 18.0, "dedup_m": 750, "is_sensitive": False},
    "kidnapping_security": {"name": "Kidnapping & Security", "ttl_hours": 8.0, "dedup_m": 500, "is_sensitive": True},
    "road_condition": {"name": "Road Hazard & Gully", "ttl_hours": 36.0, "dedup_m": 250, "is_sensitive": False},
    "disaster_fire": {"name": "Fire & Explosion", "ttl_hours": 5.0, "dedup_m": 400, "is_sensitive": False},
    "other": {"name": "Other Incident", "ttl_hours": 24.0, "dedup_m": 300, "is_sensitive": False},
}

_INITIALIZED = False
_INCIDENTS: Dict[str, Dict[str, Any]] = {}
_REPORTS: Dict[str, List[Dict[str, Any]]] = {}
_REPORTERS: Dict[str, Dict[str, Any]] = {}
_VERIFICATIONS: Dict[str, Dict[str, Dict[str, Any]]] = {}  # incident_id -> {reporter_id: vote_data}
_MONITORS: Dict[str, List[Dict[str, Any]]] = {}  # reporter_id -> [monitors]
_ALERTS: Dict[str, List[Dict[str, Any]]] = {}  # reporter_id -> [alerts]


def _haversine_distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculates great-circle distance between two points on Earth in meters."""
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def init_memory_store():
    """Initializes in-memory database with the nationwide seed dataset if not yet loaded."""
    global _INITIALIZED
    if _INITIALIZED:
        return
    _INITIALIZED = True

    candidates = [
        Path(__file__).resolve().parent.parent.parent / "data" / "nigeria_incidents_seed.json",
        Path(__file__).resolve().parent.parent.parent.parent / "frontend" / "public" / "geo" / "nigeria_incidents_seed.json",
    ]

    loaded_list: List[Dict[str, Any]] = []
    for cand in candidates:
        if cand.exists():
            try:
                with open(cand, "r", encoding="utf-8") as f:
                    loaded_list = json.load(f)
                    print(f"[Naija Pulse] In-memory store loaded {len(loaded_list)} nationwide seed incidents from {cand.name}")
                    break
            except Exception as e:
                print(f"[Naija Pulse] Could not load {cand}: {e}")

    now = datetime.now(timezone.utc)
    for idx, item in enumerate(loaded_list):
        # Generate stable UUID for seeded incidents
        inc_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, f"np-seed-{idx}-{item.get('title', '')}")
        inc_id_str = str(inc_uuid)

        lat = float(item.get("lat") or 9.082)
        lng = float(item.get("lng") or 8.6753)
        cat_code = item.get("category_code") or "other"
        hours_ago = float(item.get("hours_ago") or 1.5)
        ttl = float(item.get("ttl_hours") or 24.0)

        first_rep = now - timedelta(hours=hours_ago)
        expires = now + timedelta(hours=ttl)

        h3_7 = latlng_to_h3(lat, lng, resolution=7)
        h3_8 = latlng_to_h3(lat, lng, resolution=8)
        h3_9 = latlng_to_h3(lat, lng, resolution=9)

        record = {
            "id": inc_uuid,
            "category_code": cat_code,
            "title": item.get("title") or "Community Incident",
            "summary": item.get("summary") or "",
            "h3_res7": h3_7,
            "h3_res8": h3_8,
            "h3_res9": h3_9,
            "latitude": lat,
            "longitude": lng,
            "exact_lat": lat,
            "exact_lng": lng,
            "status": item.get("status") or "active",
            "trust_score": float(item.get("trust_score") or 0.8),
            "report_count": int(item.get("report_count") or 1),
            "confirm_count": int(item.get("confirm_count") or 1),
            "dispute_count": int(item.get("dispute_count") or 0),
            "first_reported_at": first_rep,
            "last_activity_at": first_rep,
            "expires_at": expires,
            "source": item.get("source") or "seed",
            "state_name": item.get("state_name") or "",
            "lga_name": item.get("lga_name") or "",
            "agency_status": item.get("agency_status") or "unassigned",
        }
        _INCIDENTS[inc_id_str] = record

        # Add initial witness note if present
        witness_notes = item.get("witness_notes") or []
        _REPORTS[inc_id_str] = [
            {
                "id": uuid.uuid4(),
                "incident_id": inc_uuid,
                "reporter_id": None,
                "h3_index": h3_8,
                "description": note,
                "media_url": None,
                "observed_at": first_rep,
                "created_at": first_rep,
            }
            for note in witness_notes
        ]


def memory_get_incidents_count() -> int:
    init_memory_store()
    return len(_INCIDENTS)


def memory_get_or_create_reporter(device_token: str, display_name: Optional[str] = None) -> Dict[str, Any]:
    init_memory_store()
    if device_token not in _REPORTERS:
        _REPORTERS[device_token] = {
            "id": uuid.uuid5(uuid.NAMESPACE_DNS, f"reporter-{device_token}"),
            "device_token": device_token,
            "display_name": display_name or "Bystander",
            "role": "citizen",
            "reports_confirmed": 2,
            "reports_disputed": 0,
            "trust_points": 10,
            "is_banned": False,
            "created_at": datetime.now(timezone.utc),
            "last_seen_at": datetime.now(timezone.utc),
        }
    else:
        _REPORTERS[device_token]["last_seen_at"] = datetime.now(timezone.utc)
    return _REPORTERS[device_token]


def memory_list_active_incidents(
    category_code: Optional[str] = None,
    h3_res7: Optional[str] = None,
    min_trust: float = 0.0,
    within_hours: Optional[int] = None,
    include_historical: bool = False,
) -> List[Dict[str, Any]]:
    init_memory_store()
    now = datetime.now(timezone.utc)
    results = []

    for inc in _INCIDENTS.values():
        # Status & expiry check
        if not include_historical:
            if inc["status"] not in ("unconfirmed", "active"):
                continue
            if inc["expires_at"] < now:
                continue

        # Trust score filter
        if inc["trust_score"] < min_trust:
            continue

        # Category filter
        if category_code and inc["category_code"] != category_code:
            continue

        # Macro H3 region filter
        if h3_res7 and inc["h3_res7"] != h3_res7:
            continue

        # Recency filter
        if within_hours and within_hours > 0:
            cutoff = now - timedelta(hours=within_hours)
            if inc["last_activity_at"] < cutoff:
                continue

        results.append(inc)

    # Sort newest first
    results.sort(key=lambda x: x["last_activity_at"], reverse=True)
    return results[:200]


def memory_get_incident_with_reports(incident_id: UUID) -> Optional[Dict[str, Any]]:
    init_memory_store()
    inc_str = str(incident_id)
    inc = _INCIDENTS.get(inc_str)
    if not inc:
        return None

    result = dict(inc)
    result["reports"] = _REPORTS.get(inc_str, [])
    return result


def memory_create_or_merge_report(report_in: ReportCreate, reporter: Dict[str, Any]) -> Dict[str, Any]:
    init_memory_store()
    lat = float(report_in.latitude)
    lng = float(report_in.longitude)
    cat_code = report_in.category_code
    now = datetime.now(timezone.utc)

    config = CATEGORY_CONFIG.get(cat_code, CATEGORY_CONFIG["other"])
    dedup_m = config["dedup_m"]
    ttl_hours = config["ttl_hours"]
    is_sensitive = config["is_sensitive"]

    h3_7 = latlng_to_h3(lat, lng, resolution=7)
    h3_8 = latlng_to_h3(lat, lng, resolution=8)
    h3_9 = latlng_to_h3(lat, lng, resolution=9)

    # Look for active incident within dedup radius
    merged_incident = None
    for inc in _INCIDENTS.values():
        if inc["category_code"] == cat_code and inc["status"] in ("unconfirmed", "active"):
            dist = _haversine_distance_m(lat, lng, inc["exact_lat"], inc["exact_lng"])
            if dist <= dedup_m:
                merged_incident = inc
                break

    if merged_incident:
        # Merge into existing incident
        inc_id_str = str(merged_incident["id"])
        merged_incident["report_count"] += 1
        merged_incident["last_activity_at"] = now
        merged_incident["expires_at"] = now + timedelta(hours=ttl_hours)
        merged_incident["trust_score"] = min(1.0, merged_incident["trust_score"] + 0.10)
        if merged_incident["trust_score"] >= 0.65:
            merged_incident["status"] = "active"

        report_rec = {
            "id": uuid.uuid4(),
            "incident_id": merged_incident["id"],
            "reporter_id": reporter["id"],
            "h3_index": h3_8,
            "description": report_in.description,
            "media_url": report_in.media_url,
            "observed_at": report_in.observed_at or now,
            "created_at": now,
        }
        _REPORTS.setdefault(inc_id_str, []).append(report_rec)
        return {"incident": merged_incident, "report": report_rec}
    else:
        # Create brand-new canonical incident
        new_id = uuid.uuid4()
        new_id_str = str(new_id)

        pub_lat, pub_lng = get_public_location(lat, lng, is_sensitive=is_sensitive)
        reporter_rep = calculate_reporter_reputation(
            reporter.get("reports_confirmed", 0),
            reporter.get("reports_disputed", 0)
        )
        initial_trust = 0.40 if reporter_rep >= 0.5 else 0.25

        title = report_in.description[:60] + "..." if len(report_in.description) > 60 else report_in.description

        new_inc = {
            "id": new_id,
            "category_code": cat_code,
            "title": title,
            "summary": report_in.description,
            "h3_res7": h3_7,
            "h3_res8": h3_8,
            "h3_res9": h3_9,
            "latitude": pub_lat,
            "longitude": pub_lng,
            "exact_lat": lat,
            "exact_lng": lng,
            "status": "unconfirmed",
            "trust_score": initial_trust,
            "report_count": 1,
            "confirm_count": 0,
            "dispute_count": 0,
            "first_reported_at": now,
            "last_activity_at": now,
            "expires_at": now + timedelta(hours=ttl_hours),
            "source": "crowd",
            "state_name": "",
            "lga_name": "",
            "agency_status": "unassigned",
        }
        _INCIDENTS[new_id_str] = new_inc

        report_rec = {
            "id": uuid.uuid4(),
            "incident_id": new_id,
            "reporter_id": reporter["id"],
            "h3_index": h3_8,
            "description": report_in.description,
            "media_url": report_in.media_url,
            "observed_at": report_in.observed_at or now,
            "created_at": now,
        }
        _REPORTS[new_id_str] = [report_rec]
        return {"incident": new_inc, "report": report_rec}


def memory_cast_verification_vote(
    incident_id: UUID,
    vote_in: VerificationCreate,
    reporter: Dict[str, Any]
) -> Dict[str, Any]:
    init_memory_store()
    inc_id_str = str(incident_id)
    inc = _INCIDENTS.get(inc_id_str)
    if not inc:
        raise ValueError("Incident not found")

    reporter_id = reporter["id"]
    if any(str(report.get("reporter_id")) == str(reporter_id) for report in _REPORTS.get(inc_id_str, [])):
        raise ValueError("You cannot verify an incident you reported yourself")

    lat, lng = float(vote_in.latitude), float(vote_in.longitude)
    dist_m = int(_haversine_distance_m(lat, lng, inc["exact_lat"], inc["exact_lng"]))

    rep_id_str = str(reporter_id)
    voter_rep = calculate_reporter_reputation(
        reporter.get("reports_confirmed", 0),
        reporter.get("reports_disputed", 0)
    )
    weight = calculate_effective_vote_weight(dist_m, voter_rep)

    inc_votes = _VERIFICATIONS.setdefault(inc_id_str, {})
    inc_votes[rep_id_str] = {
        "vote": vote_in.vote,
        "weight": weight,
        "distance_m": dist_m,
    }

    confirm_weights = [v["weight"] for v in inc_votes.values() if v["vote"] == 1]
    dispute_weights = [v["weight"] for v in inc_votes.values() if v["vote"] == -1]

    new_trust = calculate_incident_trust_score(
        prior_score=0.35,
        confirm_weights=confirm_weights,
        dispute_weights=dispute_weights,
    )

    now = datetime.now(timezone.utc)
    inc["trust_score"] = new_trust
    inc["confirm_count"] = len(confirm_weights)
    inc["dispute_count"] = len(dispute_weights)
    inc["last_activity_at"] = now

    if vote_in.vote == 1:
        config = CATEGORY_CONFIG.get(inc["category_code"], CATEGORY_CONFIG["other"])
        inc["expires_at"] = now + timedelta(hours=config["ttl_hours"])

    if new_trust >= 0.65:
        inc["status"] = "active"
    elif new_trust < 0.20 and inc["dispute_count"] >= 3:
        inc["status"] = "resolved"

    return {
        "incident_id": incident_id,
        "new_trust_score": new_trust,
        "confirm_count": inc["confirm_count"],
        "dispute_count": inc["dispute_count"],
        "voter_weight_applied": weight,
        "distance_meters": dist_m,
        "message": f"Verification vote recorded with weight {weight:.2f}",
    }


def memory_list_hex_stats(lat: Optional[float] = None, lng: Optional[float] = None, ring_k: int = 3) -> List[Dict[str, Any]]:
    init_memory_store()
    now = datetime.now(timezone.utc)

    # Aggregate active incidents by h3_res8
    hex_map: Dict[str, Dict[str, Any]] = {}
    target_hexes = set()
    if lat is not None and lng is not None:
        center_hex = latlng_to_h3(lat, lng, resolution=8)
        target_hexes = set(get_h3_neighbors(center_hex, k=ring_k))

    for inc in _INCIDENTS.values():
        if inc["status"] not in ("unconfirmed", "active"):
            continue
        h8 = inc["h3_res8"]
        if target_hexes and h8 not in target_hexes:
            continue

        if h8 not in hex_map:
            hex_map[h8] = {
                "h3_index": h8,
                "lga_name": inc.get("lga_name") or "Local Area",
                "state_name": inc.get("state_name") or "Nigeria",
                "historical_security_risk": 0.25,
                "historical_flood_risk": 0.20,
                "community_safety_score": 0.80,
                "community_power_score": 0.70,
                "community_livability_score": 0.75,
                "active_incident_count": 0,
                "total_historical_reports": 1,
                "updated_at": inc["last_activity_at"],
            }
        hex_map[h8]["active_incident_count"] += 1
        if inc["category_code"] == "kidnapping_security":
            hex_map[h8]["historical_security_risk"] = max(hex_map[h8]["historical_security_risk"], 0.65)
        elif inc["category_code"] == "flood":
            hex_map[h8]["historical_flood_risk"] = max(hex_map[h8]["historical_flood_risk"], 0.60)

    return list(hex_map.values())[:200]


def memory_create_monitor(monitor_in: Any, reporter_id: UUID) -> Dict[str, Any]:
    init_memory_store()
    rep_key = str(reporter_id)
    mon_id = uuid.uuid4()
    center_hex = None
    monitored_hexes = []

    if monitor_in.monitor_type == "point" and monitor_in.latitude is not None and monitor_in.longitude is not None:
        center_hex = latlng_to_h3(monitor_in.latitude, monitor_in.longitude, resolution=8)
        ring_k = 2 if (monitor_in.radius_m or 1500) > 1000 else 1
        monitored_hexes = get_h3_neighbors(center_hex, k=ring_k)
    elif monitor_in.monitor_type == "route" and monitor_in.route_coordinates:
        coords = [(c[0], c[1]) for c in monitor_in.route_coordinates]
        monitored_hexes = route_to_h3_corridor(coords, resolution=8, corridor_ring_buffer=1)

    rec = {
        "id": mon_id,
        "label": monitor_in.label,
        "monitor_type": monitor_in.monitor_type,
        "monitored_hex_count": len(monitored_hexes),
        "category_filter": monitor_in.category_filter,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "monitored_hexes": monitored_hexes,
    }
    _MONITORS.setdefault(rep_key, []).append(rec)
    return rec


def memory_list_monitors(reporter_id: UUID) -> List[Dict[str, Any]]:
    init_memory_store()
    rep_key = str(reporter_id)
    return _MONITORS.get(rep_key, [])


def memory_list_alerts(reporter_id: UUID) -> Dict[str, Any]:
    init_memory_store()
    rep_key = str(reporter_id)
    alerts = _ALERTS.get(rep_key, [])
    unread = sum(1 for a in alerts if not a.get("is_read"))
    return {"alerts": alerts, "unread_count": unread}


def memory_check_route_safety(route_coords: List[Tuple[float, float]], buffer_ring: int = 1) -> Dict[str, Any]:
    init_memory_store()
    if not route_coords:
        return {
            "route_hexes": [],
            "overall_safety_rating": "CLEAR",
            "average_historical_risk": 0.0,
            "active_incidents_count": 0,
            "active_incidents": [],
            "safety_advisory": "No route points provided.",
        }

    corridor_hexes = set(route_to_h3_corridor(route_coords, resolution=8, corridor_ring_buffer=buffer_ring))
    matched_incidents = []

    for inc in _INCIDENTS.values():
        if inc["status"] in ("unconfirmed", "active") and inc["h3_res8"] in corridor_hexes:
            matched_incidents.append(inc)

    matched_incidents.sort(key=lambda x: x["trust_score"], reverse=True)

    has_kidnap = any(i["category_code"] == "kidnapping_security" for i in matched_incidents)
    has_flood = any(i["category_code"] == "flood" for i in matched_incidents)
    has_road = any(i["category_code"] == "road_condition" for i in matched_incidents)

    if has_kidnap:
        rating = "CRITICAL_AVOID"
        advisory = "Security warnings detected along this highway corridor. Military checkpoints or escort advised."
    elif len(matched_incidents) >= 4 or has_flood:
        rating = "CAUTION"
        advisory = "Multiple active incident reports (road hazard or flood) recorded along this route."
    elif matched_incidents:
        rating = "MONITOR"
        advisory = "Minor reports logged along route corridor. Drive with standard awareness."
    else:
        rating = "CLEAR"
        advisory = "No active hazard reports detected along this travel corridor. Safe commute!"

    return {
        "route_hexes": list(corridor_hexes)[:150],
        "overall_safety_rating": rating,
        "average_historical_risk": 0.22,
        "active_incidents_count": len(matched_incidents),
        "active_incidents": matched_incidents[:15],
        "safety_advisory": advisory,
    }
