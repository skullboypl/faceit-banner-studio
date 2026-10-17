import { afterEach, describe, expect, test, vi } from 'vitest';
import { faceitGet } from '../widget/src/utils/faceit_util';

const reply = (status: number) => Promise.resolve(new Response('{}', { status }));
type Call = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('faceitGet: our server first, the browser with its own client key only when the server cannot answer', () => {
  test('the server answer is used when it works, and no key is sent from the browser', async () => {
    vi.stubEnv('VITE_FACEIT_CLIENT_KEY', 'client-key');
    const fetchMock = vi.fn<Call>(() => reply(200));
    vi.stubGlobal('fetch', fetchMock);
    expect((await faceitGet('/players/abc')).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/faceit/v4/players/abc');
  });

  test.each([429, 502, 503])('a %i from our server is retried straight against FACEIT with the client key', async (status) => {
    vi.stubEnv('VITE_FACEIT_CLIENT_KEY', 'client-key');
    const fetchMock = vi.fn<Call>((url) => (String(url).startsWith('/api/faceit') ? reply(status) : reply(200)));
    vi.stubGlobal('fetch', fetchMock);
    const response = await faceitGet('/players/abc');
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toBe('https://open.faceit.com/data/v4/players/abc');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer client-key');
  });

  test('a network failure on our server falls back the same way', async () => {
    vi.stubEnv('VITE_FACEIT_CLIENT_KEY', 'client-key');
    const fetchMock = vi.fn<Call>((url) => (String(url).startsWith('/api/faceit') ? Promise.reject(new Error('offline')) : reply(200)));
    vi.stubGlobal('fetch', fetchMock);
    expect((await faceitGet('/players/abc')).status).toBe(200);
  });

  test('without a client key nothing leaves for FACEIT and the server answer is returned as it is', async () => {
    vi.stubEnv('VITE_FACEIT_CLIENT_KEY', '');
    const fetchMock = vi.fn<Call>(() => reply(429));
    vi.stubGlobal('fetch', fetchMock);
    expect((await faceitGet('/players/abc')).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('a missing player (404) is not retried: it is an answer, not a failure', async () => {
    vi.stubEnv('VITE_FACEIT_CLIENT_KEY', 'client-key');
    const fetchMock = vi.fn<Call>(() => reply(404));
    vi.stubGlobal('fetch', fetchMock);
    expect((await faceitGet('/players/abc')).status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('session wins, losses and session stats survive the fallback', () => {
  const ID = '11111111-1111-4111-8111-111111111111';
  const match = (agoMinutes: number, kills: number, deaths: number, result: '1' | '0') => ({
    stats: {
      'Match Finished At': Date.now() - agoMinutes * 60_000,
      Kills: String(kills),
      Deaths: String(deaths),
      Assists: '2',
      MVPs: '1',
      ADR: '80',
      'K/D Ratio': (kills / deaths).toFixed(2),
      'K/R Ratio': '0.8',
      'Headshots %': '40',
      Result: result,
      'Competition Id': 'x',
    },
  });
  const data = (path: string) => {
    if (path.includes('/games/cs2/stats')) return { items: [match(10, 20, 10, '1'), match(30, 10, 10, '0'), match(600, 30, 10, '1')] };
    if (path.includes('/stats/cs2')) return { lifetime: {} };
    if (path.includes('/rankings/')) return null;
    return { player_id: ID, nickname: 'tester', country: 'pl', games: { cs2: { faceit_elo: 2000, skill_level: 9, region: 'EU' } } };
  };

  test('with our server rate limited, the browser key still gives the session record and session averages', async () => {
    vi.stubEnv('VITE_FACEIT_CLIENT_KEY', 'client-key');
    vi.stubGlobal(
      'fetch',
      vi.fn((url: RequestInfo | URL) => {
        const text = String(url);
        if (text.startsWith('/api/faceit')) return reply(429);
        const body = data(text.replace('https://open.faceit.com/data/v4', ''));
        return Promise.resolve(body ? new Response(JSON.stringify(body), { status: 200 }) : new Response('{}', { status: 404 }));
      })
    );
    const { getPlayerStats } = await import('../widget/src/utils/faceit_util');
    const player = await getPlayerStats(ID, 30, new Date(Date.now() - 2 * 3_600_000), false);
    expect(player?.wins).toBe(1);
    expect(player?.losses).toBe(1);
    expect(player?.form).toEqual(['W', 'L']);
    expect(player?.session?.matches).toBe(2);
    expect(player?.session?.kd).toBeCloseTo(1.5, 5);
    expect(player?.avg.matches).toBe(3);
  });
});
