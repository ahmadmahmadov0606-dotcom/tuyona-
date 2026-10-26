# 💍 Тӯёна — платформаи хизматҳои тӯй дар Тоҷикистон

Ҳама чизи тӯй дар як ҷо: тӯйхона, мошини арӯс, сароянда, суратгир, либос, ошпаз, ороиш ва ғайра.
Мизоҷ санаи холиро дар тақвим мебинад ва брон мекунад; хизматрасон тасдиқ мекунад.

- **Backend:** FastAPI · SQLAlchemy 2 · JWT · bcrypt · SQLite/PostgreSQL
- **Frontend:** React 18 · React Router · Vite
- **Тестҳо:** 17 тести pytest

## 🚀 Оғози зуд (дар компютери худ)

Лозим: Python 3.11+ ва Node.js 18+.

**1. Backend**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                 # Windows: copy .env.example .env
python -m app.seed --demo            # категорияҳо, шаҳрҳо + эълонҳои намунавӣ
python -m app.create_admin admin@tuyona.tj "Маъмур" admin12345
uvicorn app.main:app --reload
```
API: http://localhost:8000/docs (Swagger — ҳамаи endpoint-ҳо)

**2. Frontend** (дар терминали дигар)
```bash
cd frontend
npm install
npm run dev
```
Сайт: http://localhost:5173

**Ҳисобҳои намунавӣ** (парол `demo1234`):

| Нақш | Телефон |
|---|---|
| Хизматрасон | vendor@tuyona.tj |
| Мизоҷ | client@tuyona.tj |
| Маъмур | admin@tuyona.tj (парол `admin12345`) |

## 🧪 Тестҳо
```bash
cd backend && pytest -q
```

## 🐳 Production бо Docker (PostgreSQL)
```bash
echo "SECRET_KEY=$(python -c 'import secrets;print(secrets.token_urlsafe(48))')" > .env
docker compose up -d --build
docker compose exec app python -m app.create_admin EMAIL "Ном" ПАРОЛИ_ҚАВӢ
```
Сайт ва API дар http://localhost:8000. Frontend-и сохташуда аз ҳамон сервер дода мешавад.

## ✨ Имкониятҳо

**Мизоҷ:** ҷустуҷӯ бо филтр (категория, шаҳр, нарх, ғунҷоиш, **санаи холӣ**), тақвими санаҳои банд/холӣ,
брон, бекор кардан, интихобшуда (♡), шарҳ ва баҳо (танҳо пас аз гирифтани хизмат).

**Хизматрасон:** кабинет бо омор, гузоштан/таҳрир/нест кардани эълон, то 12 сурат,
тасдиқ/рад кардани дархостҳо, банд кардани санаҳо дар тақвим.

**Маъмур:** омори умумӣ, пинҳон кардани эълонҳо, бастани корбарон.

**10 гурӯҳ, 35 категория:** Ҷой · Нақлиёт · Арӯс · Домод · Барнома · Сурат ва видео · Хӯрок · Ороиш · Ҷаҳиз · Дигар.
Категорияҳо дар `backend/app/seed.py` ҳастанд — илова кардан осон аст.

## 🔒 Амният ва устуворӣ
- Паролҳо бо **bcrypt**, воридшавӣ бо **JWT**
- Маҳдудияти кӯшиши воридшавӣ (10 бор дар як дақиқа)
- **Ҳимоя аз дукарата брон:** индекси ягона дар база — ҳатто ду тасдиқи ҳамзамон як санаро ду бор банд карда наметавонанд
- Ҳангоми тасдиқ дархостҳои дигари ҳамон сана худкор рад мешаванд
- Санҷиши сурат аз рӯи мазмуни файл (на номаш), ҳадди андоза 5MB
- Ҳуқуқҳо: хизматрасон танҳо эълони худро тағйир медиҳад; admin-ро аз сайт сабт кардан мумкин нест
- Рақамҳои телефон ба шакли ягонаи `+992XXXXXXXXX` оварда мешаванд
- Дар production бе `SECRET_KEY` сервер оғоз намешавад

## 📁 Сохтор
```
backend/
  app/
    core/        танзимот, амният (JWT, bcrypt, rate limit)
    routers/     auth, catalog, listings, bookings, me, admin
    models.py    ҷадвалҳои база
    schemas.py   санҷиши маълумот (Pydantic)
    seed.py      категорияҳо ва шаҳрҳо
  tests/
frontend/
  src/
    pages/       Home, Search, ListingPage, Auth, Client, vendor/, admin/
    components/  Layout, Calendar, ui
    api.js       ҳамаи дархостҳо ба API
```

## 🛣 Қадамҳои навбатӣ
- Воридшавӣ бо рамзи SMS · Alembic барои миграцияҳо · пардохти онлайн (Alif, DC)
- Бот дар Telegram барои огоҳиномаҳо · барномаи мобилӣ
