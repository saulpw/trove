import { setPath, setStorage, clearStorage } from './domstub';
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTags, esc, normalizeUrl, formatDuration, formatDate,
  sortLinks, filterLinksByTime, getTagFilters, getRatings,
} from '../../src/frontend';

const pad = (n: number) => String(n).padStart(2, '0');
const localIso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localIso(d);
};

describe('parseTags', () => {
  test('splits on spaces', () => assert.deepEqual(parseTags('games retro'), ['games', 'retro']));
  test('drops empty segments', () => assert.deepEqual(parseTags('  games   retro '), ['games', 'retro']));
  test('undefined is no tags', () => assert.deepEqual(parseTags(undefined), []));
  test('empty string is no tags', () => assert.deepEqual(parseTags(''), []));
});

describe('esc', () => {
  test('escapes ampersand first, then angles and quotes', () =>
    assert.equal(esc('<a href="x">&amp;</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;amp;&lt;/a&gt;'));
  test('leaves single quotes alone', () => assert.equal(esc("it's"), "it's"));
  test('leaves plain text alone', () => assert.equal(esc('games retro'), 'games retro'));
});

describe('normalizeUrl', () => {
  test('adds https to a bare host', () => assert.equal(normalizeUrl('example.com/a'), 'https://example.com/a'));
  test('keeps http', () => assert.equal(normalizeUrl('http://example.com'), 'http://example.com'));
  test('keeps https', () => assert.equal(normalizeUrl('https://example.com'), 'https://example.com'));
  test('empty stays empty', () => assert.equal(normalizeUrl(''), ''));
});

describe('formatDuration', () => {
  test('undefined is blank', () => assert.equal(formatDuration(undefined), ''));
  test('under a minute is seconds', () => assert.equal(formatDuration('0:45'), '45s'));
  test('exactly a minute', () => assert.equal(formatDuration('1:00'), '1m'));
  test('minutes truncate seconds', () => assert.equal(formatDuration('3:20'), '3m'));
  test('hours and minutes', () => assert.equal(formatDuration('1:45:30'), '1h45m'));
  test('whole hours drop minutes', () => assert.equal(formatDuration('2:00:00'), '2h'));
  test('unparseable form passes through', () => assert.equal(formatDuration('90'), '90'));
});

describe('formatDate', () => {
  const now = new Date();
  test('other year is just the year', () => {
    const d = new Date(now.getFullYear() - 1, 5, 15, 12, 0);
    assert.equal(formatDate(localIso(d)), String(now.getFullYear() - 1));
  });
  test('same year other month is year-month', () => {
    const d = new Date(now.getFullYear(), (now.getMonth() + 1) % 12, 15, 12, 0);
    assert.equal(formatDate(localIso(d)), `${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  });
  test('same month other day is full date', () => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() === 1 ? 2 : 1, 12, 0);
    assert.equal(formatDate(localIso(d)), `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  });
  test('today is a clock time', () => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 30);
    assert.equal(formatDate(localIso(d)), 'today 14:30');
  });
});

describe('sortLinks', () => {
  const links = [
    { url: 'a', added: '2024-01-01', title: 'Banana', tags: 'x y z' },
    { url: 'b', added: '2026-05-05', title: 'apple', tags: '' },
    { url: 'c', added: '2025-03-03', tags: 'x' },
  ];

  test('newest is descending by added', () =>
    assert.deepEqual(sortLinks(links, 'newest').map(l => l.url), ['b', 'c', 'a']));
  test('oldest is ascending by added', () =>
    assert.deepEqual(sortLinks(links, 'oldest').map(l => l.url), ['a', 'c', 'b']));
  test('unknown sort falls back to newest', () =>
    assert.deepEqual(sortLinks(links, 'bogus').map(l => l.url), ['b', 'c', 'a']));
  test('alpha is case-insensitive on title, url when untitled', () =>
    assert.deepEqual(sortLinks(links, 'alpha').map(l => l.url), ['b', 'a', 'c']));
  test('fewest-tags is ascending by tag count', () =>
    assert.deepEqual(sortLinks(links, 'fewest-tags').map(l => l.url), ['b', 'c', 'a']));
  test('random keeps every link', () => {
    const out = sortLinks(links, 'random');
    assert.deepEqual(out.map(l => l.url).sort(), ['a', 'b', 'c']);
  });
  test('input array is not reordered', () => {
    sortLinks(links, 'oldest');
    assert.deepEqual(links.map(l => l.url), ['a', 'b', 'c']);
  });
});

describe('filterLinksByTime', () => {
  const links = [
    { url: 'recent', added: daysAgo(2) },
    { url: 'old', added: daysAgo(60) },
    { url: 'undated', added: '' },
  ];

  test('all keeps everything including undated', () =>
    assert.deepEqual(filterLinksByTime(links, 'all').map(l => l.url), ['recent', 'old', 'undated']));
  test('unknown period keeps everything', () =>
    assert.deepEqual(filterLinksByTime(links, 'decade').map(l => l.url), ['recent', 'old', 'undated']));
  test('week keeps only the last 7 days', () =>
    assert.deepEqual(filterLinksByTime(links, 'week').map(l => l.url), ['recent']));
  test('day drops a 2-day-old link', () =>
    assert.deepEqual(filterLinksByTime(links, 'day').map(l => l.url), []));
  test('year keeps both dated links', () =>
    assert.deepEqual(filterLinksByTime(links, 'year').map(l => l.url), ['recent', 'old']));
  test('undated links are dropped by any real period', () =>
    assert.equal(filterLinksByTime(links, 'year').some(l => l.url === 'undated'), false));
});

describe('getTagFilters', () => {
  test('root has no filters', () => { setPath('/'); assert.deepEqual(getTagFilters(), []); });
  test('single tag', () => { setPath('/games'); assert.deepEqual(getTagFilters(), ['games']); });
  test('intersection', () => { setPath('/games/retro'); assert.deepEqual(getTagFilters(), ['games', 'retro']); });
  test('exclusion keeps its minus', () => { setPath('/games/-retro'); assert.deepEqual(getTagFilters(), ['games', '-retro']); });
  test('trailing slash is ignored', () => { setPath('/games/'); assert.deepEqual(getTagFilters(), ['games']); });
  test('index.html is not a tag', () => { setPath('/index.html'); assert.deepEqual(getTagFilters(), []); });
  test('index.html under a tag is not a tag', () => { setPath('/games/index.html'); assert.deepEqual(getTagFilters(), ['games']); });
});

describe('getRatings', () => {
  beforeEach(() => clearStorage());
  test('no stored ratings is an empty map', () => assert.deepEqual(getRatings(), {}));
  test('stored ratings round-trip', () => {
    setStorage('trove_ratings', '{"https://a":1,"https://b":-1}');
    assert.deepEqual(getRatings(), { 'https://a': 1, 'https://b': -1 });
  });
});
