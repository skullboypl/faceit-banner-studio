import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { renderWithApp } from '../components/test-utils';
import { getLiveBoard } from '../utils/presence';
import { LiveRanking } from './LiveRanking';

vi.mock('../utils/presence', () => ({
  PRESENCE_REFRESH_MS: 60_000,
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
});
