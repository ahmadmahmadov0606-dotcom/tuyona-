from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select

from app.deps import DB, CurrentUser
from app.models import Booking, BookingStatus, Feedback, Listing, Role, User
from app.routers.listings import LOAD as LISTING_LOAD
from app.schemas import AdminStats, AdminUserOut, ListingCard, Page


def require_admin(user: CurrentUser) -> User:
    if user.role != Role.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Танҳо барои маъмур")
    return user


AdminUser = Annotated[User, Depends(require_admin)]
router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStats)
def stats(_: AdminUser, db: DB):
    def cnt(q):
        return db.scalar(q) or 0

    return AdminStats(
        users=cnt(select(func.count(User.id))),
        vendors=cnt(select(func.count(User.id)).where(User.role == Role.vendor)),
        listings=cnt(select(func.count(Listing.id))),
        active_listings=cnt(select(func.count(Listing.id)).where(Listing.is_active.is_(True))),
        bookings=cnt(select(func.count(Booking.id))),
        bookings_confirmed=cnt(
            select(func.count(Booking.id)).where(Booking.status == BookingStatus.confirmed)
        ),
        feedback_unread=cnt(select(func.count(Feedback.id)).where(Feedback.is_read.is_(False))),
    )


@router.get("/users", response_model=Page[AdminUserOut])
def users(
    _: AdminUser,
    db: DB,
    q: str | None = Query(None, max_length=60),
    role: Role | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    stmt = select(User)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.email.like(like), User.full_name.like(like)))
    if role:
        stmt = stmt.where(User.role == role)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.scalars(stmt.order_by(User.id.desc()).offset((page - 1) * size).limit(size)).all()
    return Page(items=items, total=total, page=page, size=size)


@router.patch("/users/{user_id}/active", response_model=AdminUserOut)
def set_user_active(user_id: int, active: bool, admin: AdminUser, db: DB):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Корбар ёфт нашуд")
    if u.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ҳисоби худро баста наметавонед")
    u.is_active = active
    if not active:  # эълонҳои корбари басташуда пинҳон мешаванд
        for l in db.scalars(select(Listing).where(Listing.vendor_id == u.id)):
            l.is_active = False
    db.commit()
    return u


@router.get("/listings", response_model=Page[ListingCard])
def listings(
    _: AdminUser,
    db: DB,
    q: str | None = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    stmt = select(Listing)
    if q:
        stmt = stmt.where(Listing.search_text.like(f"%{q.casefold().strip()}%"))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.scalars(
        stmt.options(*LISTING_LOAD).order_by(Listing.id.desc()).offset((page - 1) * size).limit(size)
    ).all()
    return Page(items=items, total=total, page=page, size=size)


@router.patch("/listings/{listing_id}/active", response_model=ListingCard)
def set_listing_active(listing_id: int, active: bool, _: AdminUser, db: DB):
    l = db.scalar(select(Listing).options(*LISTING_LOAD).where(Listing.id == listing_id))
    if not l:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Эълон ёфт нашуд")
    l.is_active = active
    db.commit()
    return l
