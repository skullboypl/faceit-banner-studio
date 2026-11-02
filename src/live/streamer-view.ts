import type { StreamerDay, StreamerSamplePoint } from './streamer-api';

export const STREAMER_CHART_DAYS = 14;
export const STREAMER_TABLE_PAGE = 14;
export const STREAMER_SESSION_PAGE = 5;
export const STREAMER_ELO_POINTS = 48;

export function dayHasActivity(point: StreamerDay) {
  return Boolean(
    point.viewersSamples ||
      point.matches ||
      point.elo != null ||
      point.viewersAvg ||
      point.viewersPeak
  );
}

/** Last N calendar days, or the most recent active window when those days are empty. */
export function chartSeries(series: StreamerDay[], n = STREAMER_CHART_DAYS) {
  if (!series.length) return [];
  const recent = series.slice(-n);
  if (recent.some(dayHasActivity)) return recent;
  const active = series.filter(dayHasActivity);
  return active.slice(-n);
}

/** Newest first, only days that actually have a sample — no 90-zero walls. */
export function tableSeries(series: StreamerDay[]) {
  return series.filter(dayHasActivity).reverse();
}

export function pageSlice<T>(items: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size) || 1);
  const current = Math.min(pages, Math.max(1, page));
  return {
    current,
    pages,
    slice: items.slice((current - 1) * size, current * size),
  };
}

export function downsampleElo(points: StreamerSamplePoint[], max = STREAMER_ELO_POINTS) {
  if (points.length <= max) return points;
  const last = points.length - 1;
  const out: StreamerSamplePoint[] = [];
  for (let i = 0; i < max; i += 1) {
    const point = points[Math.round((i / (max - 1)) * last)];
    if (!out.length || out[out.length - 1] !== point) out.push(point);
  }
  return out;
}
