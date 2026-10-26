import re
from datetime import date, datetime
from typing import Annotated, Generic, TypeVar

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import BookingStatus, PriceUnit, Role

T = TypeVar("T")


def normalize_tj_phone(value: str) -> str:
    """Рақами Тоҷикистонро ба шакли +992XXXXXXXXX меорад."""
    digits = re.sub(r"\D", "", value or "")
    if len(digits) == 9:
        digits = "992" + digits
    if not (len(digits) == 12 and digits.startswith("992")):
        raise ValueError("Рақами телефон бояд дар шакли +992XXXXXXXXX бошад")
    return "+" + digits


Phone = Annotated[str, AfterValidator(normalize_tj_phone)]
Email = Annotated[EmailStr, AfterValidator(str.lower)]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int


# ---------- Auth ----------
class RegisterIn(BaseModel):
    email: Email
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=6, max_length=72)
    role: Role = Role.client


class LoginIn(BaseModel):
    email: Email
    password: str = Field(min_length=1, max_length=72)


class UserOut(ORM):
    id: int
    email: str
    full_name: str
    role: Role
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)


# ---------- Catalog ----------
class CityOut(ORM):
    id: int
    slug: str
    name: str


class CategoryOut(ORM):
    id: int
    slug: str
    name: str
    icon: str
    group_id: int


class CategoryGroupOut(ORM):
    id: int
    slug: str
    name: str
    icon: str
    categories: list[CategoryOut]


# ---------- Listings ----------
class ImageOut(ORM):
    id: int
    url: str


class VendorPublic(ORM):
    id: int
    full_name: str


class ListingBase(BaseModel):
    category_id: int
    city_id: int
    title: str = Field(min_length=3, max_length=140)
    description: str = Field(default="", max_length=5000)
    address: str = Field(default="", max_length=200)
    contact_phone: Phone
    price_from: int = Field(ge=0, le=10_000_000)
    price_unit: PriceUnit = PriceUnit.event
    capacity: int | None = Field(default=None, ge=1, le=10_000)


class ListingCreate(ListingBase):
    pass


class ListingUpdate(BaseModel):
    category_id: int | None = None
    city_id: int | None = None
    title: str | None = Field(default=None, min_length=3, max_length=140)
    description: str | None = Field(default=None, max_length=5000)
    address: str | None = Field(default=None, max_length=200)
    contact_phone: Phone | None = None
    price_from: int | None = Field(default=None, ge=0, le=10_000_000)
    price_unit: PriceUnit | None = None
    capacity: int | None = Field(default=None, ge=1, le=10_000)
    is_active: bool | None = None


class ListingCard(ORM):
    id: int
    title: str
    price_from: int
    price_unit: PriceUnit
    capacity: int | None
    rating_avg: float
    rating_count: int
    is_active: bool
    city: CityOut
    category: CategoryOut
    cover: str | None = None


class ListingDetail(ListingCard):
    description: str
    address: str
    contact_phone: str
    views: int
    images: list[ImageOut]
    vendor: VendorPublic
    created_at: datetime
    is_favorite: bool = False


class AvailabilityOut(BaseModel):
    listing_id: int
    month: str  # YYYY-MM
    busy: list[date]


class BlockDatesIn(BaseModel):
    days: list[date] = Field(min_length=1, max_length=62)


# ---------- Bookings ----------
# Қонуни ҶТ №2048, моддаи 12: зиёфати тӯй — то 150 нафар, оши тӯй — то 200 нафар
FEAST_MAX_GUESTS = 150
OSH_MAX_GUESTS = 200


class BookingCreate(BaseModel):
    listing_id: int
    event_date: date
    guests: int | None = Field(default=None, ge=1, le=OSH_MAX_GUESTS)
    note: str = Field(default="", max_length=1000)
    contact_phone: Phone


class BookingListingBrief(ORM):
    id: int
    title: str
    cover: str | None = None


class BookingOut(ORM):
    id: int
    event_date: date
    guests: int | None
    note: str
    contact_phone: str
    status: BookingStatus
    created_at: datetime
    listing: BookingListingBrief
    client: VendorPublic


class BookingStatusIn(BaseModel):
    status: BookingStatus


# ---------- Reviews ----------
class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    text: str = Field(default="", max_length=2000)


class ReviewOut(ORM):
    id: int
    rating: int
    text: str
    created_at: datetime
    author: VendorPublic


# ---------- Admin ----------
class AdminUserOut(UserOut):
    is_active: bool


class AdminStats(BaseModel):
    users: int
    vendors: int
    listings: int
    active_listings: int
    bookings: int
    bookings_confirmed: int


# ---------- Vendor ----------
class VendorStats(BaseModel):
    listings: int
    active_listings: int
    total_views: int
    bookings_pending: int
    bookings_confirmed: int
    upcoming: list[BookingOut]


# ---------- Фармоиши мошинҳо (галереяи «Мошинҳои бартар») ----------
CAR_IDS = {f"{i:02d}" for i in range(1, 12)}  # car-01 … car-11
MAX_CARS = 4  # Қонуни ҶТ №2048, моддаи 12: корвони тӯй — на бештар аз 4 мошин
# Моддаи 16: тӯй барвақттар аз 06:00 (деҳот, тобистон) оғоз намешавад ва то 22:00 анҷом меёбад
EARLIEST_START, LATEST_START = "06:00", "21:00"


class CarOrderCreate(BaseModel):
    cars: list[str] = Field(min_length=1, max_length=MAX_CARS)
    event_date: date
    start_time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    pickup_address: str = Field(default="", max_length=200)
    contact_phone: Phone
    note: str = Field(default="", max_length=1000)

    @field_validator("start_time")
    @classmethod
    def _start(cls, v: str) -> str:
        if not EARLIEST_START <= v <= LATEST_START:
            raise ValueError(f"Тибқи қонун тӯй то соати 22:00 анҷом меёбад — вақти оғоз аз {EARLIEST_START} то {LATEST_START}")
        return v

    @field_validator("cars")
    @classmethod
    def _cars(cls, v: list[str]) -> list[str]:
        if len(set(v)) != len(v):
            raise ValueError("Мошин такрор шудааст")
        unknown = [c for c in v if c not in CAR_IDS]
        if unknown:
            raise ValueError(f"Мошини номаълум: {', '.join(unknown)}")
        return sorted(v)


class CarOrderOut(ORM):
    id: int
    cars: list[str] = Field(validation_alias="car_ids")
    event_date: date
    start_time: str
    pickup_address: str
    contact_phone: str
    note: str
    status: BookingStatus
    created_at: datetime
    client: VendorPublic
