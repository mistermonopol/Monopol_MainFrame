"""An outbound LAN bridge. User sessions and bridge credentials are separate scopes."""
import asyncio
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from threading import RLock
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select
from .db import Item, Session, now

user_router = APIRouter(prefix='/api/v1/smart-home')
bridge_router = APIRouter(prefix='/api/v1/bridge/ha')
lock = RLock()
BRIDGE_ID = 'ha-bridge'
FINAL = {'accepted', 'failed', 'expired', 'unknown'}


def stamp():
    return now().isoformat()


def parse(value):
    return datetime.fromisoformat(value).astimezone(timezone.utc)


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def bridge_authenticated(request: Request):
    header = request.headers.get('authorization', '')
    candidate = digest(header[7:]) if header.startswith('Bearer ') and len(header) <= 512 else ''
    with Session() as db:
        row = db.get(Item, BRIDGE_ID)
        if not row or not hmac.compare_digest(row.data['token_hash'], candidate):
            raise HTTPException(401, 'Bridge authentication failed.')
    return candidate


def check_credential(db, principal):
    row = db.get(Item, BRIDGE_ID)
    if not row or not hmac.compare_digest(row.data['token_hash'], principal):
        raise HTTPException(401, 'Bridge authentication failed.')
    return row


def status(data):
    if not data:
        return 'not_configured'
    if not data.get('last_seen') or now() - parse(data['last_seen']) > timedelta(seconds=20):
        return 'offline'
    return 'online' if data.get('available') else 'ha_unavailable'


def lights():
    with Session() as db:
        row = db.get(Item, BRIDGE_ID)
        data = row.data if row else {}
        return {'status':status(data), 'last_seen':data.get('last_seen'), 'last_state':data.get('last_state'),
                'error':data.get('error'), 'lights':data.get('lights', [])}


@user_router.get('/lights')
def get_lights():
    return lights()


@user_router.post('/bridge-token')
def rotate_token():
    token = secrets.token_urlsafe(48)
    with lock, Session.begin() as db:
        row = db.get(Item, BRIDGE_ID)
        data = {'token_hash':digest(token), 'lights':[], 'available':False}
        if row:
            row.data = data
            row.updated_at = now()
        else:
            db.add(Item(id=BRIDGE_ID,kind='ha_bridge',data=data,version=1,updated_at=now()))
        for command in db.scalars(select(Item).where(Item.kind == 'ha_command')):
            if command.data['status'] not in FINAL:
                command.data = {**command.data,'status':'unknown' if command.data['status']=='dispatched' else 'failed','error':'bridge_replaced'}
    # Never persisted or logged in plaintext. Not part of dashboard/agent data.
    return {'token':token}


class Light(BaseModel):
    model_config = ConfigDict(extra='forbid')
    entity_id: str = Field(pattern=r'^light\.[a-z0-9_]+$', max_length=255)
    name: str = Field(min_length=1, max_length=250)
    state: Literal['on','off','unknown','unavailable']
    brightness_pct: int | None = Field(default=None, ge=0, le=100)
    rgb_color: tuple[int,int,int] | None = None
    color_temp_kelvin: int | None = Field(default=None, ge=1, le=100000)
    supported_color_modes: list[Literal['onoff','brightness','color_temp','hs','xy','rgb','rgbw','rgbww','white','unknown']] = Field(default_factory=list, max_length=20)
    min_kelvin: int | None = Field(default=None, ge=1, le=100000)
    max_kelvin: int | None = Field(default=None, ge=1, le=100000)

    @model_validator(mode='after')
    def validate_colors(self):
        if self.rgb_color and any(v < 0 or v > 255 for v in self.rgb_color):
            raise ValueError('Invalid RGB color')
        if self.min_kelvin and self.max_kelvin and self.min_kelvin > self.max_kelvin:
            raise ValueError('Invalid Kelvin range')
        return self


class Report(BaseModel):
    model_config = ConfigDict(extra='forbid')
    available: bool
    error: Literal['auth','network','invalid_response'] | None = None
    lights: list[Light] = Field(default_factory=list, max_length=2000)

    @model_validator(mode='after')
    def unique_entities(self):
        if len({n.entity_id for n in self.lights}) != len(self.lights):
            raise ValueError('Duplicate light entity')
        return self


@bridge_router.post('/report')
def report(data: Report, principal=Depends(bridge_authenticated)):
    with lock, Session.begin() as db:
        row = check_credential(db, principal)
        updated = {**row.data, 'last_seen':stamp(), 'available':data.available, 'error':data.error}
        if data.available:
            updated['lights'] = [light.model_dump(mode='json') for light in data.lights]
            updated['last_state'] = stamp()
        row.data = updated
        row.updated_at = now()
    return {'ok':True}


class CommandInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    request_id: UUID
    entity_ids: list[str] = Field(min_length=1, max_length=100)
    power: Literal['on','off'] | None = None
    brightness_pct: int | None = Field(default=None, ge=0, le=100)
    rgb_color: tuple[int,int,int] | None = None
    color_temp_kelvin: int | None = Field(default=None, ge=1, le=100000)

    @model_validator(mode='after')
    def validate_action(self):
        import re
        if any(not re.fullmatch(r'light\.[a-z0-9_]{1,249}', entity) for entity in self.entity_ids):
            raise ValueError('Only light entities are allowed')
        self.entity_ids = list(dict.fromkeys(self.entity_ids))
        if self.rgb_color and any(v < 0 or v > 255 for v in self.rgb_color):
            raise ValueError('Invalid RGB color')
        if self.rgb_color is not None and self.color_temp_kelvin is not None:
            raise ValueError('Choose color or color temperature')
        extras = self.brightness_pct is not None or self.rgb_color is not None or self.color_temp_kelvin is not None
        if self.power is None and not extras:
            raise ValueError('An explicit target state is required')
        if self.power == 'off' and extras:
            raise ValueError('Off cannot include light settings')
        if self.brightness_pct == 0 and (self.power == 'on' or self.rgb_color is not None or self.color_temp_kelvin is not None):
            raise ValueError('Zero brightness means off')
        return self


def validate_capabilities(command, available):
    by_id = {light['entity_id']:light for light in available}
    for entity in command.entity_ids:
        light = by_id.get(entity)
        if not light or light['state'] not in {'on','off'}:
            raise HTTPException(409, 'A selected light is unknown or unavailable.')
        modes = set(light['supported_color_modes'])
        if command.brightness_pct not in {None, 0} and not modes - {'onoff','unknown'}:
            raise HTTPException(422, 'A selected light does not support dimming.')
        if command.rgb_color is not None and not modes & {'hs','xy','rgb','rgbw','rgbww'}:
            raise HTTPException(422, 'A selected light does not support color.')
        if command.color_temp_kelvin is not None:
            if 'color_temp' not in modes or not light.get('min_kelvin') or not light.get('max_kelvin'):
                raise HTTPException(422, 'A selected light does not support color temperature.')
            if not light['min_kelvin'] <= command.color_temp_kelvin <= light['max_kelvin']:
                raise HTTPException(422, 'Color temperature is outside the supported range.')


def expire(row):
    if row.data['status'] not in FINAL and parse(row.data['expires_at']) <= now():
        row.data = {**row.data, 'status':'expired' if row.data['status']=='pending' else 'unknown', 'error':'deadline_exceeded'}


def public_command(row):
    return {k:v for k,v in row.data.items() if k not in {'request_hash','token_hash'}} | {'id':row.id}


def enqueue(data: CommandInput):
    key = 'ha-command-' + str(data.request_id)
    request_hash = hashlib.sha256(json.dumps(data.model_dump(mode='json'),sort_keys=True).encode()).hexdigest()
    with lock, Session.begin() as db:
        existing = db.get(Item, key)
        if existing:
            if existing.data['request_hash'] != request_hash:
                raise HTTPException(409, 'Request ID already used for another light command.')
            expire(existing)
            return public_command(existing)
        bridge = db.get(Item, BRIDGE_ID)
        if not bridge or status(bridge.data) != 'online':
            raise HTTPException(503, 'Home Assistant bridge is offline. No command was queued.')
        validate_capabilities(data, bridge.data['lights'])
        row = Item(id=key,kind='ha_command',version=1,updated_at=now(),data={
            'request_hash':request_hash,'token_hash':bridge.data['token_hash'], 'status':'pending',
            'created_at':stamp(),'expires_at':(now()+timedelta(seconds=15)).isoformat(),
            'command':data.model_dump(mode='json',exclude={'request_id'},exclude_none=True)})
        db.add(row)
        return public_command(row)


@user_router.post('/commands',status_code=202)
def create_command(data: CommandInput):
    return enqueue(data)


@user_router.get('/commands/{command_id}')
def get_command(command_id: str):
    with lock, Session.begin() as db:
        row = db.get(Item,command_id)
        if not row or row.kind != 'ha_command':
            raise HTTPException(404, 'Light command not found.')
        expire(row)
        return public_command(row)


def claim(principal):
    with lock, Session.begin() as db:
        bridge = check_credential(db,principal)
        rows = db.scalars(select(Item).where(Item.kind=='ha_command', Item.data['status'].as_string().in_(['pending','dispatched'])).order_by(Item.updated_at))
        for row in rows:
            expire(row)
            if row.data['status']=='pending' and hmac.compare_digest(row.data['token_hash'],principal):
                if status(bridge.data) != 'online':
                    row.data = {**row.data,'status':'failed','error':'ha_unavailable'}
                    continue
                row.data = {**row.data,'status':'dispatched'}
                return public_command(row)
    return None


@bridge_router.post('/poll')
async def poll(wait: int = 25, principal=Depends(bridge_authenticated)):
    if wait < 0 or wait > 25:
        raise HTTPException(422, 'Invalid polling duration.')
    for _ in range(wait*4+1):
        command = claim(principal)
        if command:
            return command
        if wait:
            await asyncio.sleep(.25)
    return {'id':None}


class Result(BaseModel):
    model_config = ConfigDict(extra='forbid')
    accepted: bool
    uncertain: bool = False
    error: Literal['auth','network','invalid_response','unsupported','expired'] | None = None


@bridge_router.post('/commands/{command_id}/result')
def command_result(command_id: str, result: Result, principal=Depends(bridge_authenticated)):
    with lock, Session.begin() as db:
        check_credential(db,principal)
        row = db.get(Item,command_id)
        if not row or row.kind!='ha_command' or not hmac.compare_digest(row.data['token_hash'],principal):
            raise HTTPException(404, 'Light command not found.')
        expire(row)
        if row.data['status'] != 'dispatched':
            return public_command(row)
        row.data = {**row.data,'status':'unknown' if result.uncertain else 'accepted' if result.accepted else 'failed','error':result.error}
        row.updated_at = now()
        return public_command(row)


async def control(data: CommandInput):
    queued = enqueue(data)
    while queued['status'] not in FINAL:
        await asyncio.sleep(.3)
        queued = get_command(queued['id'])
    return {'command':queued,'home_assistant':lights()}
