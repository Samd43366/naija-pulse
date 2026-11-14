from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class NewsArticleResponse(BaseModel):
    id: str
    title: str
    summary: str
    outlet: str
    url: Optional[str] = None
    category_code: Optional[str] = None
    state_name: Optional[str] = None
    lga_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source_type: str = "newsroom"
    published_at: datetime

