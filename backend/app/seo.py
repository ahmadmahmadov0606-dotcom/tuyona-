"""SEO: рендери серверии саҳифаҳои оммавӣ барои ботҳои ҷустуҷӯ ва превюи Telegram/WhatsApp/Facebook.

Сайт SPA (React) аст — бе JavaScript HTML холӣ мебуд. Барои ҳар суроға сервер ба index.html илова мекунад:
  • <title>, description, canonical, Open Graph, Twitter Card, robots, кодҳои тасдиқи Google/Яндекс;
  • матни воқеии саҳифа аз база (сарлавҳа, тавсиф, рӯйхати хизматҳо бо пайванд) дар дохили #root —
    React онро ҳангоми оғоз бо интерфейси пурра иваз мекунад;
  • JSON-LD (Organization, WebSite, Service + Offer, BreadcrumbList).
Ҳамчунин robots.txt, sitemap.xml ва тасвирҳои OG 1200×630.
"""
import io
import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html import escape
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.models import Category, CategoryGroup, Listing

SITE_NAME = "Тӯёна"
DEFAULT_TITLE = "Тӯёна — хизматҳои тӯй дар Тоҷикистон"
DEFAULT_DESC = ("Ҳамаи хизматҳои тӯй дар як ҷо: тӯйхона, мошини арӯс, сароянда, суратгир, либоси арӯс ва ошпаз. "
                "Нарх, акс ва санаҳои холиро бинед ва бевосита брон кунед.")
FONTS = Path(__file__).with_name("assets") / "fonts"
OG_SIZE = (1200, 630)

GROUP_DESC = {
    "venue": "Тӯйхонаҳо, толорҳо ва боғҳо барои ҳар андозаи тӯй",
    "transport": "Мошини арӯс, кортеж ва нақлиёт барои меҳмонон",
    "bride": "Либос, атлас, ҳуснорой ва ҷавоҳирот барои арӯс",
    "groom": "Костюм, чапон ва сартарошхона барои домод",
    "program": "Сароянда, тамада, карнайчӣ, садо ва равшанӣ",
    "media": "Суратгир, видеограф ва дрон — хотираҳои абадӣ",
    "food": "Ошпаз, оши тӯй, торт, дастархон ва ширинӣ",
    "decor": "Ороиши толор, гулҳо, арк ва пуфакҳо",
    "planning": "Ташкилотчии тӯй, пешхизматҳо ва меҳмондорӣ",
    "other": "Даъватнома ва иҷораи миз, курсӣ ва хайма",
}
PRICE_UNITS = {"event": "барои тӯй", "hour": "дар як соат", "day": "дар як рӯз", "person": "барои 1 нафар", "item": "барои 1 дона"}

# Саҳифаҳои статикӣ: роҳ → (сарлавҳа, тавсиф, h1, матн)
STATIC = {
    "/qonun": ("Қонуни тӯй — ҳадҳои Қонуни ҶТ №2048 | Тӯёна",
               "Муҳимтарин талаботи Қонуни ҶТ «Дар бораи танзими ҷашну маросим» (20.06.2024, №2048) барои тӯй: "
               "зиёфат то 150 нафар, оши тӯй то 200 нафар, то 3 соат, корвон то 4 мошин.",
               "Қонуни тӯй",
               ["Тӯй — на зиёда аз ду маърака ва дар давоми на бештар аз ду рӯз.",
                "Зиёфат — барои то 150 нафар, оши тӯй — барои то 200 нафар.",
                "Давомнокии тӯй — то 3 соат; дар шаҳр рӯзҳои истироҳат 08:00–22:00, рӯзҳои корӣ 18:00–22:00.",
                "Корвони тӯй — на бештар аз 4 мошини сабукрав.",
                "Хизмати тӯйхона ва санъаткорон — бо шартномаи хаттӣ; дар бораи тӯй ба комиссияи маҳаллӣ хабар диҳед.",
                "Маросимҳои манъшуда: фотиҳаи тӯй, сандуқбарон, сарупобинон, ноншиканон, шаҳтозон (роҳбандон) ва ғайра."]),
    "/harita": ("Харитаи хизматҳои тӯй — тӯйхонаҳо ва мошинҳо | Тӯёна",
                "Тӯйхонаҳо, тарабхонаҳо, аксбардорӣ ва мошинҳои арӯс дар харитаи Душанбе — бо суроға ва роҳ.",
                "Харитаи хизматҳо", ["Тӯйхонаҳо, тарабхонаҳо, аксбардорӣ ва мошинҳо дар харита — бо суроға ва роҳнамо."]),
    "/oroishgoh": ("Ороишгоҳи AI — либоси тӯйро дар тани худ бинед | Тӯёна",
                   "Сурати худро бор кунед ва костюм, чапон, либоси арӯсӣ ё атласро аз каталог интихоб кунед — AI онро дар тани шумо нишон медиҳад.",
                   "Ороишгоҳи AI", ["Сурати худро бор кунед, либосро аз каталог интихоб кунед — AI онро дар тани шумо мепӯшонад."]),
    "/fikr": ("Фикру пешниҳод | Тӯёна", "Хато ёфтед, пешниҳод доред ё мехоҳед ташаккур гӯед? Ба Тӯёна нависед.",
              "Фикру пешниҳод", ["Хато ёфтед, пешниҳод доред ё мехоҳед ташаккур гӯед? Нависед — ҳар паёмро мехонем."]),
    "/aksho": ("Аксҳо ва муаллифон | Тӯёна", "Муаллифон ва иҷозатномаҳои аксҳои сайти Тӯёна (Wikimedia Commons).",
               "Аксҳо", ["Аксҳои категорияҳо аз Wikimedia Commons бо иҷозатномаҳои озод (CC BY, CC BY-SA)."]),
    "/login": ("Ворид шудан | Тӯёна", "Ба ҳисоби худ дар Тӯёна ворид шавед.", "Ворид шудан", []),
    "/register": ("Сабти ном | Тӯёна", "Дар Тӯёна сабти ном кунед — барои брони хизматҳо ё гузоштани эълон.", "Сабти ном", []),
}
PRIVATE_PREFIXES = ("/admin", "/vendor", "/bookings", "/favorites")
NOINDEX_PATHS = {"/login", "/register"}


@dataclass
class Page:
    path: str
    title: str = DEFAULT_TITLE
    description: str = DEFAULT_DESC
    canonical: str | None = None  # роҳ бо query (бе домен); None — ҳамон path
    image: str = "/og/default.jpg"
    og_type: str = "website"
    robots: str = "index, follow"
    status: int = 200
    body: str = ""
    jsonld: list = field(default_factory=list)


def site() -> str:
    return get_settings().site_url.rstrip("/")


def _text(value: str, limit: int) -> str:
    """Тавсифи кӯтоҳ: бе қайди муаллифони аксҳо ва фосилаҳои зиёдатӣ."""
    lines = [l for l in (value or "").split("\n") if not l.strip().startswith("Акс: ")]
    text = re.sub(r"\s+", " ", " ".join(lines)).strip()
    return text if len(text) <= limit else text[: limit - 1].rsplit(" ", 1)[0] + "…"


def _price(l: Listing) -> str:
    return f"аз {l.price_from:,} сомонӣ {PRICE_UNITS.get(l.price_unit.value, '')}".replace(",", " ").strip()


def _listing_items(listings) -> str:
    rows = []
    for l in listings:
        rows.append(f'<li><a href="/listing/{l.id}">{escape(l.title)}</a> — {escape(l.category.name)}, '
                    f'{escape(l.city.name)}, {escape(_price(l))}</li>')
    return "<ul>" + "".join(rows) + "</ul>" if rows else "<p>Ҳоло дар ин бахш хизмат нест.</p>"


def _nav() -> str:
    links = [("/", "Асосӣ"), ("/search", "Ҳамаи хизматҳо"), ("/harita", "Харита"), ("/oroishgoh", "Ороишгоҳ"),
             ("/qonun", "Қонуни тӯй"), ("/fikr", "Фикру пешниҳод")]
    return "<nav><ul>" + "".join(f'<li><a href="{h}">{t}</a></li>' for h, t in links) + "</ul></nav>"


def _groups(db: Session):
    return db.scalars(select(CategoryGroup).options(selectinload(CategoryGroup.categories)).order_by(CategoryGroup.sort)).all()


def _active(db: Session):
    return (select(Listing).options(selectinload(Listing.images), selectinload(Listing.city), selectinload(Listing.category))
            .where(Listing.is_active.is_(True)))


def _breadcrumbs(items: list[tuple[str, str]]) -> dict:
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": name, "item": site() + path} for i, (name, path) in enumerate(items)]}


def build(db: Session, path: str, query: dict) -> Page:
    path = "/" + path.strip("/") if path.strip("/") else "/"
    page = Page(path=path)

    if path.startswith(PRIVATE_PREFIXES):
        page.robots, page.title = "noindex, nofollow", f"{SITE_NAME}"
        return page

    if path == "/":
        groups = _groups(db)
        popular = db.scalars(_active(db).order_by(Listing.views.desc()).limit(12)).all()
        cats = "".join(
            f'<li><a href="/search?group={g.slug}">{escape(g.name)}</a> — {escape(GROUP_DESC.get(g.slug, ""))}: '
            + ", ".join(f'<a href="/search?category={c.slug}">{escape(c.name)}</a>' for c in g.categories) + "</li>"
            for g in groups)
        page.body = (f"<h1>{DEFAULT_TITLE}</h1><p>{escape(DEFAULT_DESC)}</p>"
                     f"<h2>Категорияҳо</h2><ul>{cats}</ul><h2>Маъмултарин хизматҳо</h2>{_listing_items(popular)}"
                     '<p><a href="/qonun">Қонуни тӯй</a>: зиёфат то 150 нафар, оши тӯй то 200 нафар, то 3 соат, корвон то 4 мошин.</p>')
        page.jsonld = [
            {"@context": "https://schema.org", "@type": "Organization", "name": SITE_NAME, "url": site() + "/",
             "logo": site() + "/icons/icon-512.png", "areaServed": "TJ"},
            {"@context": "https://schema.org", "@type": "WebSite", "name": SITE_NAME, "url": site() + "/", "inLanguage": "tg",
             "potentialAction": {"@type": "SearchAction", "target": site() + "/search?q={search_term_string}",
                                 "query-input": "required name=search_term_string"}},
        ]
        return page

    if path == "/search":
        groups = _groups(db)
        group_slug, cat_slug = query.get("group", ""), query.get("category", "")
        stmt = _active(db).join(Category, Listing.category_id == Category.id)
        group = next((g for g in groups if g.slug == group_slug), None)
        cat = next((c for g in groups for c in g.categories if c.slug == cat_slug), None)
        if cat:
            group = next(g for g in groups if g.id == cat.group_id)
            stmt, name, desc = stmt.where(Category.id == cat.id), cat.name, f"{cat.name} барои тӯй дар Тоҷикистон — нарх, акс ва санаҳои холӣ."
            page.canonical = f"/search?category={cat.slug}"
        elif group:
            stmt, name, desc = stmt.where(Category.group_id == group.id), group.name, f"{GROUP_DESC.get(group.slug, group.name)} — нарх, акс ва санаҳои холӣ."
            page.canonical = f"/search?group={group.slug}"
        else:
            name, desc = "Ҳамаи хизматҳо", "Ҳамаи хизматҳои тӯй дар як ҷо — бо нарх ва санаҳои холӣ."
            page.canonical = "/search"
            if group_slug or cat_slug:
                page.status, page.robots = 404, "noindex, follow"
        listings = db.scalars(stmt.order_by(Listing.views.desc()).limit(48)).all()
        page.title, page.description = f"{name} — хизматҳои тӯй дар Тоҷикистон | {SITE_NAME}", desc
        sub = ""
        if group and not cat:
            sub = "<p>" + ", ".join(f'<a href="/search?category={c.slug}">{escape(c.name)}</a>' for c in group.categories) + "</p>"
        page.body = f"<h1>{escape(name)}</h1><p>{escape(desc)}</p>{sub}{_listing_items(listings)}"
        if group:
            page.image = f"/og/group/{group.slug}.jpg"
            crumbs = [("Тӯёна", "/"), ("Хизматҳо", "/search"), (group.name, f"/search?group={group.slug}")]
            if cat:
                crumbs.append((cat.name, f"/search?category={cat.slug}"))
            page.jsonld = [_breadcrumbs(crumbs)]
        return page

    m = re.fullmatch(r"/listing/(\d+)", path)
    if m:
        l = db.scalar(_active(db).where(Listing.id == int(m.group(1))))
        if not l:
            page.status, page.robots, page.title = 404, "noindex, follow", f"Эълон ёфт нашуд | {SITE_NAME}"
            page.body = '<h1>Эълон ёфт нашуд</h1><p><a href="/search">Ҳамаи хизматҳо</a></p>'
            return page
        desc = _text(l.description, 300) or f"{l.title} — {l.category.name}, {l.city.name}."
        page.title = f"{l.title} — {l.category.name}, {l.city.name} | {SITE_NAME}"
        page.description = _text(f"{l.title}. {_price(l)}. {desc}", 160)
        page.og_type, page.image = "article", f"/og/listing/{l.id}.jpg"
        facts = [l.category.name, l.city.name + (f", {l.address}" if l.address else ""), _price(l)]
        if l.capacity:
            facts.append(f"ғунҷоиш: то {l.capacity} нафар")
        imgs = "".join(f'<img src="{escape(i.url)}" alt="{escape(l.title)} — акс {n + 1}" width="600" loading="lazy">'
                       for n, i in enumerate(l.images[:4]))
        page.body = (f"<h1>{escape(l.title)}</h1><p>{' · '.join(escape(f) for f in facts)}</p>"
                     f"<p>{escape(_text(l.description, 1200))}</p>{imgs}"
                     f'<p><a href="/search?category={l.category.slug}">Хизматҳои дигар: {escape(l.category.name)}</a></p>')
        group = db.get(CategoryGroup, l.category.group_id)
        page.jsonld = [
            {"@context": "https://schema.org", "@type": "Service", "name": l.title, "serviceType": l.category.name,
             "description": desc, "url": site() + path, "image": [site() + i.url for i in l.images[:4]],
             "areaServed": {"@type": "City", "name": l.city.name},
             "provider": {"@type": "LocalBusiness", "name": l.title, "telephone": l.contact_phone,
                          "address": {"@type": "PostalAddress", "addressLocality": l.city.name, "streetAddress": l.address or l.city.name,
                                      "addressCountry": "TJ"}},
             "offers": {"@type": "Offer", "price": l.price_from, "priceCurrency": "TJS", "url": site() + path}},
            _breadcrumbs([("Тӯёна", "/"), ("Хизматҳо", "/search"), (group.name, f"/search?group={group.slug}"), (l.title, path)]),
        ]
        return page

    m = re.fullmatch(r"/moshin/(\d{2})", path)
    if m:
        page.title = f"Мошини арӯс №{m.group(1)} — шоуруми мошинҳо | {SITE_NAME}"
        page.description = "Мошинҳои боҳашамат барои арӯс ва кортежи тӯй дар Душанбе — то 4 мошин тибқи қонун."
        page.image = f"/cars/optimized/car-{m.group(1)}-1200.webp"
        page.body = f'<h1>Мошини арӯс №{m.group(1)}</h1><p>{page.description}</p><p><a href="/search?group=transport">Ҳамаи мошинҳо</a></p>'
        return page

    if path in STATIC:
        title, desc, h1, paras = STATIC[path]
        page.title, page.description = title, desc
        page.body = f"<h1>{h1}</h1>" + "".join(f"<p>{escape(p)}</p>" for p in paras)
        if path in NOINDEX_PATHS:
            page.robots = "noindex, follow"
        return page

    page.status, page.robots, page.title = 404, "noindex, follow", f"Саҳифа ёфт нашуд | {SITE_NAME}"
    page.body = '<h1>Саҳифа ёфт нашуд</h1><p><a href="/">Ба саҳифаи асосӣ</a></p>'
    return page


def render(template: str, page: Page) -> str:
    """index.html + метатегҳо + матни саҳифа (дар #root) + JSON-LD."""
    s = get_settings()
    url = site() + (page.canonical or page.path)
    image = site() + page.image
    e = lambda v: escape(v, quote=True)
    head = [
        f'<meta name="description" content="{e(page.description)}" />',
        f'<meta name="robots" content="{page.robots}" />',
        f'<link rel="canonical" href="{e(url)}" />',
        f'<meta property="og:site_name" content="{SITE_NAME}" />',
        f'<meta property="og:locale" content="tg_TJ" />',
        f'<meta property="og:type" content="{page.og_type}" />',
        f'<meta property="og:title" content="{e(page.title)}" />',
        f'<meta property="og:description" content="{e(page.description)}" />',
        f'<meta property="og:url" content="{e(url)}" />',
        f'<meta property="og:image" content="{e(image)}" />',
        '<meta property="og:image:width" content="1200" />' if page.image.startswith("/og/") else "",
        '<meta property="og:image:height" content="630" />' if page.image.startswith("/og/") else "",
        f'<meta property="og:image:alt" content="{e(page.title)}" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        f'<meta name="twitter:title" content="{e(page.title)}" />',
        f'<meta name="twitter:description" content="{e(page.description)}" />',
        f'<meta name="twitter:image" content="{e(image)}" />',
    ]
    if s.google_site_verification:
        head.append(f'<meta name="google-site-verification" content="{e(s.google_site_verification)}" />')
    if s.yandex_verification:
        head.append(f'<meta name="yandex-verification" content="{e(s.yandex_verification)}" />')
    for data in page.jsonld:
        head.append('<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False).replace("</", "<\\/") + "</script>")

    html = re.sub(r"<title>.*?</title>", f"<title>{escape(page.title)}</title>", template, count=1, flags=re.S)
    html = re.sub(r'\s*<meta name="description"[^>]*>', "", html, count=1)
    html = html.replace("</head>", "    " + "\n    ".join(h for h in head if h) + "\n  </head>", 1)
    # Матни саҳифа барои ботҳо ва бе JS; React онро бо интерфейси пурра иваз мекунад
    body = (f'<div class="ssr">{_nav()}<main>{page.body}</main>'
            f'<footer><p>© {datetime.now().year} {SITE_NAME} — хизматҳои тӯй дар Тоҷикистон.</p></footer></div>')
    return html.replace('<div id="root"></div>', f'<div id="root">{body}</div>', 1)


# ---------------- robots.txt ва sitemap.xml ----------------

def robots_txt() -> str:
    return "\n".join([
        "User-agent: *",
        "Allow: /",
        *[f"Disallow: {p}" for p in ("/api/", "/admin", "/vendor", "/bookings", "/favorites", "/uploads/tryon/", "/login", "/register")],
        "",
        f"Sitemap: {site()}/sitemap.xml",
        "",
    ])


def sitemap_xml(db: Session) -> str:
    def url(loc: str, lastmod: datetime | None = None, priority: str = "0.6", freq: str = "weekly") -> str:
        mod = f"<lastmod>{lastmod.astimezone(timezone.utc).date().isoformat()}</lastmod>" if lastmod else ""
        return f"<url><loc>{escape(site() + loc)}</loc>{mod}<changefreq>{freq}</changefreq><priority>{priority}</priority></url>"

    newest = db.scalar(select(func.max(Listing.updated_at)).where(Listing.is_active.is_(True)))
    urls = [url("/", newest, "1.0", "daily"), url("/search", newest, "0.9", "daily")]
    urls += [url(p, None, "0.5", "monthly") for p in ("/qonun", "/harita", "/oroishgoh", "/fikr", "/aksho")]
    for g in _groups(db):
        urls.append(url(f"/search?group={g.slug}", newest, "0.8", "daily"))
        urls += [url(f"/search?category={c.slug}", newest, "0.7") for c in g.categories]
    for lid, updated in db.execute(select(Listing.id, Listing.updated_at).where(Listing.is_active.is_(True)).order_by(Listing.id)):
        urls.append(url(f"/listing/{lid}", updated, "0.8"))
    urls += [url(f"/moshin/{i:02d}", None, "0.4", "monthly") for i in range(1, 12)]
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            + "".join(urls) + "</urlset>\n")


# ---------------- Тасвирҳои Open Graph (1200×630) ----------------

def _cover_crop(image, size=OG_SIZE):
    from PIL import ImageOps
    return ImageOps.fit(image.convert("RGB"), size, centering=(0.5, 0.45))


def _brand(canvas, title: str, subtitle: str):
    """Пардаи бургундӣ дар поён, номи эълон ва «Тӯёна»."""
    from PIL import Image, ImageDraw, ImageFont

    w, h = canvas.size
    shade = Image.new("L", (1, h))
    for y in range(h):
        shade.putpixel((0, y), int(235 * max(0, (y - h * 0.38) / (h * 0.62)) ** 1.3))
    overlay = Image.new("RGB", (w, h), (34, 8, 22))
    canvas.paste(overlay, (0, 0), shade.resize((w, h)))
    draw = ImageDraw.Draw(canvas)
    big = ImageFont.truetype(str(FONTS / "DejaVuSerif-Bold.ttf"), 58)
    small = ImageFont.truetype(str(FONTS / "DejaVuSans.ttf"), 30)
    lines, line = [], ""
    for word in title.split():
        test = (line + " " + word).strip()
        if draw.textlength(test, font=big) > w - 120 and line:
            lines.append(line); line = word
        else:
            line = test
    lines = (lines + [line])[-2:]
    y = h - 70 - 70 * len(lines) - 40
    for text in lines:
        draw.text((60, y), text, font=big, fill=(255, 248, 238)); y += 70
    draw.text((60, y + 8), subtitle, font=small, fill=(233, 199, 132))
    draw.text((w - 60 - draw.textlength("Тӯёна", font=small), 44), "Тӯёна", font=small, fill=(233, 199, 132))
    return canvas


def og_image(db: Session, kind: str) -> bytes | None:
    """kind: 'default' ё 'listing/<id>'. Натиҷа дар uploads/og кэш мешавад."""
    from PIL import Image

    s = get_settings()
    folder = s.upload_dir / "og"
    folder.mkdir(exist_ok=True)
    if kind == "default":
        cached = folder / "default-v1.jpg"
        if not cached.exists():
            dist = Path(__file__).resolve().parents[2] / "frontend" / "dist" / "categories" / "optimized" / "venue-1200.webp"
            base = Image.open(dist) if dist.exists() else Image.new("RGB", OG_SIZE, (60, 14, 36))
            img = _brand(_cover_crop(base), "Хизматҳои тӯй дар Тоҷикистон", "тӯйхона · мошини арӯс · сароянда · суратгир")
            img.save(cached, "JPEG", quality=86)
        return cached.read_bytes()
    g = re.fullmatch(r"group/([a-z-]+)", kind)
    if g:
        group = db.scalar(select(CategoryGroup).where(CategoryGroup.slug == g.group(1)))
        if not group:
            return None
        cached = folder / f"group-{group.slug}-v1.jpg"
        if not cached.exists():
            src = Path(__file__).resolve().parents[2] / "frontend" / "dist" / "categories" / "optimized" / f"{group.slug}-1200.webp"
            base = Image.open(src) if src.exists() else Image.new("RGB", OG_SIZE, (60, 14, 36))
            _brand(_cover_crop(base), group.name, GROUP_DESC.get(group.slug, "хизматҳои тӯй дар Тоҷикистон")).save(cached, "JPEG", quality=86)
        return cached.read_bytes()
    m = re.fullmatch(r"listing/(\d+)", kind)
    if not m:
        return None
    l = db.scalar(select(Listing).options(selectinload(Listing.images), selectinload(Listing.city), selectinload(Listing.category))
                  .where(Listing.id == int(m.group(1)), Listing.is_active.is_(True)))
    if not l:
        return None
    stamp = int((l.updated_at or l.created_at).timestamp())
    cached = folder / f"listing-{l.id}-{stamp}.jpg"
    if not cached.exists():
        for old in folder.glob(f"listing-{l.id}-*.jpg"):
            old.unlink(missing_ok=True)
        cover = s.upload_dir / l.cover.rsplit("/", 1)[-1] if l.cover else None
        base = Image.open(cover) if cover and cover.exists() else Image.new("RGB", OG_SIZE, (60, 14, 36))
        img = _brand(_cover_crop(base), l.title, f"{l.category.name} · {l.city.name} · {_price(l)}")
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=86)
        cached.write_bytes(buf.getvalue())
    return cached.read_bytes()

