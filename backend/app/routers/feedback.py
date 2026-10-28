from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import func, select

from app.core.security import RateLimiter
from app.deps import DB, OptionalUser
from app.models import Feedback
from app.routers.admin import AdminUser
from app.schemas import FeedbackIn, FeedbackOut, Page

router = APIRouter(tags=["feedback"])

# Бар зидди спам: аз як корбар/IP — то 5 фикр дар як соат
feedback_limiter = RateLimiter(5, window_seconds=60 * 60)


@router.post("/feedback", status_code=201)
def send_feedback(data: FeedbackIn, request: Request, db: DB, user: OptionalUser):
    """Фикру пешниҳод дар бораи сайт. Бе воридшавӣ ҳам мумкин."""
    key = f"user:{user.id}" if user else f"ip:{request.client.host if request.client else '?'}"
    if not feedback_limiter.allow(key):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Шумо аллакай чанд фикр фиристодед. Каме баъдтар нависед.")
    item = Feedback(
        user_id=user.id if user else None, topic=data.topic, rating=data.rating, message=data.message.strip(),
        name=(data.name.strip() or (user.full_name if user else ""))[:120],
        contact=(data.contact.strip() or (user.email if user else ""))[:120], page=data.page.strip(),
    )
    db.add(item)
    db.commit()
    return {"ok": True}


@router.get("/admin/feedback", response_model=Page[FeedbackOut])
def admin_feedback(_: AdminUser, db: DB, unread: bool = False,
                   page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    stmt = select(Feedback)
    if unread:
        stmt = stmt.where(Feedback.is_read.is_(False))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.scalars(stmt.order_by(Feedback.id.desc()).offset((page - 1) * size).limit(size)).all()
    return Page(items=items, total=total, page=page, size=size)


@router.patch("/admin/feedback/{feedback_id}/read", response_model=FeedbackOut)
def mark_read(feedback_id: int, _: AdminUser, db: DB, read: bool = True):
    item = db.get(Feedback, feedback_id)
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Фикр ёфт нашуд")
    item.is_read = read
    db.commit()
    return item
