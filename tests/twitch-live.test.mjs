/* global Response */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTwitchLookup } from '../server/twitch-live.mjs';

const config = () => ({ enabled: true, url: 'https://skullboy.pl', key: 'test-secret' });
const players = ['LIVE', 'offline', 'deleted', 'unknown'].map((twitch) => ({ nickname: twitch, twitch }));

test('batches normalized logins, keeps zero viewers, and separates missing from unknown', async () => {
  let calls = 0;
  const lookup = createTwitchLookup({ config, fetcher: async (url, options) => {
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

test('refreshes after a minute; failures and individual errors never become offline', async () => {
  let time = 0;
  let calls = 0;
  const lookup = createTwitchLookup({ config, now: () => time, fetcher: async () => {
    calls++;
    if (calls === 1) return Response.json({ ok: true, streams: { live: { live: true, viewers: 15 }, offline: { live: false, error: 'failed' } } });
    throw new Error('unavailable');
  } });
  const first = await lookup(players);
  assert.equal(first[0].twitchStatus.viewers, 15);
  assert.equal(first[1].twitchStatus.state, 'unknown');
  time = 60_001;
  assert.ok((await lookup(players)).every((p) => p.twitchStatus.state === 'unknown'));
  await lookup(players);
  assert.equal(calls, 2);
});

test('limits batches to 100 and does not fetch when disabled or missing a key', async () => {
  const sizes = [];
  const fetcher = async (url) => { sizes.push(url.searchParams.get('logins').split(',').length); return Response.json({ ok: true, streams: {} }); };
  const lookup = createTwitchLookup({ config, fetcher });
  await lookup(Array.from({ length: 201 }, (_, i) => ({ twitch: `user${i}` })));
  assert.deepEqual(sizes, [100, 100, 1]);
  for (const settings of [{ ...config(), enabled: false }, { ...config(), key: '' }]) {
    assert.equal(await createTwitchLookup({ config: () => settings, fetcher })(players), players);
  }
  assert.equal(sizes.length, 3);
});
