import { afterEach, describe, expect, test, vi } from 'vitest';
import { getPlayerRankingPosition, isKnownPlace, UNKNOWN_PLACE } from '../widget/src/utils/faceit_util';

const ID = '11111111-1111-4111-8111-111111111111';

const stub = (body: unknown, status = 200) =>
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status }))));

afterEach(() => vi.unstubAllGlobals());

describe('getPlayerRankingPosition', () => {
  test('a place inside the regional top 1000 is returned', async () => {
    stub({ position: 87, items: [] });
    expect(await getPlayerRankingPosition(ID, 'EU')).toBe(87);
  });

  test('a regional place beyond 1000 is still the real place; the banner decides what a challenger is', async () => {
    stub({ position: 29178, items: [] });
    expect(await getPlayerRankingPosition(ID, 'EU')).toBe(29178);
  });

  test('a known place is a whole number from 1, never the stand-in for no place', () => {
    expect(isKnownPlace(1)).toBe(true);
    expect(isKnownPlace(29178)).toBe(true);
    expect(isKnownPlace(0)).toBe(false);
    expect(isKnownPlace(UNKNOWN_PLACE)).toBe(false);
    expect(isKnownPlace(undefined)).toBe(false);
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
