import json
import logging
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app import assistant
from app.core.config import get_settings
from app.core.security import RateLimiter
from app.deps import DB, OptionalUser

log = logging.getLogger("tuyona")
router = APIRouter(prefix="/assistant", tags=["assistant"])

hourly_limiter = RateLimiter(get_settings().assistant_hourly_limit, window_seconds=60 * 60)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatIn(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=40)


@router.get("/status")
def assistant_status():
    return {"enabled": assistant.enabled()}


@router.post("")
def chat(data: ChatIn, request: Request, db: DB, user: OptionalUser):
    if data.messages[-1].role != "user":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Паёми охир бояд аз корбар бошад")
    key = f"user:{user.id}" if user else f"ip:{request.client.host if request.client else '?'}"
    if not hourly_limiter.allow(key):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Саволҳо зиёд шуданд. Каме баъдтар нависед.")
    try:
        return assistant.ask(db, [m.model_dump() for m in data.messages])
    except assistant.AssistantUnavailable:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Ёрдамчии AI ҳоло фаъол нест")
    except assistant.AssistantError as error:
        if str(error) == "rate_limit":
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "AI банд аст. Пас аз як дақиқа боз нависед.")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Ёрдамчӣ ҳоло ҷавоб дода наметавонад. Баъдтар кӯшиш кунед.")


@router.post("/stream")
def chat_stream(data: ChatIn, request: Request, db: DB, user: OptionalUser):
    """Мисли POST /assistant, вале ҷавоб пора-пора (NDJSON): {"delta": …} … {"done": true, "listings": […]}.
    Агар дар миёна хато шавад — {"error": "…"}."""
    if data.messages[-1].role != "user":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Паёми охир бояд аз корбар бошад")
    key = f"user:{user.id}" if user else f"ip:{request.client.host if request.client else '?'}"
    if not hourly_limiter.allow(key):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Саволҳо зиёд шуданд. Каме баъдтар нависед.")
    try:
        plan = assistant.start(db, [m.model_dump() for m in data.messages])
    except assistant.AssistantUnavailable:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Ёрдамчии AI ҳоло фаъол нест")
    except assistant.AssistantError as error:
        if str(error) == "rate_limit":
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "AI банд аст. Пас аз як дақиқа боз нависед.")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Ёрдамчӣ ҳоло ҷавоб дода наметавонад. Баъдтар кӯшиш кунед.")

    def lines():
        try:
            for event in assistant.stream(plan):
                yield json.dumps(event, ensure_ascii=False) + "\n"
        except assistant.AssistantError as error:
            log.warning("Assistant stream failed: %s", error)
            yield json.dumps({"error": "Ёрдамчӣ ҳоло ҷавоб дода наметавонад. Баъдтар кӯшиш кунед."}, ensure_ascii=False) + "\n"

    return StreamingResponse(lines(), media_type="application/x-ndjson", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
