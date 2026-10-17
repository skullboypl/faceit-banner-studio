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

test('the same player is fetched once inside 30 seconds, then again after', async () => {
  let clock = 1_000;
  const calls = [];
  const cache = createFaceitCache({
    now: () => clock,
    getKey: () => 'test-key',
    fetcher: async (url) => {
      if (!String(url).includes('/history')) calls.push(url); /* the cheap freshness check is not a full read */
      return { status: 200, text: async () => `{"url":${JSON.stringify(url)}}` };
    },
  });
  const target = faceitTarget(`/api/faceit/v4/players/${id}`);
  const other = faceitTarget(`/api/faceit/v4/players/${id}/stats/cs2`);
  const [first, second] = await Promise.all([cache.load(target), cache.load(target)]);
  assert.equal(calls.length, 1);
  assert.equal(first.body, second.body);
  clock += 20_000;
  await cache.load(target);
  assert.equal(calls.length, 1);
  clock += 11_000;
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
      if (!String(url).includes('/history')) calls.push(url);
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

test('rankings change slowly and are kept for ten minutes, while profiles still refresh every 30 seconds', async () => {
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
    fetcher: async (url) => {
      if (!String(url).includes('/history')) calls++;
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

test('dropPlayer forgets only that player so the next read of theirs goes to FACEIT', async () => {
  let calls = 0;
  const cache = createFaceitCache({
    now: () => 1_000,
    getKey: () => 'test-key',
    fetcher: async (url) => {
      if (!String(url).includes('/history')) calls++;
      return { status: 200, text: async () => '{}' };
    },
  });
  const mine = faceitTarget(`/api/faceit/v4/players/${id}`);
  const otherId = '22222222-2222-2222-2222-222222222222';
  const theirs = faceitTarget(`/api/faceit/v4/players/${otherId}`);
  await cache.load(mine);
  await cache.load(theirs);
  assert.equal(calls, 2);
  cache.dropPlayer(id);
  await cache.load(mine);
  await cache.load(theirs);
  assert.equal(calls, 3);
});

test('player reads point the avatar and the cover at our cached copies, and leave other pictures alone', async () => {
  const body = (extra) => JSON.stringify({ player_id: id, nickname: 'X', games: { cs2: {} }, ...extra });
  const read = async (extra) => {
    const cache = createFaceitCache({
      getKey: () => 'k',
      fetcher: async (url) => ({ status: 200, text: async () => (String(url).includes('/api/users/') ? '{}' : body(extra)) }),
    });
    return JSON.parse((await cache.load(faceitTarget(`/api/faceit/v4/players/${id}`))).body);
  };
  const mine = await read({ avatar: 'https://assets.faceit-cdn.net/a.jpg', cover_image: 'https://distribution.faceit-cdn.net/c.jpg' });
  assert.equal(mine.avatar, `/api/presence/avatar/${id}`);
  assert.equal(mine.cover_image, `/api/presence/cover/${id}`);
  const odd = await read({ avatar: 'https://evil.example/a.jpg', cover_image: '' });
  assert.equal(odd.avatar, 'https://evil.example/a.jpg');
  assert.equal(odd.cover_image, '');
  const none = await read({});
  assert.equal(none.avatar, undefined);
});

test('when FACEIT refuses or fails, the last good answer is served instead of an error', async () => {
  let clock = 1_000;
  let mode = 'ok';
  const cache = createFaceitCache({
    now: () => clock,
    getKey: () => 'k',
    fetcher: async () => {
      if (mode === 'down') throw new Error('offline');
      if (mode === 'limited') return { status: 429, text: async () => '{"error":"rate"}' };
      return { status: 200, text: async () => '{"nickname":"Good"}' };
    },
  });
  const target = faceitTarget(`/api/faceit/v4/players/${id}/stats/cs2`);
  assert.equal((await cache.load(target)).body, '{"nickname":"Good"}');
  clock += 60_000;
  mode = 'limited';
  const limited = await cache.load(target);
  assert.equal(limited.status, 200);
  assert.equal(limited.body, '{"nickname":"Good"}');
  clock += 20_000;
  mode = 'down';
  assert.equal((await cache.load(target)).body, '{"nickname":"Good"}');
  /* with nothing to fall back on, the error still reaches the caller */
  const fresh = faceitTarget(`/api/faceit/v4/players/${id}/history?game=cs2`);
  assert.equal((await cache.load(fresh)).status, 502);
});

/** A fake FACEIT: counts calls per kind and lets a test finish a match. */
function fakeFaceit() {
  const state = { head: 'match-1', calls: { history: 0, profile: 0, stats: 0, lifetime: 0 } };
  const fetcher = async (url) => {
    const u = String(url);
    if (u.includes('/history')) {
      state.calls.history++;
      return { status: 200, text: async () => JSON.stringify({ items: [{ match_id: state.head }] }) };
    }
    if (u.includes('/games/cs2/stats')) {
      state.calls.stats++;
      return { status: 200, text: async () => JSON.stringify({ items: [], head: state.head }) };
    }
    if (u.includes('/stats/cs2')) {
      state.calls.lifetime++;
      return { status: 200, text: async () => JSON.stringify({ lifetime: {} }) };
    }
    if (u.includes('/api/users/')) return { status: 200, text: async () => '{}' };
    state.calls.profile++;
    return { status: 200, text: async () => JSON.stringify({ player_id: id, nickname: 'X', games: { cs2: { faceit_elo: state.head === 'match-1' ? 1000 : 1020 } } }) };
  };
  return { state, fetcher };
}

test('a player who has not finished a match is not read again in full: one cheap check replaces three calls', async () => {
  let clock = 1_000;
  const { state, fetcher } = fakeFaceit();
  const cache = createFaceitCache({ now: () => clock, getKey: () => 'k', fetcher });
  const targets = [
    faceitTarget(`/api/faceit/v4/players/${id}`),
    faceitTarget(`/api/faceit/v4/players/${id}/games/cs2/stats?limit=100`),
    faceitTarget(`/api/faceit/v4/players/${id}/stats/cs2`),
  ];
  for (const target of targets) await cache.load(target);
  assert.deepEqual([state.calls.profile, state.calls.stats, state.calls.lifetime], [1, 1, 1]);
  /* five minutes of one-minute refreshes with no new match */
  for (let minute = 0; minute < 5; minute++) {
    clock += 60_000;
    for (const target of targets) await cache.load(target);
  }
  assert.deepEqual([state.calls.profile, state.calls.stats, state.calls.lifetime], [1, 1, 1]);
  assert.ok(state.calls.history <= 6, `${state.calls.history} history checks`);
});

test('after a new match the three reads are refreshed at once, and kept fresh for two minutes while ELO settles', async () => {
  let clock = 1_000;
  const { state, fetcher } = fakeFaceit();
  const cache = createFaceitCache({ now: () => clock, getKey: () => 'k', fetcher });
  const profile = faceitTarget(`/api/faceit/v4/players/${id}`);
  const stats = faceitTarget(`/api/faceit/v4/players/${id}/games/cs2/stats?limit=100`);
  await cache.load(profile);
  await cache.load(stats);
  clock += 60_000;
  state.head = 'match-2';
  const after = JSON.parse((await cache.load(profile)).body);
  assert.equal(after.games.cs2.faceit_elo, 1020);
  await cache.load(stats);
  assert.equal(state.calls.stats, 2);
  /* inside the settling window every refresh reads again */
  clock += 60_000;
  await cache.load(profile);
  assert.equal(state.calls.profile, 3);
  /* after it, the check finds nothing new and the answer is kept */
  clock += 3 * 60_000;
  await cache.load(profile);
  clock += 60_000;
  await cache.load(profile);
  assert.ok(state.calls.profile <= 4);
});

test('an answer is never kept for more than ten minutes just because no match was seen', async () => {
  let clock = 1_000;
  const { state, fetcher } = fakeFaceit();
  const cache = createFaceitCache({ now: () => clock, getKey: () => 'k', fetcher });
  const lifetime = faceitTarget(`/api/faceit/v4/players/${id}/stats/cs2`);
  await cache.load(lifetime);
  for (let i = 0; i < 12; i++) {
    clock += 60_000;
    await cache.load(lifetime);
  }
  assert.ok(state.calls.lifetime >= 2, 'read again at least once in twelve minutes');
});

test('under load the answers are kept longer instead of piling more requests on FACEIT', async () => {
  let clock = 1_000;
  let busy = 0;
  let calls = 0;
  const cache = createFaceitCache({
    now: () => clock,
    getKey: () => 'k',
    pressure: () => busy,
    fetcher: async () => {
      calls++;
      return { status: 200, text: async () => '{}' };
    },
  });
  const target = faceitTarget(`/api/faceit/v4/players/${id}/history?game=cs2`);
  await cache.load(target);
  clock += 31_000;
  await cache.load(target);
  assert.equal(calls, 2, 'a quiet server reads again after 30 seconds');
  busy = 1;
  clock += 31_000;
  await cache.load(target);
  assert.equal(calls, 2, 'a busy one keeps the answer');
  clock += 100_000;
  await cache.load(target);
  assert.equal(calls, 3);
});

test('a player read teaches the server where the pictures are, before they are asked for', async () => {
  const { imageSource } = await import('../server/faceit-gate.mjs');
  const player = '44444444-4444-4444-8444-444444444444';
  const cache = createFaceitCache({
    getKey: () => 'k',
    fetcher: async (url) => ({
      status: 200,
      text: async () =>
        String(url).includes('/api/users/')
          ? '{}'
          : JSON.stringify({ player_id: player, games: { cs2: {} }, avatar: 'https://assets.faceit-cdn.net/p.jpg', cover_image: 'https://distribution.faceit-cdn.net/p-cover.jpg' }),
    }),
  });
  await cache.load(faceitTarget(`/api/faceit/v4/players/${player}`));
  assert.equal(imageSource(player, 'avatar'), 'https://assets.faceit-cdn.net/p.jpg');
  assert.equal(imageSource(player, 'cover'), 'https://distribution.faceit-cdn.net/p-cover.jpg');
});
