import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const PLAYER = '11111111-1111-4111-8111-111111111111';
const SECOND = 1000;
const roster = (names: string[]) => ({ roster: names.map((nickname, index) => ({ player_id: nickname === 'a1' ? PLAYER : `p-${nickname}-${index}`, nickname, game_skill_level: 7 })) });

type World = {
  active?: { match_id: string; status: string };
  head?: string;
  /** whether FACEIT has the finished match's statistics yet */
  statsReady: boolean;
  calls: string[];
};

/** A fake FACEIT behind our server. Counts what a popup asks for. */
function stubWorld(): World {
  const world: World = { head: 'finished-1', statsReady: true, calls: [] };
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const path = String(input).replace('/api/faceit/v4', '');
      const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
      if (path.endsWith('/active')) {
        world.calls.push('active');
        return json(world.active ?? {});
      }
      if (path.includes('/history')) {
        world.calls.push('history');
        return json({ items: world.head ? [{ match_id: world.head }] : [] });
      }
      const stats = path.match(/^\/matches\/([^/]+)\/stats/);
      if (stats) {
        world.calls.push('stats');
        return world.statsReady
          ? json({ rounds: [{ teams: [{ players: [{ player_id: PLAYER, player_stats: { Kills: '20', Deaths: '10', Assists: '1', ADR: '80', 'Headshots %': '40', MVPs: '2' } }] }] }] })
          : json({}, 404);
      }
      const match = path.match(/^\/matches\/([^/]+)$/);
      if (match) {
        world.calls.push('match');
        const live = world.active?.match_id === match[1];
        return json({
          status: live ? world.active!.status : 'FINISHED',
          teams: { faction1: roster(['a1']), faction2: roster(['b1']) },
          results: { winner: 'faction1', score: { faction1: 13, faction2: 9 } },
          finished_at: Math.floor(Date.now() / 1000),
        });
      }
      world.calls.push('profile');
      return json({}, 404);
    })
  );
  return world;
}

const count = (world: World, kind: string) => world.calls.filter((call) => call === kind).length;
const load = async () => (await import('../widget/src/utils/faceit_match')).fetchLatestMatch;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-17T12:00:00Z'));
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the popup asks FACEIT only for what can have changed', () => {
  test('an idle player: the finished match is read once, and the history only about once a minute', async () => {
    const world = stubWorld();
    const fetchLatestMatch = await load();
    for (let poll = 0; poll < 6; poll++) {
      const match = await fetchLatestMatch(PLAYER);
      expect(match?.phase).toBe('post');
      vi.setSystemTime(Date.now() + 20 * SECOND);
    }
    expect(count(world, 'match')).toBe(1);
    expect(count(world, 'stats')).toBe(1);
    expect(count(world, 'history')).toBeLessThanOrEqual(3);
    expect(count(world, 'active')).toBe(6);
  });

  test('a lobby or running match is read once per state, not on every poll', async () => {
    const world = stubWorld();
    world.active = { match_id: 'live-1', status: 'VOTING' };
    const fetchLatestMatch = await load();
    for (let poll = 0; poll < 4; poll++) {
      expect((await fetchLatestMatch(PLAYER))?.phase).toBe('pre');
      vi.setSystemTime(Date.now() + 20 * SECOND);
    }
    expect(count(world, 'match')).toBe(1);
    expect(count(world, 'history')).toBe(0);
    world.active = { match_id: 'live-1', status: 'ONGOING' };
    expect((await fetchLatestMatch(PLAYER))?.phase).toBe('live');
    expect(count(world, 'match')).toBe(2);
    expect((await fetchLatestMatch(PLAYER))?.phase).toBe('live');
    expect(count(world, 'match')).toBe(2);
  });

  test('the moment a match ends the result is looked up at once, without waiting for the idle pause', async () => {
    const world = stubWorld();
    world.active = { match_id: 'live-2', status: 'ONGOING' };
    const fetchLatestMatch = await load();
    await fetchLatestMatch(PLAYER);
    vi.setSystemTime(Date.now() + 20 * SECOND);
    world.active = undefined;
    world.head = 'live-2';
    const after = await fetchLatestMatch(PLAYER);
    expect(after?.id).toBe('live-2');
    expect(after?.phase).toBe('post');
    expect(after?.me?.kills).toBe(20);
  });

  test('a result without statistics yet is asked again on the next poll until they arrive, then kept', async () => {
    const world = stubWorld();
    world.statsReady = false;
    const fetchLatestMatch = await load();
    expect((await fetchLatestMatch(PLAYER))?.me).toBeUndefined();
    vi.setSystemTime(Date.now() + 20 * SECOND);
    world.statsReady = true;
    expect((await fetchLatestMatch(PLAYER))?.me?.kills).toBe(20);
    const statsAsked = count(world, 'stats');
    vi.setSystemTime(Date.now() + 20 * SECOND);
    expect((await fetchLatestMatch(PLAYER))?.me?.kills).toBe(20);
    expect(count(world, 'stats')).toBe(statsAsked);
  });

  test('a new finished match is picked up when the history shows it', async () => {
    const world = stubWorld();
    const fetchLatestMatch = await load();
    expect((await fetchLatestMatch(PLAYER))?.id).toBe('finished-1');
    world.head = 'finished-2';
    vi.setSystemTime(Date.now() + 70 * SECOND);
    expect((await fetchLatestMatch(PLAYER))?.id).toBe('finished-2');
  });
});
