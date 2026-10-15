import { afterEach, describe, expect, test, vi } from 'vitest';
import { lookupRosterCard } from '../widget/src/utils/faceit_util';

const reply = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

const stub = (lifetime: Record<string, string> | undefined, statsOk = true) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).includes('/stats/cs2')) return reply({ lifetime }, statsOk);
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

describe('lookupRosterCard', () => {
  test('reads K/D, win rate, headshots, ADR and the other lifetime stats', async () => {
    stub({
      'Average K/D Ratio': '1.31',
      'Win Rate %': '56',
      'Average Headshots %': '48',
      ADR: '81.4',
      'Average K/R Ratio': '0.82',
      Matches: '3120',
      Wins: '1750',
      'Current Win Streak': '4',
    });
    expect(await lookupRosterCard('skull')).toMatchObject({
      username: 'skull',
      elo: 2100,
      level: 10,
      kd: 1.31,
      winRate: 56,
      hs: 48,
      adr: 81.4,
      kr: 0.82,
      matches: 3120,
      wins: 1750,
      streak: 4,
    });
  });

  test('ADR also comes from "Average Damage per Round" when that is the name FACEIT uses', async () => {
    stub({ 'Average Damage per Round': '77.5' });
    expect((await lookupRosterCard('skull')).adr).toBe(77.5);
  });

  test('a stat that is missing or not a number becomes 0, so the banner shows a dash', async () => {
    stub({ 'Average K/D Ratio': 'n/a', Matches: '' });
    expect(await lookupRosterCard('skull')).toMatchObject({ kd: 0, hs: 0, adr: 0, kr: 0, matches: 0, wins: 0, streak: 0 });
  });

  test('when the stats request fails the row still has ELO and level', async () => {
    stub(undefined, false);
    expect(await lookupRosterCard('skull')).toMatchObject({ elo: 2100, level: 10, kd: 0, hs: 0, adr: 0, matches: 0 });
  });

  test('an unknown player is a missing row', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply({}, false)));
    expect(await lookupRosterCard('nobody')).toMatchObject({ username: 'nobody', missing: true, hs: 0, adr: 0, matches: 0 });
  });
});
