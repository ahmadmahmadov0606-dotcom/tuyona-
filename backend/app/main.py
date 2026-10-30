import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app import seo
from app.db import Base, engine, migrate_phone_to_email
from app.deps import DB
from app.routers import admin, assistant, auth, bookings, car_orders, catalog, feedback, listings, me, tryon

log = logging.getLogger("tuyona")
settings = get_settings()

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Дар production ба ҷои create_all миграцияҳо (Alembic) истифода баред.
    migrate_phone_to_email()
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Платформаи хизматҳои тӯй дар Тоҷикистон: тӯйхона, мошини арӯс, сароянда ва ғайра.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    return response


@app.exception_handler(IntegrityError)
async def integrity_handler(_: Request, exc: IntegrityError):
    log.warning("Integrity error: %s", exc.orig)
    return JSONResponse(status_code=409, content={"detail": "Маълумот бо сабти мавҷуда мухолиф аст"})


API = "/api"
for r in (auth.router, catalog.router, listings.router, bookings.router, me.router, admin.router, car_orders.router, tryon.router, assistant.router, feedback.router):
    app.include_router(r, prefix=API)


@app.get(f"{API}/health", tags=["system"])
def health():
    return {"status": "ok"}


app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


# ---------- SEO: robots.txt, sitemap.xml, тасвирҳои Open Graph ----------
@app.get("/robots.txt", include_in_schema=False)
def robots():
    return PlainTextResponse(seo.robots_txt())


@app.get("/sitemap.xml", include_in_schema=False)
def sitemap(db: DB):
    return Response(seo.sitemap_xml(db), media_type="application/xml", headers={"Cache-Control": "public, max-age=3600"})


@app.get("/og/default.jpg", include_in_schema=False)
def og_default(db: DB):
    return Response(seo.og_image(db, "default"), media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/og/group/{slug}.jpg", include_in_schema=False)
def og_group(slug: str, db: DB):
    data = seo.og_image(db, f"group/{slug}")
    if data is None:
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    return Response(data, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/og/listing/{listing_id}.jpg", include_in_schema=False)
def og_listing(listing_id: int, db: DB):
    data = seo.og_image(db, f"listing/{listing_id}")
    if data is None:
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    return Response(data, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})

# Агар frontend сохта нашуда бошад, "/" ба сайти Vite (ё /docs) мегузарад, на 404.
if not FRONTEND_DIST.exists():

    @app.get("/", include_in_schema=False)
    def root():
        return RedirectResponse(os.environ.get("FRONTEND_URL") or "/docs")


# Агар frontend сохта шуда бошад (npm run build), онро ҳамин сервер медиҳад.
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    _template: dict = {}

    def index_template() -> str:
        """dist/index.html (пас аз npm run build аз нав хонда мешавад)."""
        path = FRONTEND_DIST / "index.html"
        mtime = path.stat().st_mtime
        if _template.get("mtime") != mtime:
            _template.update(mtime=mtime, html=path.read_text(encoding="utf-8"))
        return _template["html"]

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str, request: Request, db: DB):
        if full_path.startswith(("api/", "uploads/")):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        file = FRONTEND_DIST / full_path
        if full_path and file.is_file() and FRONTEND_DIST in file.resolve().parents:
            return FileResponse(file)
        # Саҳифаҳои SPA: метатегҳо ва матни саҳифа аз сервер (SEO ва превюи паёмрасонҳо)
        page = seo.build(db, full_path, dict(request.query_params))
        return HTMLResponse(seo.render(index_template(), page), status_code=page.status,
                            headers={"Cache-Control": "no-cache"})
