import io
import logging
import re
import uuid

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import select

from app import assistant, tryon
from app.core.config import get_settings
from app.core.security import RateLimiter
from app.deps import DB, CurrentUser, OptionalUser
from app.models import Category, Listing
from app.routers.listings import LOAD
from app.schemas import ListingCard
from app.seed_photos import PHOTOS as SCENE_PHOTOS

log = logging.getLogger("tuyona")
router = APIRouter(prefix="/tryon", tags=["tryon"])

# Ҳар корбар дар як шабонарӯз — то TRYON_DAILY_LIMIT кӯшиш (AI гарон аст).
daily_limiter = RateLimiter(get_settings().tryon_daily_limit, window_seconds=24 * 60 * 60)
MAX_PHOTO_MB = 10


@router.get("/status")
def tryon_status():
    """Кадом провайдер ҳоло кор мекунад ва кадом категорияҳо кадом қисми баданро мепӯшонанд."""
    return {**tryon.status(), "categories": tryon.WEARABLE}


@router.get("/outfits", response_model=list[ListingCard])
def outfits(db: DB, category: str | None = Query(None, description="slug-и категорияи либос")):
    """Либосҳои каталог, ки AI метавонад пӯшонад (танҳо эълонҳои бо сурат)."""
    slugs = [category] if category in tryon.WEARABLE else list(tryon.WEARABLE)
    items = db.scalars(
        select(Listing).options(*LOAD)
        .join(Category, Listing.category_id == Category.id)
        .where(Listing.is_active.is_(True), Category.slug.in_(slugs))
        .order_by(Listing.rating_count.desc(), Listing.id.desc())
        .limit(60)
    ).all()
    # Эълонҳое, ки акси манзараи тӯй доранд (на акси худи либос), ба ороишгоҳ намеоянд
    scenes = set(SCENE_PHOTOS)
    return [l for l in items if l.cover and l.title not in scenes]


@router.post("")
def try_on(photo: UploadFile, user: CurrentUser, db: DB, listing_id: int = Form()):
    """Сурати корбар + либоси эълон → сурати корбар дар он либос. Сурати аслӣ дар сервер нигоҳ дошта намешавад."""
    from PIL import Image, ImageOps, UnidentifiedImageError

    listing = db.scalar(select(Listing).options(*LOAD).where(Listing.id == listing_id, Listing.is_active.is_(True)))
    part = tryon.WEARABLE.get(listing.category.slug) if listing else None
    if not part:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Либос ёфт нашуд")
    if not listing.cover:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Ин либос сурат надорад")
    if part not in tryon.status()["supports"]:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Ин либосро ҳоло пӯшонда наметавонем")

    data = photo.file.read(MAX_PHOTO_MB * 1024 * 1024 + 1)
    if len(data) > MAX_PHOTO_MB * 1024 * 1024:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, f"Сурат бояд аз {MAX_PHOTO_MB} МБ хурдтар бошад")
    s = get_settings()
    try:
        person = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")  # рост, бе EXIF (GPS)
        person.thumbnail((1536, 1536))
        garment = (s.upload_dir / listing.cover.rsplit("/", 1)[-1]).read_bytes()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Суратро хондан нашуд. JPG ё PNG бор кунед.")

    if not daily_limiter.allow(f"tryon:{user.id}"):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Имрӯз кӯшишҳо тамом шуданд. Фардо боз кӯшиш кунед.")

    try:
        result, provider, face_restored = tryon.run_tryon(person, garment, part, tryon.describe(listing.title, listing.category.slug))
    except tryon.TryOnError as error:
        log.warning("Try-on failed: %s", error)
        if isinstance(error, tryon.TryOnQuota):
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Квотаи ройгони AI тамом шуд. Баъдтар кӯшиш кунед.")
        if isinstance(error, tryon.TryOnTimeout):
            raise HTTPException(status.HTTP_504_GATEWAY_TIMEOUT, "Хизмати AI бедор мешавад. Пас аз як дақиқа боз кӯшиш кунед.")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Хизмати AI ҳоло банд аст. Баъдтар кӯшиш кунед.")

    folder = s.upload_dir / "tryon"
    folder.mkdir(exist_ok=True)
    name = f"{uuid.uuid4().hex}.jpg"
    (folder / name).write_bytes(result)
    return {"image": f"/uploads/tryon/{name}", "listing_id": listing.id, "provider": provider, "face_restored": face_restored}


RESULT_PATH = re.compile(r"^/uploads/tryon/[0-9a-f]{32}\.jpg$")
advice_limiter = RateLimiter(get_settings().assistant_hourly_limit, window_seconds=60 * 60)


def _jpeg(data: bytes, side: int = 1024) -> bytes:
    from PIL import Image, ImageOps

    image = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")  # бе EXIF (GPS)
    image.thumbnail((side, side))
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=88)
    return buffer.getvalue()


@router.post("/advice")
def advice(request: Request, db: DB, user: OptionalUser, listing_id: int = Form(),
           photo: UploadFile | None = File(None), result: str | None = Form(None)):
    """Маслиҳати стилисти AI: сурати корбар (ё натиҷаи ороишгоҳ) + либос → маслиҳат ва либосҳои дигари каталог."""
    from PIL import UnidentifiedImageError

    if not assistant.enabled():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Ёрдамчии AI ҳоло фаъол нест")
    listing = db.scalar(select(Listing).options(*LOAD).where(Listing.id == listing_id, Listing.is_active.is_(True)))
    if not listing or listing.category.slug not in tryon.WEARABLE:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Либос ёфт нашуд")
    key = f"user:{user.id}" if user else f"ip:{request.client.host if request.client else '?'}"
    if not advice_limiter.allow(key):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Саволҳо зиёд шуданд. Каме баъдтар кӯшиш кунед.")

    s = get_settings()
    images = []
    try:
        if result and RESULT_PATH.match(result):
            images.append(("корбар дар либоси интихобшуда (натиҷаи ороишгоҳи AI)", _jpeg((s.upload_dir / "tryon" / result.rsplit("/", 1)[-1]).read_bytes())))
        elif photo is not None:
            data = photo.file.read(MAX_PHOTO_MB * 1024 * 1024 + 1)
            if len(data) > MAX_PHOTO_MB * 1024 * 1024:
                raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, f"Сурат бояд аз {MAX_PHOTO_MB} МБ хурдтар бошад")
            images.append(("сурати корбар (ҳоло бе ин либос)", _jpeg(data)))
        if listing.cover:
            images.append((f"либоси «{listing.title}»", _jpeg((s.upload_dir / listing.cover.rsplit("/", 1)[-1]).read_bytes(), 768)))
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Суратро хондан нашуд. JPG ё PNG бор кунед.")

    others = [o for o in outfits(db) if o.id != listing.id]
    price = lambda l: f"аз {l.price_from} сомонӣ {assistant.PRICE_UNITS.get(l.price_unit.value, '')}".strip()
    try:
        text = assistant.stylist(
            {"title": listing.title, "category": listing.category.name, "price": price(listing), "description": listing.description},
            images,
            [{"id": o.id, "title": o.title, "category": o.category.name, "price": price(o)} for o in others],
        )
    except assistant.AssistantError as error:
        log.warning("Stylist failed: %s", error)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Стилисти AI ҳоло ҷавоб дода наметавонад. Баъдтар кӯшиш кунед.")
    linked = [o for o in others if f"/listing/{o.id})" in text]
    return {
        "advice": text or "Маслиҳат тайёр нашуд. Боз кӯшиш кунед.",
        "listings": [{"id": o.id, "title": o.title, "city": o.city.name, "price": price(o), "cover": o.cover} for o in linked],
    }
