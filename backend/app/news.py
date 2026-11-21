"""Read fixed public RSS feeds with Playwright and keep selected stories in the brain vault."""
import asyncio
import hashlib
import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urlsplit
from xml.etree import ElementTree

from fastapi import HTTPException
from pydantic import BaseModel, Field, field_validator

from .config import settings

FEEDS = {
    'BBC World': 'https://feeds.bbci.co.uk/news/world/rss.xml',
    'BBC Technology': 'https://feeds.bbci.co.uk/news/technology/rss.xml',
    'The Guardian World': 'https://www.theguardian.com/world/rss',
}
ARTICLE_HOSTS = {'bbc.co.uk', 'www.bbc.co.uk', 'bbc.com', 'www.bbc.com', 'theguardian.com', 'www.theguardian.com'}
NEWS_NOTE = 'News Feed.md'
MAX_STORIES = 30


class Story(BaseModel):
    id: str = Field(pattern=r'^[a-f0-9]{20}$')
    title: str = Field(min_length=1, max_length=250)
    url: str = Field(max_length=1500)
    source: str = Field(max_length=80)
    snippet: str = Field(max_length=500)
    published: str = Field(max_length=100)

    @field_validator('url')
    @classmethod
    def public_link(cls, value):
        parsed = urlsplit(value)
        if (parsed.scheme != 'https' or parsed.hostname not in ARTICLE_HOSTS
                or parsed.port not in {None, 443} or parsed.username is not None
                or re.search(r'[\s<>\\\x00-\x1f\x7f]', value)):
            raise ValueError('Expected a public HTTPS article link')
        return value


class TextOnly(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def plain(value, limit):
    parser = TextOnly()
    parser.feed(value)
    parser.close()
    return ' '.join(' '.join(parser.parts).split())[:limit]


def parse_feed(source, raw):
    if len(raw) > 2_000_000:
        raise ValueError('Oversized news feed')
    xml = raw.decode('utf-8-sig')
    if '<!DOCTYPE' in xml.upper() or '\x00' in xml:
        raise ValueError('Invalid news feed')
    feed = ElementTree.fromstring(xml)
    channel = feed.find('channel')
    if channel is None:
        raise ValueError('Expected an RSS channel')
    stories = []
    for item in channel.findall('item')[:60]:
        url = item.findtext('link', '').strip()
        try:
            stories.append(Story(id=hashlib.sha256(url.encode()).hexdigest()[:20],
                title=plain(item.findtext('title', ''), 250), url=url, source=source,
                snippet=plain(item.findtext('description', ''), 500),
                published=plain(item.findtext('pubDate', ''), 100)))
        except ValueError:
            continue
    return stories


async def fetch_feeds():
    # The Playwright request context reads RSS without loading publisher scripts,
    # cookies from the workspace, subresources, or redirect destinations.
    from playwright.async_api import Error, async_playwright

    try:
        async with asyncio.timeout(10), async_playwright() as playwright:
            client = await playwright.request.new_context(timeout=7000)
            try:
                async def fetch(source, url):
                    try:
                        response = await client.get(url, max_redirects=0)
                        if not response.ok:
                            return None
                        return parse_feed(source, await response.body())
                    except (Error, ValueError, ElementTree.ParseError):
                        return None

                return await asyncio.gather(*(fetch(source, url) for source, url in FEEDS.items()))
            finally:
                await client.dispose()
    except (Error, TimeoutError):
        return []


async def lookup(query):
    if not settings.news_enabled:
        raise HTTPException(503, 'Public news lookup is disabled.')
    if not isinstance(query, str) or len(query) > 100:
        raise ValueError('Expected at most 100 characters of public news keywords')
    terms = re.findall(r'\w+', query.casefold())
    feeds = [feed for feed in await fetch_feeds() if feed is not None]
    if not feeds:
        raise HTTPException(502, 'The public news feeds are unavailable. Try again later.')
    ranked = {}
    for feed in feeds:
        for index, story in enumerate(feed):
            text = f'{story.title} {story.snippet}'.casefold()
            score = sum(term in text for term in terms)
            if not terms or score:
                ranked.setdefault(story.id, (-score, index, story))
    return [story for _, _, story in sorted(ranked.values(), key=lambda row: row[:2])[:10]]


def markdown_text(value):
    return re.sub(r'([\\`*_{}\[\]()#+.!|>~-])', r'\\\1', value.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


def render(rows):
    metadata = json.dumps(rows, ensure_ascii=False, separators=(',', ':')).replace('>', r'\u003e')
    lines = ['# News Feed', '', 'Saved public headlines · [[AI_Brain]]', '', f'<!-- mainframe-news {metadata} -->', '']
    for row in rows:
        lines += [f"## {markdown_text(row['title'])}", '',
                  f"{markdown_text(row['source'])} · {markdown_text(row['published'] or row['saved_at'][:10])}", '',
                  markdown_text(row['snippet']), '', f"[Read original](<{row['url']}>)", '']
    return '\n'.join(lines)


def read_feed():
    from .integrations import read_note
    try:
        note = read_note(NEWS_NOTE)
    except HTTPException as error:
        if error.status_code == 404:
            return [], ''
        raise
    try:
        line = note['content'].split('\n')[4]
        if not line.startswith('<!-- mainframe-news ') or not line.endswith(' -->'):
            raise ValueError('Missing feed metadata')
        rows = json.loads(line[len('<!-- mainframe-news '):-len(' -->')])
        if not isinstance(rows, list) or len(rows) > MAX_STORIES:
            raise ValueError('Unexpected feed metadata')
        rows = [{**Story.model_validate(row).model_dump(),
                 'saved_at':datetime.fromisoformat(row['saved_at']).isoformat()} for row in rows]
        if note['content'] != render(rows):
            raise ValueError('Edited feed')
    except (ValueError, IndexError, KeyError, TypeError):
        raise HTTPException(409, 'News Feed.md was edited or already exists. Move it to another name to start a new managed feed.')
    return rows, note['version']


def save_stories(stories):
    from .integrations import NoteInput, write_note
    current, version = read_feed()
    known = {row['id'] for row in current}
    stamp = datetime.now(timezone.utc).isoformat()
    added = [{**story.model_dump(), 'saved_at':stamp} for story in stories if story.id not in known]
    if added:
        write_note(NoteInput(path=NEWS_NOTE, version=version, content=render((added + current)[:MAX_STORIES])))
    return added
