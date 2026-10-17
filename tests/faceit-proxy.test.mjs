import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFaceitCache, faceitTarget, withCalibration } from '../server/faceit-proxy.mjs';

const id = '11111111-1111-4111-8111-111111111111';

test('faceitTarget keeps a player read and drops anything else', () => {
  const profile = faceitTarget(`/api/faceit/v4/players/${id}`);
  assert.equal(profile.upstream, `https://open.faceit.com/data/v4/players/${id}`);
  const nick = faceitTarget('/api/faceit/v4/players?nickname=Donk&limit=999');
  assert.equal(nick.upstream, 'https://open.faceit.com/data/v4/players?nickname=Donk');
  assert.equal(faceitTarget('/api/faceit/v4/players?nickname=Donk').key, nick.key);
  assert.equal(faceitTarget('/api/faceit/v4/organizers'), null);
  assert.equal(faceitTarget('/api/faceit/v4/players?nickname=<script>'), null);
  assert.equal(faceitTarget(`/api/faceit/v4/players/${id}/history?game=csgo&limit=1`), null);
});

test('the same player is fetched once inside 15 seconds, then again after', async () => {
  let clock = 1_000;
  const calls = [];
  const cache = createFaceitCache({
    now: () => clock,
    getKey: () => 'test-key',
    fetcher: async (url) => {
      calls.push(url);
      return { status: 200, text: async () => `{"url":${JSON.stringify(url)}}` };
    },
  });
  const target = faceitTarget(`/api/faceit/v4/players/${id}`);
  const other = faceitTarget(`/api/faceit/v4/players/${id}/stats/cs2`);
  const [first, second] = await Promise.all([cache.load(target), cache.load(target)]);
  assert.equal(calls.length, 1);
  assert.equal(first.body, second.body);
  clock += 10_000;
  await cache.load(target);
  assert.equal(calls.length, 1);
  clock += 6_000;
  await cache.load(target);
  assert.equal(calls.length, 2);
  await cache.load(other);
  assert.equal(calls.length, 3);
  assert.match(calls[2], /\/stats\/cs2$/);
});

test('a calibrating player is marked once and a failed site lookup keeps the Data API body', async () => {
  const player = {
    player_id: id,
    games: { cs2: { skill_level: 10, faceit_elo: 3737 } },
  };
  const site = { payload: { games: { cs2: { is_calibrating: true, faceit_elo: 3737 } } } };
  const marked = JSON.parse(
    await withCalibration(JSON.stringify(player), async () => ({ ok: true, text: async () => JSON.stringify(site) }))
  );
  assert.equal(marked.games.cs2.is_calibrating, true);
  assert.equal(marked.games.cs2.faceit_elo, 3737);
  const kept = await withCalibration(JSON.stringify(player), async () => {
    throw new Error('offline');
  });
  assert.equal(JSON.parse(kept).games.cs2.is_calibrating, undefined);

  let clock = 1_000;
  const calls = [];
  const cache = createFaceitCache({
    now: () => clock,
    getKey: () => 'test-key',
    fetcher: async (url) => {
      calls.push(url);
      if (String(url).includes('/api/users/')) {
        return { status: 200, text: async () => JSON.stringify(site) };
      }
      return { status: 200, text: async () => JSON.stringify(player) };
    },
  });
  const target = faceitTarget(`/api/faceit/v4/players/${id}`);
  const first = await cache.load(target);
  assert.equal(JSON.parse(first.body).games.cs2.is_calibrating, true);
  clock += 1_000;
  await cache.load(target);
  assert.equal(calls.length, 2);
});

test('the active-match path asks the public site, not the Data API, and takes no query', () => {
  const target = faceitTarget(`/api/faceit/v4/players/${id}/active?userId=other`);
  assert.equal(target.upstream, `https://www.faceit.com/api/match/v1/matches/groupByState?userId=${id}`);
  assert.equal(target.site, true);
  assert.equal(faceitTarget(`/api/faceit/v4/players/nope/active`), null);
});

test('activeMatchFrom prefers a running match, then a lobby, and says nothing when there is none', async () => {
  const { activeMatchFrom } = await import('../server/faceit-proxy.mjs');
  const body = (payload) => JSON.stringify({ payload });
  assert.deepEqual(JSON.parse(activeMatchFrom(body({}))), {});
  assert.deepEqual(JSON.parse(activeMatchFrom('not json')), {});
  assert.deepEqual(JSON.parse(activeMatchFrom(body({ VOTING: [{ id: '1-lobby-match' }] }))), { match_id: '1-lobby-match', status: 'VOTING' });
  assert.deepEqual(
    JSON.parse(activeMatchFrom(body({ READY: [{ id: '1-ready-match' }], ONGOING: [{ id: '1-live-match' }, { id: '1-other-match' }] }))),
    { match_id: '1-live-match', status: 'ONGOING' }
  );
  assert.deepEqual(JSON.parse(activeMatchFrom(body({ FINISHED: [{ id: '1-done-match' }] }))), {});
});

test('a site read goes out without the API key and comes back reduced to the match', async () => {
  const calls = [];
  const cache = createFaceitCache({
    getKey: () => 'secret-key',
    fetcher: async (url, init) => {
      calls.push({ url, headers: init.headers });
      return { status: 200, text: async () => JSON.stringify({ payload: { ONGOING: [{ id: '1-live-match' }] } }) };
    },
  });
  const entry = await cache.load(faceitTarget(`/api/faceit/v4/players/${id}/active`));
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.match(calls[0].headers['User-Agent'], /faceitbanner/);
  assert.deepEqual(JSON.parse(entry.body), { match_id: '1-live-match', status: 'ONGOING' });
});

test('rankings change slowly and are kept for ten minutes, while profiles still refresh every 15 seconds', async () => {
  let clock = 1_000;
  const calls = [];
  const cache = createFaceitCache({
    now: () => clock,
    getKey: () => 'test-key',
    fetcher: async (url) => {
      calls.push(url);
      return { status: 200, text: async () => '{}' };
    },
  });
  const ranking = faceitTarget(`/api/faceit/v4/rankings/games/cs2/regions/EU/players/${id}?country=pl`);
  const profile = faceitTarget(`/api/faceit/v4/players/${id}`);
  await cache.load(ranking);
  await cache.load(profile);
  clock += 60_000;
  await cache.load(ranking);
  await cache.load(profile);
  assert.equal(calls.filter((url) => url.includes('/rankings/')).length, 1);
  assert.equal(calls.filter((url) => url.endsWith(`/players/${id}`)).length, 2);
  clock += 10 * 60_000;
  await cache.load(ranking);
  assert.equal(calls.filter((url) => url.includes('/rankings/')).length, 2);
});

test('a Twitch account linked on FACEIT is added to the player, and only a valid name', async () => {
  const player = { player_id: id, games: { cs2: { skill_level: 5, faceit_elo: 1500 } } };
  const site = (streaming) => async () => ({ ok: true, text: async () => JSON.stringify({ payload: { games: { cs2: {} }, streaming } }) });
  const linked = JSON.parse(await withCalibration(JSON.stringify(player), site({ twitch_id: 'SkullBoyPL' })));
  assert.equal(linked.twitch_id, 'SkullBoyPL');
  const odd = JSON.parse(await withCalibration(JSON.stringify(player), site({ twitch_id: '../evil?x=<b>' })));
  assert.equal(odd.twitch_id, undefined);
  const none = JSON.parse(await withCalibration(JSON.stringify(player), site({})));
  assert.equal(none.twitch_id, undefined);
});

test('clear() forgets every cached read, so the next one goes to FACEIT again', async () => {
  let calls = 0;
  const cache = createFaceitCache({
    now: () => 1_000,
    getKey: () => 'test-key',
    fetcher: async () => {
      calls++;
      return { status: 200, text: async () => '{}' };
    },
  });
  const target = faceitTarget(`/api/faceit/v4/players/${id}`);
  await cache.load(target);
  await cache.load(target);
  assert.equal(calls, 1);
  cache.clear();
  await cache.load(target);
  assert.equal(calls, 2);
});
