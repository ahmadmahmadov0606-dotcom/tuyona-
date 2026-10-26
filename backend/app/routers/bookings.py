from datetime import date

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.deps import DB, CurrentUser, VendorUser
from app.models import BlockedDate, Booking, BookingStatus, Listing, Role
from app.schemas import FEAST_MAX_GUESTS, OSH_MAX_GUESTS, BookingCreate, BookingOut, BookingStatusIn

router = APIRouter(prefix="/bookings", tags=["bookings"])

LOAD = (
    selectinload(Booking.listing).selectinload(Listing.images),
    selectinload(Booking.client),
)


def _get(db, booking_id: int) -> Booking:
    b = db.scalar(select(Booking).options(*LOAD).where(Booking.id == booking_id))
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Брон ёфт нашуд")
    return b


def _is_busy(db, listing_id: int, day: date, exclude_booking: int | None = None) -> bool:
    q = select(Booking.id).where(
        Booking.listing_id == listing_id,
        Booking.event_date == day,
        Booking.status == BookingStatus.confirmed,
    )
    if exclude_booking:
        q = q.where(Booking.id != exclude_booking)
    if db.scalar(q):
        return True
    return bool(
        db.scalar(select(BlockedDate.id).where(BlockedDate.listing_id == listing_id, BlockedDate.day == day))
    )


@router.post("", response_model=BookingOut, status_code=201)
def create_booking(data: BookingCreate, user: CurrentUser, db: DB):
    listing = db.get(Listing, data.listing_id)
    if not listing or not listing.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Эълон ёфт нашуд")
    if listing.vendor_id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Эълони худро брон карда наметавонед")
    if data.event_date < date.today():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Санаи гузашта интихоб шудааст")
    if listing.capacity and data.guests and data.guests > listing.capacity:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Ғунҷоиш танҳо то {listing.capacity} нафар аст"
        )
    limit = OSH_MAX_GUESTS if listing.category.slug == "oshpaz" else FEAST_MAX_GUESTS
    if data.guests and data.guests > limit:
        kind = "оши тӯй" if limit == OSH_MAX_GUESTS else "зиёфати тӯй"
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Тибқи қонун {kind} — то {limit} нафар")
    if _is_busy(db, listing.id, data.event_date):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ин сана аллакай банд аст")
    duplicate = db.scalar(
        select(Booking.id).where(
            Booking.listing_id == listing.id,
            Booking.client_id == user.id,
            Booking.event_date == data.event_date,
            Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed]),
        )
    )
    if duplicate:
        raise HTTPException(status.HTTP_409_CONFLICT, "Шумо барои ин сана аллакай дархост додаед")

    booking = Booking(**data.model_dump(), client_id=user.id)
    db.add(booking)
    db.commit()
    return _get(db, booking.id)


@router.get("/my", response_model=list[BookingOut])
def my_bookings(user: CurrentUser, db: DB):
    return db.scalars(
        select(Booking).options(*LOAD).where(Booking.client_id == user.id).order_by(Booking.event_date.desc())
    ).all()


@router.get("/incoming", response_model=list[BookingOut])
def incoming_bookings(
    user: VendorUser,
    db: DB,
    status_filter: BookingStatus | None = Query(None, alias="status"),
):
    q = select(Booking).options(*LOAD).join(Listing, Booking.listing_id == Listing.id)
    if user.role != Role.admin:
        q = q.where(Listing.vendor_id == user.id)
    if status_filter:
        q = q.where(Booking.status == status_filter)
    return db.scalars(q.order_by(Booking.event_date.asc())).all()


@router.patch("/{booking_id}/status", response_model=BookingOut)
def change_status(booking_id: int, data: BookingStatusIn, user: CurrentUser, db: DB):
    b = _get(db, booking_id)
    is_vendor = b.listing.vendor_id == user.id or user.role == Role.admin
    is_client = b.client_id == user.id
    new = data.status

    if new in (BookingStatus.confirmed, BookingStatus.rejected):
        if not is_vendor:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Танҳо соҳиби эълон метавонад")
        if b.status != BookingStatus.pending:
            raise HTTPException(status.HTTP_409_CONFLICT, "Танҳо дархостҳои интизорро тағйир додан мумкин")
        if new == BookingStatus.confirmed:
            if b.event_date < date.today():
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Сана гузаштааст")
            if _is_busy(db, b.listing_id, b.event_date, exclude_booking=b.id):
                raise HTTPException(status.HTTP_409_CONFLICT, "Ин сана аллакай банд аст")
    elif new == BookingStatus.cancelled:
        if not (is_client or is_vendor):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Иҷозат нест")
        if b.status not in (BookingStatus.pending, BookingStatus.confirmed):
            raise HTTPException(status.HTTP_409_CONFLICT, "Ин бронро бекор кардан мумкин нест")
        if b.event_date < date.today():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Сана гузаштааст")
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ҳолати нодуруст")

    b.status = new
    try:
        db.flush()
    except IntegrityError:  # ҳимоя аз пойгаи (race) ду тасдиқи ҳамзамон
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Ин сана аллакай банд аст")

    if new == BookingStatus.confirmed:
        # Дархостҳои дигари интизор барои ҳамон сана худкор рад мешаванд
        db.execute(
            update(Booking)
            .where(
                Booking.listing_id == b.listing_id,
                Booking.event_date == b.event_date,
                Booking.status == BookingStatus.pending,
                Booking.id != b.id,
            )
            .values(status=BookingStatus.rejected)
        )
    db.commit()
    db.expire_all()
    return _get(db, booking_id)
