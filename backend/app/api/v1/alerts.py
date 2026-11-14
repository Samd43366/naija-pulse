from uuid import UUID
from fastapi import APIRouter, Header, HTTPException, status
from app.services.reporter_service import get_or_create_reporter
from app.services.alert_service import get_reporter_alerts
from app.db.pool import get_db_pool

router = APIRouter(prefix="/alerts", tags=["User Alerts"])


@router.get("")
async def get_my_alerts(
    x_reporter_token: str = Header(default="anonymous-dev-device")
):
    """
    Fetches real-time in-app alerts triggered by incidents occurring
    in the user's saved locations or commute corridors.
    """
    reporter = await get_or_create_reporter(x_reporter_token)
    alerts = await get_reporter_alerts(reporter["id"])
    return {"alerts": alerts, "unread_count": sum(1 for a in alerts if a["read_at"] is None)}


@router.patch("/{alert_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_alert_read(
    alert_id: UUID,
    x_reporter_token: str = Header(default="anonymous-dev-device")
):
    reporter = await get_or_create_reporter(x_reporter_token)
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        res = await conn.execute("""
            UPDATE alerts
            SET read_at = now()
            WHERE id = $1 AND reporter_id = $2;
        """, alert_id, reporter["id"])
        if res == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Alert not found")
