import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  avatarAllowed,
  avatarContentType,
  createPlayerLookup,
  PROFILE_TTL_MS,
  LEGACY_STATS_TTL_MS,
  sanitizeInfo,
} from '../server/live.mjs';

const id = '11111111-1111-1111-1111-111111111111';
const other = '22222222-2222-2222-2222-222222222222';
const profile = (extra = {}) => ({
  player_id: id,
  nickname: 'Player',
  country: 'pl',
  verified: true,
  memberships: ['premium'],
  games: { cs2: { faceit_elo: 2400, skill_level: 10 } },
  ...extra,
});
const response = (data) => new Response(JSON.stringify(data), { status: 200 });

test('verification and avatars cannot be supplied by a public heartbeat', () => {
  const info = sanitizeInfo({
    nickname: 'Player',
    playerId: id,
    verifiedBadge: 'gold',
    avatar: 'https://example.com/avatar',
  });
  assert.equal('verifiedBadge' in info, false);
  assert.equal('avatar' in info, false);
});

test('badge/profile metadata stays cached for six hours and simultaneous requests are shared', async () => {
  let time = 0;
  let calls = 0;
  const cache = createPlayerLookup({
    now: () => time,
    getKey: () => 'test',
    fetcher: async () => {
      calls++;
      return response(profile());
    },
  });
  const profiles = await Promise.all(
    Array.from({ length: 20 }, () => cache.lookup(id))
  );
  assert.equal(calls, 1);
  assert.equal(profiles[0].verifiedBadge, 'gold');
  time = PROFILE_TTL_MS - 1;
  await cache.lookup(id);
  assert.equal(calls, 1);
  time++;
  await cache.lookup(id);
  assert.equal(calls, 2);
});

test('old ID-only banners can refresh stats sooner without shortening metadata TTL', async () => {
  let time = 0;
  let calls = 0;
  const cache = createPlayerLookup({
    now: () => time,
    getKey: () => 'test',
    fetcher: async () => {
      calls++;
      return response(profile());
    },
  });
  await cache.lookup(id);
  time = LEGACY_STATS_TTL_MS;
  await cache.lookup(id);
  assert.equal(calls, 1);
  await cache.lookup(id, { freshStats: true });
  assert.equal(calls, 2);
});

test('an outage retains cached metadata and backs off for five minutes', async () => {
  let time = 0;
  let calls = 0;
  const cache = createPlayerLookup({
    now: () => time,
    getKey: () => 'test',
    fetcher: async () => {
      if (++calls > 1) throw new Error('offline');
      return response(profile());
    },
  });
  await cache.lookup(id);
  time = PROFILE_TTL_MS;
  assert.equal((await cache.lookup(id)).verifiedBadge, 'gold');
  await cache.lookup(id);
  assert.equal(calls, 2);
  time += 5 * 60_000;
  await cache.lookup(id);
  assert.equal(calls, 3);
  time = 24 * 60 * 60_000;
  assert.equal(await cache.lookup(id), null);
});

test('rate limiting pauses lookups globally and honors Retry-After', async () => {
  let time = 0;
  let calls = 0;
  const cache = createPlayerLookup({
    now: () => time,
    getKey: () => 'test',
    fetcher: async () => {
      calls++;
      return new Response('', {
        status: 429,
        headers: { 'Retry-After': '600' },
      });
    },
  });
  assert.equal(await cache.lookup(id), null);
  await cache.lookup(other);
  time = 599_999;
  await cache.lookup(other);
  assert.equal(calls, 1);
  time++;
  await cache.lookup(other);
  assert.equal(calls, 2);
});

test('unverified Premium accounts have no badge and a mismatched player is rejected', async () => {
  const cache = createPlayerLookup({
    getKey: () => 'test',
    fetcher: async () => response(profile({ verified: false })),
  });
  assert.equal((await cache.lookup(id)).verifiedBadge, 'none');
  assert.equal(await cache.lookup(other), null);
});

test('unknown players are negatively cached and synchronous failures can be retried', async () => {
  let time = 0;
  let calls = 0;
  const cache = createPlayerLookup({
    now: () => time,
    getKey: () => 'test',
    fetcher: () => {
      calls++;
      if (calls === 1) throw new Error('sync failure');
      return Promise.resolve(new Response('', { status: 404 }));
    },
  });
  await cache.lookup(id);
  time = 5 * 60_000;
  await cache.lookup(id);
  time += 60_000;
  await cache.lookup(id, { freshStats: true });
  assert.equal(calls, 2);
});

test('avatar bytes are accepted only from a FACEIT host and a real image', () => {
  assert.equal(avatarAllowed('https://assets.faceit-cdn.net/avatars/a.jpg'), true);
  assert.equal(avatarAllowed('https://evil.example/a.jpg'), false);
  assert.equal(avatarAllowed('not a url'), false);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, ...new Array(40).fill(1)]);
  assert.equal(avatarContentType(jpeg), 'image/jpeg');
  assert.equal(avatarContentType(Buffer.from('hello')), null);
});
