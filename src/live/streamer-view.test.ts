import { describe, expect, test } from 'vitest';
import type { StreamerDay } from './streamer-api';
import {
  STREAMER_CHART_DAYS,
  STREAMER_TABLE_PAGE,
  chartSeries,
  dayHasActivity,
  downsampleElo,
  pageSlice,
  tableSeries,
} from './streamer-view';

function day(iso: string, extra: Partial<StreamerDay> = {}): StreamerDay {
  return { day: iso, viewersPeak: 0, viewersAvg: 0, viewersSamples: 0, elo: null, matches: 0, ...extra };
}

describe('streamer-view', () => {
  test('chartSeries keeps the last calendar window when it has activity', () => {
    const series = [
      day('2026-08-01', { viewersAvg: 40, viewersSamples: 2 }),
      ...Array.from({ length: 13 }, (_, index) => day(`2026-10-${String(index + 1).padStart(2, '0')}`)),
      day('2026-10-14', { elo: 2100 }),
    ];
    const window = chartSeries(series, 14);
    expect(window).toHaveLength(STREAMER_CHART_DAYS);
    expect(window[0].day).toBe('2026-10-01');
    expect(window[window.length - 1].day).toBe('2026-10-14');
  });

  test('chartSeries falls back to recent active days when the last window is empty', () => {
    const series = [day('2026-08-01', { matches: 1 }), day('2026-08-02'), day('2026-11-01')];
    expect(chartSeries(series, 2).map((point) => point.day)).toEqual(['2026-08-01']);
  });

  test('tableSeries drops zero days and lists newest first', () => {
    const series = [
      day('2026-10-01', { viewersAvg: 10, viewersSamples: 1 }),
      day('2026-10-02'),
      day('2026-10-03', { elo: 1800 }),
    ];
    expect(tableSeries(series).map((point) => point.day)).toEqual(['2026-10-03', '2026-10-01']);
    expect(dayHasActivity(series[1])).toBe(false);
  });

  test('pageSlice pages a long table without leftover items', () => {
    const items = Array.from({ length: 30 }, (_, index) => index);
    const first = pageSlice(items, 1, STREAMER_TABLE_PAGE);
    expect(first.pages).toBe(3);
    expect(first.slice).toEqual(items.slice(0, 14));
    expect(pageSlice(items, 3, STREAMER_TABLE_PAGE).slice).toHaveLength(2);
  });

  test('downsampleElo keeps the ends of a long session', () => {
    const points = Array.from({ length: 200 }, (_, index) => ({ ts: index, elo: 1000 + index, viewers: 1 }));
    const slim = downsampleElo(points, 48);
    expect(slim.length).toBeLessThanOrEqual(48);
    expect(slim[0]).toBe(points[0]);
    expect(slim[slim.length - 1]).toBe(points[199]);
  });
});
