"""Versioned owner workspace configuration, shared by both clients."""
from threading import Lock
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict, model_validator
from sqlalchemy import update
from .db import Session, Item, now

router = APIRouter(prefix='/api/v1/dashboard')
lock = Lock()
CATALOG = [
    {'type':t,'title':title,'sizes':[3,6,12],'options':options}
    for t,title,options in [
        ('health','Health',{'metrics':['steps','sleep_minutes','resting_pulse','heart_rate','weight_kg']}),
        ('metric','Health metric',{'metric':'heart_rate'}),
        ('chart','Health chart',{'metric':'steps','period':'week'}),
        ('tasks','Tasks',{'filter':'open'}), ('lights','Lights',{'entity_ids':[]}),
        ('music','Music projects',{'project_id':''}), ('obsidian','Obsidian',{'path':''}),
        ('agent','AI chat',{})]]

class Placement(BaseModel):
    model_config = ConfigDict(extra='forbid')
    order: int = Field(ge=0, le=1000000)
    width: int = Field(ge=1, le=12)
    height: int = Field(default=1,ge=1,le=3)

class Widget(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: str = Field(min_length=1,max_length=80,pattern=r'^[a-zA-Z0-9_-]+$')
    type: Literal['health','metric','chart','tasks','lights','music','obsidian','agent']
    title: str = Field(default='',max_length=100)
    options: dict = Field(default_factory=dict)
    desktop: Placement
    mobile: Placement

    @model_validator(mode='after')
    def valid_options(self):
        from .health import METRICS
        allowed = set(next(c['options'] for c in CATALOG if c['type']==self.type))
        if not set(self.options)<=allowed:
            raise ValueError('Unknown widget options')
        if self.desktop.width not in {3,6,12} or self.mobile.width not in {1,2}:
            raise ValueError('Invalid widget width')
        for key in ['metric','period','filter','path','project_id']:
            if key in self.options and (not isinstance(self.options[key],str) or len(self.options[key])>500):
                raise ValueError('Invalid widget option')
        if self.options.get('metric','steps') not in METRICS:
            raise ValueError('Unknown health metric')
        if 'metrics' in self.options and (not isinstance(self.options['metrics'],list) or not 1<=len(self.options['metrics'])<=16 or any(m not in METRICS for m in self.options['metrics'])):
            raise ValueError('Unknown health metrics')
        if self.options.get('period','week') not in {'day','week','month'} or self.options.get('filter','open') not in {'open','done','all'}:
            raise ValueError('Invalid widget filter')
        ids=self.options.get('entity_ids',[])
        if not isinstance(ids,list) or len(ids)>100 or any(not isinstance(i,str) or not i.startswith('light.') or len(i)>255 for i in ids):
            raise ValueError('Invalid light selection')
        return self

class Configuration(BaseModel):
    model_config = ConfigDict(extra='forbid')
    version: int = Field(ge=0)
    widgets: list[Widget] = Field(max_length=40)

    @model_validator(mode='after')
    def unique_ids(self):
        if len({w.id for w in self.widgets})!=len(self.widgets):
            raise ValueError('Duplicate widget ID')
        return self

def defaults():
    types=['health','chart','tasks','lights','music','obsidian','agent']
    return {'version':0,'widgets':[
        {'id':'default-'+t,'type':t,'title':'','options':next(c['options'].copy() for c in CATALOG if c['type']==t),
         'desktop':{'order':i,'width':12 if t=='health' else 6,'height':1},
         'mobile':{'order':i,'width':2,'height':1}} for i,t in enumerate(types)]}

@router.get('/catalog')
def catalog():
    return CATALOG

@router.get('/config')
def configuration():
    with Session() as db:
        row=db.get(Item,'dashboard-config')
        return {'version':row.version,'widgets':row.data['widgets']} if row else defaults()

@router.put('/config')
def save_configuration(payload: Configuration):
    with lock, Session.begin() as db:
        row=db.get(Item,'dashboard-config')
        if not row:
            if payload.version!=0:
                raise HTTPException(409,'Dashboard changed. Reload before saving.')
            row=Item(id='dashboard-config',kind='dashboard_config',version=1,data={'widgets':[w.model_dump() for w in payload.widgets]})
            db.add(row)
        else:
            changed=db.execute(update(Item).where(Item.id==row.id,Item.version==payload.version).values(version=payload.version+1,data={'widgets':[w.model_dump() for w in payload.widgets]},updated_at=now()))
            if changed.rowcount!=1:
                raise HTTPException(409,'Dashboard changed. Reload before saving.')
        return {'version':payload.version+1,'widgets':[w.model_dump() for w in payload.widgets]}
