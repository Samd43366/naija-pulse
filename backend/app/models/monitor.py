from datetime import datetime
from typing import List, Optional, Tuple
from uuid import UUID
from pydantic import BaseModel, Field
from app.models.incident import IncidentResponse


class MonitorCreate(BaseModel):
    label: str = Field(..., example="Home, Office, Lekki-Epe Commute")
    monitor_type: str = Field(default="point", pattern="^(point|corridor)$")
    
    # Point fields
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_m: Optional[int] = 1500
    
    # Corridor fields (list of (lat, lng) tuples representing commute route)
    route_coordinates: Optional[List[Tuple[float, float]]] = None
    corridor_ring_buffer: Optional[int] = 1
    
    category_filter: Optional[List[str]] = None


class MonitorResponse(BaseModel):
    id: UUID
    label: str
    monitor_type: str
    monitored_hex_count: int
    category_filter: Optional[List[str]] = None
    is_active: bool
    created_at: datetime


class RouteSafetyCheckRequest(BaseModel):
    route_coordinates: List[Tuple[float, float]] = Field(
        ...,
        description="List of (lat, lng) tuples along the planned commute path"
    )
    buffer_ring: int = Field(default=1, description="H3 ring buffer around the route (1 = ~460m buffer)")


class RouteSafetyCheckResponse(BaseModel):
    route_hexes: List[str]
    overall_safety_rating: str  # "SAFE", "MODERATE_RISK", "HIGH_ALERT"
    average_historical_risk: float
    active_incidents_count: int
    active_incidents: List[IncidentResponse]
    safety_advisory: str
