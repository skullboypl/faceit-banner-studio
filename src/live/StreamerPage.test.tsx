import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { renderWithApp } from '../components/test-utils';
import { getStreamerPage } from './streamer-api';
import { StreamerPage } from './StreamerPage';

vi.mock('./streamer-api', () => ({
  getStreamerPage: vi.fn(),
}));

describe('StreamerPage', () => {
  test('renders daily viewers, elo and matches instead of empty copy when data exists', async () => {
    vi.mocked(getStreamerPage).mockResolvedValue({
      ok: true,
      found: true,
      generatedAt: 1,
      cacheSeconds: 60,
      streamer: { slug: 's1mple', nickname: 's1mple', viewersAvg: 120, viewersPeak: 200, matches: 3, elo: 2410, twitch: 's1mple' },
      days: 2,
      series: [
        { day: '2026-11-01', viewersPeak: 80, viewersAvg: 40, viewersSamples: 2, elo: 2400, matches: 1 },
        { day: '2026-11-02', viewersPeak: 200, viewersAvg: 120, viewersSamples: 3, elo: 2410, matches: 2 },
      ],
    });
    renderWithApp(
      <MemoryRouter>
        <StreamerPage slug="s1mple" />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: 's1mple' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Wszyscy streamerzy' }).getAttribute('href')).toBe('/streamers');
    expect(document.title).toContain('s1mple');
    expect(screen.getByText('2026-11-02')).toBeTruthy();
    expect(screen.getAllByText('120').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2410').length).toBeGreaterThan(0);
    expect(screen.queryByText('Brak jeszcze dziennych statystyk tego kanału.')).toBeNull();
  });
});
