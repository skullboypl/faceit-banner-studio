import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ProfilePanel } from './ProfilePanel';
import { renderWithApp } from './test-utils';

const profile = {
  nickname: 'Jebaka4K',
  avatar: null,
  faceit: { elo: 2100, level: 8, country: 'pl', ranking: null, verifiedBadge: 'none' as const },
  logins: [],
};

describe('ProfilePanel', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes('/api/auth/profile') && !url.includes('cache')) {
          return { ok: true, json: async () => profile };
        }
        return { ok: true, json: async () => ({}) };
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('lets the signed-in player clear their FACEIT cache', async () => {
    const clearCache = vi.fn(async () => undefined);
    renderWithApp(<ProfilePanel clearCache={clearCache} />);
    expect(await screen.findByRole('button', { name: 'Wyczyść mój cache' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Wyczyść mój cache' }));
    await waitFor(() => expect(clearCache).toHaveBeenCalledOnce());
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/Cache wyczyszczony/);
  });

  test('still offers cache clearing when the profile card cannot load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({ error: 'profile' }) }))
    );
    const clearCache = vi.fn(async () => undefined);
    renderWithApp(<ProfilePanel clearCache={clearCache} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Wyczyść mój cache' }));
    await waitFor(() => expect(clearCache).toHaveBeenCalledOnce());
  });

  test('says so when the cache was cleared too recently', async () => {
    const clearCache = vi.fn(async () => {
      throw new Error('too_soon');
    });
    renderWithApp(<ProfilePanel clearCache={clearCache} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Wyczyść mój cache' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Poczekaj/);
  });
});
