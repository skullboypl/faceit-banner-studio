import { afterEach, describe, expect, test, vi } from 'vitest';
import { lookupRosterCard, summarizeRecentMatches, summarizeSessionMatches } from '../widget/src/utils/faceit_util';

const reply = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

const match = (stats: Record<string, string>) => ({ stats });

const stub = (items: { stats: Record<string, string> }[] | undefined, statsOk = true) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).includes('/games/cs2/stats')) return reply({ items }, statsOk);
      if (String(url).includes('/rankings/')) return reply({ position: 717, items: [] });
      return reply({
        player_id: '0a1b2c3d-1111-4222-8333-444455556666',
        nickname: 'skull',
        avatar: 'https://cdn.faceit/a.jpg',
        cover_image: '',
        country: 'pl',
        games: { cs2: { faceit_elo: 2100, skill_level: 10, region: 'EU' } },
      });
    })
  );

afterEach(() => vi.unstubAllGlobals());

describe('summarizeRecentMatches', () => {
  test('averages the newest matches and keeps the win streak from the latest one', () => {
    const summary = summarizeRecentMatches(
      [
        match({ Result: '1', Kills: '20', Deaths: '10', Headshots: '10', ADR: '80', Rounds: '24' }),
        match({ Result: '1', Kills: '10', Deaths: '10', Headshots: '5', ADR: '60', Rounds: '20' }),
        match({ Result: '0', Kills: '15', Deaths: '15', Headshots: '6', ADR: '70', Rounds: '30' }),
      ],
      20
    );
    expect(summary).toMatchObject({
      kd: 45 / 35,
      winRate: (2 / 3) * 100,
      hs: (21 / 45) * 100,
      adr: 70,
      kr: 45 / 74,
      matches: 3,
      wins: 2,
      losses: 1,
      streak: 2,
      form: ['W', 'W', 'L'],
    });
  });

  test('a shorter window drops the older matches', () => {
    const summary = summarizeRecentMatches(
      [
        match({ Result: '0', Kills: '1', Deaths: '2', ADR: '10' }),
        match({ Result: '1', Kills: '9', Deaths: '1', ADR: '90' }),
      ],
      1
    );
    expect(summary).toMatchObject({ matches: 1, wins: 0, losses: 1, streak: 0, kd: 0.5, adr: 10 });
  });

  test('falls back to the headshot percent and K/R when the raw counts are missing', () => {
    const summary = summarizeRecentMatches(
      [match({ Result: '1', 'Headshots %': '40', 'K/R Ratio': '0.8', 'Average Damage per Round': '77.5' })],
      20
    );
    expect(summary).toMatchObject({ hs: 40, kr: 0.8, adr: 77.5, wins: 1, matches: 1 });
  });
});

describe('lookupRosterCard', () => {
  test('reads K/D and the win/loss form from the last 20 matches, not the lifetime totals', async () => {
    stub([
      match({ Result: '1', Kills: '20', Deaths: '10', Headshots: '8', ADR: '80', Rounds: '20' }),
      match({ Result: '0', Kills: '10', Deaths: '10', Headshots: '2', ADR: '60', Rounds: '20' }),
    ]);
    const card = await lookupRosterCard('skull');
    expect(card).toMatchObject({
      username: 'skull',
      elo: 2100,
      level: 10,
      kd: 1.5,
      winRate: 50,
      hs: (10 / 30) * 100,
      adr: 70,
      kr: 0.75,
      matches: 2,
      wins: 1,
      losses: 1,
      streak: 1,
      form: ['W', 'L'],
      ranking: 717,
    });
    const url = String(vi.mocked(fetch).mock.calls.find(([called]) => String(called).includes('/stats'))?.[0]);
    expect(url).toContain('/games/cs2/stats?limit=100');
  });

  test('asks for 100 matches and keeps only the selected window for the recent columns', async () => {
    stub(Array.from({ length: 40 }, () => match({ Result: '1', Kills: '10', Deaths: '10' })));
    const card = await lookupRosterCard('skull', 30);
    const url = String(vi.mocked(fetch).mock.calls.find(([called]) => String(called).includes('/stats'))?.[0]);
    expect(url).toContain('limit=100');
    expect(card.matches).toBe(30);
  });

  test('session stats ignore matches finished before the session started', () => {
    const summary = summarizeSessionMatches(
      [
        match({ Result: '1', Kills: '20', Deaths: '10', Headshots: '10', ADR: '80', Rounds: '20', 'Match Finished At': '1500' }),
        match({ Result: '0', Kills: '4', Deaths: '8', ADR: '40', 'Match Finished At': '500' }),
      ],
      1000
    );
    expect(summary).toMatchObject({ wins: 1, losses: 0, matches: 1, kills: 20, avg: 20, adr: 80 });
  });

  test('a match without numbers becomes a dash on the banner', async () => {
    stub([match({ Result: '1' })]);
    expect(await lookupRosterCard('skull')).toMatchObject({ kd: 0, hs: 0, adr: 0, kr: 0, matches: 1, wins: 1, streak: 1 });
  });

  test('when the stats request fails the row still has ELO and level', async () => {
    stub(undefined, false);
    expect(await lookupRosterCard('skull')).toMatchObject({ elo: 2100, level: 10, kd: 0, hs: 0, adr: 0, matches: 0 });
  });

  test('a level 10 who is off the ladder does not get a ranking', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/rankings/')) return reply({ position: 0, items: [] });
        if (String(url).includes('/games/cs2/stats')) return reply({ items: [] });
        return reply({
          player_id: '0a1b2c3d-1111-4222-8333-444455556666',
          nickname: 'off',
          games: { cs2: { faceit_elo: 3700, skill_level: 10, region: 'EU' } },
        });
      })
    );
    const card = await lookupRosterCard('off');
    expect(card.level).toBe(10);
    expect(card.ranking).toBeUndefined();
  });

  test('a calibrating player keeps the last ELO, drops the level and skips the ladder', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/rankings/')) return reply({ position: 4, items: [] });
      if (String(url).includes('/games/cs2/stats')) return reply({ items: [] });
      return reply({
        player_id: '0a1b2c3d-1111-4222-8333-444455556666',
        nickname: 'SpavaQu',
        games: { cs2: { faceit_elo: 3737, skill_level: 10, region: 'EU', is_calibrating: true } },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const card = await lookupRosterCard('SpavaQu');
    expect(card).toMatchObject({ elo: 3737, level: 0, calibrating: true });
    expect(card.ranking).toBeUndefined();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/rankings/'))).toBe(false);
  });

  test('an unknown player is a missing row', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply({}, false)));
    expect(await lookupRosterCard('nobody')).toMatchObject({ username: 'nobody', missing: true, hs: 0, adr: 0, matches: 0 });
  });
});
