import asyncio
import json
from datetime import timedelta
from uuid import uuid4

import httpx
import pytest
from test_api import client
from app import home_assistant as home
from app.db import Item, Session, now
from bridge.connector import Connector, normalize, service, origin


def lamp(**overrides):
    return {'entity_id':'light.studio','name':'Studio','state':'on','brightness_pct':50,
            'rgb_color':[255,0,0],'color_temp_kelvin':3000,'min_kelvin':2000,'max_kelvin':6500,
            'supported_color_modes':['rgb','color_temp'],**overrides}


def connect(client, lamps=None):
    token=client.post('/api/v1/smart-home/bridge-token').json()['token']
    headers={'Authorization':'Bearer '+token}
    response=client.post('/api/v1/bridge/ha/report',json={'available':True,'lights':lamps or [lamp()]},headers=headers)
    assert response.status_code==200
    return token,headers


def test_bridge_credentials_are_scoped_and_never_exposed(client):
    token,headers=connect(client)
    assert client.post('/api/v1/bridge/ha/poll?wait=0').status_code==401
    assert client.get('/api/v1/smart-home/lights',headers=headers).status_code==401
    assert client.get('/api/v1/smart-home/lights').json()['status']=='online'
    assert token not in client.get('/api/v1/dashboard').text
    with Session() as db:
        stored=db.get(Item,home.BRIDGE_ID).data
        assert token not in json.dumps(stored)
        assert stored['token_hash']==home.digest(token)
    assert 'token_hash' not in client.get('/api/v1/smart-home/lights').text
    assert client.post('/api/v1/bridge/ha/report',headers=headers,json={'available':True,'lights':[lamp(entity_id='lock.front')]}).status_code==422


def test_light_commands_are_idempotent_and_claimed_only_once(client):
    token,headers=connect(client)
    body={'request_id':str(uuid4()),'entity_ids':['light.studio'],'brightness_pct':35}
    created=client.post('/api/v1/smart-home/commands',json=body)
    assert created.status_code==202
    job=created.json()
    assert 'token_hash' not in job and job['status']=='pending'
    assert client.post('/api/v1/smart-home/commands',json=body).json()['id']==job['id']
    assert client.post('/api/v1/smart-home/commands',json={**body,'brightness_pct':36}).status_code==409
    claimed=client.post('/api/v1/bridge/ha/poll?wait=0',headers=headers).json()
    assert claimed['id']==job['id'] and claimed['status']=='dispatched'
    assert client.post('/api/v1/bridge/ha/poll?wait=0',headers=headers).json()['id'] is None
    client.post('/api/v1/bridge/ha/report',headers=headers,json={'available':True,'lights':[lamp(brightness_pct=35)]})
    result=client.post('/api/v1/bridge/ha/commands/'+job['id']+'/result',headers=headers,json={'accepted':True})
    assert result.json()['status']=='accepted'
    assert client.get('/api/v1/smart-home/lights').json()['lights'][0]['brightness_pct']==35
    assert client.get('/api/v1/smart-home/commands/'+job['id']).json()['status']=='accepted'


@pytest.mark.parametrize('claimed,expected',[(False,'expired'),(True,'unknown')])
def test_expired_commands_never_execute_after_reconnect(client,monkeypatch,claimed,expected):
    token,headers=connect(client)
    job=client.post('/api/v1/smart-home/commands',json={'request_id':str(uuid4()),'entity_ids':['light.studio'],'power':'off'}).json()
    if claimed:client.post('/api/v1/bridge/ha/poll?wait=0',headers=headers)
    clock=now()+timedelta(seconds=16)
    monkeypatch.setattr(home,'now',lambda:clock)
    assert client.post('/api/v1/bridge/ha/poll?wait=0',headers=headers).json()['id'] is None
    assert client.get('/api/v1/smart-home/commands/'+job['id']).json()['status']==expected
    assert client.post('/api/v1/bridge/ha/commands/'+job['id']+'/result',headers=headers,json={'accepted':True}).json()['status']==expected


def test_offline_and_replaced_bridge_cannot_accept_stale_commands(client,monkeypatch):
    body={'request_id':str(uuid4()),'entity_ids':['light.studio'],'power':'on'}
    assert client.post('/api/v1/smart-home/commands',json=body).status_code==503
    token,headers=connect(client)
    job=client.post('/api/v1/smart-home/commands',json=body).json()
    client.post('/api/v1/smart-home/bridge-token')
    assert client.post('/api/v1/bridge/ha/poll?wait=0',headers=headers).status_code==401
    assert client.get('/api/v1/smart-home/commands/'+job['id']).json()['status']=='failed'
    token,headers=connect(client)
    clock=now()+timedelta(seconds=21);monkeypatch.setattr(home,'now',lambda:clock)
    assert client.get('/api/v1/smart-home/lights').json()['status']=='offline'
    assert client.post('/api/v1/smart-home/commands',json={**body,'request_id':str(uuid4())}).status_code==503


@pytest.mark.parametrize('settings', [{'brightness_pct':40},{'rgb_color':[1,2,3]},{'color_temp_kelvin':3000}])
def test_capability_validation_prevents_unsupported_commands(client,settings):
    connect(client,[lamp(supported_color_modes=['onoff'])])
    assert client.post('/api/v1/smart-home/commands',json={'request_id':str(uuid4()),'entity_ids':['light.studio'],**settings}).status_code==422
    assert client.post('/api/v1/smart-home/commands',json={'request_id':str(uuid4()),'entity_ids':['switch.plug'],'power':'on'}).status_code==422
    assert client.post('/api/v1/smart-home/commands',json={'request_id':str(uuid4()),'entity_ids':['light.studio'],'power':'off'}).status_code==202


def test_connector_filters_other_domains_and_executes_only_light_services():
    states=[{'entity_id':'light.studio','state':'on','attributes':{'friendly_name':'Studio','brightness':128,'rgb_color':[255,0,0],'supported_color_modes':['rgb','color_temp'],'min_color_temp_kelvin':2000,'max_color_temp_kelvin':6500,'secret':'never_upload'}},
            {'entity_id':'sensor.private','state':'secret','attributes':{}}]
    normalized=normalize(states)
    assert len(normalized)==1 and normalized[0]['brightness_pct']==50
    assert 'secret' not in json.dumps(normalized)
    assert service({'entity_ids':['light.studio'],'brightness_pct':0},normalized)==('turn_off',{'entity_id':['light.studio']})
    assert service({'entity_ids':['light.studio'],'rgb_color':[0,255,0]},normalized)[0]=='turn_on'
    with pytest.raises(ValueError):service({'entity_ids':['lock.front'],'power':'off'},normalized)
    with pytest.raises(ValueError):service({'entity_ids':['light.studio'],'service':'unlock'},normalized)
    with pytest.raises(ValueError):origin('http://cloud.test',https=True)
    with pytest.raises(ValueError):origin('https://user:secret@cloud.test',https=True)
    assert origin('http://192.168.1.2:8123/')=='http://192.168.1.2:8123'


def test_connector_reports_current_state_and_expired_jobs_never_reach_ha():
    calls=[];reports=[]
    def local(request):
        calls.append(request)
        if request.method=='GET':return httpx.Response(200,json=[{'entity_id':'light.studio','state':'on','attributes':{'supported_color_modes':['rgb']}}])
        assert request.url.path=='/api/services/light/turn_off'
        assert json.loads(request.content)=={'entity_id':['light.studio']}
        return httpx.Response(200,json=[])
    def cloud(request):
        reports.append((request.url.path,json.loads(request.content)))
        return httpx.Response(200,json={'ok':True})
    async def run():
        async with httpx.AsyncClient(base_url='http://ha.test',transport=httpx.MockTransport(local)) as ha, httpx.AsyncClient(base_url='https://cloud.test',transport=httpx.MockTransport(cloud)) as remote:
            connector=Connector(remote,ha)
            await connector.execute({'id':'one','expires_at':(now()+timedelta(seconds=15)).isoformat(),'command':{'entity_ids':['light.studio'],'power':'off'}})
            assert sum(r.method=='POST' for r in calls)==1
            await connector.execute({'id':'two','expires_at':(now()-timedelta(seconds=1)).isoformat(),'command':{'entity_ids':['light.studio'],'power':'on'}})
            assert sum(r.method=='POST' for r in calls)==1
    asyncio.run(run())
    assert reports[-1][1]['error']=='expired'
    assert any(path.endswith('/report') and body['available'] for path,body in reports)


def test_agent_adapter_waits_for_bridge_result_without_blocking_loop(client):
    from app.agent_tools import dispatch
    token,headers=connect(client)
    async def run():
        async def bridge():
            for _ in range(40):
                job=home.claim(home.digest(token))
                if job:
                    home.command_result(job['id'],home.Result(accepted=True),home.digest(token))
                    return
                await asyncio.sleep(.02)
            pytest.fail('Agent command was not queued')
        result,_=await asyncio.gather(dispatch('control_lights',{'entity_ids':['light.studio'],'power':'off'},'test-agent-scope'),bridge())
        assert result[0]['command']['status']=='accepted'
        assert result[1]['type']=='control_lights'
    asyncio.run(run())


def test_transport_timeout_after_service_call_reports_uncertainty(client):
    token,headers=connect(client)
    job=client.post('/api/v1/smart-home/commands',json={'request_id':str(uuid4()),'entity_ids':['light.studio'],'power':'off'}).json()
    client.post('/api/v1/bridge/ha/poll?wait=0',headers=headers)
    response=client.post('/api/v1/bridge/ha/commands/'+job['id']+'/result',headers=headers,json={'accepted':False,'uncertain':True,'error':'network'})
    assert response.json()['status']=='unknown'
    assert client.post('/api/v1/bridge/ha/poll?wait=0',headers=headers).json()['id'] is None


def test_connector_timeout_is_never_claimed_as_a_confirmed_failure():
    results=[]
    def ha(request):
        if request.method=='POST':raise httpx.ReadTimeout('No acknowledgement',request=request)
        return httpx.Response(200,json=[{'entity_id':'light.studio','state':'on','attributes':{}}])
    def cloud(request):
        results.append(json.loads(request.content));return httpx.Response(200,json={})
    async def run():
        async with httpx.AsyncClient(base_url='http://ha.test',transport=httpx.MockTransport(ha)) as local, httpx.AsyncClient(base_url='https://cloud.test',transport=httpx.MockTransport(cloud)) as remote:
            await Connector(remote,local).execute({'id':'one','expires_at':(now()+timedelta(seconds=15)).isoformat(),'command':{'entity_ids':['light.studio'],'power':'off'}})
    asyncio.run(run())
    assert results[-1]=={'accepted':False,'error':'network','uncertain':True}
