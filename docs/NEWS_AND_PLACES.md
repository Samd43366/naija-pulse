# News and place discovery

## News desk

Naija Pulse now exposes `GET /api/v1/news` for a source-labeled Nigeria news feed. The current development feed is built from the existing seeded dataset and the RSS ingestion script in `backend/scripts/ingest_nigeria_news.py`.

Supported filters are `state`, `category`, `search`, and `limit`. Each article includes its outlet, summary, publication estimate, optional source URL, optional map coordinates, and a provenance class.

The ingestion job should run on a schedule outside the request path. It should fetch RSS, deduplicate by external ID/title, geocode against the local gazetteer, and write only the fields the product is licensed to retain. The UI should link to the original article and avoid republishing full copyrighted text.

Before production, confirm the terms for each publisher’s RSS feed and decide whether the product should show a headline/summary/link or license full article content. A newsroom source is not automatically an official source; the UI keeps those labels separate.

## Interesting places

The Explore Places screen reads the existing `frontend/public/geo/nigeria_cities_detail.json` atlas. It provides searchable place cards and jumps to the selected coordinate on the map. The map already renders atlas place labels at suitable zoom levels.

Future place records should add:

- `description`
- `kind`
- `state_name` and `city_name`
- `opening_hours` when verified
- `price_band` when useful
- `source_url`
- `last_verified_at`
- accessibility and safety notes with careful wording

Do not present an unverified place as open, safe, or officially endorsed. Keep discovery separate from incident trust scoring.

