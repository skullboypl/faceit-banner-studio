import { describe, expect, test } from 'vitest';
import { parseStreamerPath, streamerIndexTitle, streamerPageDescription, streamerPageTitle, streamerPath, streamerSlugOf } from './streamer-seo';

describe('streamer permalinks', () => {
  test('prefers Twitch login as the slug and keeps Kick as the fallback', () => {
    expect(streamerSlugOf({ twitch: 's1mple', kick: 'other' })).toBe('s1mple');
    expect(streamerSlugOf({ kick: 'Mapet' })).toBe('mapet');
    expect(streamerSlugOf({})).toBe('');
  });

  test('builds and reads /streamers/:slug paths', () => {
    expect(streamerPath('s1mple')).toBe('/streamers/s1mple');
    expect(parseStreamerPath('/streamers/s1mple')).toBe('s1mple');
    expect(parseStreamerPath('/streamers')).toBe('');
    expect(parseStreamerPath('/live')).toBe('');
  });

  test('puts the streamer name in the document title', () => {
    expect(streamerIndexTitle('Ranking streamerów – 7 dni')).toBe('Ranking streamerów – 7 dni');
    expect(streamerPageTitle('s1mple', 'Nasi streamerzy')).toBe('s1mple · Nasi streamerzy');
    expect(streamerPageDescription('s1mple', '{{0}} na FACEIT Banner: widzowie, ELO i mecze z każdego dnia.')).toBe(
      's1mple na FACEIT Banner: widzowie, ELO i mecze z każdego dnia.'
    );
  });
});
