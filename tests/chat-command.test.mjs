import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_REPLY_MAX, chatNick, chatReply, chatRequest, handleChatCommand, mapName, recentAverages, recentForm } from '../server/chat-command.mjs';
import { faceitTarget } from '../server/faceit-proxy.mjs';
import { chatDay, createChatStats } from '../server/chat-stats.mjs';

const id = '10b53a6d-5fc9-4095-920c-2953cfa62486';
const ok = (body) => ({ status: 200, body: JSON.stringify(body) });
const match = (result, kills = 20, deaths = 10) => ({ stats: { Result: result, Kills: String(kills), Deaths: String(deaths) } });

/** A fake FACEIT behind the shared cache: answers by path and records what was asked. */
function fakeRead({ nickname = 'SkullBoy', elo = 3184, calibrating = false, position = 512, items } = {}) {
  const asked = [];
  const read = async (path) => {
    asked.push(path);
    if (path.startsWith('/players?nickname=')) {
      return decodeURIComponent(path.split('=')[1]) === nickname
        ? ok({ player_id: id, nickname, games: { cs2: { faceit_elo: elo, skill_level: 10, region: 'EU', is_calibrating: calibrating } } })
        : { status: 404, body: '{}' };
    }
    if (path.startsWith('/search/players')) return ok({ items: [{ nickname: 'SkullBoyFan', player_id: '22222222-2222-2222-2222-222222222222' }, { nickname, player_id: id }] });
    if (path === `/players/${id}`) return ok({ player_id: id, nickname, games: { cs2: { faceit_elo: elo, skill_level: 10, region: 'EU' } } });
    if (path.startsWith('/rankings/')) return ok({ position });
    if (path.includes('/games/cs2/stats')) return ok({ items: items ?? [match('1'), match('1'), match('0', 10, 20), match('1'), match('0'), match('1')] });
    return { status: 404, body: '{}' };
  };
  return { read, asked };
}

test('a chat nick is the first word without the @, and junk is not a nick', () => {
  assert.equal(chatNick('@SkullBoy'), 'SkullBoy');
  assert.equal(chatNick('  SkullBoy  extra words'), 'SkullBoy');
  assert.equal(chatNick('a'), '');
  assert.equal(chatNick('<script>'), '');
  assert.equal(chatNick('/ban'), '');
  assert.equal(chatNick(''), '');
});

test('the request falls back to the streamer nick, English and the default parts', () => {
  assert.deepEqual(chatRequest('/api/faceit/elo?nick=&default=SkullBoy'), {
    nick: 'SkullBoy',
    lang: 'en',
    show: ['rank', 'last'],
    cmd: 'elo',
    kind: 'elo',
    owner: 'skullboy',
    preview: false,
  });
  assert.deepEqual(chatRequest('/api/faceit/elo?nick=%40other&default=SkullBoy&lang=pl&show=kd,bogus&cmd=faceit'), {
    nick: 'other',
    lang: 'pl',
    show: ['kd'],
    cmd: 'faceit',
    kind: 'elo',
    owner: 'skullboy',
    preview: false,
  });
  assert.equal(chatRequest('/api/faceit/elo?nick=x&preview=1').preview, true);
  assert.equal(chatRequest('/api/faceit/elo?nick=x').owner, '');
  assert.equal(chatRequest('/api/faceit/elo?type=live').kind, 'live');
  assert.equal(chatRequest('/api/faceit/elo?type=live').cmd, 'live');
  assert.equal(chatRequest('/api/faceit/elo?type=drop').kind, 'elo');
  assert.equal(chatRequest('/api/faceit/elo?lang=xx').lang, 'en');
});

test('a reply has the ELO, level, place and the last five results', async () => {
  const { read } = fakeRead();
  const reply = await chatReply({ nick: 'SkullBoy', lang: 'pl', show: ['rank', 'kd', 'last'], cmd: 'elo' }, read);
  assert.equal(reply, 'SkullBoy: 3184 ELO · Poziom 10 · #512 EU · K/D 1.57 · Ostatnie: W W L W L');
});

test('a nick typed in another case is found through the search', async () => {
  const { read, asked } = fakeRead();
  const reply = await chatReply({ nick: 'skullboy', lang: 'en', show: [], cmd: 'elo' }, read);
  assert.equal(reply, 'SkullBoy: 3184 ELO · Level 10');
  assert.ok(asked.some((path) => path.startsWith('/search/players')));
});

test('an unknown player, a missing nick and a FACEIT outage each answer one sentence', async () => {
  const { read } = fakeRead();
  assert.equal(await chatReply({ nick: 'Nobody', lang: 'en', show: [], cmd: 'elo' }, async (path) => (path.startsWith('/search') ? ok({ items: [] }) : read(path))), 'Player Nobody not found on FACEIT.');
  assert.equal(await chatReply({ nick: '', lang: 'pl', show: [], cmd: 'faceit' }, read), 'Podaj nick FACEIT: !faceit nick');
  assert.equal(await chatReply({ nick: 'SkullBoy', lang: 'de', show: [], cmd: 'elo' }, async () => ({ status: 502, body: '{}' })), 'FACEIT antwortet gerade nicht, versuch es in einer Minute.');
});

test('a calibrating player shows no level and no place', async () => {
  const { read, asked } = fakeRead({ calibrating: true });
  assert.equal(await chatReply({ nick: 'SkullBoy', lang: 'en', show: ['rank'], cmd: 'elo' }, read), 'SkullBoy: 3184 ELO · calibrating');
  assert.ok(!asked.some((path) => path.startsWith('/rankings/')));
});

test('a reply is never longer than a bot can print', async () => {
  const { read } = fakeRead({ nickname: 'X'.repeat(30) });
  const reply = await chatReply({ nick: 'X'.repeat(30), lang: 'tr', show: ['rank', 'kd', 'last'], cmd: 'elo' }, read);
  assert.ok(reply.length <= CHAT_REPLY_MAX);
});

test('recentForm counts K/D over twenty matches and keeps five results', () => {
  const items = Array.from({ length: 25 }, (_, index) => match(index % 2 ? '0' : '1', 10, 5));
  const recent = recentForm(items);
  assert.equal(recent.kd, 2);
  assert.deepEqual(recent.form, ['W', 'L', 'W', 'L', 'W']);
  assert.deepEqual(recentForm(undefined), { kd: null, form: [] });
});

test('the endpoint answers plain text with status 200, and leaves other paths alone', async () => {
  const { read } = fakeRead();
  const response = () => {
    const res = { headers: {}, statusCode: 0, body: '', setHeader: (name, value) => (res.headers[name.toLowerCase()] = value), end: (body) => (res.body = body) };
    return res;
  };
  const res = response();
  const handled = await handleChatCommand({ url: '/api/faceit/elo?nick=SkullBoy&lang=en&show=', method: 'GET', headers: {}, socket: {} }, res, { unlimitedRate: true, read });
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /^text\/plain/);
  assert.equal(res.body, 'SkullBoy: 3184 ELO · Level 10');
  assert.equal(await handleChatCommand({ url: '/api/faceit/v4/players', method: 'GET', headers: {}, socket: {} }, response(), { read }), false);
});

test('the proxy allows the player search, always for CS2', () => {
  const target = faceitTarget('/api/faceit/v4/search/players?nickname=SkullBoy&limit=20&game=csgo');
  assert.equal(target.upstream, 'https://open.faceit.com/data/v4/search/players?nickname=skullboy&game=cs2&offset=0&limit=20');
  assert.equal(faceitTarget('/api/faceit/v4/search/players?nickname=%3Cx%3E'), null);
});

const NOW = Date.parse('2026-11-02T22:30:00Z');
const full = (result, map, score, kills, deaths, extra = {}) => ({
  stats: {
    Result: result,
    Map: map,
    Score: score,
    Kills: String(kills),
    Deaths: String(deaths),
    Assists: '4',
    ADR: '91.6',
    'Headshots %': '48',
    'K/R Ratio': '0.9',
    'Match Finished At': NOW - 25 * 60_000,
    ...extra,
  },
});

test('!last describes the newest match: map, result, score, K-D-A, K/D, ADR, HS and when', async () => {
  const { read } = fakeRead({ items: [full('0', 'de_mirage', '9 / 13', 24, 15), full('1', 'de_nuke', '13 / 5', 10, 10)] });
  const reply = await chatReply({ nick: 'SkullBoy', lang: 'pl', kind: 'last', cmd: 'last' }, read, NOW);
  assert.equal(reply, 'SkullBoy · Ostatni mecz: Mirage · L 9:13 · 24-15-4 · K/D 1.60 · ADR 92 · HS 48% · 25 min temu');
});

test('!kd gives the K/D of twenty matches and of the last one', async () => {
  const items = [full('1', 'de_inferno', '13 / 7', 30, 10), ...Array.from({ length: 24 }, () => full('0', 'de_nuke', '5 / 13', 10, 10))];
  const { read } = fakeRead({ items });
  assert.equal(await chatReply({ nick: 'SkullBoy', lang: 'en', kind: 'kd' }, read, NOW), 'SkullBoy: K/D 1.10 (20 matches) · last match 3.00');
});

test('!avg gives per-match averages over twenty matches', async () => {
  const items = [full('1', 'de_inferno', '13 / 7', 20, 10), full('0', 'de_nuke', '5 / 13', 10, 10)];
  const { read } = fakeRead({ items });
  assert.equal(
    await chatReply({ nick: 'SkullBoy', lang: 'en', kind: 'avg' }, read, NOW),
    'SkullBoy · average of 2 matches: K/D 1.50 · K/R 0.90 · ADR 91.6 · HS 48% · 15.0 kills · 50% wins'
  );
});

test('a player without matches gets one sentence from !last, !kd and !avg', async () => {
  const { read } = fakeRead({ items: [] });
  for (const kind of ['last', 'kd', 'avg']) {
    assert.equal(await chatReply({ nick: 'SkullBoy', lang: 'en', kind }, read, NOW), 'SkullBoy has no CS2 matches on FACEIT yet.');
  }
});

/** The popup's reads: the active lookup, the match, and the ten profiles behind the team averages. */
function liveRead({ status = 'ONGOING', active = true, mineOnRight = false } = {}) {
  const base = fakeRead();
  const friends = ['33333333-3333-3333-3333-333333333331', '33333333-3333-3333-3333-333333333332'];
  const rivals = ['44444444-4444-4444-4444-444444444441', '44444444-4444-4444-4444-444444444442'];
  const roster = (ids) => ({ roster: ids.map((player_id) => ({ player_id })) });
  const own = roster([id, ...friends]);
  const other = roster(rivals);
  const read = async (path) => {
    if (path.endsWith('/active')) return ok(active ? { match_id: '1-abc-match', status } : {});
    if (path === '/matches/1-abc-match') {
      return ok({
        status,
        voting: { map: { pick: ['de_ancient'] } },
        results: { score: { faction1: 8, faction2: 5 } },
        teams: mineOnRight ? { faction1: other, faction2: own } : { faction1: own, faction2: other },
      });
    }
    if (friends.some((f) => path === `/players/${f}`)) return ok({ games: { cs2: { faceit_elo: 3000 } } });
    if (rivals.some((r) => path === `/players/${r}`)) return ok({ games: { cs2: { faceit_elo: 2800 } } });
    return base.read(path);
  };
  return read;
}

test('!live shows the running match the way the popup reads it, with the streamer team first', async () => {
  assert.equal(
    await chatReply({ nick: 'SkullBoy', lang: 'en', kind: 'live' }, liveRead()),
    'SkullBoy is playing now · Ancient · 8:5 · avg ELO 3061 vs 2800 · faceit.com/en/cs2/room/1-abc-match'
  );
  assert.equal(
    await chatReply({ nick: 'SkullBoy', lang: 'en', kind: 'live' }, liveRead({ mineOnRight: true })),
    'SkullBoy is playing now · Ancient · 5:8 · avg ELO 3061 vs 2800 · faceit.com/en/cs2/room/1-abc-match'
  );
});

test('!live tells a lobby from a match, and says when there is neither', async () => {
  assert.match(await chatReply({ nick: 'SkullBoy', lang: 'pl', kind: 'live' }, liveRead({ status: 'VOTING' })), /^SkullBoy jest w lobby meczu · Ancient/);
  assert.equal(await chatReply({ nick: 'SkullBoy', lang: 'pl', kind: 'live' }, liveRead({ active: false })), 'SkullBoy nie gra teraz meczu.');
});

test('map names lose the de_ prefix, and averages of nothing are nothing', () => {
  assert.equal(mapName('de_mirage'), 'Mirage');
  assert.equal(mapName(''), '');
  assert.equal(recentAverages([]), null);
});

const KINDS = ['elo', 'last', 'kd', 'avg', 'live'];
const DAY = new Date('2026-11-03T20:00:00Z');

/** A Redis double: hashes, the bump-if-present script, and multi with hset/expire. */
function fakeRedis() {
  const hashes = new Map();
  const client = {
    hashes,
    eval: async (_script, count, ...rest) => {
      const keys = rest.slice(0, count);
      const kind = rest[count];
      for (const key of keys) {
        const bag = hashes.get(key);
        if (bag) bag[kind] = String(Number(bag[kind] ?? 0) + 1);
      }
      return 1;
    },
    hgetall: async (key) => ({ ...(hashes.get(key) ?? {}) }),
    multi() {
      const ops = [];
      const batch = {
        hset: (key, values) => (ops.push(() => hashes.set(key, Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)])))), batch),
        expire: () => batch,
        exec: async () => ops.forEach((op) => op()),
      };
      return batch;
    },
  };
  let up = true;
  return { client, call: async (run) => (up ? run(client) : undefined), down: () => (up = false) };
}

/** A Postgres double holding chat_command_counts rows, answering the few statements the counters send. */
function fakePostgres() {
  const rows = new Map();
  let up = true;
  let writes = 0;
  const sum = (filter) => {
    const out = new Map();
    for (const [key, n] of rows) {
      const [owner, day, kind] = key.split('|');
      if (filter(owner, day)) out.set(kind, (out.get(kind) ?? 0) + n);
    }
    return [...out].map(([kind, n]) => ({ kind, n: String(n) }));
  };
  const pool = {
    query: async (sql, params = []) => {
      if (sql.startsWith('INSERT')) {
        writes += 1;
        const [owners, days, kinds, counts] = params;
        owners.forEach((owner, index) => {
          const key = `${owner}|${days[index]}|${kinds[index]}`;
          rows.set(key, (rows.get(key) ?? 0) + counts[index]);
        });
        return { rows: [] };
      }
      if (sql.includes('AND day')) return { rows: sum((owner, day) => owner === params[0] && day === params[1]) };
      if (sql.includes('WHERE owner')) return { rows: sum((owner) => owner === params[0]) };
      return { rows: sum(() => true) };
    },
  };
  return {
    rows,
    get writes() {
      return writes;
    },
    call: async (run) => (up ? run(pool) : undefined),
    down: () => (up = false),
    upAgain: () => (up = true),
  };
}

/** Timers the test fires by hand. */
function manualTimers() {
  const waiting = [];
  return { set: (run) => (waiting.push(run), { unref() {} }), fire: () => waiting.splice(0).forEach((run) => run()) };
}

test('calls wait in memory and reach Postgres in one write per flush', async () => {
  const redis = fakeRedis();
  const pg = fakePostgres();
  const timers = manualTimers();
  const stats = createChatStats({ kinds: KINDS, redis: redis.call, postgres: pg.call, now: () => DAY, setTimer: timers.set });
  await stats.record('elo', 'skullboy');
  await stats.record('elo', 'skullboy');
  await stats.record('live', 'skullboy');
  await stats.record('elo', 'someone');
  await stats.record('elo', '');
  await stats.record('bogus', 'skullboy');
  assert.equal(pg.writes, 0);
  timers.fire();
  await stats.flush();
  assert.equal(pg.writes, 1);
  assert.equal(pg.rows.get('skullboy|2026-11-03|elo'), 2);
  assert.equal(pg.rows.get('|2026-11-03|elo'), 1);
  const read = await stats.read('skullboy');
  assert.deepEqual(read.total, { elo: 4, last: 0, kd: 0, avg: 0, live: 1 });
  assert.deepEqual(read.mine, { elo: 2, last: 0, kd: 0, avg: 0, live: 1 });
  assert.deepEqual(read.today, { elo: 2, last: 0, kd: 0, avg: 0, live: 1 });
  assert.equal(chatDay(new Date('2026-11-03T23:59:00Z')), '2026-11-03');
});

test('Redis caches the sums: a missing key is rebuilt from Postgres plus the calls still waiting, then bumped live', async () => {
  const redis = fakeRedis();
  const pg = fakePostgres();
  pg.rows.set('skullboy|2026-11-01|elo', 40);
  const stats = createChatStats({ kinds: KINDS, redis: redis.call, postgres: pg.call, now: () => DAY, setTimer: () => null });
  await stats.record('elo', 'skullboy');
  /* Not in Postgres yet, and no cache: the read counts the waiting call too */
  assert.equal((await stats.read('skullboy')).mine.elo, 41);
  assert.equal(redis.client.hashes.get('fb:chatcmd2:owner:skullboy').elo, '41');
  /* With the key warm, a new call bumps the cache without asking Postgres */
  await stats.record('elo', 'skullboy');
  assert.equal(redis.client.hashes.get('fb:chatcmd2:owner:skullboy').elo, '42');
  assert.equal((await stats.read('skullboy')).mine.elo, 42);
  /* A call does not create a key: an evicted cache cannot come back as a lone "1" */
  redis.client.hashes.clear();
  await stats.record('kd', 'skullboy');
  assert.equal(redis.client.hashes.size, 0);
  assert.equal((await stats.read('skullboy')).mine.kd, 1);
});

test('a failed write keeps the calls for the next one', async () => {
  const pg = fakePostgres();
  const stats = createChatStats({ kinds: KINDS, redis: async () => undefined, postgres: pg.call, now: () => DAY, setTimer: () => null });
  await stats.record('avg', 'skullboy');
  pg.down();
  await stats.flush();
  assert.equal(pg.rows.size, 0);
  pg.upAgain();
  await stats.record('avg', 'skullboy');
  await stats.flush();
  assert.equal(pg.rows.get('skullboy|2026-11-03|avg'), 2);
});

test('with Redis and Postgres both down the counters live in memory', async () => {
  const stats = createChatStats({ kinds: KINDS, redis: async () => undefined, postgres: async () => undefined, setTimer: () => null });
  await stats.record('kd', 'skullboy');
  const read = await stats.read('skullboy');
  assert.equal(read.mine.kd, 1);
  assert.equal(read.total.kd, 1);
  assert.deepEqual((await stats.read('')).mine, { elo: 0, last: 0, kd: 0, avg: 0, live: 0 });
});

test('the endpoint counts bot calls, skips the studio preview and serves the numbers as JSON', async () => {
  const { read } = fakeRead();
  const stats = createChatStats({ kinds: KINDS, redis: async () => undefined, postgres: async () => undefined, setTimer: () => null });
  const response = () => {
    const res = { headers: {}, statusCode: 0, body: '', setHeader: (name, value) => (res.headers[name.toLowerCase()] = value), end: (body) => (res.body = body) };
    return res;
  };
  const call = (url) => handleChatCommand({ url, method: 'GET', headers: {}, socket: {} }, response(), { unlimitedRate: true, read, stats });
  await call('/api/faceit/elo?default=SkullBoy&nick=');
  await call('/api/faceit/elo?type=kd&default=SkullBoy&nick=other');
  await call('/api/faceit/elo?default=SkullBoy&preview=1&nick=');
  await new Promise((resolve) => setImmediate(resolve));
  const res = response();
  assert.equal(await handleChatCommand({ url: '/api/faceit/elo/stats?nick=@SkullBoy', method: 'GET', headers: {}, socket: {} }, res, { unlimitedRate: true, stats }), true);
  assert.match(res.headers['content-type'], /^application\/json/);
  const body = JSON.parse(res.body);
  assert.equal(body.owner, 'skullboy');
  assert.equal(body.mine.elo, 1);
  assert.equal(body.mine.kd, 1);
  assert.equal(body.total.elo, 1);
});
