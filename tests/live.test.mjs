import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { playerIdFromReferer, publicRanking, sanitizeInfo } from '../server/live.mjs';
import { ACTIVE_WINDOW_MS, createPresenceMiddleware } from '../server/presence.mjs';

process.env.LIVE_BOARD_TTL_MS = '0';

test('a banner that only reports after a win stays on the live list for an hour', () => {
  assert.equal(ACTIVE_WINDOW_MS, 60 * 60_000);
});

test('sanitizeInfo ignores a sign-in mark sent by the widget', () => {
  const info = sanitizeInfo({ nickname: 'player', confirmed: true, guid: '11111111-1111-1111-1111-111111111111' });
  assert.equal(info.nickname, 'player');
  assert.equal('confirmed' in info, false);
  assert.equal('guid' in info, false);
});

test('sanitizeInfo keeps a valid banner and drops a bad elo, level and player id', () => {
  const info = sanitizeInfo({
    nickname: '  donk666  ',
    playerId: 'not-a-uuid',
    elo: 99999,
    level: 11,
    country: 'PL',
    style: 'orbit',
  });
  assert.deepEqual(info, { nickname: 'donk666', country: 'pl', style: 'orbit' });
});

test('sanitizeInfo keeps a player id when the old banner has not sent a nickname yet', () => {
  const id = '10B53A6D-5FC9-4095-920C-2953CFA62486';
  assert.deepEqual(sanitizeInfo({ playerId: id, elo: 2100 }), {
    playerId: id.toLowerCase(),
    elo: 2100,
  });
  assert.equal(sanitizeInfo({ playerId: 'not-a-player' }), null);
});

test('sanitizeInfo keeps a calibration mark and ignores any other value', () => {
  assert.equal(sanitizeInfo({ nickname: 'SpavaQu', elo: 3737, calibrating: true }).calibrating, true);
  assert.equal('level' in sanitizeInfo({ nickname: 'SpavaQu', elo: 3737, calibrating: true, level: 10 }), false);
  assert.equal('calibrating' in sanitizeInfo({ nickname: 'ranked', elo: 2000, calibrating: 'yes' }), false);
});

test('sanitizeInfo strips control characters and refuses a nickname that is only markup', () => {
  assert.equal(sanitizeInfo({ nickname: 'a\u0000b<script>' })?.nickname, 'abscript');
  assert.equal(sanitizeInfo({ nickname: '<' }), null);
  assert.equal(sanitizeInfo(null), null);
});

test('publicRanking sorts by elo descending, puts a missing elo last and keeps one row per player', () => {
  const rows = publicRanking([
    { info: { nickname: 'low', elo: 1200, playerId: '11111111-1111-1111-1111-111111111111' }, lastSeen: 2 },
    { info: { nickname: 'low-old', elo: 9000, playerId: '11111111-1111-1111-1111-111111111111' }, lastSeen: 1 },
    { info: { nickname: 'top', elo: 3500 }, lastSeen: 3 },
    { info: { nickname: 'bare' }, lastSeen: 4 },
    { info: null, lastSeen: 5 },
  ]);
  assert.deepEqual(rows.map((row) => row.nickname), ['top', 'low', 'bare']);
  assert.equal('playerId' in rows[1], false);
  assert.equal('confirmed' in rows[1], false);
});

test('publicRanking serves avatars from this site and keeps only a challenger place', () => {
  const id = '11111111-1111-1111-1111-111111111111';
  const [row] = publicRanking([
    {
      info: {
        nickname: 'ayan',
        elo: 3900,
        playerId: id,
        region: 'EU',
        avatar: 'https://assets.faceit-cdn.net/avatars/ayan.jpg',
        ranking: 42,
      },
      lastSeen: 1,
    },
  ]);
  assert.equal(row.avatar, `/api/presence/avatar/${id}`);
  assert.equal(row.ranking, 42);
  assert.equal('region' in row, false);
  assert.equal('playerId' in row, false);
  const [plain] = publicRanking([
    { info: { nickname: 'mid', elo: 2500, ranking: 4000, region: 'EU' }, lastSeen: 1 },
  ]);
  assert.equal('ranking' in plain, false);
});

test('publicRanking keeps a sign-in mark and drops the account id', () => {
  const id = '11111111-1111-1111-1111-111111111111';
  const [row] = publicRanking([
    { info: { nickname: 'signed', elo: 2000, playerId: id, confirmed: true }, lastSeen: 1 },
  ]);
  assert.equal(row.confirmed, true);
  assert.equal('playerId' in row, false);
  const [forged] = publicRanking([
    { info: { nickname: 'forged', elo: 2000, confirmed: 'yes' }, lastSeen: 1 },
  ]);
  assert.equal('confirmed' in forged, false);
});

async function serve(middleware) {
  const server = createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

test('playerIdFromReferer reads only a FACEIT id from the banner address', () => {
  const id = '10b53a6d-5fc9-4095-920c-2953cfa62486';
  assert.equal(playerIdFromReferer(`https://faceitbanner.vxh.pl/widget/?style=prime&player_id=${id}`), id);
  assert.equal(playerIdFromReferer('https://faceitbanner.vxh.pl/widget/?player_id=not-a-player'), '');
  assert.equal(playerIdFromReferer(''), '');
});

test('the live board is public, ordered, and hides the session id', async () => {
  const { base, close } = await serve(createPresenceMiddleware({ unlimitedRate: true }));
  const beat = (id, info) =>
    fetch(`${base}/api/presence`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
      body: JSON.stringify({ id, info }),
    });
  try {
    assert.equal((await beat('abcdefghijklmnop01', { nickname: 'alpha', elo: 1000, playerId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' })).status, 200);
    assert.equal((await beat('abcdefghijklmnop02', { nickname: 'zeta', elo: 2400 })).status, 200);
    assert.equal((await beat('abcdefghijklmnop03', { nickname: '<script>alert(1)</script>', elo: 5000 })).status, 200);
    const board = await (await fetch(`${base}/api/presence/live`, { headers: { 'x-forwarded-for': '203.0.113.11' } })).json();
    assert.deepEqual(board.players.map((player) => [player.nickname, player.elo]), [
      ['scriptalert(1)/script', 5000],
      ['zeta', 2400],
      ['alpha', 1000],
    ]);
    assert.equal(board.players.some((player) => 'id' in player || 'playerId' in player), false);
    assert.equal(board.ranked, 3);
    assert.equal(board.online >= 3, true);
    delete process.env.FACEIT_API_KEY;
    delete process.env.VITE_FACEIT_API_KEY;
    assert.equal((await beat('abcdefghijklmnop04', { playerId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' })).status, 200);
    const idOnly = await (await fetch(`${base}/api/presence/live`, { headers: { 'x-forwarded-for': '203.0.113.12' } })).json();
    assert.equal(idOnly.players.some((player) => player.nickname === 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), false);
    assert.equal(idOnly.online >= 4, true);

    const playerId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const original = globalThis.fetch;
    process.env.FACEIT_API_KEY = 'test-key';
    globalThis.fetch = async (url, options) => {
      if (String(url).includes('/api/users/')) return new Response('{}', { status: 404 });
      if (String(url).includes('open.faceit.com')) {
        return new Response(
          JSON.stringify({
            nickname: 'OldBanner',
            player_id: playerId,
            country: 'pl',
            games: { cs2: { faceit_elo: 1500, skill_level: 7 } },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return original(url, options);
    };
    try {
      const posted = await fetch(`${base}/api/presence`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.40',
          referer: `https://faceitbanner.vxh.pl/widget/?player_id=${playerId}`,
        },
        body: JSON.stringify({ id: 'oldbannerheartbeat01' }),
      });
      assert.equal(posted.status, 200);
      const named = await (await fetch(`${base}/api/presence/live`, { headers: { 'x-forwarded-for': '203.0.113.41' } })).json();
      assert.deepEqual(
        named.players.find((player) => player.nickname === 'OldBanner'),
        { nickname: 'OldBanner', elo: 1500, level: 7, country: 'pl', verifiedBadge: 'none' }
      );
    } finally {
      globalThis.fetch = original;
      delete process.env.FACEIT_API_KEY;
    }

    process.env.LIVE_BOARD_TTL_MS = '250';
    const before = await (await fetch(`${base}/api/presence/live`, { headers: { 'x-forwarded-for': '203.0.113.50' } })).json();
    assert.equal((await beat('latearrivalheart01', { nickname: 'LateArrival', elo: 10 })).status, 200);
    const during = await (await fetch(`${base}/api/presence/live`, { headers: { 'x-forwarded-for': '203.0.113.51' } })).json();
    const duringCount = await (await fetch(`${base}/api/presence`, { headers: { 'x-forwarded-for': '203.0.113.52' } })).json();
    assert.equal(during.players.some((player) => player.nickname === 'LateArrival'), false);
    assert.equal(during.online, before.online);
    assert.equal(duringCount.online, before.online);
    assert.match(duringCount.windowSeconds.toString(), /^\d+$/);
    await new Promise((resolve) => setTimeout(resolve, 320));
    const after = await (await fetch(`${base}/api/presence/live`, { headers: { 'x-forwarded-for': '203.0.113.53' } })).json();
    assert.equal(after.players.some((player) => player.nickname === 'LateArrival'), true);
    assert.equal(after.online >= before.online + 1, true);
    process.env.LIVE_BOARD_TTL_MS = '0';
  } finally {
    process.env.LIVE_BOARD_TTL_MS = '0';
    await close();
  }
});

test('publicRanking passes a known membership tier on and drops anything else', () => {
  const rows = publicRanking([
    { info: { nickname: 'Pro', playerId: '11111111-1111-1111-1111-111111111111', membership: 'premium', esea: true }, lastSeen: 2 },
    { info: { nickname: 'Odd', playerId: '22222222-2222-2222-2222-222222222222', membership: 'gold', esea: 'yes' }, lastSeen: 1 },
  ]);
  const byName = Object.fromEntries(rows.map((row) => [row.nickname, row]));
  assert.equal(byName.Pro.membership, 'premium');
  assert.equal(byName.Pro.esea, true);
  assert.equal('membership' in byName.Odd, false);
  assert.equal('esea' in byName.Odd, false);
});

test('publicRanking keeps the token flag and a valid Twitch name, and drops the rest', () => {
  const rows = publicRanking([
    { info: { nickname: 'Linked', playerId: '11111111-1111-1111-1111-111111111111', token: true, twitch: 'SkullBoyPL' }, lastSeen: 2 },
    { info: { nickname: 'Odd', playerId: '22222222-2222-2222-2222-222222222222', token: 'yes', twitch: 'a b/c' }, lastSeen: 1 },
  ]);
  const byName = Object.fromEntries(rows.map((row) => [row.nickname, row]));
  assert.equal(byName.Linked.token, true);
  assert.equal(byName.Linked.twitch, 'SkullBoyPL');
  assert.equal('token' in byName.Odd, false);
  assert.equal('twitch' in byName.Odd, false);
});
