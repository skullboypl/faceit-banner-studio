import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchLatestMatch } from '../widget/src/utils/faceit_match';

const PLAYER = '11111111-1111-4111-8111-111111111111';
const roster = (names: string[]) => ({ roster: names.map((nickname, index) => ({ player_id: `p-${nickname}-${index}`, nickname, game_skill_level: 7 })) });

const answer = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

/** Routes every request the popup makes to a canned FACEIT answer. */
function stubFaceit(routes: Record<string, unknown>) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input).replace('/api/faceit/v4', '');
      calls.push(url);
      const hit = Object.entries(routes).find(([prefix]) => url.startsWith(prefix));
      return hit ? answer(hit[1]) : answer({}, 404);
    })
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchLatestMatch: the match the player is in right now', () => {
  test('a running match is shown live, even though the history only lists finished ones', async () => {
    const calls = stubFaceit({
      [`/players/${PLAYER}/active`]: { match_id: 'live-match-id', status: 'ONGOING' },
      '/matches/live-match-id': {
        status: 'ONGOING',
        voting: { map: { pick: ['de_mirage'] } },
        teams: { faction1: { name: 'team_A', ...roster(['a1', 'a2']) }, faction2: { name: 'team_B', ...roster(['b1', 'b2']) } },
        results: { score: { faction1: 7, faction2: 6 } },
      },
      [`/players/${PLAYER}/history`]: { items: [{ match_id: 'old-finished-match', status: 'finished' }] },
    });
    const match = await fetchLatestMatch(PLAYER);
    expect(match?.id).toBe('live-match-id');
    expect(match?.phase).toBe('live');
    expect(match?.sides[0].players.map((player) => player.nickname)).toEqual(['a1', 'a2']);
    expect(calls.some((url) => url.startsWith(`/players/${PLAYER}/history`))).toBe(false);
  });

  test('a lobby that is still being set up is the before-the-match phase', async () => {
    stubFaceit({
      [`/players/${PLAYER}/active`]: { match_id: 'lobby-match-id', status: 'VOTING' },
      '/matches/lobby-match-id': {
        status: 'VOTING',
        teams: { faction1: roster(['a1']), faction2: roster(['b1']) },
      },
    });
    const match = await fetchLatestMatch(PLAYER);
    expect(match?.phase).toBe('pre');
    expect(match?.score).toBeUndefined();
  });

  test('with nothing running the newest finished match is the after-the-match result', async () => {
    stubFaceit({
      [`/players/${PLAYER}/active`]: {},
      [`/players/${PLAYER}/history`]: { items: [{ match_id: 'finished-match-id', status: 'finished' }] },
      '/matches/finished-match-id/stats': { rounds: [] },
      '/matches/finished-match-id': {
        status: 'FINISHED',
        teams: { faction1: roster(['a1']), faction2: roster(['b1']) },
        results: { winner: 'faction1', score: { faction1: 13, faction2: 9 } },
      },
    });
    const match = await fetchLatestMatch(PLAYER);
    expect(match?.phase).toBe('post');
    expect(match?.score).toEqual([13, 9]);
  });

  test('if the active lookup fails, the finished match still works', async () => {
    stubFaceit({
      [`/players/${PLAYER}/history`]: { items: [{ match_id: 'finished-match-id', status: 'finished' }] },
      '/matches/finished-match-id/stats': { rounds: [] },
      '/matches/finished-match-id': { status: 'FINISHED', teams: { faction1: roster(['a1']), faction2: roster(['b1']) } },
    });
    expect((await fetchLatestMatch(PLAYER))?.phase).toBe('post');
  });
});
