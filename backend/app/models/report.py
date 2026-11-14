from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class ReportCreate(BaseModel):
    category_code: str = Field(..., description="Category code (e.g. power_outage, flood, kidnapping_security)")
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    description: str = Field(..., min_length=3, max_length=2000)
    media_url: Optional[str] = None
    gps_accuracy_m: Optional[int] = None
    observed_at: Optional[datetime] = None


class ReportResponse(BaseModel):
    id: UUID
    incident_id: UUID
    h3_index: str
    description: str
    media_url: Optional[str] = None
    observed_at: datetime
    created_at: datetime
