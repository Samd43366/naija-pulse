from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field


class VerificationCreate(BaseModel):
    vote: Literal[1, -1] = Field(
        ...,
        description="+1 for Confirm (Happening/Active), -1 for Dispute (False/Cleared)"
    )
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Voter's current latitude for distance weighting")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Voter's current longitude")


class VerificationResponse(BaseModel):
    incident_id: UUID
    vote: int
    weight: float
    distance_m: int
    new_trust_score: float
    incident_status: str
    confirm_count: int
    dispute_count: int
