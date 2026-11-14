"""
Live Nigerian News RSS Scraper, Classifier, Geocoder & Seeder.

Concept (Automated OSINT Ingestion):
Crowdsourced platforms suffer from the "cold-start problem" when launching in a new city.
This pipeline solves cold-start by pulling live Nigerian news RSS feeds (Punch, Premium Times,
Vanguard, Daily Trust), filtering for actionable civic/hazard events, geocoding mentioned
Nigerian areas/LGAs/states against our 1,049-entry vector gazetteer, and merging them into
`frontend/src/data/researchedNewsSeed.json` (and PostgreSQL when `--db` is passed).

Usage:
  python scripts/ingest_nigeria_news.py              # Scrape live RSS & enrich seed JSON
  python scripts/ingest_nigeria_news.py --db         # Also upsert into PostgreSQL/PostGIS
"""

import argparse
import hashlib
import html
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SEED_JSON = PROJECT_ROOT / "frontend" / "src" / "data" / "researchedNewsSeed.json"
GAZETTEER_JSON = PROJECT_ROOT / "frontend" / "public" / "geo" / "nigeria_cities_detail.json"

RSS_FEEDS = [
    ("Punch Nigeria", "https://punchng.com/feed/"),
    ("Premium Times", "https://www.premiumtimesng.com/feed"),
    ("Vanguard Nigeria", "https://www.vanguardngr.com/feed/"),
    ("Daily Trust", "https://dailytrust.com/feed/"),
]

CATEGORY_RULES = [
    ("disaster_fire", [
        "tanker explosion", "tanker fire", "fire outbreak", "market fire", "inferno",
        "gas explosion", "pipeline explosion", "gutted by fire", "razed", "building collapse",
    ]),
    ("flood", [
        "flood", "submerged", "downpour", "nihsa", "overflowing river", "dam release",
        "riverbank", "flash flood",
    ]),
    ("power_outage", [
        "national grid", "grid collapse", "blackout", "power outage", "load shedding",
        "load-shedding", "ikeja electric", "aedc", "ekedc", "kedco", "330kv", "tcn",
    ]),
    ("road_condition", [
        "gridlock", "traffic diversion", "third mainland", "eko bridge", "carter bridge",
        "pothole", "failed portion", "fallen truck", "overturned truck", "lastma", "frsc",
        "expressway",
    ]),
    ("kidnapping_security", [
        "kidnap", "abduct", "bandits", "gunmen", "terrorists", "boko haram", "iswap",
        "ambush", "curfew", "troops neutralize", "rescued victims",
    ]),
    ("other", [
        "cholera", "lassa fever", "water scarcity", "burst pipe", "waterways", "laswa", "ncdc",
    ]),
]


def clean_html(raw_text: str) -> str:
    txt = re.sub(r"<[^>]+>", " ", raw_text or "")
    txt = html.unescape(txt)
    return re.sub(r"\s+", " ", txt).strip()


COURTROOM_EXCLUSIONS = [
    "remanded", "arraigned", "high court", "magistrate court", "sentenced to",
    "pleaded not guilty", "adjourned the case", "election tribunal",
]


def classify_article(title: str, desc: str) -> str | None:
    hay = f"{title} {desc}".lower()
    if any(excl in hay for excl in COURTROOM_EXCLUSIONS):
        return None
    for cat, keywords in CATEGORY_RULES:
        if any(kw in hay for kw in keywords):
            return cat
    return None


SHORT_VALID_TOWNS = {"aba", "jos", "uyo", "epe", "ojo", "ife", "owo"}


def load_gazetteer() -> list[dict]:
    if not GAZETTEER_JSON.exists():
        return []
    data = json.loads(GAZETTEER_JSON.read_text(encoding="utf-8"))
    entries = data.get("search_index", [])
    valid = [
        e for e in entries
        if len(e.get("name", "")) >= 4 or e.get("name", "").lower() in SHORT_VALID_TOWNS
    ]
    valid.sort(key=lambda e: (e.get("type") == "State", -len(e["name"])))
    return valid


def geocode_text(title: str, desc: str, gazetteer: list[dict]) -> dict | None:
    for text in (title, f"{title} {desc}"):
        for entry in gazetteer:
            raw_name = entry["name"].replace(" State", "").strip()
            if len(raw_name) < 4 and raw_name.lower() not in SHORT_VALID_TOWNS:
                continue
            pattern = r"\b" + re.escape(raw_name) + r"\b"
            if re.search(pattern, text, flags=re.IGNORECASE):
                return entry
    return None


def fetch_rss_items(outlet: str, url: str) -> list[dict]:
    print(f"  [RSS] Checking {outlet} ({url})...", flush=True)
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NaijaPulse-OSINT/1.0",
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        xml_bytes = resp.read()
    root = ET.fromstring(xml_bytes)
    items = []
    for item in root.findall(".//item")[:25]:
        title = clean_html(item.findtext("title") or "")
        desc = clean_html(item.findtext("description") or "")
        link = (item.findtext("link") or "").strip()
        if title:
            items.append({"outlet": outlet, "title": title, "desc": desc, "link": link})
    return items


def main():
    parser = argparse.ArgumentParser(description="Scrape & geocode Nigerian news RSS into Naija Pulse.")
    parser.add_argument("--db", action="store_true", help="Also run PostgreSQL seed after updating JSON.")
    args = parser.parse_args()

    existing: list[dict] = json.loads(SEED_JSON.read_text(encoding="utf-8")) if SEED_JSON.exists() else []
    seen_ids = {row["external_id"] for row in existing}
    seen_titles = {row["title"].lower()[:45] for row in existing}

    gazetteer = load_gazetteer()
    added = 0

    for outlet, url in RSS_FEEDS:
        try:
            rss_items = fetch_rss_items(outlet, url)
        except Exception as err:
            print(f"      ! Skipped {outlet} (offline or timeout: {err})", flush=True)
            continue

        for art in rss_items:
            cat = classify_article(art["title"], art["desc"])
            if not cat:
                continue
            loc = geocode_text(art["title"], art["desc"], gazetteer)
            if not loc:
                continue

            ext_id = "rss-" + hashlib.md5(art["title"].encode("utf-8")).hexdigest()[:12]
            if ext_id in seen_ids or art["title"].lower()[:45] in seen_titles:
                continue

            summary = art["desc"][:240] + ("…" if len(art["desc"]) > 240 else "")
            source_type = (
                "acled" if cat == "kidnapping_security"
                else "nema" if cat == "flood"
                else "official"
            )
            ttl_map = {
                "power_outage": 4.0,
                "flood": 18.0,
                "kidnapping_security": 8.0,
                "road_condition": 24.0,
                "disaster_fire": 6.0,
                "other": 24.0,
            }

            new_entry = {
                "external_id": ext_id,
                "category_code": cat,
                "title": art["title"][:115],
                "summary": summary or art["title"],
                "news_outlet": f"{outlet} (Live RSS)",
                "url": art.get("link"),
                "state_name": loc.get("sub", "Nigeria").replace(" State", ""),
                "lga_name": loc["name"],
                "lat": round(float(loc["lat"]), 4),
                "lng": round(float(loc["lng"]), 4),
                "trust_score": 0.84,
                "status": "active",
                "report_count": 3,
                "confirm_count": 2,
                "dispute_count": 0,
                "source": source_type,
                "hours_ago": 0.5,
                "ttl_hours": ttl_map.get(cat, 12.0),
                "witness_notes": [
                    f"Auto-ingested from {outlet} live feed and geocoded to {loc['name']} ({loc.get('sub', 'Nigeria')})."
                ],
            }
            existing.insert(0, new_entry)
            seen_ids.add(ext_id)
            seen_titles.add(art["title"].lower()[:45])
            added += 1
            print(f"    [+] Matched [{cat}] {art['title'][:65]} -> {loc['name']}", flush=True)

    SEED_JSON.write_text(json.dumps(existing, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n[✓] News seed ready: {len(existing)} total researched/live incidents ({added} newly scraped from live RSS).", flush=True)

    if args.db:
        import asyncio
        from scripts.seed_demo_data import seed_data
        asyncio.run(seed_data())


if __name__ == "__main__":
    main()
