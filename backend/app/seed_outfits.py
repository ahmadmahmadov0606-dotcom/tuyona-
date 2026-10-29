"""Либосҳо барои ороишгоҳи AI (/oroishgoh): аксҳои воқеӣ аз Wikimedia Commons бо иҷозатномаҳои озод.

Иҷро (пас аз `python -m app.seed --demo`, интернет лозим):  python -m app.seed_outfits

Аксҳо ба uploads/ (то 1600px) бор мешаванд; муаллиф ва иҷозатномаи ҳар акс дар тавсифи эълон навишта мешавад.
Бори дуюм иҷро кардан бехатар аст: эълонҳои мавҷуда (аз рӯи ном) такрор намешаванд.
"""
import io
import json
import re
import urllib.parse
import urllib.request
import uuid

from sqlalchemy import select

from app.core.config import get_settings
from app.db import SessionLocal
from app.models import Category, City, Listing, ListingImage, PriceUnit, User

UA = {"User-Agent": "tuyona/1.0 (wedding marketplace; seed script)"}
API = "https://commons.wikimedia.org/w/api.php"

# (категория, ном, нарх барои 1 рӯз, тавсиф, файл дар Commons)
OUTFITS = [
    ("suit", "Смокинги сиёҳи классикӣ", 450, "Смокинги сиёҳ бо ёқаи атлас — барои домод дар шаби тӯй.",
     "File:Three-Piece Black Wool Tuxedo Belonging to Charles Lindbergh - DPLA - 843a9a277cbac3b6ecd673477bcd8b82 (page 2).jpg"),
    # Ороишгоҳ: либос бояд рост ва аз рӯ ба рӯ бошад (дар манекен ё дар тани одам). Акси ҳамвор бо остинҳои
    # кушода AI-ро ба «бол» мебарад — чунин аксҳо иваз шуданд (ниг. RENAMED).
    ("suit", "Пиҷаки хокистарии хатдор", 350, "Пиҷаки хокистарии классикӣ бо хатҳои борик, се тугма — барои тӯй ва зиёфат.",
     "File:BijanSuit1.jpg"),
    ("suit", "Пиҷаки кабуди хатдор", 300, "Пиҷаки кабуди торик бо хатҳои борик — барои хостгорӣ ва рӯзи тӯй.",
     "File:Loto Casual Blazers (125).jpg"),
    ("chapan", "Чапони кабуди духтадӯзӣ", 400, "Чапони бахмали кабуд бо гулдӯзии зардӯзӣ дар канорҳо.",
     "File:Manteau brodé de cérémonie (Boukhara, Ouzbékistan) (5676363385).jpg"),
    ("chapan", "Чапони кабуди лиҳофӣ", 350, "Чапони лиҳофии кабуд — анъанавӣ, гарм ва зебо барои домод.",
     "File:Chopon kiygan erkak.png"),
    ("chapan", "Чапони рахдор ва тоқӣ", 300, "Чапони анъанавии рахдор бо тоқӣ — барои домод ва меҳмонони тӯй.",
     "File:Erkaklar milliy libosi 3.png"),
    ("wedding-dress", "Либоси арӯсии сафеди тӯрӣ", 2500, "Либоси арӯсии сафед бо тӯр ва домани пуфак.",
     "File:1957 wedding dress.jpg"),
    ("wedding-dress", "Либоси арӯсии сафеди атласӣ", 2200, "Либоси арӯсии сафеди атласӣ бо силуэти «A», камари гулдӯзӣ ва домани васеъ.",
     "File:A Line Wedding Dress.jpg"),
    ("national-dress", "Либоси атласи миллӣ", 600, "Куртаи атлас ва домани абрбандӣ — барои ош ва рӯзи дуюми тӯй.",
     "File:Dress for women of Uzbekistan.jpg"),
    ("national-dress", "Либоси атласи кабуд", 550, "Либоси атласи миллии кабуд бо нақши абрбандӣ — барои ош ва рӯзи дуюми тӯй.",
     "File:Ayollar milliy libosi 13.png"),
]


# Номи кӯҳна → нав: дар базаҳои мавҷуда эълон бо ном, тавсиф ва акси нав иваз мешавад
RENAMED = {
    "Пиҷаки зиёфатии сиёҳ": "Пиҷаки хокистарии хатдор",
    "Чапони сурхи абрбандӣ (икат)": "Чапони кабуди лиҳофӣ",
    "Либоси атласи сурх": "Либоси атласи кабуд",
}


def _get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def _strip(html):
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html or "")).strip()
    half = len(text) // 2
    return text[:half] if len(text) % 2 == 0 and text[:half] == text[half:] else text  # Commons баъзан номро ду бор медиҳад


def commons_info(title):
    q = urllib.parse.urlencode({"action": "query", "format": "json", "titles": title, "prop": "imageinfo",
                                "iiprop": "url|extmetadata", "iiurlwidth": 1280})
    page = next(iter(json.loads(_get(f"{API}?{q}"))["query"]["pages"].values()))
    ii = page["imageinfo"][0]
    meta = ii.get("extmetadata", {})
    return {
        "url": ii.get("thumburl") or ii["url"],
        "page": ii["descriptionurl"],
        "author": _strip(meta.get("Artist", {}).get("value")) or "номаълум",
        "license": meta.get("LicenseShortName", {}).get("value", ""),
    }


def to_jpeg(data):
    from PIL import Image, ImageOps

    image = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
    image.thumbnail((1600, 1600))
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=88)
    return buffer.getvalue()


def run():
    s = get_settings()
    db = SessionLocal()
    vendor = db.scalar(select(User).where(User.email == "vendor@tuyona.tj"))
    city = db.scalar(select(City).where(City.slug == "dushanbe"))
    if not vendor or not city:
        raise SystemExit("Аввал иҷро кунед: python -m app.seed --demo")
    added = updated = 0
    old_titles = {new: old for old, new in RENAMED.items()}
    for slug, title, price, text, file in OUTFITS:
        listing = db.scalar(select(Listing).where(Listing.title.in_([title, old_titles.get(title, title)])))
        # Акси ҳамин файл аллакай ҳаст — бетағйир
        if listing and file[5:].replace(" ", "_") in urllib.parse.unquote(listing.description or ""):
            continue
        category = db.scalar(select(Category).where(Category.slug == slug))
        info = commons_info(file)
        name = f"{uuid.uuid4().hex}.jpg"
        (s.upload_dir / name).write_bytes(to_jpeg(_get(info["url"])))
        credit = f"Акс: {info['author']}, {info['license']} — Wikimedia Commons: {info['page']}"
        description = f"{text} Иҷора барои рӯзи тӯй; андозаро пешакӣ занг зада аниқ кунед.\n\n{credit}"
        if listing:  # акси кӯҳна (ва номи кӯҳна) иваз мешавад
            for image in list(listing.images):
                (s.upload_dir / image.url.rsplit("/", 1)[-1]).unlink(missing_ok=True)
                listing.images.remove(image)
            listing.title, listing.description, listing.price_from = title, description, price
            updated += 1
        else:
            listing = Listing(
                vendor_id=vendor.id, category_id=category.id, city_id=city.id, title=title, description=description,
                address=f"{city.name}", contact_phone="+992900000001", price_from=price, price_unit=PriceUnit.day,
            )
            db.add(listing)
            added += 1
        listing.images.append(ListingImage(url=f"/uploads/{name}", sort=0))
        db.commit()
        print(f"+ {title}  ({info['license']}, {info['author']})")
    print(f"Илова шуд: {added}, иваз шуд: {updated}, бетағйир: {len(OUTFITS) - added - updated}")
    db.close()


if __name__ == "__main__":
    run()
