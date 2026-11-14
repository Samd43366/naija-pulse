"""
NEMA / HDX Flood Vulnerability CSV Ingestion Pipeline -> H3 Flood Priors.

Reads historical flood records (state, lga, latitude, longitude, severity_1_to_5, notes)
and updates `historical_flood_risk` in `hex_stats` for every impacted H3 Resolution-8 cell
plus its 1-ring neighbors (since floodplains spill into adjacent ~460m cells!).

Usage:
  python -m scripts.ingest_nema_floods_csv --sample
"""

import argparse
import asyncio
import csv
import sys
from pathlib import Path

import asyncpg
from app.config import get_settings
from app.core.h3_utils import get_h3_neighbors, latlng_to_h3

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

settings = get_settings()

SAMPLE_NEMA_ROWS = [
    ("NEMA-FL-01", "Lagos", "Lagos Island", "6.4531", "3.3958", "4", "Seasonal lagoon surge & storm drain backflow along Marina."),
    ("NEMA-FL-02", "Lagos", "Eti-Osa", "6.4428", "3.4752", "4", "Flash flooding along Lekki corridor after heavy downpour."),
    ("NEMA-FL-03", "Kogi", "Lokoja", "7.8023", "6.7333", "5", "Niger-Benue confluence floodplain inundation."),
    ("NEMA-FL-04", "Rivers", "Obio/Akpor", "4.8472", "6.9746", "3", "Urban drainage overflow during peak rainy season."),
]


def write_sample_csv(csv_path: Path) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["record_id", "state", "lga", "latitude", "longitude", "severity", "notes"])
        writer.writerows(SAMPLE_NEMA_ROWS)
    print(f"  [✓] Wrote sample NEMA/HDX flood CSV to {csv_path}")


async def ingest_nema(csv_path: Path) -> None:
    conn = await asyncpg.connect(
        user=settings.POSTGRES_USER,
        password=settings.POSTGRES_PASSWORD,
        database=settings.POSTGRES_DB,
        host=settings.POSTGRES_HOST,
        port=settings.POSTGRES_PORT,
    )
    try:
        updated_cells = 0
        with csv_path.open("r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            async with conn.transaction():
                for row in reader:
                    lat = float(row["latitude"])
                    lng = float(row["longitude"])
                    severity = int(row.get("severity") or 3)
                    center_hex = latlng_to_h3(lat, lng, resolution=8)

                    # Center cell gets full risk; 6 neighbor cells get 75% spillover risk
                    for h in get_h3_neighbors(center_hex, k=1):
                        base_risk = min(0.95, severity / 5.0)
                        risk = round(base_risk if h == center_hex else base_risk * 0.75, 3)
                        await conn.execute("""
                            INSERT INTO hex_stats (
                                h3_index, lga_name, state_name, historical_flood_risk, updated_at
                            )
                            VALUES ($1, $2, $3, $4, now())
                            ON CONFLICT (h3_index) DO UPDATE SET
                                historical_flood_risk = GREATEST(hex_stats.historical_flood_risk, EXCLUDED.historical_flood_risk),
                                lga_name = COALESCE(EXCLUDED.lga_name, hex_stats.lga_name),
                                state_name = COALESCE(EXCLUDED.state_name, hex_stats.state_name),
                                updated_at = now();
                        """, h, row.get("lga"), row.get("state"), risk)
                        updated_cells += 1

        print(f"  [✓] Updated NEMA flood vulnerability priors across {updated_cells} H3 cells.")
    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest NEMA/HDX Flood CSV into H3 priors")
    parser.add_argument("csv_file", nargs="?", default="../data/nema_floods_sample.csv")
    parser.add_argument("--sample", action="store_true")
    args = parser.parse_args()

    target = Path(args.csv_file)
    if args.sample or not target.exists():
        write_sample_csv(target)
    asyncio.run(ingest_nema(target))
