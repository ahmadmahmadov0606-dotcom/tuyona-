"""Пур кардани база бо категорияҳо, шаҳрҳо ва эълонҳои намунавӣ.

Иҷро:  python -m app.seed          (танҳо категорияҳо ва шаҳрҳо)
       python -m app.seed --demo   (+ хизматрасони намунавӣ ва эълонҳо)
"""
import random
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db import Base, SessionLocal, engine
from app.models import Category, CategoryGroup, City, Listing, PriceUnit, Role, User

CITIES = [
    ("dushanbe", "Душанбе"), ("khujand", "Хуҷанд"), ("bokhtar", "Бохтар"),
    ("kulob", "Кӯлоб"), ("istaravshan", "Истаравшан"), ("panjakent", "Панҷакент"),
    ("hisor", "Ҳисор"), ("vahdat", "Ваҳдат"), ("tursunzoda", "Турсунзода"),
    ("isfara", "Исфара"), ("khorugh", "Хоруғ"), ("danghara", "Данғара"),
]

CATEGORIES = [
    ("venue", "Ҷой", "🏛", [
        ("tuykhona", "Тӯйхона ва ресторан", "🏛"),
        ("small-hall", "Толори хурд (ош, хостгорӣ)", "🍽"),
        ("garden", "Ҳавлӣ ва боғ", "🌳"),
    ]),
    ("transport", "Нақлиёт", "🚗", [
        ("bride-car", "Мошини арӯс", "🚘"),
        ("cortege", "Мошинҳои кортеж", "🚗"),
        ("bus", "Автобус барои меҳмонон", "🚌"),
        ("car-decor", "Ороиши мошин", "🎀"),
    ]),
    ("bride", "Арӯс", "👰", [
        ("wedding-dress", "Либоси арӯсӣ", "👗"),
        ("national-dress", "Атлас ва либоси миллӣ", "🧵"),
        ("beauty-salon", "Салони ҳуснорой", "💄"),
        ("jewelry", "Тилло ва ҷавоҳирот", "💍"),
    ]),
    ("groom", "Домод", "🤵", [
        ("suit", "Костюм", "🤵"),
        ("chapan", "Чапон ва тоқӣ", "🧥"),
        ("barber", "Сартарошхона", "💈"),
    ]),
    ("program", "Барнома", "🎤", [
        ("singer", "Сароянда ва ҳофиз", "🎤"),
        ("tamada", "Тамада", "🎙"),
        ("karnay", "Карнай ва сурнай", "🎺"),
        ("dancers", "Гурӯҳи рақс", "💃"),
        ("dj-sound", "DJ, садо ва равшанӣ", "🎧"),
    ]),
    ("media", "Сурат ва видео", "📸", [
        ("photographer", "Суратгир", "📸"),
        ("videographer", "Видеограф", "🎥"),
        ("drone", "Дрон", "🚁"),
        ("studio", "Студияи сурат", "🖼"),
    ]),
    ("food", "Хӯрок", "🍰", [
        ("oshpaz", "Ошпаз (оши наҳор)", "🍚"),
        ("cake", "Торт", "🎂"),
        ("dastarkhan", "Дастархон ва ширинӣ", "🍬"),
        ("tabaq", "Табақ барои арӯсу домод", "🧺"),
    ]),
    ("decor", "Ороиш", "💐", [
        ("hall-decor", "Ороиши толор", "✨"),
        ("flowers", "Гул ва гулдаста", "💐"),
        ("arch", "Арк ва нишастгоҳи арӯс", "🌸"),
        ("balloons", "Пуфакҳо", "🎈"),
    ]),
    ("dowry", "Ҷаҳиз ва тӯҳфа", "🎁", [
        ("bedding", "Сандуқ, кӯрпа, болишт", "🛏"),
        ("furniture", "Мебел ва асбоби рӯзгор", "🛋"),
    ]),
    ("other", "Дигар", "✉️", [
        ("invitations", "Даъватнома", "✉️"),
        ("rentals", "Иҷораи миз, курсӣ, хайма", "⛺"),
    ]),
]

DEMO = {
    "tuykhona": [("Тӯйхонаи «Ориёно»", 250, PriceUnit.person, 600), ("Тӯйхонаи «Наврӯз»", 180, PriceUnit.person, 400),
                 ("Ресторани «Сомон Палас»", 300, PriceUnit.person, 800)],
    "small-hall": [("Толори «Дастархон» барои ош", 3000, PriceUnit.event, 120)],
    "bride-car": [("BMW 7 Series барои арӯс", 1500, PriceUnit.event, None),
                  ("Mercedes S-Class бо ронанда", 1200, PriceUnit.event, None),
                  ("Rolls-Royce Phantom барои арӯс", 1800, PriceUnit.event, None)],
    "cortege": [("Кортежи 4 мошини боҳашамат", 2500, PriceUnit.event, None)],
    "wedding-dress": [("Либосҳои арӯсӣ — иҷора", 900, PriceUnit.day, None)],
    "beauty-salon": [("Салони «Malika» — ороиши арӯс", 700, PriceUnit.event, None)],
    "singer": [("Ҳофиз ва гурӯҳи созандагон", 5000, PriceUnit.event, None)],
    "tamada": [("Тамадаи ботаҷриба — ду забон", 2000, PriceUnit.event, None)],
    "karnay": [("Карнайчиён ва сурнайчиён", 1000, PriceUnit.event, None)],
    "photographer": [("Суратгири тӯй — 500+ сурат", 2500, PriceUnit.event, None)],
    "videographer": [("Видео бо клипи тӯй, 4K", 3500, PriceUnit.event, None)],
    "oshpaz": [("Оши наҳор барои 200 нафар", 40, PriceUnit.person, 200)],
    "cake": [("Торти тӯйи 5-ошёна", 1200, PriceUnit.item, None)],
    "hall-decor": [("Ороиши толор бо гулҳои зинда", 4000, PriceUnit.event, None)],
}


def seed_reference(db: Session):
    for i, (slug, name) in enumerate(CITIES):
        if not db.scalar(select(City).where(City.slug == slug)):
            db.add(City(slug=slug, name=name, sort=i))
    for gi, (gslug, gname, gicon, cats) in enumerate(CATEGORIES):
        group = db.scalar(select(CategoryGroup).where(CategoryGroup.slug == gslug))
        if not group:
            group = CategoryGroup(slug=gslug, name=gname, icon=gicon, sort=gi)
            db.add(group)
            db.flush()
        for ci, (cslug, cname, cicon) in enumerate(cats):
            if not db.scalar(select(Category).where(Category.slug == cslug)):
                db.add(Category(group_id=group.id, slug=cslug, name=cname, icon=cicon, sort=ci))
    db.commit()


def seed_demo(db: Session):
    if db.scalar(select(User).where(User.email == "vendor@tuyona.tj")):
        return
    vendor = User(email="vendor@tuyona.tj", full_name="Хизматрасони намунавӣ",
                  password_hash=hash_password("demo1234"), role=Role.vendor)
    client = User(email="client@tuyona.tj", full_name="Мизоҷи намунавӣ",
                  password_hash=hash_password("demo1234"), role=Role.client)
    db.add_all([vendor, client])
    db.flush()
    cities = db.scalars(select(City).order_by(City.sort)).all()
    rnd = random.Random(7)
    for slug, items in DEMO.items():
        cat = db.scalar(select(Category).where(Category.slug == slug))
        for title, price, unit, cap in items:
            city = cities[0] if rnd.random() < 0.6 else rnd.choice(cities[:4])
            db.add(Listing(
                vendor_id=vendor.id, category_id=cat.id, city_id=city.id, title=title,
                description=f"{title}. Хизмати боэътимод барои тӯйи шумо. Барои маълумоти бештар занг занед.",
                address=f"{city.name}, кӯчаи Рӯдакӣ", contact_phone="+992900000001",
                price_from=price, price_unit=unit, capacity=cap,
                views=rnd.randint(20, 900),
            ))
    db.commit()


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_reference(db)
        if "--demo" in sys.argv:
            seed_demo(db)
    print("Seed tayyor ✓")
