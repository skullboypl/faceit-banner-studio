import { describe, expect, test } from 'vitest';
import { feedbackPostPath, tabFromLocation, tabFromSearch } from './tab-search';

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

  test('a ticket permalink opens the feedback tab', () => {
    expect(tabFromLocation('/feedback/abc', '', 6)).toBe(5);
    expect(tabFromLocation('/feedback/abc', '?tab=0', 6)).toBe(5);
    expect(tabFromLocation('/', '?tab=5', 6)).toBe(5);
    expect(tabFromLocation('/live', '', 6)).toBe(0);
    expect(feedbackPostPath('abc')).toBe('/feedback/abc');
  });
});
