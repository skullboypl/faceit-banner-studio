import { screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { renderWithApp } from '../components/test-utils';
import { getStreamerRanking } from './streamer-api';
import { StreamerRanking } from './StreamerRanking';

vi.mock('./streamer-api', () => ({
  getStreamerRanking: vi.fn(),
}));

describe('StreamerRanking', () => {
  test('lists crawlable permalinks with 7-day averages and a full history archive', async () => {
    vi.mocked(getStreamerRanking).mockResolvedValue({
      ok: true,
      days: 7,
      historyDays: 90,
      generatedAt: 1,
      cacheSeconds: 60,
      streamers: [
        { slug: 's1mple', nickname: 's1mple', viewersAvg: 400, viewersPeak: 900, matches: 6, elo: 2500 },
        { slug: 'mapet', nickname: 'Mapet', viewersAvg: 40, viewersPeak: 80, matches: 2, elo: 1800, kick: 'mapet' },
      ],
      archive: [
        { slug: 's1mple', nickname: 's1mple', viewersAvg: 0, viewersPeak: 0, matches: 0, elo: 2500, lastDay: '2026-11-02' },
        { slug: 'oldone', nickname: 'OldOne', viewersAvg: 0, viewersPeak: 0, matches: 0, elo: 1600, lastDay: '2026-10-01' },
      ],
    });
    renderWithApp(
      <MemoryRouter>
        <StreamerRanking />
      </MemoryRouter>
    );
    const rank = await screen.findByRole('list', { name: 'Ranking streamerów – 7 dni' });
    const first = within(rank).getByRole('link', { name: /s1mple/i });
    expect(first.getAttribute('href')).toBe('/streamers/s1mple');
    expect(first.textContent).toContain('400');
    expect(within(rank).getByRole('link', { name: /Mapet/i }).getAttribute('href')).toBe('/streamers/mapet');
    const archive = screen.getByRole('list', { name: 'Pełna historia streamerów' });
    const old = within(archive).getByRole('link', { name: /OldOne/i });
    expect(old.getAttribute('href')).toBe('/streamers/oldone');
    expect(old.querySelector('.streamers-archive-who')?.textContent).toContain('OldOne');
    expect(old.querySelector('.streamers-archive-day')?.textContent).toBe('2026-10-01');
    expect(old.querySelector('.streamers-archive-handle')?.textContent).toBe('@oldone');
    expect(within(archive).getByText('2026-11-02').className).toContain('streamers-archive-day');
    expect(screen.getByRole('link', { name: 'Wszyscy streamerzy' }).getAttribute('href')).toBe('/streamers');
  });
});
