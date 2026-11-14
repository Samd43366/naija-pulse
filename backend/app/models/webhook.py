from typing import Optional
from pydantic import BaseModel, Field


class SmsWebhookPayload(BaseModel):
    """
    Standard SMS / USSD inbound webhook payload
    Compatible with Africa's Talking / Twilio SMS gateway callbacks.
    Example message text: "SECURITY Kidnapping attempt along Birnin Gwari junction"
    """
    sender: str = Field(..., description="Phone number or shortcode of sender")
    text: str = Field(..., description="Raw SMS content containing category, location, and details")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timestamp: Optional[str] = None


class SmsWebhookResponse(BaseModel):
    success: bool
    incident_id: Optional[str] = None
    message: str
