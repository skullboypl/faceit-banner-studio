import { fireEvent, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { renderWithApp } from '../components/test-utils';
import { getStreamerPage } from './streamer-api';
import { StreamerPage } from './StreamerPage';
import type { StreamerDay, StreamerSession } from './streamer-api';

function dayPoint(day: string, extra: Partial<StreamerDay> = {}): StreamerDay {
  return { day, viewersPeak: 20, viewersAvg: 10, viewersSamples: 1, elo: 2000, matches: 1, ...extra };
}

function session(index: number): StreamerSession {
  const startedAt = Date.parse('2026-11-01T12:00:00.000Z') - index * 86400000;
  return {
    startedAt,
    endedAt: startedAt + 3600000,
    eloStart: 2000,
    eloEnd: 2010,
    viewersPeak: 40,
    points: [
      { ts: startedAt, elo: 2000, viewers: 20 },
      { ts: startedAt + 3600000, elo: 2010, viewers: 40 },
    ],
  };
}

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
      sessions: [
        {
          startedAt: Date.parse('2026-11-02T15:00:00.000Z'),
          endedAt: Date.parse('2026-11-02T17:00:00.000Z'),
          eloStart: 2400,
          eloEnd: 2410,
          viewersPeak: 200,
          points: [
            { ts: Date.parse('2026-11-02T15:00:00.000Z'), elo: 2400, viewers: 80 },
            { ts: Date.parse('2026-11-02T17:00:00.000Z'), elo: 2410, viewers: 200 },
          ],
        },
      ],
    });
    renderWithApp(
      <MemoryRouter>
        <StreamerPage slug="s1mple" />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: 's1mple' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Wszyscy streamerzy' }).getAttribute('href')).toBe('/streamers');
    expect(screen.getByRole('link', { name: 'Ranking i historia streamerów' }).getAttribute('href')).toBe('/streamers/ranking');
    expect(document.title).toContain('s1mple');
    expect(within(screen.getByRole('table')).getByText('2026-11-02')).toBeTruthy();
    expect(screen.getAllByText('120').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2410').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'ELO w czasie streamu' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Ostatni stream' })).toBeTruthy();
    expect(screen.queryByText('Brak jeszcze dziennych statystyk tego kanału.')).toBeNull();
  });

  test('keeps an ELO-over-time empty state instead of a blank page when there are no samples', async () => {
    vi.mocked(getStreamerPage).mockResolvedValue({
      ok: true,
      found: false,
      generatedAt: 1,
      cacheSeconds: 60,
      streamer: { slug: 'quietone', nickname: 'QuietOne', viewersAvg: 0, viewersPeak: 0, matches: 0, elo: null },
      days: 90,
      series: [],
      sessions: [],
    });
    renderWithApp(
      <MemoryRouter>
        <StreamerPage slug="quietone" />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: 'QuietOne' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'ELO w czasie streamu' })).toBeTruthy();
    expect(screen.getByText('Brak jeszcze próbek ELO z transmisji. Gdy baner jest otwarty na live, ELO pojawi się tutaj w czasie.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  test('paginates the daily table and only mounts one open ELO session at a time', async () => {
    const series = Array.from({ length: 30 }, (_, index) => {
      const day = new Date(Date.UTC(2026, 8, 1 + index)).toISOString().slice(0, 10);
      return dayPoint(day, { viewersAvg: 10 + index, elo: 2000 + index });
    });
    vi.mocked(getStreamerPage).mockResolvedValue({
      ok: true,
      found: true,
      generatedAt: 1,
      cacheSeconds: 60,
      streamer: { slug: 'draxu', nickname: 'draxu', viewersAvg: 40, viewersPeak: 80, matches: 30, elo: 2029, twitch: 'draxu' },
      days: 90,
      series,
      sessions: Array.from({ length: 8 }, (_, index) => session(index)),
    });
    renderWithApp(
      <MemoryRouter>
        <StreamerPage slug="draxu" />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: 'draxu' })).toBeTruthy();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(15);
    expect(within(table).getByText(series[29].day)).toBeTruthy();
    expect(within(table).queryByText(series[0].day)).toBeNull();
    expect(screen.getAllByText('Strona 1 z 3').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Następna' })[1]);
    expect(within(screen.getByRole('table')).getByText(series[15].day)).toBeTruthy();
    const sessions = document.querySelectorAll('.streamers-session');
    expect(sessions).toHaveLength(5);
    expect([...sessions].filter((node) => (node as HTMLDetailsElement).open)).toHaveLength(1);
    expect(document.querySelectorAll('.streamers-elo-line')).toHaveLength(1);
  });

  test('does not mount a 90-day wall of zeros', async () => {
    vi.mocked(getStreamerPage).mockResolvedValue({
      ok: true,
      found: false,
      generatedAt: 1,
      cacheSeconds: 60,
      streamer: { slug: 'ghost', nickname: 'ghost', viewersAvg: 0, viewersPeak: 0, matches: 0, elo: null },
      days: 90,
      series: Array.from({ length: 90 }, (_, index) =>
        dayPoint(new Date(Date.UTC(2026, 7, 4 + index)).toISOString().slice(0, 10), {
          viewersPeak: 0,
          viewersAvg: 0,
          viewersSamples: 0,
          elo: null,
          matches: 0,
        })
      ),
      sessions: [],
    });
    renderWithApp(
      <MemoryRouter>
        <StreamerPage slug="ghost" />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: 'ghost' })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(document.querySelectorAll('.streamers-daychart-col')).toHaveLength(0);
    expect(screen.getAllByText('Brak jeszcze dziennych statystyk tego kanału.').length).toBe(1);
  });
});
