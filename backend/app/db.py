from collections.abc import Generator

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def make_engine(url: str):
    is_sqlite = url.startswith("sqlite")
    engine = create_engine(
        url,
        connect_args={"check_same_thread": False} if is_sqlite else {},
        pool_pre_ping=not is_sqlite,
    )
    if is_sqlite:
        @event.listens_for(engine, "connect")
        def _fk_on(dbapi_conn, _):
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.close()
    return engine


engine = make_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


# Ҳисобҳои намунавӣ, ки пештар бо телефон буданд.
DEMO_EMAILS = {
    "+992900000001": "vendor@tuyona.tj",
    "+992900000002": "client@tuyona.tj",
    "+992900000009": "admin@tuyona.tj",
}


def migrate_phone_to_email() -> None:
    """Базаи кӯҳна: сутуни users.phone → users.email (як бор)."""
    insp = inspect(engine)
    if "users" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("users")}
    if "phone" not in cols or "email" in cols:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users RENAME COLUMN phone TO email"))
        rows = conn.execute(text("SELECT id, email FROM users")).all()
        for uid, phone in rows:
            email = DEMO_EMAILS.get(phone) or f"{phone.lstrip('+')}@tuyona.tj"
            conn.execute(text("UPDATE users SET email = :e WHERE id = :i"), {"e": email, "i": uid})


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
