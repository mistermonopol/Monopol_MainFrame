"""Due task reminders shared by Web Push and the authenticated Android worker."""
import asyncio
import base64
import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone, time as daytime
from urllib.parse import urlparse
from threading import Lock
from zoneinfo import ZoneInfo

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from pywebpush import webpush, WebPushException
from py_vapid import Vapid
from .config import settings
from .db import Item, Session, now

router = APIRouter()
log = logging.getLogger(__name__)
vapid_lock = Lock()


def scheduled_at(data):
    if data.get('completed') or not data.get('reminders_enabled', True):
        return None
    if data.get('remind_at'):
        return datetime.fromisoformat(data['remind_at'].replace('Z', '+00:00')).astimezone(timezone.utc)
    if data.get('due'):
        return datetime.combine(datetime.fromisoformat(data['due']).date(), daytime(9), ZoneInfo('Europe/Berlin')).astimezone(timezone.utc)
    return None


def due_reminders(clock=None):
    clock = clock or now()
    with Session() as db:
        tasks = list(db.scalars(select(Item).where(Item.kind == 'tasks')))
        result = []
        for task in tasks:
            stamp = scheduled_at(task.data)
            if stamp and clock - timedelta(hours=24) <= stamp <= clock:
                key = hashlib.sha256((task.id + stamp.isoformat()).encode()).hexdigest()
                result.append({'id': key, 'task_id': task.id, 'title': task.data['title'], 'scheduled_at': stamp.isoformat()})
        return sorted(result, key=lambda r: r['scheduled_at'])


@router.get('/notifications/due')
def notifications_due():
    return due_reminders()


def vapid():
    with vapid_lock:
        return _vapid()


def _vapid():
    with Session.begin() as db:
        row = db.get(Item, 'webpush-vapid')
        if row:
            return row.data
        private = ec.generate_private_key(ec.SECP256R1())
        public = private.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
        data = {'private': private.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode(),
                'public': base64.urlsafe_b64encode(public).decode().rstrip('=')}
        db.add(Item(id='webpush-vapid', kind='notification_config', data=data, version=1, updated_at=now()))
        return data


@router.get('/notifications/config')
def notification_config():
    return {'public_key': vapid()['public'], 'timezone': 'Europe/Berlin', 'default_time': '09:00'}


class Subscription(BaseModel):
    endpoint: str = Field(max_length=4096)
    keys: dict[str, str]
    language: str = Field(default='en', pattern='^(en|de)$')

    @field_validator('endpoint')
    @classmethod
    def valid_endpoint(cls, value):
        parsed = urlparse(value)
        host = (parsed.hostname or '').lower()
        allowed = host in {'fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'} or host.endswith('.notify.windows.com') or host.endswith('.push.services.mozilla.com')
        if parsed.scheme != 'https' or parsed.username or parsed.password or parsed.port not in {None, 443} or not allowed:
            raise ValueError('Unsupported push service endpoint')
        return value

    @field_validator('keys')
    @classmethod
    def valid_keys(cls, value):
        if set(value) != {'p256dh', 'auth'}:
            raise ValueError('Invalid push keys')
        for name, length in [('p256dh', 65), ('auth', 16)]:
            try:
                decoded = base64.urlsafe_b64decode(value[name] + '=' * (-len(value[name]) % 4))
                if len(decoded) != length:
                    raise ValueError()
                if name == 'p256dh':
                    ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), decoded)
            except (ValueError, TypeError):
                raise ValueError('Invalid push key encoding')
        return value


@router.post('/notifications/subscriptions')
def subscribe(data: Subscription):
    key = 'push-' + hashlib.sha256(data.endpoint.encode()).hexdigest()
    with Session.begin() as db:
        row = db.get(Item, key)
        if row:
            row.data = data.model_dump()
            row.updated_at = now()
        else:
            count = len(list(db.scalars(select(Item.id).where(Item.kind == 'push_subscription'))))
            if count >= 20:
                raise HTTPException(409, 'Push subscription limit reached. Disable notifications on an old device first.')
            db.add(Item(id=key, kind='push_subscription', data=data.model_dump(), version=1, updated_at=now()))
    return {'ok': True}


class Unsubscribe(BaseModel):
    endpoint: str = Field(max_length=4096)


@router.post('/notifications/unsubscribe')
def unsubscribe(data: Unsubscribe):
    key = 'push-' + hashlib.sha256(data.endpoint.encode()).hexdigest()
    with Session.begin() as db:
        row = db.get(Item, key)
        if row and row.kind == 'push_subscription':
            db.delete(row)
    return {'ok': True}


def dispatch():
    reminders = due_reminders()
    with Session() as db:
        subscribers = [(s.id, s.data) for s in db.scalars(select(Item).where(Item.kind == 'push_subscription'))]
    if not reminders or not subscribers:
        return
    private = Vapid(private_key=serialization.load_pem_private_key(vapid()['private'].encode(), password=None))
    for sid, subscription in subscribers:
        for reminder in reminders:
            key = 'sent-' + hashlib.sha256((sid + reminder['id']).encode()).hexdigest()
            with Session() as db:
                if db.get(Item, key):
                    continue
            # Check current state again: completed tasks must not produce queued alerts.
            with Session() as db:
                current = db.get(Item, reminder['task_id'])
                if not current or scheduled_at(current.data) is None or scheduled_at(current.data).isoformat() != reminder['scheduled_at']:
                    continue
            try:
                webpush(subscription_info={'endpoint':subscription['endpoint'],'keys':subscription['keys']},
                        data=json.dumps({'title':'Aufgabe fällig' if subscription['language']=='de' else 'Task due', 'body':reminder['title'], 'id':reminder['id'], 'url':'/?tab=tasks'}),
                        vapid_private_key=private, vapid_claims={'sub':settings.public_url}, timeout=10, ttl=3600)
                with Session.begin() as db:
                    if not db.get(Item, key):
                        db.add(Item(id=key, kind='push_delivery', data={'sent_at':now().isoformat()}, version=1, updated_at=now()))
            except WebPushException as error:
                if error.response is not None and error.response.status_code in {404, 410}:
                    unsubscribe(Unsubscribe(endpoint=subscription['endpoint']))
                    break
                log.warning('Task push delivery failed; will retry. No provider payload logged.')
            except Exception:
                log.warning('Task push transport failed; will retry. No provider payload logged.')
    with Session.begin() as db:
        for row in db.scalars(select(Item).where(Item.kind == 'push_delivery')):
            if datetime.fromisoformat(row.data['sent_at']) < now() - timedelta(days=7):
                db.delete(row)


async def reminder_loop():
    while True:
        await asyncio.sleep(60)
        try:
            await asyncio.to_thread(dispatch)
            from .agent_tools import cleanup_history
            await asyncio.to_thread(cleanup_history)
        except Exception:
            log.warning('Task reminder cycle failed. Retrying in one minute.')
