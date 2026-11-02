import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { renderWithApp } from '../components/test-utils';
import { getStreamerRanking } from './streamer-api';
import { StreamerRanking } from './StreamerRanking';

vi.mock('./streamer-api', () => ({
  getStreamerRanking: vi.fn(),
}));

describe('StreamerRanking', () => {
  test('lists crawlable permalinks with 7-day averages', async () => {
    vi.mocked(getStreamerRanking).mockResolvedValue({
      ok: true,
      days: 7,
      generatedAt: 1,
      cacheSeconds: 60,
      streamers: [
        { slug: 's1mple', nickname: 's1mple', viewersAvg: 400, viewersPeak: 900, matches: 6, elo: 2500 },
        { slug: 'mapet', nickname: 'Mapet', viewersAvg: 40, viewersPeak: 80, matches: 2, elo: 1800, kick: 'mapet' },
      ],
    });
    renderWithApp(
      <MemoryRouter>
        <StreamerRanking />
      </MemoryRouter>
    );
    const first = await screen.findByRole('link', { name: /s1mple/i });
    expect(first.getAttribute('href')).toBe('/streamers/s1mple');
    expect(first.textContent).toContain('400');
    expect(screen.getByRole('link', { name: /Mapet/i }).getAttribute('href')).toBe('/streamers/mapet');
  });
});
