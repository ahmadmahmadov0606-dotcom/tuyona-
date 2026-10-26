import os
import tempfile
from pathlib import Path

_tmp = Path(tempfile.mkdtemp(prefix="tuyona-test-"))
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp / 'test.db'}"
os.environ["UPLOAD_DIR"] = str(_tmp / "uploads")

import pytest  
from fastapi.testclient import TestClient  

from app.db import Base, SessionLocal, engine 
from app.main import app  
from app.routers.auth import login_limiter  
from app.seed import seed_reference  


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_reference(db)
    login_limiter.reset()
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def register(client, email, role="client", name="Тест Корбар"):
    r = client.post("/api/auth/register", json={
        "email": email, "full_name": name, "password": "secret123", "role": role,
    })
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def vendor(client):
    return register(client, "vendor@test.tj", "vendor", "Хизматрасон")


@pytest.fixture
def user(client):
    return register(client, "client@test.tj", "client", "Мизоҷ")


@pytest.fixture
def ref(client):
    cats = client.get("/api/categories").json()
    cities = client.get("/api/cities").json()
    by_slug = {c["slug"]: c for g in cats for c in g["categories"]}
    return {"cat": by_slug, "city": {c["slug"]: c for c in cities}}


@pytest.fixture
def make_listing(client, vendor, ref):
    def _make(**over):
        body = {
            "category_id": ref["cat"]["bride-car"]["id"],
            "city_id": ref["city"]["dushanbe"]["id"],
            "title": "Лимузини сафед",
            "description": "Барои арӯс",
            "contact_phone": "901111111",
            "price_from": 1500,
            "price_unit": "event",
        }
        body.update(over)
        r = client.post("/api/listings", json=body, headers=vendor)
        assert r.status_code == 201, r.text
        return r.json()
    return _make
