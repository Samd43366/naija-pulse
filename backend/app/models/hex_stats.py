from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class HexRatingCreate(BaseModel):
    safety_rating: int = Field(..., ge=1, le=5, description="1 (Unsafe) to 5 (Very Safe)")
    power_rating: int = Field(..., ge=1, le=5, description="1 (No power) to 5 (24/7 reliable)")
    livability_rating: int = Field(..., ge=1, le=5, description="1 (Poor) to 5 (Great roads/drainage)")
    comment: Optional[str] = Field(None, max_length=500)
    lga_name: Optional[str] = None
    state_name: Optional[str] = None


class HexStatResponse(BaseModel):
    h3_index: str
    lga_name: Optional[str] = None
    state_name: Optional[str] = None
    historical_security_risk: float
    historical_flood_risk: float
    community_safety_score: float
    community_power_score: float
    community_livability_score: float
    active_incident_count: int
    total_historical_reports: int
    updated_at: Optional[datetime] = None
