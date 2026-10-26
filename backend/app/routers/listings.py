import calendar
import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, UploadFile, status
from sqlalchemy import delete, exists, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.deps import DB, CurrentUser, OptionalUser, VendorUser
from app.models import (
    BlockedDate, Booking, BookingStatus, Category, CategoryGroup, City, Favorite,
    Listing, ListingImage, Review, Role, User,
)
from app.schemas import (
    AvailabilityOut, BlockDatesIn, ImageOut, ListingCard, ListingCreate, ListingDetail,
    ListingUpdate, Page, ReviewCreate, ReviewOut,
)

router = APIRouter(prefix="/listings", tags=["listings"])

LOAD = (
    selectinload(Listing.images),
    selectinload(Listing.city),
    selectinload(Listing.category),
    selectinload(Listing.vendor),
)

IMAGE_SIGNATURES = {
    b"\xff\xd8\xff": "jpg",
    b"\x89PNG\r\n\x1a\n": "png",
}


def _detect_image(head: bytes) -> str | None:
    for sig, ext in IMAGE_SIGNATURES.items():
        if head.startswith(sig):
            return ext
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None


def get_listing_or_404(db, listing_id: int) -> Listing:
    listing = db.scalar(select(Listing).options(*LOAD).where(Listing.id == listing_id))
    if not listing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Эълон ёфт нашуд")
    return listing


def get_owned_listing(db, listing_id: int, user: User) -> Listing:
    listing = get_listing_or_404(db, listing_id)
    if listing.vendor_id != user.id and user.role != Role.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Ин эълони шумо нест")
    return listing


def _validate_refs(db, category_id: int | None, city_id: int | None):
    if category_id is not None and not db.get(Category, category_id):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Категория нодуруст аст")
    if city_id is not None and not db.get(City, city_id):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Шаҳр нодуруст аст")


def busy_days_condition(day: date):
    """Шарти SQL: эълон дар ин рӯз банд аст."""
    booked = exists().where(
        Booking.listing_id == Listing.id,
        Booking.event_date == day,
        Booking.status == BookingStatus.confirmed,
    )
    blocked = exists().where(BlockedDate.listing_id == Listing.id, BlockedDate.day == day)
    return or_(booked, blocked)


# ---------------- Ҷустуҷӯ ----------------
@router.get("", response_model=Page[ListingCard])
def search_listings(
    db: DB,
    q: str | None = Query(None, max_length=100),
    category: str | None = Query(None, description="slug-и категория"),
    group: str | None = Query(None, description="slug-и гурӯҳ"),
    city: str | None = Query(None, description="slug-и шаҳр"),
    min_price: int | None = Query(None, ge=0),
    max_price: int | None = Query(None, ge=0),
    min_capacity: int | None = Query(None, ge=1),
    available_on: date | None = Query(None, description="Танҳо онҳое, ки дар ин сана холӣ ҳастанд"),
    sort: Literal["popular", "price_asc", "price_desc", "rating", "new"] = "popular",
    page: int = Query(1, ge=1),
    size: int = Query(12, ge=1, le=48),
):
    stmt = select(Listing).where(Listing.is_active.is_(True))
    if category:
        stmt = stmt.join(Category, Listing.category_id == Category.id).where(Category.slug == category)
    elif group:
        stmt = (
            stmt.join(Category, Listing.category_id == Category.id)
            .join(CategoryGroup, Category.group_id == CategoryGroup.id)
            .where(CategoryGroup.slug == group)
        )
    if city:
        stmt = stmt.join(City, Listing.city_id == City.id).where(City.slug == city)
    if q:
        for word in q.casefold().split()[:5]:
            escaped = word.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            stmt = stmt.where(Listing.search_text.like(f"%{escaped}%", escape="\\"))
    if min_price is not None:
        stmt = stmt.where(Listing.price_from >= min_price)
    if max_price is not None:
        stmt = stmt.where(Listing.price_from <= max_price)
    if min_capacity is not None:
        stmt = stmt.where(Listing.capacity >= min_capacity)
    if available_on is not None:
        stmt = stmt.where(~busy_days_condition(available_on))

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0

    order = {
        "popular": (Listing.rating_count.desc(), Listing.views.desc(), Listing.id.desc()),
        "price_asc": (Listing.price_from.asc(), Listing.id.desc()),
        "price_desc": (Listing.price_from.desc(), Listing.id.desc()),
        "rating": (Listing.rating_avg.desc(), Listing.rating_count.desc(), Listing.id.desc()),
        "new": (Listing.created_at.desc(), Listing.id.desc()),
    }[sort]
    items = db.scalars(
        stmt.options(*LOAD).order_by(*order).offset((page - 1) * size).limit(size)
    ).all()
    return Page(items=items, total=total, page=page, size=size)


# ---------------- CRUD ----------------
@router.post("", response_model=ListingDetail, status_code=201)
def create_listing(data: ListingCreate, user: VendorUser, db: DB):
    _validate_refs(db, data.category_id, data.city_id)
    listing = Listing(**data.model_dump(), vendor_id=user.id)
    db.add(listing)
    db.commit()
    return get_listing_or_404(db, listing.id)


@router.get("/{listing_id}", response_model=ListingDetail)
def get_listing(listing_id: int, db: DB, user: OptionalUser):
    listing = get_listing_or_404(db, listing_id)
    is_owner = user and (user.id == listing.vendor_id or user.role == Role.admin)
    if not listing.is_active and not is_owner:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Эълон ёфт нашуд")
    if not is_owner:
        db.execute(update(Listing).where(Listing.id == listing_id).values(views=Listing.views + 1))
        db.commit()
        listing = get_listing_or_404(db, listing_id)
    out = ListingDetail.model_validate(listing)
    if user:
        out.is_favorite = bool(
            db.scalar(select(Favorite.id).where(Favorite.user_id == user.id, Favorite.listing_id == listing_id))
        )
    return out


@router.patch("/{listing_id}", response_model=ListingDetail)
def update_listing(listing_id: int, data: ListingUpdate, user: VendorUser, db: DB):
    listing = get_owned_listing(db, listing_id, user)
    changes = data.model_dump(exclude_unset=True)
    _validate_refs(db, changes.get("category_id"), changes.get("city_id"))
    for k, v in changes.items():
        setattr(listing, k, v)
    db.commit()
    return get_listing_or_404(db, listing_id)


@router.delete("/{listing_id}", status_code=204)
def delete_listing(listing_id: int, user: VendorUser, db: DB):
    listing = get_owned_listing(db, listing_id, user)
    upload_dir = get_settings().upload_dir
    for img in listing.images:
        (upload_dir / img.url.rsplit("/", 1)[-1]).unlink(missing_ok=True)
    db.delete(listing)
    db.commit()


# ---------------- Суратҳо ----------------
@router.post("/{listing_id}/images", response_model=list[ImageOut], status_code=201)
async def upload_images(listing_id: int, files: list[UploadFile], user: VendorUser, db: DB):
    s = get_settings()
    listing = get_owned_listing(db, listing_id, user)
    if len(listing.images) + len(files) > s.max_images_per_listing:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Ҳадди аксар {s.max_images_per_listing} сурат"
        )
    max_bytes = s.max_upload_mb * 1024 * 1024
    saved: list[ListingImage] = []
    written = []
    try:
        start = len(listing.images)
        for i, f in enumerate(files):
            data = await f.read(max_bytes + 1)
            if len(data) > max_bytes:
                raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, f"Сурат аз {s.max_upload_mb}MB калон аст")
            ext = _detect_image(data[:16])
            if not ext:
                raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Танҳо JPG, PNG ё WEBP")
            name = f"{uuid.uuid4().hex}.{ext}"
            path = s.upload_dir / name
            path.write_bytes(data)
            written.append(path)
            img = ListingImage(listing_id=listing.id, url=f"/uploads/{name}", sort=start + i)
            db.add(img)
            saved.append(img)
        db.commit()
    except Exception:
        db.rollback()
        for p in written:
            p.unlink(missing_ok=True)
        raise
    return saved


@router.delete("/{listing_id}/images/{image_id}", status_code=204)
def delete_image(listing_id: int, image_id: int, user: VendorUser, db: DB):
    get_owned_listing(db, listing_id, user)
    img = db.get(ListingImage, image_id)
    if not img or img.listing_id != listing_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Сурат ёфт нашуд")
    (get_settings().upload_dir / img.url.rsplit("/", 1)[-1]).unlink(missing_ok=True)
    db.delete(img)
    db.commit()


# ---------------- Тақвим ----------------
@router.get("/{listing_id}/availability", response_model=AvailabilityOut)
def availability(listing_id: int, db: DB, month: str = Query(..., pattern=r"^\d{4}-(0[1-9]|1[0-2])$")):
    if not db.get(Listing, listing_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Эълон ёфт нашуд")
    y, m = map(int, month.split("-"))
    first, last = date(y, m, 1), date(y, m, calendar.monthrange(y, m)[1])
    booked = db.scalars(
        select(Booking.event_date).where(
            Booking.listing_id == listing_id,
            Booking.status == BookingStatus.confirmed,
            Booking.event_date.between(first, last),
        )
    ).all()
    blocked = db.scalars(
        select(BlockedDate.day).where(
            BlockedDate.listing_id == listing_id, BlockedDate.day.between(first, last)
        )
    ).all()
    return AvailabilityOut(listing_id=listing_id, month=month, busy=sorted(set(booked) | set(blocked)))


@router.post("/{listing_id}/blocked", status_code=204)
def block_dates(listing_id: int, data: BlockDatesIn, user: VendorUser, db: DB):
    get_owned_listing(db, listing_id, user)
    existing = set(
        db.scalars(
            select(BlockedDate.day).where(BlockedDate.listing_id == listing_id, BlockedDate.day.in_(data.days))
        ).all()
    )
    for d in set(data.days) - existing:
        db.add(BlockedDate(listing_id=listing_id, day=d))
    db.commit()


@router.delete("/{listing_id}/blocked", status_code=204)
def unblock_dates(listing_id: int, data: BlockDatesIn, user: VendorUser, db: DB):
    get_owned_listing(db, listing_id, user)
    db.execute(
        delete(BlockedDate).where(BlockedDate.listing_id == listing_id, BlockedDate.day.in_(data.days))
    )
    db.commit()


# ---------------- Шарҳҳо ----------------
@router.get("/{listing_id}/reviews", response_model=list[ReviewOut])
def list_reviews(listing_id: int, db: DB, limit: int = Query(50, ge=1, le=100)):
    return db.scalars(
        select(Review)
        .options(selectinload(Review.author))
        .where(Review.listing_id == listing_id)
        .order_by(Review.created_at.desc())
        .limit(limit)
    ).all()


def _recalc_rating(db, listing_id: int):
    avg, cnt = db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(Review.listing_id == listing_id)
    ).one()
    db.execute(
        update(Listing)
        .where(Listing.id == listing_id)
        .values(rating_avg=round(float(avg or 0), 2), rating_count=cnt)
    )


@router.post("/{listing_id}/reviews", response_model=ReviewOut, status_code=201)
def create_review(listing_id: int, data: ReviewCreate, user: CurrentUser, db: DB):
    listing = get_listing_or_404(db, listing_id)
    if listing.vendor_id == user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Ба эълони худ шарҳ навишта наметавонед")
    had_service = db.scalar(
        select(Booking.id).where(
            Booking.listing_id == listing_id,
            Booking.client_id == user.id,
            Booking.status == BookingStatus.confirmed,
            Booking.event_date <= date.today(),
        )
    )
    if not had_service:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Шарҳро танҳо пас аз гирифтани хизмат навиштан мумкин аст"
        )
    review = Review(listing_id=listing_id, author_id=user.id, rating=data.rating, text=data.text.strip())
    db.add(review)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Шумо аллакай шарҳ навиштаед")
    _recalc_rating(db, listing_id)
    db.commit()
    db.refresh(review)
    return review


# ---------------- Интихобшудаҳо ----------------
@router.post("/{listing_id}/favorite", status_code=204)
def add_favorite(listing_id: int, user: CurrentUser, db: DB):
    get_listing_or_404(db, listing_id)
    if not db.scalar(select(Favorite.id).where(Favorite.user_id == user.id, Favorite.listing_id == listing_id)):
        db.add(Favorite(user_id=user.id, listing_id=listing_id))
        db.commit()


@router.delete("/{listing_id}/favorite", status_code=204)
def remove_favorite(listing_id: int, user: CurrentUser, db: DB):
    db.execute(delete(Favorite).where(Favorite.user_id == user.id, Favorite.listing_id == listing_id))
    db.commit()
