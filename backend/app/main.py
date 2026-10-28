import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app.db import Base, engine, migrate_phone_to_email
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

# Агар frontend сохта нашуда бошад, "/" ба сайти Vite (ё /docs) мегузарад, на 404.
if not FRONTEND_DIST.exists():

    @app.get("/", include_in_schema=False)
    def root():
        return RedirectResponse(os.environ.get("FRONTEND_URL") or "/docs")


# Агар frontend сохта шуда бошад (npm run build), онро ҳамин сервер медиҳад.
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith(("api/", "uploads/")):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        file = FRONTEND_DIST / full_path
        if full_path and file.is_file() and FRONTEND_DIST in file.resolve().parents:
            return FileResponse(file)
        return FileResponse(FRONTEND_DIST / "index.html")
