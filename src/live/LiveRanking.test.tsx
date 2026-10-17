import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { renderWithApp } from '../components/test-utils';
import { getLiveBoard } from '../utils/presence';
import { LiveRanking } from './LiveRanking';

vi.mock('../utils/presence', () => ({
  PRESENCE_REFRESH_MS: 60_000,
  LIVE_LIST_REFRESH_MS: 60_000,
  getLiveBoard: vi.fn(),
}));

const players = Array.from({ length: 16 }, (_, index) => ({
  nickname: `player${index + 1}`,
  elo: 3000 - index,
  level: 10,
  country: 'pl',
}));

describe('LiveRanking', () => {
  beforeEach(() => {
    vi.mocked(getLiveBoard).mockResolvedValue({
      online: 40,
      ranked: players.length,
      windowSeconds: 135,
      players,
    });
  });

  test('shows one page at a time and keeps the real rank on the next page', async () => {
    renderWithApp(<LiveRanking />);
    expect(await screen.findByRole('link', { name: 'player1' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'player16' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Następna' }));
    expect(screen.getByRole('link', { name: 'player16' })).toBeTruthy();
    expect(screen.getByText('16')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'player1' })).toBeNull();
  });

  test('says that the player data is a saved copy, how often it is renewed, and when it was made', async () => {
    vi.mocked(getLiveBoard).mockResolvedValue({
      online: 2,
      ranked: 1,
      windowSeconds: 135,
      cacheSeconds: 900,
      generatedAt: new Date('2026-10-17T12:34:56').getTime(),
      players: [players[0]],
    });
    renderWithApp(<LiveRanking />);
    await screen.findByRole('link', { name: 'player1' });
    const note = screen.getByRole('note');
    expect(note.textContent).toContain('zapisana kopia');
    expect(note.textContent).toContain('15 min');
    expect(note.textContent).toContain('12:34');
  });

  test('shows the plan, ESEA, token and Twitch link next to the nickname, and nothing for a plain account', async () => {
    vi.mocked(getLiveBoard).mockResolvedValue({
      online: 4,
      ranked: 4,
      windowSeconds: 135,
      players: [
        { ...players[0], membership: 'premium', esea: true, token: true, twitch: 'SkullBoyPL' },
        { ...players[1], membership: 'plus' },
        { ...players[2] },
        { ...players[3], membership: 'gold' as never, twitch: 'a b/c' },
      ],
    });
    renderWithApp(<LiveRanking />);
    await screen.findByRole('link', { name: 'player1' });
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]).getByRole('img', { name: 'Plan FACEIT Premium' })).toBeTruthy();
    expect(within(rows[0]).getByRole('img', { name: 'Członek ESEA' })).toBeTruthy();
    expect(within(rows[0]).getByRole('img', { name: 'Super Match Token' })).toBeTruthy();
    const twitch = within(rows[0]).getByRole('link', { name: 'Twitch: SkullBoyPL' });
    expect(twitch.getAttribute('href')).toBe('https://www.twitch.tv/SkullBoyPL');
    expect(twitch.getAttribute('rel')).toContain('noreferrer');
    expect(within(rows[1]).getByRole('img', { name: 'Plan FACEIT Plus' })).toBeTruthy();
    expect(within(rows[2]).queryByRole('img', { name: /Plan|ESEA|Token/ })).toBeNull();
    expect(within(rows[3]).queryByRole('img', { name: /Plan|ESEA|Token/ })).toBeNull();
    expect(within(rows[3]).queryByRole('link', { name: /Twitch/ })).toBeNull();
  });

  test('shows real level artwork and only the verification badge supplied by the server', async () => {
    vi.mocked(getLiveBoard).mockResolvedValue({
      online: 3,
      ranked: 3,
      windowSeconds: 135,
      players: [
        { ...players[0], verifiedBadge: 'gold' },
        { ...players[1], verifiedBadge: 'verified', level: 4 },
        { ...players[2], verifiedBadge: 'none' },
      ],
    });
    renderWithApp(<LiveRanking />);
    await screen.findByRole('link', { name: 'player1' });
    const rows = screen.getAllByRole('listitem');
    expect(
      within(rows[0]).getByRole('img', {
        name: 'Zweryfikowane konto FACEIT Premium',
      })
    ).toBeTruthy();
    expect(
      within(rows[1]).getByRole('img', { name: 'Zweryfikowane konto FACEIT' })
    ).toBeTruthy();
    expect(
      within(rows[2]).queryByRole('img', { name: /Zweryfikowane/ })
    ).toBeNull();
    expect(
      within(rows[0])
        .getByRole('img', { name: 'Poziom FACEIT 10' })
        .querySelector('svg.faceit-level')
    ).toBeTruthy();
    expect(
      within(rows[1])
        .getByRole('img', { name: 'Poziom FACEIT 4' })
        .querySelector('svg.faceit-level')
    ).toBeTruthy();
  });

  test('shows a sign-in mark without an account id', async () => {
    vi.mocked(getLiveBoard).mockResolvedValue({
      online: 2,
      ranked: 2,
      windowSeconds: 135,
      players: [
        { ...players[0], confirmed: true },
        { ...players[1], confirmed: false },
      ],
    });
    renderWithApp(<LiveRanking />);
    const rows = await screen.findAllByRole('listitem');
    expect(within(rows[0]).getByRole('img', { name: 'Potwierdzony logowaniem do studia' })).toBeTruthy();
    expect(within(rows[1]).queryByRole('img', { name: 'Potwierdzony logowaniem do studia' })).toBeNull();
    expect(rows[0].textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  test('does not poll hidden tabs or duplicate an in-flight request', async () => {
    vi.useFakeTimers();
    const hidden = vi.spyOn(document, 'hidden', 'get');
    hidden.mockReturnValue(false);
    let complete!: (value: Awaited<ReturnType<typeof getLiveBoard>>) => void;
    vi.mocked(getLiveBoard)
      .mockClear()
      .mockReturnValue(
        new Promise((resolve) => {
          complete = resolve;
        })
      );
    try {
      renderWithApp(<LiveRanking />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });
      expect(getLiveBoard).toHaveBeenCalledTimes(1);
      await act(async () =>
        complete({ online: 0, ranked: 0, windowSeconds: 135, players: [] })
      );
      hidden.mockReturnValue(true);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });
      expect(getLiveBoard).toHaveBeenCalledTimes(1);
    } finally {
      hidden.mockRestore();
      vi.useRealTimers();
    }
  });
});
