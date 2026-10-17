import { describe, expect, test } from 'vitest';
import { languages } from './translations';
import { languageFlag } from '../components/language-flag';

const english = languages.find((language) => language.id === 'en')!;
const placeholders = (text: string) => [...text.matchAll(/\{\{(\d+)\}\}/g)].map((match) => match[1]).sort().join(',');

describe('languages', () => {
  test('the studio offers the languages FACEIT players speak', () => {
    expect(languages.map((language) => language.id)).toEqual(['en', 'pl', 'de', 'uk', 'ru', 'tr', 'pt', 'es', 'fr', 'cs']);
    expect(new Set(languages.map((language) => language.id)).size).toBe(languages.length);
  });

  test.each(languages.map((language) => [language.id, language] as const))('%s has every key English has, no extras, and no empty text', (_id, language) => {
    const missing = Object.keys(english.translations).filter((key) => !(key in language.translations));
    const extra = Object.keys(language.translations).filter((key) => !(key in english.translations));
    const empty = Object.entries(language.translations).filter(([key, value]) => typeof value !== 'string' || (value.trim() === '' && english.translations[key].trim() !== ''));
    expect({ missing: missing.slice(0, 5), extra: extra.slice(0, 5), empty: empty.slice(0, 5) }).toEqual({ missing: [], extra: [], empty: [] });
  });

  test.each(languages.map((language) => [language.id, language] as const))('%s keeps every {{0}} placeholder of the English text', (_id, language) => {
    const broken = Object.entries(english.translations)
      .filter(([key, value]) => placeholders(value) !== placeholders(language.translations[key] ?? ''))
      .map(([key]) => key);
    expect(broken.slice(0, 5)).toEqual([]);
  });

  test('every language has a name written in itself', () => {
    expect(languages.map((language) => language.name)).toEqual(['English', 'Polski', 'Deutsch', 'Українська', 'Русский', 'Türkçe', 'Português', 'Español', 'Français', 'Čeština']);
  });
});

describe('languageFlag', () => {
  test('maps a language to the flag of the country that speaks it most', () => {
    expect(languageFlag('en')).toBe('gb');
    expect(languageFlag('uk')).toBe('ua');
    expect(languageFlag('cs')).toBe('cz');
    expect(languageFlag('pt')).toBe('br');
    for (const id of ['pl', 'de', 'ru', 'tr', 'es', 'fr']) expect(languageFlag(id)).toBe(id);
  });
});
