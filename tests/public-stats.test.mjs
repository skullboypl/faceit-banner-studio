import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allowedOrigin, handlePublicStats, publicSummary, summarize } from '../server/public-stats.mjs';

const id = '11111111-1111-4111-8111-111111111111';
const ok = (body) => ({ status: 200, body: JSON.stringify(body) });
const fakeLoad = (calls = []) => async (path) => {
  calls.push(path);
  if (path.startsWith('/players?nickname=')) return path.includes('Donk') ? ok({ player_id: id, nickname: 'Donk', games: { cs2: { skill_level: 10, faceit_elo: 3200 } } }) : { status: 404, body: '{}' };
  if (path === `/players/${id}`) return ok({ player_id: id, nickname: 'Donk', country: 'ru', games: { cs2: { skill_level: 10, faceit_elo: 3200 } } });
  if (path.startsWith(`/players/${id}/games/cs2/stats`)) {
    return ok({ items: [
      { stats: { Kills: '30', Deaths: '15', 'Headshots %': '50', ADR: '100', Result: '1' } },
      { stats: { Kills: '10', Deaths: '20', 'Headshots %': '30', ADR: '60', Result: '0' } },
    ] });
  }
  if (path === `/players/${id}/stats/cs2`) return ok({ lifetime: { Matches: '1200', 'Win Rate %': '58', 'Average K/D Ratio': '1.4', 'Current Win Streak': '3' } });
  return { status: 404, body: '{}' };
};

const fakeRes = () => {
  const res = { headers: {}, statusCode: 0, body: '' };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.end = (b) => { res.body = b; };
  return res;
};

test('summarize averages the newest matches like the banner does', () => {
  const s = summarize([
    { stats: { Kills: '30', Deaths: '15', 'Headshots %': '50', ADR: '100', Result: '1' } },
    { stats: { Kills: '10', Deaths: '20', 'Headshots %': '30', ADR: '60', Result: '0' } },
  ], 20);
  assert.equal(s.matches, 2);
  assert.equal(s.kd, 1.14);
  assert.equal(s.winRate, 50);
  assert.equal(s.hs, 40);
  assert.equal(s.adr, 80);
  assert.deepEqual(s.form, ['W', 'L']);
  assert.equal(s.streak, 1);
});

test('publicSummary resolves a nickname and merges profile, recent and lifetime stats', async () => {
  const out = await publicSummary('Donk', 20, fakeLoad());
  assert.equal(out.status, 200);
  assert.equal(out.body.elo, 3200);
  assert.equal(out.body.level, 10);
  assert.equal(out.body.recent.kd, 1.14);
  assert.equal(out.body.lifetime.matches, 1200);
  assert.equal((await publicSummary('nobody', 20, fakeLoad())).status, 404);
});

test('only overlays.vxh.pl and localhost get CORS', () => {
  assert.equal(allowedOrigin('https://overlays.vxh.pl'), 'https://overlays.vxh.pl');
  assert.equal(allowedOrigin('http://localhost:5188'), 'http://localhost:5188');
  assert.equal(allowedOrigin('https://evil.example'), '');
  assert.equal(allowedOrigin(undefined), '');
});

test('handler validates input, answers with CORS and reuses the composed answer', async () => {
  const calls = [];
  const load = fakeLoad(calls);
  const req = (url, origin = 'https://overlays.vxh.pl') => ({ url, method: 'GET', headers: { origin }, socket: {} });

  const bad = fakeRes();
  assert.equal(await handlePublicStats(req('/api/faceit/public/<x>'), bad, { unlimitedRate: true, load }), true);
  assert.equal(bad.statusCode, 400);

  assert.equal(await handlePublicStats(req('/api/faceit/v4/players'), fakeRes(), { load }), false);

  let clock = 1_000;
  const first = fakeRes();
  await handlePublicStats(req(`/api/faceit/public/${id}?matches=10`), first, { unlimitedRate: true, load, now: () => clock });
  assert.equal(first.statusCode, 200);
  assert.equal(first.headers['access-control-allow-origin'], 'https://overlays.vxh.pl');
  assert.equal(JSON.parse(first.body).nickname, 'Donk');
  const used = calls.length;
  clock += 5_000;
  await handlePublicStats(req(`/api/faceit/public/${id}?matches=10`, 'https://evil.example'), fakeRes(), { unlimitedRate: true, load, now: () => clock });
  assert.equal(calls.length, used, 'second read inside 20 s comes from the composed cache');
});
