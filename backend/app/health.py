"""Bounded time series, per-source reconciliation and sync diagnostics."""
from datetime import date, datetime, timedelta, timezone
from hashlib import sha256
from typing import Literal
from zoneinfo import ZoneInfo
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, AwareDatetime, ConfigDict, model_validator, field_validator
from sqlalchemy import select, delete
from .db import HealthSession, HealthSeries, HealthMeta, HealthDay, now

router=APIRouter(prefix='/api/v1/health')
METRICS={
    'steps':('Steps','Schritte','',0,1000000),
    'sleep_minutes':('Sleep','Schlaf','min',0,1440),
    'resting_pulse':('Resting heart rate','Ruhepuls','bpm',1,300),
    'weight_kg':('Weight','Gewicht','kg',1,1000),
    'heart_rate':('Heart rate','Puls','bpm',1,300),
    'hrv_ms':('HRV','HRV','ms',0,1000),
    'oxygen_pct':('Oxygen saturation','Sauerstoffsättigung','%',0,100),
    'respiratory_rate':('Respiratory rate','Atemfrequenz','/min',1,100),
    'distance_m':('Distance','Strecke','m',0,1000000),
    'active_kcal':('Active calories','Aktive Kalorien','kcal',0,50000),
    'total_kcal':('Total calories','Gesamte Kalorien','kcal',0,50000),
    'exercise_minutes':('Training','Training','min',0,1440),
}
ZONE=ZoneInfo('Europe/Berlin')

def cleanup_series():
    with HealthSession.begin() as db:
        db.execute(delete(HealthSeries).where(HealthSeries.day<(now().astimezone(ZONE).date()-timedelta(days=89)).isoformat()))

class Sample(BaseModel):
    model_config=ConfigDict(extra='forbid')
    at: AwareDatetime
    value: float = Field(allow_inf_nan=False)
    label: str | None = Field(default=None,max_length=100)

class Window(BaseModel):
    model_config=ConfigDict(extra='forbid')
    day: date
    metric: str
    source: str = Field(min_length=1,max_length=255)
    samples: list[Sample] = Field(max_length=100000)

    @model_validator(mode='after')
    def valid(self):
        if self.metric not in METRICS:
            raise ValueError('Unknown health metric')
        today=now().astimezone(ZONE).date()
        if not today-timedelta(days=89)<=self.day<=today:
            raise ValueError('Only the last 90 days can be reconciled')
        lower,upper=METRICS[self.metric][3:]
        if any(s.at.astimezone(ZONE).date()!=self.day or not lower<=s.value<=upper or s.at>now()+timedelta(minutes=5) for s in self.samples):
            raise ValueError('Invalid sample timestamp or value')
        if len({s.at for s in self.samples})!=len(self.samples):
            raise ValueError('Duplicate sample timestamp')
        return self

class MetricStatus(BaseModel):
    model_config=ConfigDict(extra='forbid')
    permission: bool
    state: Literal['ok','no_data','denied','error']
    sources: list[str] = Field(default_factory=list,max_length=50)
    last_measurement: AwareDatetime | None = None

class SyncBatch(BaseModel):
    model_config=ConfigDict(extra='forbid')
    windows: list[Window] = Field(default_factory=list,max_length=100)
    status: dict[str,MetricStatus] = Field(default_factory=dict)
    generation: str = Field(default='0',max_length=80)
    days: list[dict] = Field(default_factory=list,max_length=90)
    @field_validator('days')
    @classmethod
    def summaries(cls, values):
        from .main import DayInput
        parsed=[DayInput.model_validate(v) for v in values]
        today=now().astimezone(ZONE).date()
        if len({v.day for v in parsed})!=len(parsed) or any(not today-timedelta(days=89)<=v.day<=today for v in parsed):
            raise ValueError('Invalid summary dates')
        return [v.model_dump(mode='json',exclude_unset=True) for v in parsed]
    @model_validator(mode='after')
    def valid(self):
        if not set(self.status)<=set(METRICS) or len({(w.day,w.metric,w.source) for w in self.windows})!=len(self.windows) or sum(len(w.samples) for w in self.windows)>100000:
            raise ValueError('Invalid sync batch')
        return self

@router.get('/metrics')
def metrics():
    with HealthSession() as db:
        meta=db.get(HealthMeta,'status')
        generation=db.get(HealthMeta,'generation')
        return {'generation':generation.data['value'] if generation else '0','metrics':[{'id':k,'name':v[0],'name_de':v[1],'unit':v[2],**(meta.data.get(k,{}) if meta else {})} for k,v in METRICS.items()]}

@router.put('/sync')
def sync(payload: SyncBatch):
    with HealthSession.begin() as db:
        generation=db.get(HealthMeta,'generation')
        if payload.generation!=(generation.data['value'] if generation else '0'):
            raise HTTPException(409,'Health data was cleared. Restart synchronization.')
        for value in payload.days:
            row=db.get(HealthDay,value['day'])
            if row:
                row.data={**row.data,**value}
                row.updated_at=now()
            else:
                db.add(HealthDay(day=value['day'],data=value))
        db.execute(delete(HealthSeries).where(HealthSeries.day<(now().astimezone(ZONE).date()-timedelta(days=89)).isoformat()))
        for window in payload.windows:
            key=sha256(f'{window.day}|{window.metric}|{window.source}'.encode()).hexdigest()
            row=db.get(HealthSeries,key)
            data={'samples':[{'at':s.at.astimezone(timezone.utc).isoformat(),'value':s.value,**({'label':s.label} if s.label else {})} for s in sorted(window.samples,key=lambda s:s.at)]}
            if row:
                row.data=data
            else:
                db.add(HealthSeries(id=key,day=window.day.isoformat(),metric=window.metric,source=window.source,data=data))
        if payload.status:
            meta=db.get(HealthMeta,'status')
            values=dict(meta.data) if meta else {}
            for key,value in payload.status.items():
                previous=values.get(key,{})
                values[key]={**value.model_dump(mode='json'),'last_sync':now().isoformat() if value.state!='error' else previous.get('last_sync')}
                if value.state=='error':
                    values[key].update(sources=previous.get('sources',[]),last_measurement=previous.get('last_measurement'))
            if meta: meta.data=values
            else: db.add(HealthMeta(key='status',data=values))
    return {'reconciled':len(payload.windows)}

@router.get('/series')
def series(metric: str, start: date, end: date, source: str | None=None):
    if metric not in METRICS or not 0<=(end-start).days<=89 or end>now().astimezone(ZONE).date():
        raise HTTPException(422,'Invalid health query')
    with HealthSession() as db:
        start=max(start,now().astimezone(ZONE).date()-timedelta(days=89))
        query=select(HealthSeries).where(HealthSeries.metric==metric,HealthSeries.day>=start.isoformat(),HealthSeries.day<=end.isoformat()).order_by(HealthSeries.day,HealthSeries.source)
        sources=sorted({r.source for r in db.scalars(query.execution_options(yield_per=1)) if r.data['samples']})
        chosen=source or ('health_connect' if 'health_connect' in sources else next(iter(sources),None))
        # Bound chart responses, preserving minima/maxima for each minute.
        buckets={}
        count,total,minimum,maximum,last=0,0.0,None,None,None
        for row in db.scalars(query.where(HealthSeries.source==chosen).execution_options(yield_per=1)):
            for point in row.data['samples']:
                value=point['value'];count+=1;total+=value
                minimum=value if minimum is None else min(minimum,value)
                maximum=value if maximum is None else max(maximum,value)
                if last is None or point['at']>last['at']:last=point
                key=point['at'][:16]
                group=buckets.get(key,[point,point])
                buckets[key]=[min(group+[point],key=lambda p:p['value']),max(group+[point],key=lambda p:p['value'])]
        reduced=[p for group in buckets.values() for p in sorted({p['at']:p for p in (min(group,key=lambda p:p['value']),max(group,key=lambda p:p['value']))}.values(),key=lambda p:p['at'])]
        stride=max(1,(len(reduced)+9999)//10000)
        bounded=reduced[::stride]
        if last and (not bounded or bounded[-1]['at']!=last['at']):bounded.append(last)
        return {'metric':metric,'source':chosen,'sources':sources,'samples':bounded,'truncated':len(reduced)>10000,
                'summary':{'mean':total/count,'min':minimum,'max':maximum,'last':last} if count else None}
