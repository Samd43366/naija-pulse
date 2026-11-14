from typing import Any, List, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.services.chatbot_service import answer_question

router = APIRouter(prefix="/chat", tags=["PulseAI Chatbot"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    incidents: Optional[List[dict[str, Any]]] = None


class MapAction(BaseModel):
    label: str
    lat: float
    lng: float
    zoom: int = 10


class ChatResponse(BaseModel):
    reply: str
    engine: str
    map_action: Optional[MapAction] = None


@router.post("", response_model=ChatResponse)
async def chat_with_pulse_ai(payload: ChatRequest):
    """
    Answers user questions using PulseAI's trained TF-IDF knowledge index +
    live spatial analytics across all 36 Nigerian States + FCT (and optional Gemini RAG).
    """
    return answer_question(payload.message, client_incidents=payload.incidents)
