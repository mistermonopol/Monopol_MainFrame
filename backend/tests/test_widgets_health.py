from copy import deepcopy
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from test_api import client
from app.db import HealthSession, HealthSeries, HealthMeta, HealthDay
from sqlalchemy import select

def test_widget_config_roundtrip_and_conflict(client):
    assert client.get('/api/v1/dashboard/config',headers={'Authorization':'Bearer invalid'}).status_code==401
    config=client.get('/api/v1/dashboard/config').json()
    assert config['version']==0
    config['widgets'].append({**deepcopy(config['widgets'][0]),'id':'another-health','title':'My vitals'})
    config['widgets'][-1]['mobile']['width']=1
    saved=client.put('/api/v1/dashboard/config',json=config)
    assert saved.status_code==200
    assert client.get('/api/v1/dashboard/config').json()==saved.json()
    assert client.put('/api/v1/dashboard/config',json=config).status_code==409
    changed=saved.json();changed['widgets']=[]
    assert client.put('/api/v1/dashboard/config',json=changed).json()['widgets']==[]

def test_widget_validation_and_catalog(client):
    catalog=client.get('/api/v1/dashboard/catalog').json()
    assert {c['type'] for c in catalog}=={'health','metric','chart','tasks','lights','music','obsidian','agent'}
    config=client.get('/api/v1/dashboard/config').json()
    for mutate in [lambda c:c['widgets'].append(c['widgets'][0]),lambda c:c['widgets'][0]['mobile'].update(width=12),lambda c:c['widgets'][0].update(options={'metrics':['unknown']}),lambda c:c['widgets'][0].update(type='javascript')]:
        invalid=deepcopy(config);mutate(invalid)
        assert client.put('/api/v1/dashboard/config',json=invalid).status_code==422

def sample_window(source='watch',value=72):
    at=datetime.now(timezone.utc)-timedelta(minutes=10)
    return {'day':at.astimezone(ZoneInfo('Europe/Berlin')).date().isoformat(),'metric':'heart_rate','source':source,'samples':[{'at':at.isoformat(),'value':value}]}

def test_series_reconciliation_sources_and_agent(client):
    window=sample_window()
    for _ in range(2):assert client.put('/api/v1/health/sync',json={'windows':[window]}).status_code==200
    other={**window,'source':'second','samples':[{**window['samples'][0],'value':100}]}
    assert client.put('/api/v1/health/sync',json={'windows':[other]}).status_code==200
    params={'metric':'heart_rate','start':window['day'],'end':window['day'],'source':'watch'}
    result=client.get('/api/v1/health/series',params=params).json()
    assert len(result['samples'])==1 and result['summary']['mean']==72
    assert result['sources']==['second','watch']
    window['samples'][0]['value']=80
    client.put('/api/v1/health/sync',json={'windows':[window]})
    from app.agent_tools import execute
    assert execute('read_health_series',params)[0]['summary']['mean']==80
    window['samples']=[]
    client.put('/api/v1/health/sync',json={'windows':[window]})
    assert client.get('/api/v1/health/series',params=params).json()['samples']==[]

def test_health_validation_status_and_delete(client):
    window=sample_window()
    for patch in [{'metric':'unknown'},{'samples':[{**window['samples'][0],'value':999}]},{'samples':[{'at':'2020-01-01T00:00:00Z','value':70}]}]:
        assert client.put('/api/v1/health/sync',json={'windows':[{**window,**patch}]}).status_code==422
    status={'heart_rate':{'permission':True,'state':'ok','sources':['watch'],'last_measurement':window['samples'][0]['at']}}
    assert client.put('/api/v1/health/sync',json={'windows':[window],'status':status}).status_code==200
    status['heart_rate']={'permission':True,'state':'error'}
    client.put('/api/v1/health/sync',json={'status':status})
    metric=next(m for m in client.get('/api/v1/health/metrics').json()['metrics'] if m['id']=='heart_rate')
    assert metric['sources']==['watch'] and metric['last_sync'] and metric['state']=='error'
    client.delete('/api/v1/health/days')
    assert client.get('/api/v1/health/days').json()['days']==[]
    assert client.put('/api/v1/health/sync',json={'windows':[window]}).status_code==409
    generation=client.get('/api/v1/health/metrics').json()['generation']
    assert client.put('/api/v1/health/sync',json={'generation':generation,'windows':[window]}).status_code==200

def test_legacy_import_preserves_new_fields(client):
    day=sample_window()['day']
    assert client.put('/api/v1/health/days',json={'days':[{'day':day,'heart_rate':80,'hrv_ms':40}]}).status_code==200
    assert client.put('/api/v1/health/days',json={'days':[{'day':day,'steps':100}]}).status_code==200
    result=client.get('/api/v1/health/days').json()['days'][0]
    assert result['heart_rate']==80 and result['steps']==100 and result['hrv_ms']==40

def test_retention_only_removes_old_series(client):
    from app.health import cleanup_series
    day=(datetime.now(ZoneInfo('Europe/Berlin')).date()-timedelta(days=91)).isoformat()
    with HealthSession.begin() as db:
        db.add(HealthSeries(id='old',metric='heart_rate',day=day,source='watch',data={'samples':[]}))
        db.add(HealthDay(day=day,data={'day':day,'heart_rate':70}))
    cleanup_series()
    with HealthSession() as db:
        assert db.get(HealthSeries,'old') is None
        assert db.get(HealthDay,day) is not None

def test_berlin_dst_samples_and_summary_backfill(client):
    from app import health
    from unittest.mock import patch
    # The repeated Berlin 02:30 has two distinct UTC instants.
    with patch.object(health,'now',return_value=datetime(2026,11,1,tzinfo=timezone.utc)):
        window={'day':'2026-10-25','metric':'heart_rate','source':'watch','samples':[{'at':'2026-10-25T00:30:00Z','value':60},{'at':'2026-10-25T01:30:00Z','value':80}]}
        assert client.put('/api/v1/health/sync',json={'windows':[window],'days':[{'day':'2026-10-25','heart_rate':70}]}).status_code==200
        result=client.get('/api/v1/health/series',params={'metric':'heart_rate','start':'2026-10-25','end':'2026-10-25'}).json()
        assert len(result['samples'])==2 and result['summary']['mean']==70
        assert client.put('/api/v1/health/sync',json={'days':[{'day':'2026-07-01','heart_rate':70}]}).status_code==422
