import { describe, expect, test } from 'vitest';
import { tabFromSearch } from './tab-search';

describe('tabFromSearch', () => {
  test('opens public banners at tab=4 and feedback at tab=5', () => {
    expect(tabFromSearch('?tab=4', 6)).toBe(4);
    expect(tabFromSearch('?tab=5', 6)).toBe(5);
  });

  test('falls back to settings when the index is missing or out of range', () => {
    expect(tabFromSearch('', 6)).toBe(0);
    expect(tabFromSearch('?tab=6', 6)).toBe(0);
    expect(tabFromSearch('?tab=nope', 6)).toBe(0);
  });
});
