import { describe, expect, test } from 'vitest';
import { MIN_REFRESH_SECONDS, refreshSeconds } from '../widget/src/utils/refresh';

describe('refreshSeconds: how often a banner reads FACEIT', () => {
  test('is never faster than every 30 seconds, whatever the link or the saved settings say', () => {
    expect(MIN_REFRESH_SECONDS).toBe(30);
    expect(refreshSeconds(10)).toBe(30);
    expect(refreshSeconds(5)).toBe(30);
    expect(refreshSeconds(29)).toBe(30);
  });

  test('keeps the slower choices as they are', () => {
    expect(refreshSeconds(30)).toBe(30);
    expect(refreshSeconds(60)).toBe(60);
    expect(refreshSeconds(120)).toBe(120);
  });

  test('a missing or broken value is the default minute', () => {
    expect(refreshSeconds(undefined)).toBe(60);
    expect(refreshSeconds('abc')).toBe(60);
    expect(refreshSeconds(0)).toBe(60);
    expect(refreshSeconds(-5)).toBe(60);
    expect(refreshSeconds(NaN)).toBe(60);
  });
});
