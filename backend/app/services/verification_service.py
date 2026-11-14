from typing import Dict, Any
from uuid import UUID
import asyncpg
from app.db.pool import get_db_pool, is_db_pool_ready
from app.models.verification import VerificationCreate
from app.core.h3_utils import latlng_to_h3
from app.core.trust_math import (
    calculate_reporter_reputation,
    calculate_effective_vote_weight,
    calculate_incident_trust_score,
)
from app.services.memory_store import memory_cast_verification_vote


async def cast_verification_vote(
    incident_id: UUID,
    vote_in: VerificationCreate,
    reporter: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Submits a community verification (Confirm +1 or Dispute -1) for an incident.
    
    Directly powers Feature 1 (One-Tap Community Ping):
    - Calculates real geodetic distance between voter and incident.
    - Applies distance-decay and voter reputation to compute effective vote weight.
    - Recalculates incident Bayesian trust score.
    - Extends incident lifespan if confirmed.
    """
    if not is_db_pool_ready():
        return memory_cast_verification_vote(incident_id, vote_in, reporter)

    pool = await get_db_pool()
    reporter_id = reporter["id"]
    lat, lng = vote_in.latitude, vote_in.longitude
    voter_h3 = latlng_to_h3(lat, lng, resolution=8)

    voter_rep = calculate_reporter_reputation(
        reporter.get("reports_confirmed", 0),
        reporter.get("reports_disputed", 0)
    )

    async with pool.acquire() as conn:
        # 1. Fetch incident details and distance
        inc = await conn.fetchrow("""
            SELECT 
                i.id, i.trust_score, i.category_code, c.default_ttl,
                ST_Distance(i.exact_location, ST_MakePoint($1, $2)::geography) as distance_m
            FROM incidents i
            JOIN categories c ON i.category_code = c.code
            WHERE i.id = $3;
        """, lng, lat, incident_id)

        if not inc:
            raise ValueError("Incident not found")

        own_report = await conn.fetchval(
            "SELECT EXISTS (SELECT 1 FROM reports WHERE incident_id = $1 AND reporter_id = $2)",
            incident_id,
            reporter_id,
        )
        if own_report:
            raise ValueError("You cannot verify an incident you reported yourself")

        distance_m = int(inc["distance_m"])
        ttl = inc["default_ttl"]

        # 2. Compute effective weight
        weight = calculate_effective_vote_weight(distance_m, voter_rep)

        # 3. Upsert into verifications table
        await conn.execute("""
            INSERT INTO verifications (incident_id, reporter_id, vote, distance_m, voter_h3, weight, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, now())
            ON CONFLICT (incident_id, reporter_id)
            DO UPDATE SET 
                vote = EXCLUDED.vote,
                distance_m = EXCLUDED.distance_m,
                voter_h3 = EXCLUDED.voter_h3,
                weight = EXCLUDED.weight,
                updated_at = now();
        """, incident_id, reporter_id, vote_in.vote, distance_m, voter_h3, weight)

        # 4. Fetch all active votes to compute fresh Bayesian score
        vote_rows = await conn.fetch("""
            SELECT vote, weight FROM verifications WHERE incident_id = $1;
        """, incident_id)

        confirm_weights = [float(r["weight"]) for r in vote_rows if r["vote"] == 1]
        dispute_weights = [float(r["weight"]) for r in vote_rows if r["vote"] == -1]

        new_trust = calculate_incident_trust_score(
            prior_score=0.35,
            confirm_weights=confirm_weights,
            dispute_weights=dispute_weights
        )

        confirm_count = len(confirm_weights)
        dispute_count = len(dispute_weights)

        # 5. Update incident status and expiry
        # If vote is confirm (+1), extend TTL
        updated_incident = await conn.fetchrow("""
            UPDATE incidents
            SET trust_score = $1,
                confirm_count = $2,
                dispute_count = $3,
                last_activity_at = now(),
                expires_at = CASE WHEN $4 = 1 THEN now() + $5 ELSE expires_at END,
                status = CASE 
                    WHEN $1 >= 0.65 THEN 'active'
                    WHEN $1 < 0.20 AND $3 >= 3 THEN 'resolved'
                    ELSE status 
                END
            WHERE id = $6
            RETURNING id, status, trust_score, confirm_count, dispute_count, expires_at;
        """, new_trust, confirm_count, dispute_count, vote_in.vote, ttl, incident_id)

        return {
            "incident_id": incident_id,
            "vote": vote_in.vote,
            "weight": weight,
            "distance_m": distance_m,
            "new_trust_score": float(updated_incident["trust_score"]),
            "incident_status": updated_incident["status"],
            "confirm_count": int(updated_incident["confirm_count"]),
            "dispute_count": int(updated_incident["dispute_count"]),
        }
