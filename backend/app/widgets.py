"""Versioned owner workspace configuration, shared by both clients."""
from threading import Lock
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict, model_validator
from sqlalchemy import update
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from .db import Session, Item, now

router = APIRouter(prefix='/api/v1/dashboard')
lock = Lock()
CATALOG = [
    {'type':t,'title':title,'sizes':list(range(1,13)),'options':options}
    for t,title,options in [
        ('health','Health',{'metrics':['steps','sleep_minutes','resting_pulse','heart_rate','weight_kg']}),
        ('metric','Health metric',{'metric':'heart_rate'}),
        ('chart','Health chart',{'metric':'steps','period':'week'}),
        ('tasks','Tasks',{'filter':'open'}), ('lights','Lights',{'entity_ids':[]}),
        ('music','Music projects',{'project_id':''}), ('obsidian','Obsidian',{'path':''}),
        ('agent','AI chat',{}),
        ('text','Text',{'text':'Your text','size':28,'align':'left','bold':False}),
        ('clock','Clock',{'timezone':'Europe/Berlin','format':'both','seconds':False,'size':32}),
        ('box','Box',{}),('action','Shortcut',{'action':'tasks'}),('spacer','Space',{})]]

class Placement(BaseModel):
    model_config = ConfigDict(extra='forbid')
    order: int = Field(ge=0, le=1000000)
    width: int = Field(ge=1, le=12)
    height: int = Field(default=1,ge=1,le=6)

class Appearance(BaseModel):
    model_config = ConfigDict(extra='forbid')
    header: bool = True
    border: bool = True
    background: Literal['panel','none','accent'] = 'panel'
    padding: int = Field(default=18,ge=0,le=48)

class Widget(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: str = Field(min_length=1,max_length=80,pattern=r'^[a-zA-Z0-9_-]+$')
    type: Literal['health','metric','chart','tasks','lights','music','obsidian','agent','text','clock','box','action','spacer']
    title: str = Field(default='',max_length=100)
    options: dict = Field(default_factory=dict)
    desktop: Placement
    mobile: Placement
    parent_id: str | None = Field(default=None,max_length=80)
    appearance: Appearance = Field(default_factory=Appearance)

    @model_validator(mode='after')
    def valid_options(self):
        from .health import METRICS
        allowed = set(next(c['options'] for c in CATALOG if c['type']==self.type))
        if not set(self.options)<=allowed:
            raise ValueError('Unknown widget options')
        if self.mobile.width not in {1,2}:
            raise ValueError('Invalid widget width')
        for key in ['metric','period','filter','path','project_id','align','format','action','timezone']:
            if key in self.options and (not isinstance(self.options[key],str) or len(self.options[key])>500):
                raise ValueError('Invalid widget option')
        if self.options.get('metric','steps') not in METRICS:
            raise ValueError('Unknown health metric')
        if 'metrics' in self.options and (not isinstance(self.options['metrics'],list) or not 1<=len(self.options['metrics'])<=16 or any(not isinstance(m,str) or m not in METRICS for m in self.options['metrics'])):
            raise ValueError('Unknown health metrics')
        if self.options.get('period','week') not in {'day','week','month'} or self.options.get('filter','open') not in {'open','done','all'}:
            raise ValueError('Invalid widget filter')
        ids=self.options.get('entity_ids',[])
        if not isinstance(ids,list) or len(ids)>100 or any(not isinstance(i,str) or not i.startswith('light.') or len(i)>255 for i in ids):
            raise ValueError('Invalid light selection')
        if self.type=='text' and (not isinstance(self.options.get('text',''),str) or len(self.options.get('text',''))>10000):
            raise ValueError('Invalid text')
        if 'size' in self.options and (type(self.options['size']) is not int or not 12<=self.options['size']<=96):
            raise ValueError('Invalid font size')
        if self.options.get('align','left') not in {'left','center','right'} or type(self.options.get('bold',False)) is not bool or type(self.options.get('seconds',False)) is not bool:
            raise ValueError('Invalid element style')
        if self.options.get('format','both') not in {'digital','date','both'} or self.options.get('action','tasks') not in {'tasks','new_task','agent','health','music','home','obsidian'}:
            raise ValueError('Invalid element action or format')
        if self.type=='clock':
            try: ZoneInfo(self.options.get('timezone','Europe/Berlin'))
            except (ZoneInfoNotFoundError,TypeError,ValueError): raise ValueError('Invalid clock timezone')
        return self

class Configuration(BaseModel):
    model_config = ConfigDict(extra='forbid')
    version: int = Field(ge=0)
    widgets: list[Widget] = Field(max_length=80)
    editor_version: int = Field(default=2,ge=1,le=2)

    @model_validator(mode='after')
    def unique_ids(self):
        if len({w.id for w in self.widgets})!=len(self.widgets):
            raise ValueError('Duplicate widget ID')
        by_id={w.id:w for w in self.widgets}
        for w in self.widgets:
            if w.parent_id and (w.parent_id not in by_id or by_id[w.parent_id].type!='box' or by_id[w.parent_id].parent_id or w.type=='box'):
                raise ValueError('Elements can belong to a top-level box only')
        return self

def home_elements():
    return [
        {'id':'home-welcome','type':'text','title':'','options':{'text':'Welcome to MainFrame.','size':36,'align':'left','bold':True},'desktop':{'order':0,'width':8,'height':1},'mobile':{'order':0,'width':2,'height':1},'appearance':{'header':False,'border':False,'background':'none','padding':0}},
        {'id':'home-clock','type':'clock','title':'','options':{'timezone':'Europe/Berlin','format':'both','seconds':False,'size':28},'desktop':{'order':1,'width':4,'height':1},'mobile':{'order':1,'width':2,'height':1},'appearance':{'header':False,'border':False,'background':'none','padding':0}},
        {'id':'home-new-task','type':'action','title':'New task','options':{'action':'new_task'},'desktop':{'order':2,'width':3,'height':1},'mobile':{'order':2,'width':1,'height':1},'appearance':{'header':False,'border':False,'background':'none','padding':0}},
    ]

def upgrade(value):
    if value.get('editor_version',1)<2:
        old=value['widgets'];ids={w['id'] for w in old}
        old=[{**w,'desktop':{**w['desktop'],'order':w['desktop']['order']+3},'mobile':{**w['mobile'],'order':w['mobile']['order']+3}} for w in old]
        return {**value,'editor_version':2,'widgets':[w for w in home_elements() if w['id'] not in ids]+old}
    return value

def defaults():
    types=['health','chart','tasks','lights','music','obsidian','agent']
    return upgrade({'version':0,'widgets':[
        {'id':'default-'+t,'type':t,'title':'','options':next(c['options'].copy() for c in CATALOG if c['type']==t),
         'desktop':{'order':i,'width':12 if t=='health' else 6,'height':1},
         'mobile':{'order':i,'width':2,'height':1}} for i,t in enumerate(types)]})

@router.get('/catalog')
def catalog():
    return CATALOG

@router.get('/config')
def configuration():
    with Session() as db:
        row=db.get(Item,'dashboard-config')
        return upgrade({'version':row.version,**row.data}) if row else defaults()

@router.put('/config')
def save_configuration(payload: Configuration):
    with lock, Session.begin() as db:
        row=db.get(Item,'dashboard-config')
        if not row:
            if payload.version!=0:
                raise HTTPException(409,'Dashboard changed. Reload before saving.')
            row=Item(id='dashboard-config',kind='dashboard_config',version=1,data={'editor_version':payload.editor_version,'widgets':[w.model_dump() for w in payload.widgets]})
            db.add(row)
        else:
            changed=db.execute(update(Item).where(Item.id==row.id,Item.version==payload.version).values(version=payload.version+1,data={'editor_version':payload.editor_version,'widgets':[w.model_dump() for w in payload.widgets]},updated_at=now()))
            if changed.rowcount!=1:
                raise HTTPException(409,'Dashboard changed. Reload before saving.')
        return {'version':payload.version+1,'editor_version':payload.editor_version,'widgets':[w.model_dump() for w in payload.widgets]}
