from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field
from app.models.report import ReportResponse


class IncidentResponse(BaseModel):
    id: UUID
    category_code: str
    title: str
    summary: Optional[str] = None
    h3_res7: str
    h3_res8: str
    latitude: float = Field(..., description="Public latitude (blurred if sensitive)")
    longitude: float = Field(..., description="Public longitude (blurred if sensitive)")
    status: str
    trust_score: float
    report_count: int
    confirm_count: int
    dispute_count: int
    first_reported_at: datetime
    last_activity_at: datetime
    expires_at: datetime
    source: str
    source_type: Optional[str] = Field(
        default=None,
        description="Normalized provenance class: crowd, official, research, or seed",
    )
    location_precision: Optional[str] = Field(
        default=None,
        description="Public location precision: exact, neighborhood, or macro",
    )
    evidence_count: Optional[int] = Field(
        default=None,
        ge=0,
        description="Number of evidence records contributing to this incident",
    )


class IncidentDetailResponse(IncidentResponse):
    reports: List[ReportResponse] = []
