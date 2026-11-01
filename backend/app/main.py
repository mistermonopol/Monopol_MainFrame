import hashlib
import hmac
import secrets
import time
from datetime import date, datetime, timedelta, timezone
from collections import deque
from threading import Lock
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi import FastAPI, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, AwareDatetime, SecretStr, model_validator
from sqlalchemy import select, delete, text

from .config import settings
from .db import Session, HealthSession, Item, SessionToken, HealthDay, now

app = FastAPI(title="Everything API", version="1.0.0")


@app.middleware("http")
async def private_responses(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


password_salt = secrets.token_bytes(16)
password_key = hashlib.scrypt(settings.admin_password.get_secret_value().encode(),
                             salt=password_salt, n=16384, r=8, p=1)
session_key = hashlib.sha256(settings.admin_password.get_secret_value().encode()).digest()
login_failures = deque()
login_lock = Lock()


def digest(token):
    # Password changes invalidate sessions, including sessions from the old login.
    return hmac.new(session_key, token.encode(), hashlib.sha256).hexdigest()


def authenticated(request: Request):
    bearer = request.headers.get("authorization", "")
    token = bearer[7:] if bearer.startswith("Bearer ") else request.cookies.get("life_session", "")
    with Session() as db:
        session = db.get(SessionToken, digest(token))
        if not session or session.expires < time.time():
            raise HTTPException(401, "Bitte anmelden")
    if request.method not in {"GET", "HEAD", "OPTIONS"} and not bearer:
        if request.headers.get("origin") != settings.public_url.rstrip("/"):
            raise HTTPException(403, "Ungültiger Ursprung")
    return digest(token)


@app.get("/api/v1/healthz")
def healthz():
    with Session() as db, HealthSession() as health:
        db.execute(text("SELECT 1"))
        health.execute(text("SELECT 1"))
    return {"status": "ok"}


class LoginInput(BaseModel):
    password: SecretStr = Field(min_length=1, max_length=1024)


def verify_password(payload: LoginInput):
    # One private account, one API process: a shared limit prevents IP spoofing
    # through proxies from bypassing throttling. No passwords are persisted.
    with login_lock:
        clock = time.monotonic()
        while login_failures and login_failures[0] <= clock - 60:
            login_failures.popleft()
        if len(login_failures) >= 5:
            raise HTTPException(429, "Zu viele Anmeldeversuche. Bitte in einer Minute erneut versuchen.",
                                headers={"Retry-After": "60"})
        candidate = hashlib.scrypt(payload.password.get_secret_value().encode(),
                                   salt=password_salt, n=16384, r=8, p=1)
        if not hmac.compare_digest(candidate, password_key):
            login_failures.append(clock)
            raise HTTPException(401, "Passwort ist falsch")
        login_failures.clear()


def create_session():
    raw = secrets.token_urlsafe(48)
    with Session.begin() as db:
        db.add(SessionToken(digest=digest(raw), expires=time.time() + 86400 * 7))
    return raw


@app.post("/api/v1/auth/login")
def login(payload: LoginInput, request: Request, response: Response):
    if request.headers.get("origin") != settings.public_url.rstrip("/"):
        raise HTTPException(403, "Ungültiger Ursprung")
    verify_password(payload)
    raw = create_session()
    response.set_cookie("life_session", raw, httponly=True, secure=settings.cookie_secure,
                        samesite="lax", max_age=86400 * 7, path="/")
    return {"ok": True}


@app.post("/api/v1/auth/native/login")
def native_login(payload: LoginInput):
    verify_password(payload)
    return {"access_token": create_session(), "expires_in": 86400 * 7, "token_type": "Bearer"}


@app.get("/api/v1/session", dependencies=[Depends(authenticated)])
def session_info():
    return {"name": "Mein Life OS"}


@app.post("/api/v1/auth/logout")
def logout(response: Response, token=Depends(authenticated)):
    with Session.begin() as db:
        db.execute(delete(SessionToken).where(SessionToken.digest == token))
    response.delete_cookie("life_session")
    return {"ok": True}


class ItemInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=50000)
    due: date | None = None
    completed: bool = False
    start: AwareDatetime | None = None
    end: AwareDatetime | None = None
    location: str = Field(default="", max_length=500)
    version: int = Field(default=1, ge=1)

    @model_validator(mode="after")
    def validate_values(self):
        self.title = self.title.strip()
        if not self.title:
            raise ValueError("Titel fehlt")
        if self.start and self.end and self.end <= self.start:
            raise ValueError("Ende muss nach Beginn liegen")
        return self


def check_kind(kind):
    if kind not in {"tasks", "notes", "events"}:
        raise HTTPException(404, "Unbekannter Bereich")


def item_data(kind, data):
    fields = {"tasks": {"title", "description", "due", "completed"},
              "notes": {"title", "description"},
              "events": {"title", "description", "start", "end", "location"}}
    if kind == "events" and (not data.start or not data.end):
        raise HTTPException(422, "Beginn und Ende fehlen")
    return data.model_dump(mode="json", include=fields[kind])


def iso_stamp(value):
    # SQLite returns naive UTC datetimes; keep the API identical to PostgreSQL.
    return value.replace(tzinfo=value.tzinfo or timezone.utc).astimezone(timezone.utc).isoformat()


def serialize(item):
    return {**item.data, "id": item.id, "version": item.version, "updated_at": iso_stamp(item.updated_at)}


@app.get("/api/v1/items/{kind}", dependencies=[Depends(authenticated)])
def list_items(kind: str):
    check_kind(kind)
    with Session() as db:
        return [serialize(i) for i in db.scalars(select(Item).where(Item.kind == kind).order_by(Item.updated_at.desc()))]


@app.post("/api/v1/items/{kind}", status_code=201, dependencies=[Depends(authenticated)])
def create_item(kind: str, data: ItemInput):
    check_kind(kind)
    with Session.begin() as db:
        item = Item(id=str(uuid4()), kind=kind, version=1, data=item_data(kind, data), updated_at=now())
        db.add(item)
        db.flush()
        return serialize(item)


@app.put("/api/v1/items/{kind}/{item_id}", dependencies=[Depends(authenticated)])
def update_item(kind: str, item_id: str, data: ItemInput):
    check_kind(kind)
    with Session.begin() as db:
        item = db.scalar(select(Item).where(Item.id == item_id, Item.kind == kind).with_for_update())
        if not item:
            raise HTTPException(404, "Eintrag fehlt")
        if item.version != data.version:
            raise HTTPException(409, "Eintrag wurde geändert. Bitte neu laden.")
        item.data = item_data(kind, data)
        item.version += 1
        item.updated_at = now()
        db.flush()
        return serialize(item)


@app.delete("/api/v1/items/{kind}/{item_id}", dependencies=[Depends(authenticated)])
def delete_item(kind: str, item_id: str, version: int):
    check_kind(kind)
    with Session.begin() as db:
        item = db.scalar(select(Item).where(Item.id == item_id, Item.kind == kind).with_for_update())
        if not item:
            raise HTTPException(404, "Eintrag fehlt")
        if item.version != version:
            raise HTTPException(409, "Eintrag wurde geändert. Bitte neu laden.")
        db.delete(item)
    return {"ok": True}


class DayInput(BaseModel):
    day: date
    steps: int | None = Field(default=None, ge=0)
    sleep_minutes: float | None = Field(default=None, ge=0, le=1440)
    resting_pulse: float | None = Field(default=None, gt=0, le=300)
    weight_kg: float | None = Field(default=None, gt=0, le=1000)
    weight_at: AwareDatetime | None = None

    @model_validator(mode="after")
    def weight_timestamp(self):
        if (self.weight_kg is None) != (self.weight_at is None):
            raise ValueError("Gewicht und Messzeitpunkt müssen gemeinsam vorliegen")
        if self.weight_at and self.weight_at.astimezone(ZoneInfo("Europe/Berlin")).date() != self.day:
            raise ValueError("Gewichtsmessung gehört nicht zu diesem Tag")
        return self


class HealthImport(BaseModel):
    days: list[DayInput] = Field(max_length=30)


@app.put("/api/v1/health/days", dependencies=[Depends(authenticated)])
def import_health(payload: HealthImport):
    today = datetime.now(ZoneInfo("Europe/Berlin")).date()
    if len({d.day for d in payload.days}) != len(payload.days):
        raise HTTPException(422, "Doppelte Tage")
    if any(d.day > today or d.day < today - timedelta(days=29) for d in payload.days):
        raise HTTPException(422, "Nur die letzten 30 Tage sind zulässig")
    with HealthSession.begin() as db:
        for day in payload.days:
            row = db.get(HealthDay, day.day.isoformat())
            if row:
                row.data = day.model_dump(mode="json")
                row.updated_at = now()
            else:
                db.add(HealthDay(day=day.day.isoformat(), data=day.model_dump(mode="json"), updated_at=now()))
    return {"imported": len(payload.days)}


@app.get("/api/v1/health/days", dependencies=[Depends(authenticated)])
def health_days():
    with HealthSession() as db:
        rows = list(db.scalars(select(HealthDay).order_by(HealthDay.day.desc())))
        return {"days": [r.data for r in rows], "last_sync": max((iso_stamp(r.updated_at) for r in rows), default=None)}


@app.delete("/api/v1/health/days", dependencies=[Depends(authenticated)])
def clear_health():
    with HealthSession.begin() as db:
        db.execute(delete(HealthDay))
    return {"ok": True}


@app.get("/api/v1/dashboard", dependencies=[Depends(authenticated)])
def dashboard():
    return {"tasks": list_items("tasks"), "notes": list_items("notes"),
            "events": list_items("events"), "health": health_days()}
