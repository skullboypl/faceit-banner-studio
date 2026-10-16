import { afterEach, describe, expect, test, vi } from 'vitest';
import { getPlayerRankingPosition } from '../widget/src/utils/faceit_util';

const ID = '11111111-1111-4111-8111-111111111111';

const stub = (body: unknown, status = 200) =>
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status }))));

afterEach(() => vi.unstubAllGlobals());

describe('getPlayerRankingPosition', () => {
  test('a place inside the regional top 1000 is returned', async () => {
    stub({ position: 87, items: [] });
    expect(await getPlayerRankingPosition(ID, 'EU')).toBe(87);
  });

  test('a regional place beyond 1000 is not a challenger place', async () => {
    stub({ position: 29178, items: [] });
    expect(await getPlayerRankingPosition(ID, 'EU')).toBeUndefined();
  });

  test('a place in the country can be far beyond 1000 and is still a real place', async () => {
    stub({ position: 1501, items: [] });
    expect(await getPlayerRankingPosition(ID, 'EU', 'pl')).toBe(1501);
  });

  test('no place (0), a bad answer or a failed request is unknown, never a number', async () => {
    stub({ position: 0, items: [] });
    expect(await getPlayerRankingPosition(ID, 'EU', 'pl')).toBeUndefined();
    stub({}, 502);
    expect(await getPlayerRankingPosition(ID, 'EU', 'pl')).toBeUndefined();
  });
});
