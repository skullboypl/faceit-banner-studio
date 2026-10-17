import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const ID = '11111111-1111-4111-8111-111111111111';
const MINUTE = 60_000;

type World = { head: string; elo: number; failFull: boolean; calls: string[] };

/** A fake FACEIT behind our server that counts every request by kind. */
function stubWorld(): World {
  const world: World = { head: 'match-1', elo: 2000, failFull: false, calls: [] };
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const path = String(input).replace('/api/faceit/v4', '');
      const kind = path.includes('/history') ? 'history' : path.includes('/games/cs2/stats') ? 'stats' : path.includes('/stats/cs2') ? 'lifetime' : path.includes('/rankings/') ? 'ranking' : 'profile';
      world.calls.push(kind);
      const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
      if (kind === 'history') return json({ items: [{ match_id: world.head }] });
      if (world.failFull) return json({}, 500);
      if (kind === 'stats') {
        return json({
          items: [
            { stats: { 'Match Finished At': Date.now() - 10 * MINUTE, Kills: '20', Deaths: '10', Assists: '2', MVPs: '1', ADR: '80', 'K/D Ratio': '2.0', 'K/R Ratio': '0.8', 'Headshots %': '40', Result: '1', 'Competition Id': 'x' } },
          ],
        });
      }
      if (kind === 'lifetime') return json({ lifetime: {} });
      if (kind === 'ranking') return json({ position: 0, items: [] });
      return json({ player_id: ID, nickname: 'tester', country: 'pl', games: { cs2: { faceit_elo: world.elo, skill_level: 9, region: 'EU' } } });
    })
  );
  return world;
}

const full = (world: World) => world.calls.filter((kind) => kind !== 'history').length;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-17T12:00:00Z'));
  localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const load = async () => (await import('../widget/src/utils/faceit_util')).getPlayerStats;
/** The session start is fixed for the whole session, like the one the widget keeps in localStorage. */
const SESSION = new Date('2026-10-17T10:00:00Z');
const start = () => SESSION;

describe('getPlayerStats keeps what does not change, and checks with one request whether anything did', () => {
  test('the second refresh with no new match costs one request, and gives the same player', async () => {
    const world = stubWorld();
    const getPlayerStats = await load();
    const first = await getPlayerStats(ID, 30, start(), false);
    const fullAfterFirst = full(world);
    expect(fullAfterFirst).toBeGreaterThanOrEqual(3);
    world.calls.length = 0;
    vi.setSystemTime(Date.now() + MINUTE);
    const second = await getPlayerStats(ID, 30, start(), false);
    expect(world.calls).toEqual(['history']);
    expect(second).toEqual(first);
  });

  test('a new match refreshes everything at once, and the next minute still checks in full while ELO settles', async () => {
    const world = stubWorld();
    const getPlayerStats = await load();
    await getPlayerStats(ID, 30, start(), false);
    world.calls.length = 0;
    vi.setSystemTime(Date.now() + MINUTE);
    world.head = 'match-2';
    world.elo = 2025;
    const after = await getPlayerStats(ID, 30, start(), false);
    expect(after?.elo).toBe(2025);
    expect(full(world)).toBeGreaterThanOrEqual(3);
    world.calls.length = 0;
    vi.setSystemTime(Date.now() + MINUTE);
    world.elo = 2027;
    expect((await getPlayerStats(ID, 30, start(), false))?.elo).toBe(2027);
    world.calls.length = 0;
    vi.setSystemTime(Date.now() + 3 * MINUTE);
    await getPlayerStats(ID, 30, start(), false);
    expect(world.calls).toEqual(['history']);
  });

  test('nothing is kept longer than ten minutes', async () => {
    const world = stubWorld();
    const getPlayerStats = await load();
    await getPlayerStats(ID, 30, start(), false);
    world.calls.length = 0;
    vi.setSystemTime(Date.now() + 11 * MINUTE);
    await getPlayerStats(ID, 30, start(), false);
    expect(full(world)).toBeGreaterThanOrEqual(3);
  });

  test('another match window, or only official matches, is another reading', async () => {
    const world = stubWorld();
    const getPlayerStats = await load();
    await getPlayerStats(ID, 30, start(), false);
    world.calls.length = 0;
    await getPlayerStats(ID, 20, start(), false);
    expect(full(world)).toBeGreaterThanOrEqual(3);
    world.calls.length = 0;
    await getPlayerStats(ID, 30, start(), true);
    expect(full(world)).toBeGreaterThanOrEqual(3);
  });

  test('when the full read fails after a new match, the last known player is shown instead of nothing', async () => {
    const world = stubWorld();
    const getPlayerStats = await load();
    const first = await getPlayerStats(ID, 30, start(), false);
    vi.setSystemTime(Date.now() + MINUTE);
    world.head = 'match-2';
    world.failFull = true;
    const during = await getPlayerStats(ID, 30, start(), false);
    expect(during).toEqual(first);
  });

  test('a reloaded OBS source reuses what the last page kept, so a scene switch does not read everything again', async () => {
    const world = stubWorld();
    const first = await (await load())(ID, 30, start(), false);
    expect(localStorage.length).toBeGreaterThan(0);
    vi.resetModules();
    world.calls.length = 0;
    vi.setSystemTime(Date.now() + 2 * MINUTE);
    const again = await (await load())(ID, 30, start(), false);
    expect(world.calls).toEqual(['history']);
    expect(again).toEqual(first);
  });
});

describe('lookupRosterCard keeps a roster row the same way', () => {
  test('a row with no new match for its player costs one request', async () => {
    const world = stubWorld();
    const { lookupRosterCard } = await import('../widget/src/utils/faceit_util');
    const first = await lookupRosterCard('tester', 30, start().getTime());
    expect(first.missing).toBeUndefined();
    world.calls.length = 0;
    vi.setSystemTime(Date.now() + MINUTE);
    const second = await lookupRosterCard('tester', 30, start().getTime());
    expect(world.calls).toEqual(['history']);
    expect(second).toEqual(first);
  });

  test('a new match refreshes the row', async () => {
    const world = stubWorld();
    const { lookupRosterCard } = await import('../widget/src/utils/faceit_util');
    await lookupRosterCard('tester', 30, start().getTime());
    vi.setSystemTime(Date.now() + MINUTE);
    world.head = 'match-2';
    world.elo = 2050;
    expect((await lookupRosterCard('tester', 30, start().getTime())).elo).toBe(2050);
  });
});
