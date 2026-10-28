"""Аксҳои эълонҳои намунавӣ: аксҳои воқеӣ аз Тоҷикистон (Wikimedia Commons, иҷозатномаҳои озод).

Иҷро (пас аз `python -m app.seed --demo`, интернет лозим):  python -m app.seed_photos

Ба ҳар эълони бе акс аксҳои мувофиқ бор мешаванд (uploads/, то 1600px); муаллиф ва иҷозатнома
дар тавсифи эълон навишта мешавад. Мошинҳо аз аксҳои худи лоиҳа (frontend/public/cars) гирифта мешаванд.
Бори дуюм иҷро кардан бехатар аст: агар аксҳои эълон аз рӯйхати PHOTOS фарқ кунанд (рӯйхат иваз шуд),
аксҳои кӯҳна ва қайди муаллифонашон бо аксҳои нав иваз мешаванд; вагарна эълон бетағйир мемонад.
"""
import time
import urllib.error
import urllib.parse
import uuid
from pathlib import Path

from sqlalchemy import select

from app.core.config import get_settings
from app.db import SessionLocal
from app.models import Listing, ListingImage
from app.seed_outfits import _get, commons_info, to_jpeg

_FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
# Дар Docker танҳо frontend/dist ҳаст (Vite public/-ро ба dist/ нусха мекунад)
CARS_DIR = next((d for d in (_FRONTEND / "public" / "cars" / "optimized", _FRONTEND / "dist" / "cars" / "optimized") if d.is_dir()),
                _FRONTEND / "public" / "cars" / "optimized")

# номи эълон → файлҳо дар Commons (ё "car:XX" — акси мошин аз лоиҳа)
PHOTOS = {
    # Тӯйхонаҳо — аксҳои як тарабхонаи воқеии Душанбе барои ҳар эълон (на аксҳои тасодуфии тӯй)
    "Тӯйхонаи «Ориёно»": [  # тарабхонаи «Шоҳсарой»
        'File:Ресторан "Шохсарой" в г. Душанбе 4.jpg',
        'File:Ресторан "Шохсарой" в г. Душанбе 2.jpg',
        'File:Ресторан "Шохсарой" в г. Душанбе 1.jpg',
    ],
    "Тӯйхонаи «Наврӯз»": [  # тарабхонаи «Ҷавонон»
        'File:Ресторан "Джавонон" в г.Душанбе.jpg',
        'File:Ресторан "Джавонон" в г .Душанбе 02.jpg',
    ],
    "Ресторани «Сомон Палас»": [  # тарабхонаи «Дидор»
        'File:Ресторан "Дидор" в г.Душанбе 01.jpg',
        'File:Ресторан "Дидор" в г.Душанбе.jpg',
    ],
    "Толори «Дастархон» барои ош": [  # чойхонаи «Роҳат»
        "File:Chaykhona Rohat (18).jpg",
        "File:Tea House Rohat, Dushanbe, Tajikistan 8.jpg",
        "File:Tea House Rohat, Dushanbe, Tajikistan 2.jpg",
    ],
    "BMW 7 Series барои арӯс": ["car:01", "car:02"],
    "Mercedes S-Class бо ронанда": ["car:08", "car:03"],
    "Rolls-Royce Phantom барои арӯс": ["car:05", "car:06"],
    "Кортежи 4 мошини боҳашамат": ["car:10", "car:07", "car:11"],
    "Либосҳои арӯсӣ — иҷора": [
        "File:Одежда невест Гиссара (Таджикистан).JPG",
        "File:Арӯсу домод, Хуҷанд.jpg",
        "File:Свадебная церемония (Невесты, Гиссар).JPG",
    ],
    "Салони «Malika» — ороиши арӯс": [
        "File:Свадебные наряды таджиков.jpg",
        "File:Одежда невесты (Гиссар).JPG",
        "File:Подружки невесты (Арусбиёрон).jpg",
    ],
    "Ҳофиз ва гурӯҳи созандагон": [
        "File:Свадьба в Гиссаре, Таджикистан (1).jpg",
        "File:Tajik folk music performance.jpg",
        "File:People of Tajikistan for wedding ceremonies 01.jpg",
    ],
    "Тамадаи ботаҷриба — ду забон": [
        "File:People of Tajikistan for wedding ceremonies 06.jpg",
        "File:People of Tajikistan for wedding ceremonies 02.jpg",
    ],
    "Карнайчиён ва сурнайчиён": [
        "File:Karnaj,Qurghonteppa.jpg",
        "File:Wedding ceremonies in Tajikistan 01.jpg",
        "File:Сурнайист (Гиссар, Таджикистан).JPG",
    ],
    "Суратгири тӯй — 500+ сурат": [
        "File:Арӯсу домод, Хуҷанд.jpg",
        "File:Wedding ceremonies in Tajikistan 05.jpg",
        "File:Tajik wedding ceremony (bride).jpg",
    ],
    "Видео бо клипи тӯй, 4K": [
        "File:Wedding ceremonies in Tajikistan 03.jpg",
        "File:Wedding ceremonies in Tajikistan 01.jpg",
    ],
    "Оши наҳор барои 200 нафар": [
        "File:Oshi palov tajik.jpg",
        "File:Tajik plov.jpg",
        "File:Tajik dastarkhan meal.jpg",
    ],
    # Дар манбаъҳои озод акси торти тӯйи тоҷикӣ нест — мизи навхонадорон ва ширинии тоҷикӣ.
    "Торти тӯйи 5-ошёна": [
        "File:Wedding ceremonies in Tajikistan 10.jpg",
        "File:Бодомқандак (2).jpg",
    ],
    "Ороиши толор бо гулҳои зинда": [
        'File:Ресторан "Шохсарой" в г. Душанбе 9.jpg',
        "File:Wedding ceremonies in Tajikistan 10.jpg",
        "File:Wedding ceremonies in Tajikistan 05.jpg",
    ],
}


def _retry(fn, *args):
    # Commons ба дархостҳои зуд 429 медиҳад — каме сабр мекунем
    for attempt in range(5):
        try:
            time.sleep(1)
            return fn(*args)
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 4:
                raise
            time.sleep(10 * (attempt + 1))


def _save(data: bytes) -> str:
    name = f"{uuid.uuid4().hex}.jpg"
    (get_settings().upload_dir / name).write_bytes(to_jpeg(data))
    return f"/uploads/{name}"


def _up_to_date(listing, files) -> bool:
    """Аксҳои эълон ба рӯйхат мувофиқанд: шумора баробар ва ҳар файли Commons дар қайди муаллифон ҳаст."""
    if len(listing.images) != len(files):
        return False
    credits = urllib.parse.unquote(listing.description or "")
    return all(f[5:].replace(" ", "_") in credits for f in files if not f.startswith("car:"))


def _clear(listing):
    """Аксҳои кӯҳна (файлҳо ва сатрҳо) ва қайди муаллифони онҳоро нест мекунад."""
    for image in list(listing.images):
        (get_settings().upload_dir / image.url.rsplit("/", 1)[-1]).unlink(missing_ok=True)
        listing.images.remove(image)
    lines = (listing.description or "").rstrip().split("\n")
    listing.description = "\n".join(line for line in lines if not line.startswith("Акс: ")).rstrip()


def run():
    db = SessionLocal()
    added = 0
    for title, files in PHOTOS.items():
        listing = db.scalar(select(Listing).where(Listing.title == title))
        if not listing or (listing.images and _up_to_date(listing, files)):
            continue
        if listing.images:
            _clear(listing)
            db.flush()
        credits = []
        for sort, file in enumerate(files):
            if file.startswith("car:"):
                url = _save((CARS_DIR / f"car-{file[4:]}-1200.webp").read_bytes())
            else:
                info = _retry(commons_info, file)
                url = _save(_retry(_get, info["url"]))
                credits.append(f"Акс: {info['author']}, {info['license']} — Wikimedia Commons: {info['page']}")
            listing.images.append(ListingImage(url=url, sort=sort))
        if credits:
            listing.description = f"{listing.description}\n\n" + "\n".join(credits)
        db.commit()
        added += 1
        print(f"+ {title}  ({len(files)} акс)")
    print(f"Акс гирифт: {added} эълон")
    db.close()


if __name__ == "__main__":
    run()
