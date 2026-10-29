from datetime import date

from fastapi import APIRouter
from sqlalchemy import func, select

from app.deps import DB, CurrentUser, VendorUser
from app.models import Booking, BookingStatus, Favorite, Listing
from app.routers.bookings import LOAD as BOOKING_LOAD
from app.routers.listings import LOAD as LISTING_LOAD
from app.schemas import ListingCard, VendorStats

router = APIRouter(tags=["me"])


@router.get("/me/favorites", response_model=list[ListingCard])
def my_favorites(user: CurrentUser, db: DB):
    return db.scalars(
        select(Listing)
        .options(*LISTING_LOAD)
        .join(Favorite, Favorite.listing_id == Listing.id)
        .where(Favorite.user_id == user.id, Listing.is_active.is_(True))
        .order_by(Favorite.created_at.desc())
    ).all()


@router.get("/vendor/listings", response_model=list[ListingCard])
def vendor_listings(user: VendorUser, db: DB):
    return db.scalars(
        select(Listing).options(*LISTING_LOAD).where(Listing.vendor_id == user.id).order_by(Listing.id.desc())
    ).all()


@router.get("/vendor/stats", response_model=VendorStats)
def vendor_stats(user: VendorUser, db: DB):
    total, views = db.execute(
        select(func.count(Listing.id), func.coalesce(func.sum(Listing.views), 0)).where(
            Listing.vendor_id == user.id
        )
    ).one()
    active = db.scalar(
        select(func.count(Listing.id)).where(Listing.vendor_id == user.id, Listing.is_active.is_(True))
    )

    def count(st: BookingStatus) -> int:
        return db.scalar(
            select(func.count(Booking.id))
            .join(Listing, Booking.listing_id == Listing.id)
            .where(Listing.vendor_id == user.id, Booking.status == st)
        ) or 0

    upcoming = db.scalars(
        select(Booking)
        .options(*BOOKING_LOAD)
        .join(Listing, Booking.listing_id == Listing.id)
        .where(
            Listing.vendor_id == user.id,
            Booking.status == BookingStatus.confirmed,
            Booking.event_date >= date.today(),
        )
        .order_by(Booking.event_date.asc())
        .limit(10)
    ).all()

    return VendorStats(
        listings=total,
        active_listings=active or 0,
        total_views=views,
        bookings_pending=count(BookingStatus.pending),
        bookings_confirmed=count(BookingStatus.confirmed),
        upcoming=upcoming,
    )
