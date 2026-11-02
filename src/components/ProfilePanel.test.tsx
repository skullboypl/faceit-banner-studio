import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ProfilePanel } from './ProfilePanel';
import { renderWithApp } from './test-utils';

const profile = {
  nickname: 'Jebaka4K',
  avatar: null,
  kick: null as string | null,
  twitch: null as string | null,
  oauth: { twitch: true, kick: true },
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

  test('offers OAuth connect links and no typed nick field', async () => {
    renderWithApp(<ProfilePanel />);
    expect(await screen.findByText('Połączenia')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Twitch' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Kick' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Połącz Twitch' }).getAttribute('href')).toBe('/api/auth/twitch');
    expect(screen.getByRole('link', { name: 'Połącz Kick' }).getAttribute('href')).toBe('/api/auth/kick');
    expect(screen.queryByPlaceholderText('nick na Kick')).toBeNull();
    expect(screen.queryByPlaceholderText('nick na Twitch')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  test('keeps Twitch and Kick marks when a channel is already linked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        if (String(input).includes('/api/auth/profile') && !String(input).includes('cache')) {
          return { ok: true, json: async () => ({ ...profile, twitch: 'SkullBoyPL', kick: 'jebaka' }) };
        }
        return { ok: true, json: async () => ({}) };
      })
    );
    renderWithApp(<ProfilePanel />);
    expect(await screen.findByText('Połączony Twitch: SkullBoyPL')).toBeTruthy();
    expect(screen.getByText('Połączony Kick: jebaka')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Twitch' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Kick' })).toBeTruthy();
  });

  test('disables connect when OAuth keys are missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        if (String(input).includes('/api/auth/profile') && !String(input).includes('cache')) {
          return { ok: true, json: async () => ({ ...profile, oauth: { twitch: false, kick: false } }) };
        }
        return { ok: true, json: async () => ({}) };
      })
    );
    renderWithApp(<ProfilePanel />);
    expect(await screen.findByText(/Klucze OAuth nie są jeszcze ustawione/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Połącz Twitch' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Połącz Kick' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('link', { name: 'Połącz Twitch' })).toBeNull();
  });

  test('lets the signed-in player unlink a verified Twitch login', async () => {
    const unlinkTwitchAccount = vi.fn(async () => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        if (String(input).includes('/api/auth/profile') && !String(input).includes('cache')) {
          return { ok: true, json: async () => ({ ...profile, twitch: 'SkullBoyPL' }) };
        }
        return { ok: true, json: async () => ({}) };
      })
    );
    renderWithApp(<ProfilePanel unlinkTwitchAccount={unlinkTwitchAccount} />);
    expect(await screen.findByText('Połączony Twitch: SkullBoyPL')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Odłącz' })[0]);
    await waitFor(() => expect(unlinkTwitchAccount).toHaveBeenCalledOnce());
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
