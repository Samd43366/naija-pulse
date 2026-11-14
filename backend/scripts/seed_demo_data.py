"""
Seeds researched Nigerian news & agency incidents into PostgreSQL + PostGIS:
1. Reads all researched & RSS-ingested incidents from `frontend/src/data/researchedNewsSeed.json`.
2. Computes Uber H3 (Res 7, 8, 9) and applies privacy blurring for `kidnapping_security`.
3. Idempotently upserts into `incidents`, `reports`, and `hex_stats` (Bayesian priors + LGA/State metadata).
"""

import asyncio
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
import asyncpg
from app.config import PROJECT_ROOT, get_settings
from app.core.h3_utils import latlng_to_h3
from app.core.privacy import get_public_location

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

settings = get_settings()
SEED_JSON = PROJECT_ROOT / "frontend" / "public" / "geo" / "nigeria_incidents_seed.json"


async def seed_data():
    if not SEED_JSON.exists():
        raise FileNotFoundError(f"Missing news seed file: {SEED_JSON}")

    incidents_seed = json.loads(SEED_JSON.read_text(encoding="utf-8"))
    print(f"Connecting to PostgreSQL ({settings.POSTGRES_DB}) to seed {len(incidents_seed)} Nigerian news incidents...")

    conn = await asyncpg.connect(
        user=settings.POSTGRES_USER,
        password=settings.POSTGRES_PASSWORD,
        database=settings.POSTGRES_DB,
        host=settings.POSTGRES_HOST,
        port=settings.POSTGRES_PORT,
    )

    try:
        now = datetime.now(timezone.utc)

        reporter_row = await conn.fetchrow(
            """
            INSERT INTO reporters (device_token, display_name, role, reports_confirmed, trust_points)
            VALUES ($1, 'Naija Pulse News & OSINT Desk', 'verified_citizen', 32, 95)
            ON CONFLICT (device_token) DO UPDATE SET last_seen_at = now()
            RETURNING id;
            """,
            "naija_pulse_news_desk_001",
        )
        reporter_id = reporter_row["id"]
        print(f"  [✓] Verified news desk reporter ready (ID: {reporter_id})")

        for inc in incidents_seed:
            lat = float(inc["lat"])
            lng = float(inc["lng"])
            cat = inc["category_code"]
            h3_7 = latlng_to_h3(lat, lng, resolution=7)
            h3_8 = latlng_to_h3(lat, lng, resolution=8)
            h3_9 = latlng_to_h3(lat, lng, resolution=9)

            is_sensitive = cat == "kidnapping_security"
            pub_lat, pub_lng = get_public_location(lat, lng, is_sensitive=is_sensitive)

            first_seen = now - timedelta(hours=float(inc.get("hours_ago", 1.5)))
            expires_at = now + timedelta(hours=float(inc.get("ttl_hours", 12.0)))

            inc_row = await conn.fetchrow(
                """
                INSERT INTO incidents (
                    category_code, title, summary,
                    h3_res7, h3_res8, h3_res9,
                    exact_location, public_location,
                    status, trust_score, report_count, confirm_count, dispute_count,
                    first_reported_at, last_activity_at, expires_at, source, external_id
                )
                VALUES (
                    $1, $2, $3,
                    $4, $5, $6,
                    ST_MakePoint($7, $8)::geography, ST_MakePoint($9, $10)::geography,
                    $11, $12, $13, $14, $15,
                    $16, $16, $17, $18, $19
                )
                ON CONFLICT (external_id) DO UPDATE SET
                    title = EXCLUDED.title,
                    summary = EXCLUDED.summary,
                    trust_score = EXCLUDED.trust_score,
                    status = EXCLUDED.status,
                    last_activity_at = EXCLUDED.last_activity_at,
                    expires_at = EXCLUDED.expires_at
                RETURNING id;
                """,
                cat,
                inc["title"],
                inc["summary"],
                h3_7,
                h3_8,
                h3_9,
                lng,
                lat,
                pub_lng,
                pub_lat,
                inc.get("status", "active"),
                float(inc.get("trust_score", 0.85)),
                int(inc.get("report_count", 3)),
                int(inc.get("confirm_count", 2)),
                int(inc.get("dispute_count", 0)),
                first_seen,
                expires_at,
                inc.get("source", "official"),
                inc["external_id"],
            )
            incident_id = inc_row["id"]

            # Seed witness / news notes if not already present for this incident
            existing_reports = await conn.fetchval(
                "SELECT count(*) FROM reports WHERE incident_id = $1;", incident_id
            )
            if existing_reports == 0:
                notes = inc.get("witness_notes") or [inc["summary"]]
                for idx, note in enumerate(notes):
                    await conn.execute(
                        """
                        INSERT INTO reports (incident_id, reporter_id, h3_index, location, description, observed_at)
                        VALUES ($1, $2, $3, ST_MakePoint($4, $5)::geography, $6, $7);
                        """,
                        incident_id,
                        reporter_id,
                        h3_8,
                        lng,
                        lat,
                        note,
                        first_seen + timedelta(minutes=idx * 12),
                    )

            sec_risk = 0.72 if is_sensitive else (0.35 if cat == "disaster_fire" else 0.16)
            flood_risk = 0.78 if cat == "flood" else 0.18
            safety_score = 2.0 if is_sensitive else (2.7 if cat == "disaster_fire" else 3.8)
            power_score = 1.9 if cat == "power_outage" else 3.4

            await conn.execute(
                """
                INSERT INTO hex_stats (
                    h3_index, lga_name, state_name,
                    historical_security_risk, historical_flood_risk,
                    community_safety_score, community_power_score, community_livability_score,
                    active_incident_count, total_historical_reports
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, 3.6, 1, $8)
                ON CONFLICT (h3_index) DO UPDATE SET
                    lga_name = COALESCE(EXCLUDED.lga_name, hex_stats.lga_name),
                    state_name = COALESCE(EXCLUDED.state_name, hex_stats.state_name),
                    historical_security_risk = GREATEST(hex_stats.historical_security_risk, EXCLUDED.historical_security_risk),
                    historical_flood_risk = GREATEST(hex_stats.historical_flood_risk, EXCLUDED.historical_flood_risk),
                    updated_at = now();
                """,
                h3_8,
                inc.get("lga_name", "Nigeria"),
                inc.get("state_name", "Nigeria"),
                sec_risk,
                flood_risk,
                safety_score,
                power_score,
                int(inc.get("report_count", 5)) + 6,
            )

            print(f"  [✓] Seeded [{cat}] {inc['title'][:58]}... ({inc.get('state_name')})")

        print(f"\n[✓] Successfully seeded {len(incidents_seed)} Nigerian news incidents into PostGIS!")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed_data())
