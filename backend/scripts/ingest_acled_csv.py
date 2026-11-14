"""
ACLED Conflict & Kidnapping CSV Ingestion Pipeline -> H3 Bayesian Priors.

Concept:
ACLED (Armed Conflict Location & Event Data) publishes CSV rows with columns:
  event_id_cnty, event_date, event_type, sub_event_type, admin1 (state),
  admin2 (LGA), latitude, longitude, notes

Instead of treating historical ACLED records as 'live' markers, we:
1. Map each row's (latitude, longitude) to its Uber H3 Resolution-8 hexagon.
2. Count events per hexagon and normalize with a saturation curve:
       prior_risk = 1 - exp(-count / 5.0)
   so 0 events -> 0.10 baseline, 3 events -> ~0.45, 10+ events -> ~0.86+.
3. Upsert `historical_security_risk` into `hex_stats` (our Bayesian prior P0)
   and optionally insert recent rows as `status = 'historical'` in `incidents`.

Usage:
  python -m scripts.ingest_acled_csv ../data/acled_nigeria.csv
  python -m scripts.ingest_acled_csv --sample   # generates & ingests a sample CSV
"""

import argparse
import asyncio
import csv
import math
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import asyncpg
from app.config import get_settings
from app.core.h3_utils import latlng_to_h3
from app.core.privacy import get_public_location

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

settings = get_settings()

SAMPLE_ACLED_ROWS = [
    ("NGA-90001", "2026-09-14", "Violence against civilians", "Abduction/forced disappearance", "Kaduna", "Kachia", "9.8732", "7.4321", "Armed group intercepted motorists near Katari corridor."),
    ("NGA-90002", "2026-08-22", "Violence against civilians", "Abduction/forced disappearance", "Kaduna", "Chikun", "9.8760", "7.4305", "Highway ambush reported along Kaduna-Abuja road."),
    ("NGA-90003", "2026-07-09", "Battles", "Armed clash", "Kaduna", "Kachia", "9.8710", "7.4340", "Security patrol engaged armed bandits near highway."),
    ("NGA-90004", "2026-09-30", "Riots", "Mob violence", "Lagos", "Ikeja", "6.5954", "3.3431", "Localized clash near Computer Village axis dispersed by police."),
    ("NGA-90005", "2026-10-02", "Violence against civilians", "Attack", "Rivers", "Port Harcourt", "4.8156", "7.0498", "Cult-related incident reported in Diobu neighborhood."),
]


def write_sample_csv(csv_path: Path) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "event_id_cnty", "event_date", "event_type", "sub_event_type",
            "admin1", "admin2", "latitude", "longitude", "notes"
        ])
        writer.writerows(SAMPLE_ACLED_ROWS)
    print(f"  [✓] Wrote sample ACLED CSV to {csv_path}")


async def ingest_acled(csv_path: Path) -> None:
    hex_counts = defaultdict(int)
    hex_meta = {}
    parsed_rows = []

    with csv_path.open("r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            lat = float(row["latitude"])
            lng = float(row["longitude"])
            h3_8 = latlng_to_h3(lat, lng, resolution=8)
            hex_counts[h3_8] += 1
            hex_meta[h3_8] = (row.get("admin2") or None, row.get("admin1") or None)
            parsed_rows.append((row, lat, lng, h3_8))

    conn = await asyncpg.connect(
        user=settings.POSTGRES_USER,
        password=settings.POSTGRES_PASSWORD,
        database=settings.POSTGRES_DB,
        host=settings.POSTGRES_HOST,
        port=settings.POSTGRES_PORT,
    )
    try:
        async with conn.transaction():
            for h3_8, count in hex_counts.items():
                # Smooth exponential saturation curve in [0.15, 0.95]
                prior = round(min(0.95, max(0.15, 1.0 - math.exp(-count / 4.0))), 3)
                lga, state = hex_meta[h3_8]
                await conn.execute("""
                    INSERT INTO hex_stats (
                        h3_index, lga_name, state_name, historical_security_risk, total_historical_reports, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, now())
                    ON CONFLICT (h3_index) DO UPDATE SET
                        lga_name = COALESCE(EXCLUDED.lga_name, hex_stats.lga_name),
                        state_name = COALESCE(EXCLUDED.state_name, hex_stats.state_name),
                        historical_security_risk = EXCLUDED.historical_security_risk,
                        total_historical_reports = hex_stats.total_historical_reports + EXCLUDED.total_historical_reports,
                        updated_at = now();
                """, h3_8, lga, state, prior, count)

            for row, lat, lng, h3_8 in parsed_rows[:500]:
                ext_id = f"acled:{row['event_id_cnty']}"
                h3_7 = latlng_to_h3(lat, lng, resolution=7)
                h3_9 = latlng_to_h3(lat, lng, resolution=9)
                pub_lat, pub_lng = get_public_location(lat, lng, is_sensitive=True)
                title = f"[ACLED] {row.get('sub_event_type') or row.get('event_type')}"
                notes = row.get("notes") or title
                event_dt = datetime.fromisoformat(row["event_date"]).replace(tzinfo=timezone.utc)

                await conn.execute("""
                    INSERT INTO incidents (
                        category_code, title, summary,
                        h3_res7, h3_res8, h3_res9,
                        exact_location, public_location,
                        status, trust_score, report_count,
                        first_reported_at, last_activity_at, expires_at,
                        source, external_id
                    )
                    VALUES (
                        'kidnapping_security', $1, $2,
                        $3, $4, $5,
                        ST_MakePoint($6, $7)::geography, ST_MakePoint($8, $9)::geography,
                        'historical', 0.850, 1,
                        $10, $10, $10,
                        'acled', $11
                    )
                    ON CONFLICT (external_id) DO NOTHING;
                """, title, notes, h3_7, h3_8, h3_9, lng, lat, pub_lng, pub_lat, event_dt, ext_id)

        print(f"  [✓] Ingested {len(parsed_rows)} ACLED events across {len(hex_counts)} H3 hexagons.")
    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest ACLED CSV into H3 priors")
    parser.add_argument("csv_file", nargs="?", default="../data/acled_sample.csv")
    parser.add_argument("--sample", action="store_true", help="Generate sample ACLED CSV first")
    args = parser.parse_args()

    target = Path(args.csv_file)
    if args.sample or not target.exists():
        write_sample_csv(target)
    asyncio.run(ingest_acled(target))
