import re
from fastapi import APIRouter, HTTPException, status
from app.models.webhook import SmsWebhookPayload, SmsWebhookResponse
from app.models.report import ReportCreate
from app.services.reporter_service import get_or_create_reporter
from app.services.incident_service import create_or_merge_report

router = APIRouter(prefix="/webhooks", tags=["Offline & SMS Ingestion (Feature 3)"])

# Common Nigerian landmark coordinate fallbacks if telco cell-tower GPS is unavailable
NIGERIA_LANDMARK_CENTROIDS = {
    "lekki": (6.4698, 3.5852),
    "surulere": (6.4975, 3.3578),
    "ikeja": (6.5954, 3.3431),
    "yaba": (6.5167, 3.3833),
    "victoria island": (6.4281, 3.4219),
    "marina": (6.4531, 3.3958),
    "ikorodu": (6.6194, 3.5105),
    "abuja": (9.0765, 7.3986),
    "kaduna": (10.5105, 7.4165),
    "kano": (12.0022, 8.5920),
    "port harcourt": (4.8156, 7.0498),
    "ibadan": (7.3775, 3.9470),
}


def parse_sms_category_and_location(text: str):
    """
    Extracts category and fallback coordinates from unstructured SMS text.
    Example text: 'FLOOD Lekki toll gate flooded cars submerged'
    """
    clean_text = text.lower()
    
    # 1. Determine category
    category_code = "other"
    if any(k in clean_text for k in ["power", "nepa", "phcn", "light", "outage", "blackout", "transformer"]):
        category_code = "power_outage"
    elif any(k in clean_text for k in ["flood", "water", "rain", "drainage", "gutter"]):
        category_code = "flood"
    elif any(k in clean_text for k in ["kidnap", "robbery", "thief", "gun", "security", "attack", "bandit", "cult"]):
        category_code = "kidnapping_security"
    elif any(k in clean_text for k in ["road", "gully", "pothole", "accident", "gridlock", "traffic"]):
        category_code = "road_condition"
    elif any(k in clean_text for k in ["fire", "tanker", "explosion", "burn"]):
        category_code = "disaster_fire"

    # 2. Extract location centroid if mentioned
    lat, lng = (6.5244, 3.3792) # Default to Lagos Central
    for landmark, coords in NIGERIA_LANDMARK_CENTROIDS.items():
        if landmark in clean_text:
            lat, lng = coords
            break

    return category_code, lat, lng


@router.post("/sms", response_model=SmsWebhookResponse, status_code=status.HTTP_200_OK)
async def inbound_sms_gateway_webhook(payload: SmsWebhookPayload):
    """
    Feature 3: Offline / Low-Data SMS/USSD Webhook Ingestion
    
    Accepts raw incoming SMS or USSD submissions from gateways like Africa's Talking or Twilio.
    Allows citizens without smartphones, internet bundles, or in signal-dead zones
    to submit emergency reports via simple SMS.
    """
    if not payload.text:
        raise HTTPException(status_code=400, detail="SMS content cannot be empty")

    cat_code, default_lat, default_lng = parse_sms_category_and_location(payload.text)
    
    lat = payload.latitude if payload.latitude is not None else default_lat
    lng = payload.longitude if payload.longitude is not None else default_lng

    # Use a hashed phone token as the pseudonymous device identifier
    device_token = f"sms_{payload.sender}"
    reporter = await get_or_create_reporter(device_token, display_name=f"SMS Reporter ({payload.sender[-4:]})")

    report_create = ReportCreate(
        category_code=cat_code,
        latitude=lat,
        longitude=lng,
        description=f"[SMS Report] {payload.text}"
    )

    result = await create_or_merge_report(report_create, reporter)
    incident = result["incident"]

    return SmsWebhookResponse(
        success=True,
        incident_id=str(incident["id"]),
        message=f"Report ingested via SMS into incident: {incident['title']}"
    )
