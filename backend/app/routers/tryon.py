import base64
import io
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

import jwt

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import select

from app import assistant, gender, tryon
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
    """Кадом провайдер ҳоло кор мекунад, кадом категорияҳо кадом қисми баданро мепӯшонанд ва барои кӣ (мард/зан)."""
    return {**tryon.status(), "categories": tryon.WEARABLE, "genders": gender.OUTFIT_GENDER}


@router.get("/outfits", response_model=list[ListingCard])
def outfits(db: DB, category: str | None = Query(None, description="slug-и категорияи либос"),
            for_gender: Literal["male", "female"] | None = Query(None, alias="gender", description="танҳо либосҳои мардона ё занона")):
    """Либосҳои каталог, ки AI метавонад пӯшонад (танҳо эълонҳои бо сурат)."""
    slugs = [category] if category in tryon.WEARABLE else list(tryon.WEARABLE)
    if for_gender:
        slugs = [s for s in slugs if gender.OUTFIT_GENDER.get(s) == for_gender]
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


detect_limiter = RateLimiter(120, window_seconds=60 * 60)


def _read_photo(photo: UploadFile):
    from PIL import Image, ImageOps, UnidentifiedImageError

    data = photo.file.read(MAX_PHOTO_MB * 1024 * 1024 + 1)
    if len(data) > MAX_PHOTO_MB * 1024 * 1024:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, f"Сурат бояд аз {MAX_PHOTO_MB} МБ хурдтар бошад")
    try:
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")  # рост, бе EXIF (GPS)
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Суратро хондан нашуд. JPG ё PNG бор кунед.")
    image.thumbnail((1536, 1536))
    return image


def _detect(image) -> dict:
    try:
        return gender.detect(image)
    except Exception as error:  # модел бор нашуд (интернет) — корбар худаш интихоб мекунад
        log.warning("Gender detection failed: %s", error)
        return {"gender": None, "confidence": 0}


@router.post("/detect")
def detect_gender(request: Request, photo: UploadFile, user: OptionalUser):
    """Мард ё зан дар сурат (CLIP, ~50 мс). gender: null — AI мутмаин нест, корбар интихоб мекунад."""
    key = f"user:{user.id}" if user else f"ip:{request.client.host if request.client else '?'}"
    if not detect_limiter.allow(key):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Кӯшишҳо зиёд шуданд. Баъдтар кӯшиш кунед.")
    return _detect(_read_photo(photo))


PREP_MINUTES = 10


def _checked(db, listing_id: int, photo: UploadFile, person_gender: str | None):
    """Санҷишҳои умумӣ: либос, сурат, мард/зан. (эълон, қисми бадан, сурат, акси либос) бармегардонад."""
    listing = db.scalar(select(Listing).options(*LOAD).where(Listing.id == listing_id, Listing.is_active.is_(True)))
    part = tryon.WEARABLE.get(listing.category.slug) if listing else None
    if not part:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Либос ёфт нашуд")
    if not listing.cover:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Ин либос сурат надорад")
    person = _read_photo(photo)
    cover = get_settings().upload_dir / listing.cover.rsplit("/", 1)[-1]
    # Либоси занона ба мард ва мардона ба зан пӯшонда намешавад
    who = person_gender or _detect(person)["gender"]
    if who is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "AI суратро хонда натавонист. Сурати дигар бор кунед (қад ва рӯй намоён бошад).")
    needed = gender.OUTFIT_GENDER.get(listing.category.slug)
    if needed and needed != who:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT,
                            f"Ин либоси {gender.NAMES[needed]} аст. Барои сурати {'мард' if who == 'male' else 'зан'} либоси {gender.NAMES[who]}-ро интихоб кунед.")
    return listing, part, person, cover


def _prep_token(user_id: int, listing_id: int) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": str(user_id), "lid": listing_id, "typ": "tryon", "iat": now, "exp": now + timedelta(minutes=PREP_MINUTES)},
                      get_settings().secret_key, algorithm=get_settings().jwt_algorithm)


def _valid_prep(token: str | None, user_id: int, listing_id: int) -> bool:
    if not token:
        return False
    try:
        data = jwt.decode(token, get_settings().secret_key, algorithms=[get_settings().jwt_algorithm])
    except jwt.PyJWTError:
        return False
    return data.get("typ") == "tryon" and data.get("sub") == str(user_id) and data.get("lid") == listing_id


def _quota_message(error: str) -> str:
    """«Try again in 5:12:40» аз Hugging Face → вақти фаҳмо барои корбар."""
    m = re.search(r"Try again in (\d+):(\d+):\d+", error)
    if not m:
        return "Квотаи ройгони AI барои имрӯз тамом шуд. Баъдтар кӯшиш кунед."
    hours, minutes = int(m.group(1)), int(m.group(2))
    wait = f"{hours} соат" if hours else f"{max(minutes, 1)} дақиқа"
    return f"Квотаи ройгони AI барои имрӯз тамом шуд. Тақрибан пас аз {wait} боз кӯшиш кунед."


def _save_result(jpeg: bytes) -> str:
    folder = get_settings().upload_dir / "tryon"
    folder.mkdir(exist_ok=True)
    name = f"{uuid.uuid4().hex}.jpg"
    (folder / name).write_bytes(jpeg)
    return f"/uploads/tryon/{name}"


@router.post("/prepare")
def prepare(photo: UploadFile, user: CurrentUser, db: DB, listing_id: int = Form(),
            person_gender: Literal["male", "female"] | None = Form(None, alias="gender")):
    """Қадами 1-и пӯшондан дар браузер: сурат ва либоси тайёр (3:4) барои Leffa.
    Браузер онҳоро бевосита ба Hugging Face мефиристад — квотаи GPU аз IP-и худи корбар, на аз сервер."""
    listing, part, person, cover = _checked(db, listing_id, photo, person_gender)
    if not daily_limiter.allow(f"tryon:{user.id}"):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Имрӯз кӯшишҳо тамом шуданд. Фардо боз кӯшиш кунед.")
    padded, _ = tryon.pad_to_portrait(person)
    b64 = lambda data: base64.b64encode(data).decode()
    common = {"token": _prep_token(user.id, listing.id), "person": b64(tryon._jpeg(padded)), "garment": b64(tryon.garment_jpeg(cover))}
    # Болопӯш — IDM-VTON (квотаи GPU 60 с), либоси пурра — Leffa (180 с)
    if part == "upper":
        return {**common, "provider": "idm", "space": tryon.HF_SPACE, "description": tryon.describe(listing.title, listing.category.slug)}
    model, garment_type = tryon.LEFFA_TYPES[part]
    return {**common, "provider": "leffa", "space": tryon.LEFFA_SPACE, "model": model, "garment_type": garment_type}


@router.post("/finish")
def finish(photo: UploadFile, result: UploadFile, user: CurrentUser, db: DB, listing_id: int = Form(), token: str = Form()):
    """Қадами 3: натиҷаи Leffa аз браузер → андозаи сурати аслӣ ва рӯйи аслӣ. Танҳо бо токени /prepare (10 дақиқа)."""
    from PIL import Image, UnidentifiedImageError

    if not _valid_prep(token, user.id, listing_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Вақти кӯшиш гузашт. Боз «Пӯшондан»-ро пахш кунед.")
    person = _read_photo(photo)
    raw = result.file.read(MAX_PHOTO_MB * 1024 * 1024 + 1)
    try:
        if len(raw) > MAX_PHOTO_MB * 1024 * 1024:
            raise OSError("too large")
        Image.open(io.BytesIO(raw)).verify()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Натиҷаи AI хонда нашуд. Боз кӯшиш кунед.")
    jpeg, face_restored = tryon.finish(person, raw)
    return {"image": _save_result(jpeg), "listing_id": listing_id, "provider": "leffa-browser", "face_restored": face_restored}


@router.post("")
def try_on(photo: UploadFile, user: CurrentUser, db: DB, listing_id: int = Form(),
           person_gender: Literal["male", "female"] | None = Form(None, alias="gender"), token: str | None = Form(None)):
    """Пӯшондан тавассути сервер (захира, агар браузер ба Hugging Face пайваст нашавад).
    token аз /prepare — кӯшиши ҳамон либос дубора ҳисоб намешавад."""
    listing, part, person, cover = _checked(db, listing_id, photo, person_gender)
    if part not in tryon.status()["supports"]:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Ин либосро ҳоло пӯшонда наметавонем")
    if not _valid_prep(token, user.id, listing.id) and not daily_limiter.allow(f"tryon:{user.id}"):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Имрӯз кӯшишҳо тамом шуданд. Фардо боз кӯшиш кунед.")
    try:
        result, provider, face_restored = tryon.run_tryon(person, tryon.garment_jpeg(cover), part, tryon.describe(listing.title, listing.category.slug))
    except tryon.TryOnError as error:
        log.warning("Try-on failed: %s", error)
        if isinstance(error, tryon.TryOnQuota):
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, _quota_message(str(error)))
        if isinstance(error, tryon.TryOnTimeout):
            raise HTTPException(status.HTTP_504_GATEWAY_TIMEOUT, "Хизмати AI бедор мешавад. Пас аз як дақиқа боз кӯшиш кунед.")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Хизмати AI ҳоло банд аст. Баъдтар кӯшиш кунед.")
    return {"image": _save_result(result), "listing_id": listing.id, "provider": provider, "face_restored": face_restored}


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
