export type StreamerDay = {
  day: string;
  viewersPeak: number;
  viewersAvg: number;
  viewersSamples: number;
  elo: number | null;
  matches: number;
};

export type StreamerRankRow = {
  slug: string;
  nickname: string;
  avatar?: string | null;
  platform?: string;
  twitch?: string | null;
  kick?: string | null;
  viewersPeak: number;
  viewersAvg: number;
  matches: number;
  elo: number | null;
  live?: boolean;
  viewers?: number;
  lastDay?: string | null;
};

export type StreamerSamplePoint = {
  ts: number;
  elo: number | null;
  viewers: number | null;
  matchId?: string;
};

export type StreamerSession = {
  startedAt: number;
  endedAt: number;
  eloStart: number | null;
  eloEnd: number | null;
  viewersPeak: number;
  points: StreamerSamplePoint[];
};

export type StreamerRanking = {
  ok: boolean;
  days: number;
  historyDays: number;
  generatedAt: number;
  cacheSeconds: number;
  stale?: boolean;
  streamers: StreamerRankRow[];
  archive: StreamerRankRow[];
};

export type StreamerDetail = {
  ok: boolean;
  found: boolean;
  generatedAt: number;
  cacheSeconds: number;
  stale?: boolean;
  streamer: StreamerRankRow & { slug: string };
  days: number;
  series: StreamerDay[];
  sessions: StreamerSession[];
};

export async function getStreamerRanking(signal?: AbortSignal): Promise<StreamerRanking> {
  const response = await fetch('/api/streamers/ranking', { cache: 'default', signal });
  if (!response.ok) throw new Error('streamers_unavailable');
  const data = (await response.json()) as Partial<StreamerRanking>;
  return {
    ok: data.ok !== false,
    days: Math.max(1, Number(data.days) || 7),
    historyDays: Math.max(1, Number(data.historyDays) || 90),
    generatedAt: Number(data.generatedAt) || Date.now(),
    cacheSeconds: Number(data.cacheSeconds) || 60,
    stale: data.stale === true,
    streamers: Array.isArray(data.streamers) ? data.streamers.filter((row) => row && typeof row.slug === 'string') : [],
    archive: Array.isArray(data.archive) ? data.archive.filter((row) => row && typeof row.slug === 'string') : [],
  };
}

export async function getStreamerPage(slug: string, signal?: AbortSignal): Promise<StreamerDetail> {
  const response = await fetch(`/api/streamers/${encodeURIComponent(slug)}`, { cache: 'default', signal });
  if (!response.ok) throw new Error('streamer_unavailable');
  const data = (await response.json()) as Partial<StreamerDetail>;
  const streamer = data.streamer && typeof data.streamer.slug === 'string' ? data.streamer : { slug, nickname: slug, viewersPeak: 0, viewersAvg: 0, matches: 0, elo: null };
  return {
    ok: data.ok !== false,
    found: data.found === true,
    generatedAt: Number(data.generatedAt) || Date.now(),
    cacheSeconds: Number(data.cacheSeconds) || 60,
    stale: data.stale === true,
    streamer,
    days: Math.max(1, Number(data.days) || 90),
    series: Array.isArray(data.series) ? data.series : [],
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
  };
}
