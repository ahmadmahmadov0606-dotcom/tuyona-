from datetime import date, timedelta

from app.db import SessionLocal
from app.models import Booking, BookingStatus
from tests.conftest import register

FUTURE = (date.today() + timedelta(days=30)).isoformat()
MONTH = FUTURE[:7]


# ---------- Auth ----------
def test_register_login_me(client):
    h = register(client, "Ali@Mail.com")
    me = client.get("/api/auth/me", headers=h).json()
    assert me["email"] == "ali@mail.com"
    r = client.post("/api/auth/login", json={"email": "ali@mail.com", "password": "secret123"})
    assert r.status_code == 200
    assert client.post("/api/auth/login", json={"email": "ali@mail.com", "password": "bad"}).status_code == 401
    r = client.post("/api/auth/login", json={"email": "nobody@mail.com", "password": "secret123"})
    assert r.status_code == 401 and "ҳисоб нест" in r.json()["detail"]
    assert client.post("/api/auth/login", json={"email": "ali@mail.com", "password": "bad"}).json()["detail"] == "Парол нодуруст аст"


def test_duplicate_email_and_bad_email(client):
    register(client, "ali@mail.com")
    r = client.post("/api/auth/register", json={"email": "ALI@mail.com", "full_name": "Ab", "password": "secret123"})
    assert r.status_code == 409
    r = client.post("/api/auth/register", json={"email": "12345", "full_name": "Ab", "password": "secret123"})
    assert r.status_code == 422


def test_cannot_register_admin(client):
    r = client.post("/api/auth/register", json={
        "email": "ali@mail.com", "full_name": "Hacker", "password": "secret123", "role": "admin"})
    assert r.status_code == 403


def test_login_rate_limit(client):
    register(client, "ali@mail.com")
    codes = [client.post("/api/auth/login", json={"email": "ali@mail.com", "password": "x"}).status_code
             for _ in range(12)]
    assert 429 in codes


def test_invalid_token(client):
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401


# ---------- Listings ----------
def test_client_cannot_create_listing(client, user, ref):
    r = client.post("/api/listings", headers=user, json={
        "category_id": ref["cat"]["bride-car"]["id"], "city_id": ref["city"]["dushanbe"]["id"],
        "title": "Test", "contact_phone": "901111111", "price_from": 1})
    assert r.status_code == 403


def test_listing_crud_and_search(client, vendor, make_listing, ref):
    a = make_listing(title="Лимузини сафед", price_from=1500)
    make_listing(title="Тӯйхонаи калон", category_id=ref["cat"]["tuykhona"]["id"],
                 price_from=200, price_unit="person", capacity=500)
    make_listing(title="Мошин дар Хуҷанд", city_id=ref["city"]["khujand"]["id"], price_from=900)

    assert client.get("/api/listings").json()["total"] == 3
    assert client.get("/api/listings?category=bride-car").json()["total"] == 2
    assert client.get("/api/listings?group=transport&city=khujand").json()["total"] == 1
    assert client.get("/api/listings?q=лимузин").json()["total"] >= 1
    assert client.get("/api/listings?min_capacity=400").json()["total"] == 1
    prices = [i["price_from"] for i in client.get("/api/listings?sort=price_asc").json()["items"]]
    assert prices == sorted(prices)

    r = client.patch(f"/api/listings/{a['id']}", headers=vendor, json={"price_from": 1700, "is_active": False})
    assert r.json()["price_from"] == 1700
    assert client.get("/api/listings").json()["total"] == 2  # ғайрифаъол пинҳон
    assert client.get(f"/api/listings/{a['id']}").status_code == 404
    assert client.get(f"/api/listings/{a['id']}", headers=vendor).status_code == 200

    assert client.delete(f"/api/listings/{a['id']}", headers=vendor).status_code == 204


def test_other_vendor_cannot_edit(client, make_listing):
    a = make_listing()
    other = register(client, "other@test.tj", "vendor")
    assert client.patch(f"/api/listings/{a['id']}", headers=other, json={"price_from": 1}).status_code == 403
    assert client.delete(f"/api/listings/{a['id']}", headers=other).status_code == 403


def test_views_counted_for_visitors_only(client, vendor, make_listing):
    a = make_listing()
    client.get(f"/api/listings/{a['id']}")
    client.get(f"/api/listings/{a['id']}")
    client.get(f"/api/listings/{a['id']}", headers=vendor)
    assert client.get(f"/api/listings/{a['id']}", headers=vendor).json()["views"] == 2


def test_image_upload_validation(client, vendor, make_listing):
    a = make_listing()
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
    r = client.post(f"/api/listings/{a['id']}/images", headers=vendor,
                    files=[("files", ("a.png", png, "image/png"))])
    assert r.status_code == 201
    img = r.json()[0]
    assert client.get(img["url"]).status_code == 200
    assert client.get(f"/api/listings/{a['id']}").json()["cover"] == img["url"]

    fake = b"<?php echo 'hi'; ?>"
    r = client.post(f"/api/listings/{a['id']}/images", headers=vendor,
                    files=[("files", ("evil.png", fake, "image/png"))])
    assert r.status_code == 415

    assert client.delete(f"/api/listings/{a['id']}/images/{img['id']}", headers=vendor).status_code == 204


# ---------- Bookings ----------
def test_booking_flow_and_double_booking_protection(client, vendor, user, make_listing):
    a = make_listing()
    other = register(client, "other2@test.tj")

    b1 = client.post("/api/bookings", headers=user, json={
        "listing_id": a["id"], "event_date": FUTURE, "contact_phone": "902222222", "guests": 10})
    assert b1.status_code == 201, b1.text
    b2 = client.post("/api/bookings", headers=other, json={
        "listing_id": a["id"], "event_date": FUTURE, "contact_phone": "904444444"})
    assert b2.status_code == 201

    # дархости дубора аз ҳамон корбар
    dup = client.post("/api/bookings", headers=user, json={
        "listing_id": a["id"], "event_date": FUTURE, "contact_phone": "902222222"})
    assert dup.status_code == 409

    # мизоҷ тасдиқ карда наметавонад
    assert client.patch(f"/api/bookings/{b1.json()['id']}/status", headers=user,
                        json={"status": "confirmed"}).status_code == 403

    incoming = client.get("/api/bookings/incoming", headers=vendor).json()
    assert len(incoming) == 2

    r = client.patch(f"/api/bookings/{b1.json()['id']}/status", headers=vendor, json={"status": "confirmed"})
    assert r.json()["status"] == "confirmed"

    # дархости дуюм худкор рад шуд
    mine = client.get("/api/bookings/my", headers=other).json()
    assert mine[0]["status"] == "rejected"

    # сана акнун банд аст
    av = client.get(f"/api/listings/{a['id']}/availability?month={MONTH}").json()
    assert FUTURE in av["busy"]
    assert client.post("/api/bookings", headers=other, json={
        "listing_id": a["id"], "event_date": FUTURE, "contact_phone": "904444444"}).status_code == 409
    assert client.get(f"/api/listings?available_on={FUTURE}").json()["total"] == 0

    # бекор кардан аз ҷониби мизоҷ сана озод мекунад
    assert client.patch(f"/api/bookings/{b1.json()['id']}/status", headers=user,
                        json={"status": "cancelled"}).json()["status"] == "cancelled"
    assert client.get(f"/api/listings?available_on={FUTURE}").json()["total"] == 1


def test_law_guest_limits(client, user, make_listing, ref):
    # Қонуни №2048: зиёфат — то 150 нафар, оши тӯй — то 200 нафар
    hall = make_listing(capacity=600)
    osh = make_listing(category_id=ref["cat"]["oshpaz"]["id"], title="Оши тӯй", capacity=1000)
    book = lambda l, n: client.post("/api/bookings", headers=user, json={
        "listing_id": l["id"], "event_date": FUTURE, "guests": n, "contact_phone": "902222222"}).status_code
    assert book(hall, 151) == 400
    assert book(osh, 201) == 422
    assert book(osh, 200) == 201
    assert book(hall, 150) == 201


def test_booking_rules(client, vendor, user, make_listing):
    a = make_listing(capacity=100)
    past = (date.today() - timedelta(days=1)).isoformat()
    assert client.post("/api/bookings", headers=user, json={
        "listing_id": a["id"], "event_date": past, "contact_phone": "902222222"}).status_code == 400
    assert client.post("/api/bookings", headers=user, json={
        "listing_id": a["id"], "event_date": FUTURE, "guests": 120, "contact_phone": "902222222"}).status_code == 400
    assert client.post("/api/bookings", headers=vendor, json={
        "listing_id": a["id"], "event_date": FUTURE, "contact_phone": "901111111"}).status_code == 400
    assert client.post("/api/bookings", json={
        "listing_id": a["id"], "event_date": FUTURE, "contact_phone": "901111111"}).status_code == 401


def test_blocked_dates(client, vendor, user, make_listing):
    a = make_listing()
    assert client.post(f"/api/listings/{a['id']}/blocked", headers=vendor, json={"days": [FUTURE]}).status_code == 204
    assert client.post("/api/bookings", headers=user, json={
        "listing_id": a["id"], "event_date": FUTURE, "contact_phone": "902222222"}).status_code == 409
    client.request("DELETE", f"/api/listings/{a['id']}/blocked", headers=vendor, json={"days": [FUTURE]})
    assert client.post("/api/bookings", headers=user, json={
        "listing_id": a["id"], "event_date": FUTURE, "contact_phone": "902222222"}).status_code == 201


# ---------- Reviews & favorites ----------
def test_reviews_require_service(client, vendor, user, make_listing):
    a = make_listing()
    assert client.post(f"/api/listings/{a['id']}/reviews", headers=user,
                       json={"rating": 5, "text": "Аъло"}).status_code == 403
    me = client.get("/api/auth/me", headers=user).json()
    with SessionLocal() as db:
        db.add(Booking(listing_id=a["id"], client_id=me["id"], event_date=date.today() - timedelta(days=3),
                       contact_phone="+992902222222", status=BookingStatus.confirmed))
        db.commit()
    r = client.post(f"/api/listings/{a['id']}/reviews", headers=user, json={"rating": 4, "text": "Хуб"})
    assert r.status_code == 201
    assert client.post(f"/api/listings/{a['id']}/reviews", headers=user,
                       json={"rating": 5}).status_code == 409
    d = client.get(f"/api/listings/{a['id']}").json()
    assert d["rating_avg"] == 4 and d["rating_count"] == 1
    assert len(client.get(f"/api/listings/{a['id']}/reviews").json()) == 1


def test_favorites(client, user, make_listing):
    a = make_listing()
    client.post(f"/api/listings/{a['id']}/favorite", headers=user)
    client.post(f"/api/listings/{a['id']}/favorite", headers=user)  # idempotent
    assert len(client.get("/api/me/favorites", headers=user).json()) == 1
    assert client.get(f"/api/listings/{a['id']}", headers=user).json()["is_favorite"] is True
    client.delete(f"/api/listings/{a['id']}/favorite", headers=user)
    assert client.get("/api/me/favorites", headers=user).json() == []


def test_vendor_stats(client, vendor, user, make_listing):
    a = make_listing()
    b = client.post("/api/bookings", headers=user, json={
        "listing_id": a["id"], "event_date": FUTURE, "contact_phone": "902222222"}).json()
    s = client.get("/api/vendor/stats", headers=vendor).json()
    assert s["listings"] == 1 and s["bookings_pending"] == 1
    client.patch(f"/api/bookings/{b['id']}/status", headers=vendor, json={"status": "confirmed"})
    s = client.get("/api/vendor/stats", headers=vendor).json()
    assert s["bookings_confirmed"] == 1 and len(s["upcoming"]) == 1
    assert client.get("/api/vendor/stats", headers=user).status_code == 403


def _make_admin(client):
    from app.db import SessionLocal
    from app.models import Role, User
    h = register(client, "admin@test.tj", "client", "Маъмур")
    with SessionLocal() as db:
        u = db.query(User).filter_by(email="admin@test.tj").one()
        u.role = Role.admin
        db.commit()
    return h


def test_admin_panel(client, vendor, user, make_listing):
    l = make_listing()
    assert client.get("/api/admin/stats", headers=user).status_code == 403
    admin = _make_admin(client)
    s = client.get("/api/admin/stats", headers=admin).json()
    assert s["listings"] == 1 and s["vendors"] == 1
    users = client.get("/api/admin/users", params={"role": "vendor"}, headers=admin).json()
    vid = users["items"][0]["id"]
    # бастани хизматрасон эълонҳояшро пинҳон мекунад
    r = client.patch(f"/api/admin/users/{vid}/active", params={"active": False}, headers=admin)
    assert r.status_code == 200 and r.json()["is_active"] is False
    assert client.get("/api/listings").json()["total"] == 0
    assert client.get("/api/auth/me", headers=vendor).status_code == 401
    r = client.patch(f"/api/admin/listings/{l['id']}/active", params={"active": True}, headers=admin)
    assert r.json()["is_active"] is True


def test_car_orders(client, user):
    day = (date.today() + timedelta(days=20)).isoformat()
    body = {"cars": ["05", "01"], "event_date": day, "start_time": "17:30", "pickup_address": "Душанбе, Рӯдакӣ 10",
            "contact_phone": "902222222", "note": "Бо гул"}
    # бе вуруд — манъ
    assert client.post("/api/car-orders", json=body).status_code == 401
    # санҷишҳо: беш аз 4 мошин, такрор, мошини номаълум, вақти нодуруст, санаи гузашта
    for bad in ({"cars": ["01", "02", "03", "04", "05"]}, {"cars": ["01", "01"]}, {"cars": ["99"]},
                {"cars": []}, {"start_time": "25:00"}, {"start_time": "05:30"}, {"start_time": "21:30"}):
        assert client.post("/api/car-orders", json={**body, **bad}, headers=user).status_code == 422, bad
    past = {**body, "event_date": (date.today() - timedelta(days=1)).isoformat()}
    assert client.post("/api/car-orders", json=past, headers=user).status_code == 400

    r = client.post("/api/car-orders", json=body, headers=user)
    assert r.status_code == 201, r.text
    o = r.json()
    assert o["cars"] == ["01", "05"] and o["status"] == "pending" and o["contact_phone"] == "+992902222222"
    assert [x["id"] for x in client.get("/api/car-orders/my", headers=user).json()] == [o["id"]]

    # корбари дигар бекор карда наметавонад; маъмур ҳолатро иваз мекунад
    other = register(client, "other@test.tj")
    assert client.patch(f"/api/car-orders/{o['id']}/cancel", headers=other).status_code == 403
    assert client.get("/api/admin/car-orders", headers=user).status_code == 403
    admin = _make_admin(client)
    page = client.get("/api/admin/car-orders", params={"status": "pending"}, headers=admin).json()
    assert page["total"] == 1 and page["items"][0]["client"]["full_name"] == "Мизоҷ"
    r = client.patch(f"/api/admin/car-orders/{o['id']}/status", json={"status": "confirmed"}, headers=admin)
    assert r.status_code == 200 and r.json()["status"] == "confirmed"
    # мизоҷ бекор мекунад; бекоршударо бори дигар не
    assert client.patch(f"/api/car-orders/{o['id']}/cancel", headers=user).json()["status"] == "cancelled"
    assert client.patch(f"/api/car-orders/{o['id']}/cancel", headers=user).status_code == 400


# ---------- Ороишгоҳ: мард / зан ----------
def _png():
    import io
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (60, 80), (200, 180, 160)).save(buf, "PNG")
    return buf.getvalue()


def test_tryon_gender_rules(client, user, vendor, ref, monkeypatch):
    from app import gender, tryon
    from app.routers import tryon as tryon_router

    monkeypatch.setattr(tryon, "status", lambda: {"active": "test", "providers": ["test"], "supports": ["upper", "lower", "full"]})
    monkeypatch.setattr(tryon, "garment_jpeg", lambda cover: b"garment")
    monkeypatch.setattr(tryon, "run_tryon", lambda *a, **k: (_png(), "test", False))
    detected = {"gender": "male", "confidence": 0.9}
    monkeypatch.setattr(gender, "detect", lambda image: detected)

    def outfit(slug, title):
        r = client.post("/api/listings", headers=vendor, json={
            "category_id": ref["cat"][slug]["id"], "city_id": ref["city"]["dushanbe"]["id"], "title": title,
            "description": "", "contact_phone": "901111111", "price_from": 100, "price_unit": "day"})
        lid = r.json()["id"]
        img = client.post(f"/api/listings/{lid}/images", headers=vendor, files={"files": ("a.png", _png(), "image/png")})
        assert img.status_code in (200, 201), img.text
        return lid

    dress, suit = outfit("wedding-dress", "Либоси арӯсӣ"), outfit("suit", "Смокинг")
    wear = lambda lid, **form: client.post("/api/tryon", headers=user, files={"photo": ("p.png", _png(), "image/png")},
                                           data={"listing_id": lid, **form})

    # Мард → либоси арӯсӣ манъ, костюм иҷозат
    r = wear(dress)
    assert r.status_code == 422 and "занона" in r.json()["detail"]
    assert wear(suit).status_code == 200
    # Зан → костюм манъ
    detected.update(gender="female")
    assert wear(suit).status_code == 422
    assert wear(dress).status_code == 200
    # AI мутмаин нест → аз корбар мепурсем; интихоби корбар қабул мешавад
    detected.update(gender=None, confidence=0.55)
    assert wear(suit).status_code == 422
    assert wear(suit, gender="male").status_code == 200
    assert wear(dress, gender="male").status_code == 422

    # Каталог аз рӯи ҷинс ва /detect
    titles = lambda g: {o["title"] for o in client.get("/api/tryon/outfits", params={"gender": g}).json()}
    assert titles("male") == {"Смокинг"} and titles("female") == {"Либоси арӯсӣ"}
    detected.update(gender="female", confidence=0.88)
    r = client.post("/api/tryon/detect", files={"photo": ("p.png", _png(), "image/png")})
    assert r.json() == {"gender": "female", "confidence": 0.88}
    assert tryon_router.SCENE_PHOTOS  # эълонҳои манзара аз каталог берунанд


# ---------- Воридшавӣ бо Google ----------
def test_google_login(client, monkeypatch):
    import time
    import jwt
    from cryptography.hazmat.primitives.asymmetric import rsa
    from app.core import security
    from app.core.config import get_settings

    google_key, fake_key = (rsa.generate_private_key(public_exponent=65537, key_size=2048) for _ in range(2))

    class Keys:  # ба ҷои калидҳои ҷамъиятии Google
        def get_signing_key_from_jwt(self, token):
            return type("K", (), {"key": google_key.public_key()})()

    monkeypatch.setattr(security, "_google_keys", Keys())
    assert client.get("/api/auth/config").json() == {"google_client_id": None}
    assert client.post("/api/auth/google", json={"credential": "x" * 30}).status_code == 503
    monkeypatch.setattr(get_settings(), "google_client_id", "test-client.apps.googleusercontent.com")
    assert client.get("/api/auth/config").json()["google_client_id"] == "test-client.apps.googleusercontent.com"

    def token(key=google_key, **over):
        now = int(time.time())
        claims = {"iss": "https://accounts.google.com", "aud": "test-client.apps.googleusercontent.com", "iat": now,
                  "exp": now + 600, "email": "Zarina@Gmail.com", "email_verified": True, "name": "Зарина Каримова", **over}
        return jwt.encode(claims, key, algorithm="RS256")

    login = lambda t, **b: client.post("/api/auth/google", json={"credential": t, **b})
    # Ҳисоби нав сохта мешавад (email — бо ҳарфи хурд), нақш — фармоишгар ё хизматрасон
    r = login(token(), role="vendor")
    assert r.status_code == 200, r.text
    me = r.json()["user"]
    assert me["email"] == "zarina@gmail.com" and me["full_name"] == "Зарина Каримова" and me["role"] == "vendor"
    # Бори дуюм — ҳамон ҳисоб, нақш тағйир намеёбад
    again = login(token(), role="client").json()["user"]
    assert again["id"] == me["id"] and again["role"] == "vendor"
    # Токенҳои нодуруст
    assert login(token(aud="someone-else")).status_code == 401
    assert login(token(email_verified=False)).status_code == 401
    assert login(token(iss="https://evil.example")).status_code == 401
    assert login(token(exp=int(time.time()) - 10)).status_code == 401
    assert login(token(key=fake_key)).status_code == 401
    assert login(token(), role="admin").status_code == 403
    # Ҳисоби мавҷуда бо парол — бо Google ҳам ворид мешавад
    register(client, "ali@gmail.com")
    assert login(token(email="ali@gmail.com")).json()["user"]["full_name"] == "Тест Корбар"


def test_no_law_banned_categories(client):
    # Қонуни №2048: ҷаҳиз (сандуқбарон, сарупобинон) ва табақҳои тӯҳфа — категория надоранд
    groups = client.get("/api/categories").json()
    slugs = {g["slug"] for g in groups} | {c["slug"] for g in groups for c in g["categories"]}
    assert not slugs & {"dowry", "bedding", "furniture", "tabaq"}


def test_feedback(client, user):
    from app.routers.feedback import feedback_limiter
    feedback_limiter.reset()
    # Бе воридшавӣ ҳам мумкин; паёми кӯтоҳ — 422
    assert client.post("/api/feedback", json={"message": "хуб"}).status_code == 422
    assert client.post("/api/feedback", json={"topic": "bug", "message": "Тугмаи брон кор намекунад", "page": "/listing/1",
                                              "name": "Аҳмад", "contact": "+992900000000"}).status_code == 201
    # Корбари воридшуда — ном ва email худкор
    assert client.post("/api/feedback", headers=user, json={"topic": "praise", "rating": 5, "message": "Сайти олӣ!"}).status_code == 201
    assert client.post("/api/feedback", json={"message": "салом салом", "rating": 9}).status_code == 422
    # Танҳо маъмур мехонад
    assert client.get("/api/admin/feedback", headers=user).status_code == 403
    admin = _make_admin(client)
    assert client.get("/api/admin/stats", headers=admin).json()["feedback_unread"] == 2
    items = client.get("/api/admin/feedback", headers=admin).json()["items"]
    assert [i["topic"] for i in items] == ["praise", "bug"] and items[0]["name"] == "Мизоҷ" and items[0]["contact"] == "client@test.tj"
    assert client.patch(f"/api/admin/feedback/{items[1]['id']}/read", headers=admin).json()["is_read"] is True
    assert client.get("/api/admin/feedback", params={"unread": True}, headers=admin).json()["total"] == 1
    # Спам: зиёда аз 5 дар як соат
    codes = [client.post("/api/feedback", json={"message": f"паём {i} барои санҷиш"}).status_code for i in range(6)]
    assert 429 in codes
