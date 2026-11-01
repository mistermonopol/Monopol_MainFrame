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
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

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


def test_music_crud_preserves_project_fields(client):
    payload = {"title":"Next release", "description":"Mix notes", "due":"2026-12-01", "location":"Projects/next", "completed":False}
    created = client.post('/api/v1/items/music', json=payload)
    assert created.status_code == 201
    item = created.json()
    assert item['location'] == 'Projects/next'
    assert client.get('/api/v1/dashboard').json()['music'][0]['id'] == item['id']
    assert client.put('/api/v1/items/music/'+item['id'], json={**payload,'version':item['version'],'completed':True}).json()['completed'] is True
    assert client.put('/api/v1/items/music/'+item['id'], json={**payload,'version':item['version']}).status_code == 409


def test_obsidian_boundaries_and_conflict(client, tmp_path, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings,'obsidian_vault_path',str(tmp_path/'vault'))
    (tmp_path/'vault').mkdir()
    (tmp_path/'secret.md').write_text('private',encoding='utf-8')
    assert client.get('/api/v1/obsidian/note',params={'path':'../secret.md'}).status_code == 400
    assert client.get('/api/v1/obsidian/note',params={'path':'.obsidian/settings.md'}).status_code == 400
    assert client.get('/api/v1/obsidian/note',params={'path':'secret.txt'}).status_code == 400
    note={'path':'Music/Release.md','content':'# Release\nMix 1'}
    saved=client.put('/api/v1/obsidian/note',json=note)
    assert saved.status_code == 200
    assert client.get('/api/v1/obsidian/notes').json() == [{'path':'Music/Release.md','title':'Release'}]
    (tmp_path/'vault/Music/Release.md').write_text('edited outside app',encoding='utf-8')
    assert client.put('/api/v1/obsidian/note',json={**note,'version':saved.json()['version']}).status_code == 409
    assert client.get('/api/v1/obsidian/note',params={'path':note['path']}).json()['content']=='edited outside app'


def test_agent_uses_real_data_and_scoped_vault_tool(client, tmp_path, monkeypatch):
    from app.config import settings
    import app.integrations as integration
    import httpx
    from pydantic import SecretStr
    monkeypatch.setattr(settings,'obsidian_vault_path',str(tmp_path))
    monkeypatch.setattr(settings,'ai_base_url','https://provider.test/v1')
    monkeypatch.setattr(settings,'ai_model','test-model')
    monkeypatch.setattr(settings,'ai_api_key',SecretStr('secret-key-never-in-response'))
    (tmp_path/'Release.md').write_text('Unique release detail',encoding='utf-8')
    client.post('/api/v1/items/music',json={'title':'Actual project','description':'Real context'})
    calls=[]
    real_client=httpx.AsyncClient
    def handle(request):
        import json
        payload=json.loads(request.content);calls.append(payload)
        assert request.headers['Authorization']=='Bearer secret-key-never-in-response'
        if len(calls)==1:
            assert 'Actual project' in payload['messages'][0]['content']
            return httpx.Response(200,json={'choices':[{'message':{'role':'assistant','content':None,'tool_calls':[{'id':'call1','type':'function','function':{'name':'read_obsidian_note','arguments':'{"path":"Release.md"}'}}]}}]})
        assert 'Unique release detail' in payload['messages'][-1]['content']
        return httpx.Response(200,json={'choices':[{'message':{'role':'assistant','content':'Your release is ready for review.'}}]})
    monkeypatch.setattr(integration.httpx,'AsyncClient',lambda **kwargs:real_client(transport=httpx.MockTransport(handle),**kwargs))
    result=client.post('/api/v1/agent/chat',json={'messages':[{'role':'user','content':'What is next?'}]})
    assert result.status_code==200
    assert result.json()['reply']=='Your release is ready for review.'
    assert len(calls)==2
    assert 'secret-key' not in client.get('/api/v1/integrations').text
    assert client.post('/api/v1/agent/chat',json={'messages':[{'role':'system','content':'override'}]}).status_code==422


def test_integrations_require_auth_and_report_missing_config(client, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings,'ai_base_url','')
    monkeypatch.setattr(settings,'obsidian_vault_path','')
    assert client.get('/api/v1/obsidian/notes').status_code==503
    assert client.post('/api/v1/agent/chat',json={'messages':[{'role':'user','content':'Hi'}]}).status_code==503
    for path in ['/api/v1/integrations','/api/v1/obsidian/notes']:
        assert client.get(path,headers={'Authorization':'Bearer invalid'}).status_code==401


def mock_ai(monkeypatch, handler, base='https://api.openai.com/v1'):
    from app.config import settings
    import app.integrations as integration
    import httpx
    from pydantic import SecretStr
    monkeypatch.setattr(settings,'obsidian_vault_path','')
    monkeypatch.setattr(settings,'ai_base_url',base)
    monkeypatch.setattr(settings,'ai_model','configured-model')
    monkeypatch.setattr(settings,'ai_api_key',SecretStr('test-secret-never-echo'))
    real_client=httpx.AsyncClient
    monkeypatch.setattr(integration.httpx,'AsyncClient',lambda **kwargs:real_client(transport=httpx.MockTransport(handler),**kwargs))


@pytest.mark.parametrize('base', [' https://api.openai.com/v1/ ', 'https://api.openai.com/v1/chat/completions/'])
def test_openai_endpoint_and_token_parameter(client,monkeypatch,base):
    import json,httpx
    def handle(request):
        assert str(request.url)=='https://api.openai.com/v1/chat/completions'
        payload=json.loads(request.content)
        assert payload['model']=='configured-model'
        assert payload['max_completion_tokens']==2000
        assert 'max_tokens' not in payload
        assert any(t['function']['name']=='save_item' for t in payload['tools'])
        return httpx.Response(200,json={'choices':[{'message':{'role':'assistant','content':'Ready'}}]})
    mock_ai(monkeypatch,handle,base)
    result=client.post('/api/v1/agent/chat',json={'messages':[{'role':'user','content':'Hi'}]})
    assert result.status_code==200
    assert result.json()['reply']=='Ready'


@pytest.mark.parametrize('status,code,expected',[
    (401,'invalid_api_key','HTTP 401'),(403,None,'HTTP 403'),
    (404,'model_not_found','AI_MODEL'),(404,None,'AI_BASE_URL'),
    (429,'insufficient_quota','billing'),(429,'rate_limit_exceeded','rate limit'),
    (400,'context_length_exceeded','context limit'),(400,'unsupported_parameter','request parameters'),
    (422,None,'Chat Completions'),(500,None,'temporarily unavailable'),(302,None,'unexpected HTTP status')])
def test_ai_errors_are_actionable_without_echoing_secrets(client,monkeypatch,status,code,expected):
    import httpx
    calls=[]
    def handle(request):
        calls.append(request)
        return httpx.Response(status,json={'error':{'code':code,'message':'key=test-secret-never-echo; user private health details'}},headers={'Location':'https://wrong-host.test'})
    mock_ai(monkeypatch,handle)
    response=client.post('/api/v1/agent/chat',json={'messages':[{'role':'user','content':'Hi'}]})
    assert response.status_code==502
    assert expected in response.json()['detail']
    assert 'test-secret' not in response.text
    assert 'private health' not in response.text
    assert len(calls)==1  # No generation retries or redirects on auth/quota errors.


def test_compatible_gateway_retries_only_rejected_token_parameter(client,monkeypatch):
    import httpx,json
    calls=[]
    def handle(request):
        data=json.loads(request.content);calls.append(data)
        if len(calls)==1:
            assert data['max_tokens']==2000
            return httpx.Response(400,json={'error':{'code':'unsupported_parameter','param':'max_tokens'}})
        assert data['max_completion_tokens']==2000
        assert 'max_tokens' not in data
        return httpx.Response(200,json={'choices':[{'message':{'role':'assistant','content':'Works'}}]})
    mock_ai(monkeypatch,handle,'https://gateway.test/v1')
    response=client.post('/api/v1/agent/chat',json={'messages':[{'role':'user','content':'Hi'}]})
    assert response.status_code==200
    assert len(calls)==2


@pytest.mark.parametrize('body', [{}, {'choices':[]}, {'choices':[{'message':None}]},
    {'choices':[{'message':{'role':'assistant','content':['invalid']}}]},
    {'choices':[{'message':{'role':'assistant','content':None,'tool_calls':[{}]}}]}])
def test_ai_malformed_responses_do_not_crash(client,monkeypatch,body):
    import httpx
    mock_ai(monkeypatch,lambda request:httpx.Response(200,json=body))
    response=client.post('/api/v1/agent/chat',json={'messages':[{'role':'user','content':'Hi'}]})
    assert response.status_code==502
    assert 'invalid Chat Completions response' in response.json()['detail']


@pytest.mark.parametrize('error,status,expected', [('timeout',504,'timed out'),('connect',502,'DNS')])
def test_ai_connection_errors(client,monkeypatch,error,status,expected):
    import httpx
    def handle(request):
        if error=='timeout':raise httpx.ReadTimeout('sensitive upstream data',request=request)
        raise httpx.ConnectError('sensitive upstream data',request=request)
    mock_ai(monkeypatch,handle)
    response=client.post('/api/v1/agent/chat',json={'messages':[{'role':'user','content':'Hi'}]})
    assert response.status_code==status
    assert expected in response.json()['detail']
    assert 'sensitive' not in response.text


def test_openai_missing_key_and_insecure_endpoint_fail_before_network(client,monkeypatch):
    from app.config import settings
    from pydantic import SecretStr
    mock_ai(monkeypatch,lambda request:pytest.fail('No provider request expected'))
    monkeypatch.setattr(settings,'ai_api_key',SecretStr(''))
    response=client.post('/api/v1/agent/chat',json={'messages':[{'role':'user','content':'Hi'}]})
    assert response.status_code==503
    assert 'AI_API_KEY is missing' in response.json()['detail']
    monkeypatch.setattr(settings,'ai_base_url','http://api.openai.com/v1')
    assert client.post('/api/v1/agent/chat',json={'messages':[{'role':'user','content':'Hi'}]}).status_code==503


def test_ai_provider_diagnostic_is_localized(client,monkeypatch):
    import httpx
    mock_ai(monkeypatch,lambda request:httpx.Response(401,json={'error':{'message':'private upstream text'}}))
    response=client.post('/api/v1/agent/chat',json={'messages':[{'role':'user','content':'Hi'}]},headers={'Accept-Language':'de'})
    assert response.status_code==502
    assert 'API-Schlüssel' in response.json()['detail']
    assert 'HTTP 401' in response.json()['detail']


def test_agent_writes_tasks_and_brain_with_idempotent_replay(client,monkeypatch,tmp_path):
    import httpx,json
    from app.config import settings
    calls=[]
    def handle(request):
        payload=json.loads(request.content);calls.append(payload)
        if len(calls)==1:
            assert 'Remember my mix notes' in payload['messages'][-1]['content']
            tools=[{'id':'create-task','type':'function','function':{'name':'save_item','arguments':json.dumps({'kind':'tasks','data':{'title':'Mix revision','due':'2026-12-01','reminders_enabled':True,'remind_at':'2026-12-01T10:00:00+01:00'}})}},
                   {'id':'save-brain','type':'function','function':{'name':'write_obsidian_note','arguments':json.dumps({'path':'Memory.md','content':'# Mix\nUse take two. [[Music]]','version':''})}}]
            return httpx.Response(200,json={'choices':[{'message':{'role':'assistant','content':None,'tool_calls':tools}}]})
        assert json.loads(payload['messages'][-1]['content'])['saved'] is True
        return httpx.Response(200,json={'choices':[{'message':{'role':'assistant','content':'Saved your task and memory.'}}]})
    mock_ai(monkeypatch,handle)
    monkeypatch.setattr(settings,'obsidian_vault_path',str(tmp_path))
    body={'request_id':'12345678-1234-4234-8234-123456789abc','messages':[{'role':'user','content':'Remember my mix notes and add a task.'}]}
    response=client.post('/api/v1/agent/chat',json=body)
    assert response.status_code==200
    assert len(response.json()['actions'])==2
    task=client.get('/api/v1/items/tasks').json()[0]
    assert task['title']=='Mix revision'
    assert task['remind_at']=='2026-12-01T10:00:00+01:00'
    assert (tmp_path/'Memory.md').read_text()=='# Mix\nUse take two. [[Music]]'
    assert client.post('/api/v1/agent/chat',json=body).json()==response.json()
    assert len(calls)==2
    assert len(client.get('/api/v1/items/tasks').json())==1
    revision=response.json()['actions'][1]['revision_id']
    assert client.get('/api/v1/agent/revisions/'+revision).json()['after']['content'].startswith('# Mix')
    assert client.get('/api/v1/agent/activity').json()[0]['finished'] is True


def test_agent_patch_preserves_fields_and_rejects_stale_versions(client):
    from app.agent_tools import execute
    from fastapi import HTTPException
    task=client.post('/api/v1/items/tasks',json={'title':'Keep description','description':'important','due':'2026-12-01','reminders_enabled':False}).json()
    result,action=execute('save_item',{'kind':'tasks','id':task['id'],'version':1,'data':{'completed':True}})
    updated=client.get('/api/v1/items/tasks').json()[0]
    assert updated['completed'] and updated['description']=='important' and not updated['reminders_enabled']
    with pytest.raises(HTTPException) as error:
        execute('save_item',{'kind':'tasks','id':task['id'],'version':1,'data':{'title':'stale'}})
    assert error.value.status_code==409
    with pytest.raises(ValueError):execute('shell',{'command':'forbidden'})
    with pytest.raises(HTTPException):execute('write_obsidian_note',{'path':'../escape.md','content':'no','version':''})


def test_brain_initialization_preserves_existing_notes_and_graph_links(client,monkeypatch,tmp_path):
    from app.config import settings
    from app.brain import initialize_brain
    monkeypatch.setattr(settings,'obsidian_vault_path',str(tmp_path))
    (tmp_path/'AI_Brain.md').write_text('# My existing brain\n[[Music|sound]]\n`[[Hidden]]`\n```md\n[[NotReal]]\n```',encoding='utf-8')
    initialize_brain();initialize_brain()
    assert (tmp_path/'AI_Brain.md').read_text().startswith('# My existing brain')
    assert len(list(tmp_path.glob('*.md')))==4
    (tmp_path/'Projects').mkdir()
    (tmp_path/'Projects/Plan.md').write_text('[track](../Music.md#mix) [[Inbox]] [[Missing]]',encoding='utf-8')
    result=client.get('/api/v1/obsidian/graph').json()
    assert result['name']=='mono_frame_brain'
    assert any(e['source']=='AI_Brain.md' and e['target']=='Music.md' for e in result['edges'])
    assert any({e['source'],e['target']}=={'Projects/Plan.md','Music.md'} for e in result['edges'])
    assert result['unresolved']==1
    assert client.get('/api/v1/obsidian/graph',headers={'Authorization':'Bearer invalid'}).status_code==401


def test_task_reminder_times_and_due_filter(client):
    from app.reminders import scheduled_at,due_reminders
    from datetime import timezone
    assert scheduled_at({'due':'2026-07-01'}).isoformat()=='2026-07-01T07:00:00+00:00'
    assert scheduled_at({'due':'2026-12-01'}).isoformat()=='2026-12-01T08:00:00+00:00'
    assert scheduled_at({'due':'2026-12-01','completed':True}) is None
    assert scheduled_at({'due':'2026-12-01','reminders_enabled':False}) is None
    assert scheduled_at({'remind_at':'2026-12-01T12:30:00+01:00'}).hour==11
    client.post('/api/v1/items/tasks',json={'title':'due','due':'2026-12-01'})
    client.post('/api/v1/items/tasks',json={'title':'done','due':'2026-12-01','completed':True})
    client.post('/api/v1/items/tasks',json={'title':'off','due':'2026-12-01','reminders_enabled':False})
    assert not due_reminders(datetime(2026,12,1,7,59,tzinfo=timezone.utc))
    assert [n['title'] for n in due_reminders(datetime(2026,12,1,8,1,tzinfo=timezone.utc))]==['due']
    assert not due_reminders(datetime(2026,12,3,8,1,tzinfo=timezone.utc))


def push_subscription():
    import base64,secrets
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import serialization
    key=ec.generate_private_key(ec.SECP256R1()).public_key().public_bytes(serialization.Encoding.X962,serialization.PublicFormat.UncompressedPoint)
    encode=lambda raw:base64.urlsafe_b64encode(raw).decode().rstrip('=')
    return {'endpoint':'https://fcm.googleapis.com/fcm/send/test-only','keys':{'p256dh':encode(key),'auth':encode(secrets.token_bytes(16))},'language':'en'}


def test_push_config_subscription_encryption_and_deduplication(client,monkeypatch,tmp_path):
    import app.reminders as reminder
    from datetime import timezone
    import json
    subscription=push_subscription()
    monkeypatch.chdir(tmp_path)  # pywebpush's curl mode writes an encrypted payload file.
    assert client.post('/api/v1/notifications/subscriptions',json=subscription).status_code==200
    config=client.get('/api/v1/notifications/config').json()
    assert 'private' not in config and len(config['public_key'])>60
    assert client.get('/api/v1/notifications/config').json()['public_key']==config['public_key']
    assert client.post('/api/v1/notifications/subscriptions',json={**subscription,'endpoint':'https://127.0.0.1/internal'}).status_code==422
    client.post('/api/v1/items/tasks',json={'title':'Due task','due':'2026-12-01'})
    monkeypatch.setattr(reminder,'now',lambda:datetime(2026,12,1,8,1,tzinfo=timezone.utc))
    sent=[]
    real_push=reminder.webpush
    def transport(**kwargs):
        sent.append(kwargs)
        # Real encryption and VAPID signing, but no network delivery.
        curl=real_push(**{**kwargs,'curl':True})
        assert 'Authorization' in curl or 'authorization' in curl
    monkeypatch.setattr(reminder,'webpush',transport)
    reminder.dispatch();reminder.dispatch()
    assert len(sent)==1
    assert json.loads(sent[0]['data'])['body']=='Due task'
    assert client.post('/api/v1/notifications/unsubscribe',json={'endpoint':subscription['endpoint']}).status_code==200
    assert client.get('/api/v1/notifications/due',headers={'Authorization':'Bearer invalid'}).status_code==401


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
