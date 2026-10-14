import { describe, expect, test } from 'vitest';
import { pickLanguage } from './detect';

const available = [
  { id: 'en', name: 'English', translations: {} },
  { id: 'pl', name: 'Polski', translations: {} },
  { id: 'de', name: 'Deutsch', translations: {} },
];
const pick = (input: Parameters<typeof pickLanguage>[0]) => pickLanguage(input, available).id;

describe('pickLanguage', () => {
  test('a regional browser language matches its base language (pl-PL → pl)', () => {
    expect(pick({ browser: ['pl-PL'] })).toBe('pl');
    expect(pick({ browser: ['de-AT'] })).toBe('de');
    expect(pick({ browser: ['en-US'] })).toBe('en');
  });

  test('is case-insensitive and tolerates underscores', () => {
    expect(pick({ browser: ['PL-pl'] })).toBe('pl');
    expect(pick({ browser: ['de_CH'] })).toBe('de');
  });

  test('walks the browser preference list in order and skips unsupported languages', () => {
    expect(pick({ browser: ['fr-FR', 'de-DE', 'pl'] })).toBe('de');
    expect(pick({ browser: ['fr', 'es', 'pl-PL'] })).toBe('pl');
  });

  test('the ?lang= parameter beats the saved choice, which beats the browser', () => {
    expect(pick({ param: 'de', saved: 'pl', browser: ['en'] })).toBe('de');
    expect(pick({ saved: 'pl', browser: ['en'] })).toBe('pl');
  });

  test('an unknown parameter or saved value falls through to the next source', () => {
    expect(pick({ param: 'xx', saved: 'yy', browser: ['de'] })).toBe('de');
  });

  test('English is the fallback when nothing matches', () => {
    expect(pick({ browser: ['fr', 'ja'] })).toBe('en');
    expect(pick({})).toBe('en');
    expect(pick({ browser: [] })).toBe('en');
  });

  test('falls back to the first language when English is not available', () => {
    expect(pickLanguage({ browser: ['fr'] }, [available[1], available[2]]).id).toBe('pl');
  });

  test('ignores empty and non-string entries', () => {
    expect(pick({ param: null, saved: '', browser: ['', 'pl'] })).toBe('pl');
  });
});
