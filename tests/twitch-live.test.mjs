/* global Response */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRedisTwitchStore, createTwitchLookup, twitchCacheTtlSeconds } from '../server/twitch-live.mjs';

const config = () => ({ enabled: true, url: 'https://skullboy.pl', key: 'test-secret' });
const players = ['LIVE', 'offline', 'deleted', 'unknown'].map((twitch) => ({ nickname: twitch, twitch }));
const quietStore = { async loadList() { return new Map(); }, async saveList() {} };
const lookupWith = (options) => createTwitchLookup({ store: quietStore, ...options });

test('batches normalized logins, keeps zero viewers, and separates missing from unknown', async () => {
  let calls = 0;
  const lookup = lookupWith({ config, fetcher: async (url, options) => {
    calls++;
    assert.equal(url.searchParams.get('logins'), 'live,offline,deleted,unknown');
    assert.equal(options.headers.Authorization, 'Bearer test-secret');
    assert.equal(url.toString().includes('test-secret'), false);
    return Response.json({ ok: true, streams: { live: { live: true, viewers: 0, title: 'Title', game: 'CS2', thumbnail: 'https://static-cdn.jtvnw.net/preview.jpg', startedAt: '2026-10-17T18:00:00Z' }, offline: { live: false }, deleted: { live: false, exists: false } } });
  } });
  const [a, b] = await Promise.all([lookup(players), lookup(players)]);
  assert.deepEqual(a.map((p) => p.twitchStatus), [{ state: 'live', viewers: 0, title: 'Title', game: 'CS2', thumbnail: 'https://static-cdn.jtvnw.net/preview.jpg', startedAt: '2026-10-17T18:00:00Z' }, { state: 'offline' }, { state: 'missing' }, { state: 'unknown' }]);
  assert.deepEqual(a, b);
  await lookup(players);
  assert.equal(calls, 1);
  assert.equal(players[0].twitchStatus, undefined);
});

test('refreshes after the stream TTL; failures and individual errors never become offline', async () => {
  let time = 0;
  let calls = 0;
  const lookup = lookupWith({ config, now: () => time, fetcher: async () => {
    calls++;
    if (calls === 1) return Response.json({ ok: true, streams: { live: { live: true, viewers: 15 }, offline: { live: false, error: 'failed' } } });
    throw new Error('unavailable');
  } });
  const first = await lookup(players);
  assert.equal(first[0].twitchStatus.viewers, 15);
  assert.equal(first[1].twitchStatus.state, 'unknown');
  time = twitchCacheTtlSeconds() * 1000 + 1;
  assert.ok((await lookup(players)).every((p) => p.twitchStatus.state === 'unknown'));
  await lookup(players);
  assert.equal(calls, 2);
});

test('limits batches to 100 and does not fetch when disabled or missing a key', async () => {
  const sizes = [];
  const fetcher = async (url) => { sizes.push(url.searchParams.get('logins').split(',').length); return Response.json({ ok: true, streams: {} }); };
  const lookup = lookupWith({ config, fetcher });
  await lookup(Array.from({ length: 201 }, (_, i) => ({ twitch: `user${i}` })));
  assert.deepEqual(sizes, [100, 100, 1]);
  for (const settings of [{ ...config(), enabled: false }, { ...config(), key: '' }]) {
    assert.equal(await lookupWith({ config: () => settings, fetcher })(players), players);
  }
  assert.equal(sizes.length, 3);
});

test('the stream list stays in redis for the stream TTL and another process reuses it', async () => {
  const saved = new Map();
  let ttlSeen = 0;
  const redis = {
    async get(key) {
      assert.equal(key, 'fb:twitch-live:list');
      return saved.get(key) ?? null;
    },
    async set(key, value, mode, ttl) {
      assert.equal(key, 'fb:twitch-live:list');
      assert.equal(mode, 'EX');
      ttlSeen = ttl;
      saved.set(key, value);
    },
  };
  const store = createRedisTwitchStore(async (run) => run(redis));
  let time = 1_000_000;
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return Response.json({ ok: true, streams: { live: { live: true, viewers: 4 }, offline: { live: false } } });
  };
  const options = { config, store, fetcher, now: () => time };
  await createTwitchLookup(options)(players);
  assert.equal(calls, 1);
  assert.equal(ttlSeen, twitchCacheTtlSeconds());
  const listed = JSON.parse(saved.get('fb:twitch-live:list'));
  assert.equal(listed.streams.live.viewers, 4);
  assert.equal(listed.streams.live.at, time);
  assert.equal(listed.streams.offline.state, 'offline');
  assert.equal(listed.streams.unknown, undefined);
  time += 1000;
  const cached = await createTwitchLookup(options)(players.slice(0, 2));
  assert.equal(calls, 1);
  assert.equal(cached[0].twitchStatus.viewers, 4);
  assert.equal(cached[1].twitchStatus.state, 'offline');
  time += twitchCacheTtlSeconds() * 1000;
  await createTwitchLookup(options)(players.slice(0, 2));
  assert.equal(calls, 2);
});
