import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFaceitCache, faceitTarget } from '../server/faceit-proxy.mjs';
import {
  applyCachedProfiles,
  attachProfile,
  createPlayerLookup,
  fillFromPlayerId,
  mergeLastGoodPlayers,
  MISSING_TWITCH_TTL_MS,
  publicRanking,
} from '../server/live.mjs';
import { lastMatchFromHistory, mergeFaceitPayload, parseFaceitProfile } from '../server/store.mjs';

const id = '11111111-1111-1111-1111-111111111111';

const memoryStore = () => {
  const rows = new Map();
  return {
    rows,
    load: async (key) => rows.get(key) ?? null,
    loadMany: async (keys) => new Map(keys.filter((key) => rows.has(key)).map((key) => [key, rows.get(key)])),
    save: async (key, entry) => void rows.set(key, entry),
    remove: async (key) => void rows.delete(key),
  };
};

const layeredStore = () => {
  const hot = new Map();
  const warm = new Map();
  return {
    hot,
    warm,
    load: async (key) => {
      if (hot.has(key)) return hot.get(key);
      const row = warm.get(key) ?? null;
      if (row) hot.set(key, row);
      return row;
    },
    loadMany: async (keys) => {
      const found = new Map();
      for (const key of keys) {
        const row = hot.get(key) ?? warm.get(key);
        if (!row) continue;
        if (!hot.has(key)) hot.set(key, row);
        found.set(key, row);
      }
      return found;
    },
    save: async (key, entry) => {
      hot.set(key, entry);
      warm.set(key, entry);
    },
    remove: async (key) => {
      hot.delete(key);
      warm.delete(key);
    },
  };
};

const answerStore = () => {
  const hot = new Map();
  const warm = new Map();
  const pack = (player, key) => `${player}\n${key}`;
  return {
    hot,
    warm,
    load: async (player, key) => hot.get(pack(player, key)) ?? warm.get(pack(player, key)) ?? null,
    save: async (player, key, entry) => {
      hot.set(pack(player, key), entry);
      warm.set(pack(player, key), entry);
    },
    remove: async (player) => {
      for (const map of [hot, warm]) {
        for (const key of [...map.keys()]) if (key.startsWith(`${player}\n`)) map.delete(key);
      }
    },
  };
};

test('a stored FACEIT payload keeps the live snapshot and merges answers by key', () => {
  const first = mergeFaceitPayload(null, {
    at: 1000,
    profile: { nickname: 'A', elo: 1000 },
    answers: { '/players/x?': { status: 200, body: '{"a":1}', at: 1000 } },
  });
  const next = mergeFaceitPayload(first, {
    answers: { '/players/x/stats/cs2?': { status: 200, body: '{"b":2}', at: 2000 } },
  });
  assert.equal(next.at, 1000);
  assert.equal(next.profile.nickname, 'A');
  assert.equal(Object.keys(next.answers).length, 2);
  assert.deepEqual(parseFaceitProfile(JSON.stringify(next)).profile, next.profile);
  assert.deepEqual(lastMatchFromHistory(JSON.stringify({ items: [{ match_id: '1-match', started_at: 9, game: 'cs2' }] })), {
    matchId: '1-match',
    startedAt: 9,
    game: 'cs2',
  });
});

test('a proxy cache hit reads Redis and does not call FACEIT', async () => {
  const store = answerStore();
  const target = faceitTarget(`/api/faceit/v4/players/${id}`);
  store.hot.set(
    `${id}\n${target.key}`,
    { status: 200, body: '{"nickname":"Cached"}', at: 1_000, fetchedAt: 1_000, head: null }
  );
  let calls = 0;
  const cache = createFaceitCache({
    now: () => 1_500,
    getKey: () => 'k',
    store,
    fetcher: async () => {
      calls++;
      return { status: 200, text: async () => '{"nickname":"Fresh"}' };
    },
  });
  const entry = await cache.load(target);
  assert.equal(entry.body, '{"nickname":"Cached"}');
  assert.equal(calls, 0);
});

test('a proxy miss in Redis serves the Postgres copy and does not call FACEIT', async () => {
  const store = answerStore();
  const target = faceitTarget(`/api/faceit/v4/players/${id}/stats/cs2`);
  store.warm.set(
    `${id}\n${target.key}`,
    { status: 200, body: '{"lifetime":{"Matches":"12"}}', at: 2_000, fetchedAt: 2_000, head: 'match-1' }
  );
  let calls = 0;
  const cache = createFaceitCache({
    now: () => 2_400,
    getKey: () => 'k',
    store,
    fetcher: async () => {
      calls++;
      return { status: 200, text: async () => '{}' };
    },
  });
  const entry = await cache.load(target);
  assert.equal(entry.body, '{"lifetime":{"Matches":"12"}}');
  assert.equal(calls, 0);
});

test('a stored answer older than 30 seconds is still served after a restart', async () => {
  const store = answerStore();
  const target = faceitTarget(`/api/faceit/v4/players/${id}`);
  store.warm.set(`${id}\n${target.key}`, {
    status: 200,
    body: '{"nickname":"Old"}',
    at: 1_000,
    fetchedAt: 1_000,
    head: null,
  });
  let calls = 0;
  const cache = createFaceitCache({
    now: () => 1_000 + 5 * 60 * 60_000,
    getKey: () => 'k',
    store,
    fetcher: async () => {
      calls++;
      return { status: 200, text: async () => '{}' };
    },
  });
  assert.equal((await cache.load(target)).body, '{"nickname":"Old"}');
  assert.equal(calls, 0);
});

test('a successful proxy read is written to the per-profile store', async () => {
  const store = answerStore();
  const target = faceitTarget(`/api/faceit/v4/players/${id}`);
  const cache = createFaceitCache({
    now: () => 3_000,
    getKey: () => 'k',
    store,
    fetcher: async (url) => ({
      status: 200,
      text: async () => (String(url).includes('/api/users/') ? '{}' : JSON.stringify({ player_id: id, nickname: 'Saved', games: { cs2: {} } })),
    }),
  });
  await cache.load(target);
  const saved = await store.load(id, target.key);
  assert.equal(saved?.status, 200);
  assert.match(saved.body, /Saved/);
});

test('when Redis is empty a stored Postgres profile is used and promoted, without FACEIT', async () => {
  const store = layeredStore();
  store.warm.set(id, {
    profile: { nickname: 'Warm', playerId: id, elo: 1800, level: 7, country: 'pl' },
    at: 1_000,
  });
  let calls = 0;
  const cache = createPlayerLookup({
    now: () => 2_000,
    getKey: () => 'test',
    store,
    fetcher: async () => {
      calls++;
      return new Response('{}', { status: 500 });
    },
  });
  const found = await cache.lookup(id);
  assert.equal(found.nickname, 'Warm');
  assert.equal(found.elo, 1800);
  assert.equal(calls, 0);
  assert.equal(store.hot.get(id).profile.nickname, 'Warm');
});

test('applyCachedProfiles fills nickname and ELO on an ID-only live row', () => {
  const profile = { nickname: 'Cached', elo: 2100, level: 8, country: 'pl', membership: 'plus', playerId: id };
  const entries = [{ info: { playerId: id }, lastSeen: 1 }];
  applyCachedProfiles(entries, () => profile);
  assert.equal(entries[0].info.nickname, 'Cached');
  assert.equal(entries[0].info.elo, 2100);
  assert.equal(entries[0].info.membership, 'plus');
  assert.equal(entries[0].info.playerId, id);
  const [row] = publicRanking(entries);
  assert.equal(row.nickname, 'Cached');
  assert.equal(row.elo, 2100);
  assert.equal(row.membership, 'plus');
  assert.equal('verifiedBadge' in row, false);
});

test('a heartbeat ELO wins over a cached profile, and lastMatch stays off the public row', () => {
  const next = attachProfile(
    { playerId: id, nickname: 'Now', elo: 2500 },
    { nickname: 'Old', elo: 1000, lastMatch: { matchId: '1-x' }, membership: 'premium' }
  );
  assert.equal(next.elo, 2500);
  assert.equal(next.membership, 'premium');
  assert.equal('lastMatch' in next, false);
});

test('a partial live rebuild keeps the last good ELO and badge when the new row is thinner', () => {
  const merged = mergeLastGoodPlayers(
    [{ nickname: 'Ayan', country: 'pl' }],
    [{ nickname: 'Ayan', elo: 3900, level: 10, verifiedBadge: 'gold', membership: 'premium', avatar: '/api/presence/avatar/x' }]
  );
  assert.equal(merged[0].elo, 3900);
  assert.equal(merged[0].verifiedBadge, 'gold');
  assert.equal(merged[0].membership, 'premium');
  assert.equal(merged[0].avatar, '/api/presence/avatar/x');
});

test('a live fill that times out still keeps cached profile stats', async () => {
  const store = memoryStore();
  store.rows.set(id, {
    profile: { nickname: 'Cached', playerId: id, elo: 2100, level: 8, country: 'pl' },
    at: 1,
  });
  const lookup = createPlayerLookup({
    now: () => MISSING_TWITCH_TTL_MS + 5_000,
    getKey: () => 'test',
    store,
    fetcher: () => new Promise(() => {}),
  });
  const entries = [{ info: { playerId: id }, lastSeen: 1 }];
  const fill = fillFromPlayerId(entries, lookup);
  const filled = await Promise.race([
    fill.then(() => true, () => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 40)),
  ]);
  assert.equal(filled, false);
  assert.equal(entries[0].info.nickname, 'Cached');
  assert.equal(entries[0].info.elo, 2100);
  assert.equal(publicRanking(entries)[0].nickname, 'Cached');
});

test('a stored answer paints once after a restart, then the next refresh asks FACEIT', async () => {
  const store = answerStore();
  const target = faceitTarget(`/api/faceit/v4/players/${id}/games/cs2/stats?limit=100`);
  const history = faceitTarget(`/api/faceit/v4/players/${id}/history?game=cs2&offset=0&limit=1`);
  const old = { status: 200, at: 1_000, fetchedAt: 1_000, head: 'match-old' };
  store.warm.set(`${id}\n${target.key}`, { ...old, body: '{"items":["old"]}' });
  store.warm.set(`${id}\n${history.key}`, { ...old, body: '{"items":[{"match_id":"match-old"}]}' });
  let clock = 1_000 + 60 * 60_000;
  const upstream = [];
  const cache = createFaceitCache({
    now: () => clock,
    getKey: () => 'k',
    pressure: () => 0,
    store,
    fetcher: async (url) => {
      upstream.push(String(url));
      const body = String(url).includes('/history') ? '{"items":[{"match_id":"match-new"}]}' : '{"items":["new"]}';
      return { status: 200, text: async () => body };
    },
  });
  assert.equal((await cache.load(target)).body, '{"items":["old"]}');
  assert.equal(upstream.length, 0);
  clock += 61_000;
  assert.equal((await cache.load(target)).body, '{"items":["new"]}');
  assert.ok(upstream.some((url) => url.includes('/games/cs2/stats')));
  clock += 61_000;
  await cache.load(target);
  assert.ok(upstream.some((url) => url.includes('/history')), 'the newest match is read from FACEIT, not the store');
});

test('an answer pushed out of memory is not re-served from the store forever', async () => {
  const store = answerStore();
  const target = faceitTarget(`/api/faceit/v4/players/${id}`);
  store.warm.set(`${id}\n${target.key}`, { status: 200, body: '{"nickname":"Old"}', at: 1_000, fetchedAt: 1_000, head: null });
  let clock = 1_000 + 60 * 60_000;
  let calls = 0;
  const cache = createFaceitCache({
    now: () => clock,
    getKey: () => 'k',
    pressure: () => 0,
    fetcher: async (url) => {
      if (String(url).includes('/players/2')) return { status: 404, text: async () => '{}' };
      if (String(url).includes('/api/users/')) return { status: 404, text: async () => '{}' };
      if (String(url).includes('/history')) return { status: 200, text: async () => '{"items":[]}' };
      calls++;
      return { status: 200, text: async () => '{"nickname":"New"}' };
    },
    store: {
      ...store,
      save: async () => undefined,
    },
  });
  assert.equal((await cache.load(target)).body, '{"nickname":"Old"}');
  /* Other banners push this read out of the in-memory cache */
  for (let i = 0; i < 450; i++) {
    await cache.load(faceitTarget(`/api/faceit/v4/players/2${String(i).padStart(7, '0')}-1111-1111-1111-111111111111`));
  }
  clock += 61_000;
  assert.equal((await cache.load(target)).body, '{"nickname":"New"}');
  assert.equal(calls, 1);
});
