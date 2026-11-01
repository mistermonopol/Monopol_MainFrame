"""Run in the home network. Only outbound cloud HTTPS and local HA light services."""
import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import httpx

log = logging.getLogger('mainframe-bridge')
MODES = {'onoff','brightness','color_temp','hs','xy','rgb','rgbw','rgbww','white','unknown'}


def origin(value, https=False):
    value = value.strip().rstrip('/')
    parsed = urlparse(value)
    if (parsed.scheme not in ({'https'} if https else {'http','https'}) or not parsed.hostname
            or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path):
        raise ValueError('Configure a base origin without paths or credentials; cloud HTTPS is required.')
    return value


def secret(name):
    value = Path(os.environ[name]).read_text(encoding='utf-8').strip()
    if not value or '\n' in value or '\r' in value:
        raise ValueError('Invalid secret file')
    return value


def integer(value, low, high):
    return isinstance(value, int) and not isinstance(value,bool) and low <= value <= high


def normalize(states):
    if not isinstance(states,list):
        raise ValueError('Invalid Home Assistant response')
    result = []
    for row in states:
        if not isinstance(row,dict):
            raise ValueError('Invalid Home Assistant state')
        entity = row.get('entity_id','')
        if not isinstance(entity,str) or not entity.startswith('light.'):
            continue
        attrs = row.get('attributes') or {}
        if not isinstance(attrs,dict) or not isinstance(attrs.get('supported_color_modes',[]),list):
            raise ValueError('Invalid light attributes')
        modes = [m for m in attrs.get('supported_color_modes',[]) if m in MODES]
        brightness = attrs.get('brightness')
        rgb = attrs.get('rgb_color')
        minimum = attrs.get('min_color_temp_kelvin')
        maximum = attrs.get('max_color_temp_kelvin')
        if not minimum and attrs.get('max_mireds'):
            minimum = round(1_000_000/attrs['max_mireds'])
        if not maximum and attrs.get('min_mireds'):
            maximum = round(1_000_000/attrs['min_mireds'])
        state = row.get('state')
        result.append({'entity_id':entity,'name':str(attrs.get('friendly_name') or entity)[:250],
            'state':state if state in {'on','off','unknown','unavailable'} else 'unknown',
            'brightness_pct':round(brightness/255*100) if integer(brightness,0,255) else None,
            'rgb_color':rgb if isinstance(rgb,(list,tuple)) and len(rgb)==3 and all(integer(v,0,255) for v in rgb) else None,
            'color_temp_kelvin':attrs.get('color_temp_kelvin'), 'supported_color_modes':modes,
            'min_kelvin':minimum,'max_kelvin':maximum})
    return result


def service(command, lights):
    """Revalidate cloud jobs against a fresh local snapshot before physical control."""
    import re
    if not isinstance(command,dict) or set(command)-{'entity_ids','power','brightness_pct','rgb_color','color_temp_kelvin'}:
        raise ValueError('Invalid command fields')
    ids = command.get('entity_ids')
    if not isinstance(ids,list) or not 1 <= len(ids) <= 100 or any(not isinstance(e,str) or not re.fullmatch(r'light\.[a-z0-9_]{1,249}',e) for e in ids):
        raise ValueError('Only explicit light targets are allowed')
    brightness = command.get('brightness_pct')
    rgb, kelvin, power = command.get('rgb_color'),command.get('color_temp_kelvin'),command.get('power')
    if power not in {None,'on','off'} or brightness is not None and not integer(brightness,0,100):
        raise ValueError('Invalid target state')
    if rgb is not None and (not isinstance(rgb,(list,tuple)) or len(rgb)!=3 or not all(integer(v,0,255) for v in rgb)):
        raise ValueError('Invalid RGB')
    if kelvin is not None and not integer(kelvin,1,100000) or rgb is not None and kelvin is not None:
        raise ValueError('Invalid color settings')
    extras = any(v is not None for v in (brightness,rgb,kelvin))
    if power is None and not extras or power=='off' and extras or brightness==0 and (power=='on' or rgb is not None or kelvin is not None):
        raise ValueError('Conflicting target settings')
    by_id = {n['entity_id']:n for n in lights}
    for entity in ids:
        lamp = by_id.get(entity)
        if not lamp or lamp['state'] not in {'on','off'}:
            raise ValueError('Light unavailable')
        modes = set(lamp['supported_color_modes'])
        if brightness not in {None,0} and not modes-{'onoff','unknown'}:
            raise ValueError('Dimming unsupported')
        if rgb is not None and not modes & {'hs','xy','rgb','rgbw','rgbww'}:
            raise ValueError('Color unsupported')
        if kelvin is not None and ('color_temp' not in modes or not lamp.get('min_kelvin') or not lamp.get('max_kelvin') or not lamp['min_kelvin']<=kelvin<=lamp['max_kelvin']):
            raise ValueError('Temperature unsupported')
    data = {'entity_id':ids}
    if power=='off' or brightness==0:
        return 'turn_off', data
    if brightness is not None:
        data['brightness_pct'] = brightness
    if rgb is not None:
        data['rgb_color'] = list(rgb)
    if kelvin is not None:
        data['color_temp_kelvin'] = kelvin
    return 'turn_on', data


class Connector:
    def __init__(self, cloud, ha):
        self.cloud,self.ha = cloud,ha
        self.report_lock = asyncio.Lock()

    async def snapshot(self):
        response = await self.ha.get('/api/states')
        response.raise_for_status()
        return normalize(response.json())

    async def report(self):
        async with self.report_lock:
            try:
                lamps = await self.snapshot()
                payload = {'available':True,'lights':lamps}
            except httpx.HTTPStatusError as error:
                payload = {'available':False,'error':'auth' if error.response.status_code in {401,403} else 'invalid_response'}
            except httpx.RequestError:
                payload = {'available':False,'error':'network'}
            except (ValueError,TypeError,KeyError,AttributeError,ZeroDivisionError):
                payload = {'available':False,'error':'invalid_response'}
            response = await self.cloud.post('/api/v1/bridge/ha/report',json=payload)
            response.raise_for_status()

    async def execute(self, job):
        result = {'accepted':False}
        submitted = False
        try:
            deadline = datetime.fromisoformat(job['expires_at'])
            if deadline <= datetime.now(timezone.utc):
                result['error'] = 'expired'
            else:
                lamps = await self.snapshot()
                action,data = service(job['command'],lamps)
                # Snapshot could have been slow; check the deadline immediately before sending.
                if deadline <= datetime.now(timezone.utc):
                    result['error'] = 'expired'
                else:
                    submitted = True
                    response = await self.ha.post('/api/services/light/'+action,json=data)
                    response.raise_for_status()
                    result = {'accepted':True}
        except httpx.HTTPStatusError as error:
            result['error'] = 'auth' if error.response.status_code in {401,403} else 'invalid_response'
        except httpx.RequestError:
            result.update(error='network',uncertain=submitted)
        except (ValueError,TypeError,KeyError):
            result['error'] = 'unsupported'
        try:
            await self.report()
        except (httpx.HTTPError,ValueError):
            pass
        response = await self.cloud.post('/api/v1/bridge/ha/commands/'+job['id']+'/result',json=result)
        response.raise_for_status()

    async def reports(self):
        while True:
            try:
                await self.report()
            except (httpx.HTTPError,ValueError):
                log.warning('State report failed. Retrying without logging credentials or payloads.')
            await asyncio.sleep(5)

    async def commands(self):
        while True:
            try:
                response = await self.cloud.post('/api/v1/bridge/ha/poll?wait=25')
                response.raise_for_status()
                job = response.json()
                if job.get('id'):
                    # A dispatched job is never automatically redelivered, including after reconnect.
                    await self.execute(job)
            except (httpx.HTTPError,ValueError,KeyError,TypeError):
                log.warning('Cloud connection interrupted. No command replay; reconnecting.')
                await asyncio.sleep(5)


async def main():
    cloud_url = origin(os.environ['MAINFRAME_URL'],https=True)
    ha_url = origin(os.environ['HA_URL'])
    async with httpx.AsyncClient(base_url=cloud_url,headers={'Authorization':'Bearer '+secret('MAINFRAME_BRIDGE_TOKEN_FILE')},timeout=35,follow_redirects=False,trust_env=False) as cloud, httpx.AsyncClient(base_url=ha_url,headers={'Authorization':'Bearer '+secret('HA_TOKEN_FILE')},timeout=5,follow_redirects=False,trust_env=False) as ha:
        connector = Connector(cloud,ha)
        await asyncio.gather(connector.reports(),connector.commands())


if __name__=='__main__':
    logging.basicConfig(level=logging.INFO,format='%(levelname)s %(name)s %(message)s')
    logging.getLogger('httpx').setLevel(logging.WARNING)
    try:
        asyncio.run(main())
    except (ValueError,KeyError,OSError):
        log.error('Bridge configuration is invalid. Check base URLs and readable secret files.')
        raise SystemExit(1)
