import os
import sys
import tempfile
from pathlib import Path

root = tempfile.TemporaryDirectory()
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", "sqlite:///" + str(Path(root.name) / "core.db"))
os.environ["HEALTH_DATABASE_URL"] = os.getenv("TEST_HEALTH_DATABASE_URL", "sqlite:///" + str(Path(root.name) / "health.db"))
os.environ["ADMIN_PASSWORD"] = "test-only-password-with-sufficient-entropy"
os.environ["PUBLIC_URL"] = "https://life.test"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import hashlib
import time
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi.testclient import TestClient
from app.main import app, digest, login_failures
from app.db import Session, SessionToken, Item, HealthSession, HealthDay, engine, health_engine
from app.migrate import migrate
import pytest

migrate()


@pytest.fixture(scope="session", autouse=True)
def close_databases():
    yield
    engine.dispose()
    health_engine.dispose()
    root.cleanup()


@pytest.fixture
def client():
    login_failures.clear()
    with Session.begin() as db:
        for model in [Item, SessionToken]:
            db.query(model).delete()
        db.add(SessionToken(digest=digest("test-token"), expires=time.time() + 300))
    with HealthSession.begin() as db:
        db.query(HealthDay).delete()
    with TestClient(app, base_url="https://life.test", headers={"Authorization": "Bearer test-token"}) as c:
        yield c


def test_requires_valid_session(client):
    assert client.get("/api/v1/dashboard", headers={"Authorization": "Bearer missing"}).status_code == 401
    with Session.begin() as db:
        db.get(SessionToken, digest("test-token")).expires = 0
    assert client.get("/api/v1/dashboard").status_code == 401


def test_error_language_defaults_to_english_and_supports_german(client):
    headers={"Authorization":"Bearer missing"}
    assert client.get("/api/v1/session",headers=headers).json()["detail"] == "Please sign in"
    assert client.get("/api/v1/session",headers={**headers,"Accept-Language":"de"}).json()["detail"] == "Bitte anmelden"


def test_crud_and_version_conflict(client):
    created = client.post("/api/v1/items/tasks", json={"title": "Planen"})
    assert created.status_code == 201
    task = created.json()
    path = "/api/v1/items/tasks/" + task["id"]
    assert client.put(path, json={**task, "completed": True}).status_code == 200
    assert client.put(path, json=task).status_code == 409
    assert client.delete(path + "?version=1").status_code == 409
    assert client.delete(path + "?version=2").status_code == 200
    assert client.get("/api/v1/items/tasks").json() == []


def test_validation_and_kind(client):
    assert client.post("/api/v1/items/tasks", json={"title": "   "}).status_code == 422
    assert client.get("/api/v1/items/unknown").status_code == 404
    assert client.post("/api/v1/items/events", json={"title": "Termin"}).status_code == 422
    assert client.post("/api/v1/items/events", json={"title": "Termin", "start": "2026-11-01T12:00:00Z", "end": "2026-11-01T11:00:00Z"}).status_code == 422


def test_health_idempotence_and_null_values(client):
    day = datetime.now(ZoneInfo("Europe/Berlin")).date().isoformat()
    payload = {"days": [{"day": day, "steps": 1200}]}
    for _ in range(2):
        assert client.put("/api/v1/health/days", json=payload).status_code == 200
    result = client.get("/api/v1/health/days").json()
    assert len(result["days"]) == 1
    assert result["days"][0]["sleep_minutes"] is None
    payload["days"][0]["steps"] = 1400
    client.put("/api/v1/health/days", json=payload)
    assert client.get("/api/v1/health/days").json()["days"][0]["steps"] == 1400
    assert client.delete("/api/v1/health/days").status_code == 200
    assert client.get("/api/v1/health/days").json()["days"] == []


def test_health_rejects_invalid_import(client):
    assert client.put("/api/v1/health/days", json={"days": [{"day": "2000-01-01", "steps": 1}]}).status_code == 422
    assert client.put("/api/v1/health/days", json={"days": [{"day": "2026-11-01", "steps": -1}]}).status_code == 422


def test_native_password_login_and_logout(client):
    path = "/api/v1/auth/native/login"
    assert client.post(path, json={"password": "wrong"}).status_code == 401
    result = client.post(path, json={"password": os.environ["ADMIN_PASSWORD"]})
    assert result.status_code == 200
    assert "set-cookie" not in result.headers
    assert result.json()["expires_in"] == 7 * 86400
    token = result.json()["access_token"]
    assert client.post("/api/v1/auth/logout", headers={"Authorization": "Bearer " + token}).status_code == 200
    assert client.get("/api/v1/session", headers={"Authorization": "Bearer " + token}).status_code == 401


def test_cookie_origin_protection(client):
    client.headers.pop("Authorization")
    client.cookies.set("life_session", "test-token")
    assert client.post("/api/v1/items/notes", json={"title": "Notiz"}).status_code == 403
    assert client.post("/api/v1/items/notes", json={"title": "Notiz"}, headers={"Origin": "https://life.test"}).status_code == 201


def test_web_password_login(client):
    client.headers.pop("Authorization")
    assert client.post("/api/v1/auth/login", json={"password": os.environ["ADMIN_PASSWORD"]}).status_code == 403
    headers = {"Origin": "https://life.test"}
    assert client.post("/api/v1/auth/login", json={"password": "wrong"}, headers=headers).status_code == 401
    result = client.post("/api/v1/auth/login", json={"password": os.environ["ADMIN_PASSWORD"]}, headers=headers)
    assert result.status_code == 200
    assert "HttpOnly" in result.headers["set-cookie"]
    assert "Secure" in result.headers["set-cookie"]
    assert result.headers["cache-control"] == "no-store"
    assert client.get("/api/v1/session").status_code == 200
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 200
    assert client.get("/api/v1/session").status_code == 401


def test_login_throttling(client):
    for _ in range(5):
        assert client.post("/api/v1/auth/native/login", json={"password": "wrong"}).status_code == 401
    result = client.post("/api/v1/auth/login", json={"password": os.environ["ADMIN_PASSWORD"]}, headers={"Origin": "https://life.test"})
    assert result.status_code == 429
    assert result.headers["Retry-After"] == "60"
    login_failures.clear()
    login_failures.extend([time.monotonic() - 61] * 5)
    assert client.post("/api/v1/auth/native/login", json={"password": os.environ["ADMIN_PASSWORD"]}).status_code == 200


def test_legacy_login_and_sessions_removed(client):
    with Session.begin() as db:
        db.add(SessionToken(digest=hashlib.sha256(b"legacy-token").hexdigest(), expires=time.time() + 60))
    assert client.get("/api/v1/session", headers={"Authorization": "Bearer legacy-token"}).status_code == 401
    assert client.get("/api/v1/auth/callback").status_code == 404
    assert client.post("/api/v1/auth/native/exchange", json={}).status_code == 404


@pytest.mark.parametrize("kind,payload", [
    ("notes", {"title": "Release", "description": "Master prüfen"}),
    ("events", {"title": "Studio", "start": "2026-10-25T01:30:00+02:00", "end": "2026-10-25T02:30:00+01:00", "location": "Berlin"}),
])
def test_notes_and_events_round_trip(client, kind, payload):
    created = client.post("/api/v1/items/" + kind, json=payload)
    assert created.status_code == 201
    item = created.json()
    assert client.get("/api/v1/items/" + kind).json()[0] == item
    assert client.put(f"/api/v1/items/{kind}/{item['id']}", json={**item, "title": "Aktualisiert"}).json()["version"] == 2
    assert client.delete(f"/api/v1/items/{kind}/{item['id']}?version=2").status_code == 200


def test_weight_needs_matching_timestamp(client):
    day = datetime.now(ZoneInfo("Europe/Berlin")).date().isoformat()
    assert client.put("/api/v1/health/days", json={"days": [{"day": day, "weight_kg": 80}]}).status_code == 422
    assert client.put("/api/v1/health/days", json={"days": [{"day": day, "weight_kg": 80, "weight_at": day + "T12:00:00+01:00"}]}).status_code == 200


def test_database_isolation():
    from sqlalchemy import text
    from sqlalchemy.exc import DBAPIError
    if engine.dialect.name != "postgresql":
        assert engine.url.database != health_engine.url.database
        return
    for connection, forbidden in [(engine, "health.days"), (health_engine, "core.items")]:
        with connection.connect() as db:
            with pytest.raises(DBAPIError, match="permission denied"):
                db.execute(text("SELECT * FROM " + forbidden))
