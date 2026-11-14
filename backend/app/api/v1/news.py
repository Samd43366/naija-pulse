import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Query

from app.models.news import NewsArticleResponse

router = APIRouter(prefix="/news", tags=["Nigeria News"])

SEED_PATH = Path(__file__).resolve().parents[3] / "data" / "nigeria_incidents_seed.json"


def _source_type(item: dict) -> str:
    outlet = str(item.get("news_outlet") or item.get("source") or "").lower()
    if any(token in outlet for token in ("official", "nema", "lasema", "frsc", "tcn", "police")):
        return "official"
    if any(token in outlet for token in ("rss", "vanguard", "punch", "premium", "guardian", "trust", "times")):
        return "newsroom"
    return "community"


def _load_news() -> list[dict]:
    if not SEED_PATH.exists():
        return []
    try:
        rows = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    now = datetime.now(timezone.utc)
    output = []
    for index, item in enumerate(rows):
        hours_ago = float(item.get("hours_ago") or 24)
        output.append({
            "id": str(item.get("external_id") or f"seed-news-{index}"),
            "title": item.get("title") or "Nigeria news update",
            "summary": item.get("summary") or item.get("title") or "",
            "outlet": item.get("news_outlet") or item.get("source") or "Naija Pulse newsroom",
            "url": item.get("url") or item.get("article_url"),
            "category_code": item.get("category_code"),
            "state_name": item.get("state_name"),
            "lga_name": item.get("lga_name"),
            "latitude": item.get("lat"),
            "longitude": item.get("lng"),
            "source_type": _source_type(item),
            "published_at": now - timedelta(hours=hours_ago),
        })
    return output


@router.get("", response_model=List[NewsArticleResponse])
async def list_news(
    state: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None, min_length=2),
    limit: int = Query(30, ge=1, le=100),
):
    rows = _load_news()
    needle = search.lower() if search else None
    filtered = []
    for row in rows:
        if state and (row.get("state_name") or "").lower() != state.lower():
            continue
        if category and row.get("category_code") != category:
            continue
        if needle and needle not in f"{row['title']} {row['summary']} {row.get('state_name') or ''}".lower():
            continue
        filtered.append(row)
    return filtered[:limit]

