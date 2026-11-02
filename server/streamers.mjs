/**
 * Streamer analytics: daily rollups already live in store.mjs (Postgres + memory).
 * Redis holds the hot ranking / page snapshots. One in-flight build per key so a
 * burst of /streamers hits does not stampede FACEIT, Twitch or Kick.
 *
 * Viewer counts come from the existing Twitch enrich (`custom_twitch_api`) and
 * Kick public v2 — not Helix. TWITCH_CLIENT_ID/SECRET and KICK_* are OAuth pairing
 * only; Helix `streams:read` is unused.
 *
 * Offline board rows never enter rank math: ingest writes viewer/ELO points only
 * while Twitch/Kick report live (or live=true / viewers > 0).
 */
import {
  downsamplePoints,
  fillStreamerDays,
  groupStreamerSessions,
  guidForChannel,
  isLiveStreamerSample,
  lastMatchFromHistory,
  loadFaceitProfile,
  recordStreamerSample,
  redisCall,
  STREAMER_KEEP_DAYS,
  streamerArchiveRows,
  streamerDailySeries,
  streamerIdentity,
  streamerRankingRows,
  streamerSamplePoints,
  streamerSlugFrom,
  summarizeStreamerDays,
} from './store.mjs';

export const STREAMERS_RANK_KEY = 'fb:streamers:rank';
export const STREAMERS_PAGE_PREFIX = 'fb:streamers:page:';
export const STREAMERS_SAMPLES_PREFIX = 'fb:streamers:samples:';
export const STREAMERS_TTL_SECONDS = 60;
export const STREAMERS_SAMPLES_KEEP = 200;
export const STREAMER_RESERVED = new Set(['ranking', 'stats']);
const RANK_DAYS = 7;
const MAX_SESSIONS = 24;
const MAX_SESSION_POINTS = 80;
const SLUG = /^[A-Za-z0-9_-]{3,25}$/;
const BOT =
  /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex|facebookexternalhit|twitterbot|linkedinbot|embedly|whatsapp|telegrambot/i;

export function isReservedStreamerSlug(slug) {
  return STREAMER_RESERVED.has(String(slug || '').toLowerCase());
}

export function createDebouncer() {
  const pending = new Map();
  return {
    run(key, fn) {
      const waiting = pending.get(key);
      if (waiting) return waiting;
      const task = Promise.resolve()
        .then(fn)
        .finally(() => pending.delete(key));
      pending.set(key, task);
      return task;
    },
    has(key) {
      return pending.has(key);
    },
    get size() {
      return pending.size;
    },
    reset() {
      pending.clear();
    },
  };
}

export const streamerDebounce = createDebouncer();

let ingestQueue = [];
let lastGoodRank = null;
const lastGoodPage = new Map();
const liveOverlay = new Map();

export function resetStreamerRuntimeForTests() {
  streamerDebounce.reset();
  ingestQueue = [];
  lastGoodRank = null;
  lastGoodPage.clear();
  liveOverlay.clear();
}

function liveViewers(player) {
  const twitch = player?.twitchStatus;
  const kick = player?.kickStatus;
  if (twitch?.state === 'live') return Number.isInteger(twitch.viewers) ? twitch.viewers : 0;
  if (kick?.state === 'live') return Number.isInteger(kick.viewers) ? kick.viewers : 0;
  return null;
}

export function playerToSample(player) {
  if (!player || typeof player !== 'object') return null;
  const viewers = liveViewers(player);
  const live = viewers != null;
  return {
    twitch: player.twitch,
    kick: player.kick,
    nickname: player.nickname,
    avatar: player.avatar,
    elo: player.elo,
    guid: player.playerId,
    viewers: live ? viewers : null,
    live,
    matchId: player.lastMatch?.matchId,
  };
}

async function faceitBits(sample) {
  const guid = sample.guid || (await guidForChannel(sample));
  if (!guid) return { ...sample, guid: sample.guid || null };
  const row = await streamerDebounce.run(`faceit:${guid}`, () => loadFaceitProfile(guid));
  const elo = Number.isInteger(sample.elo) ? sample.elo : Number.isInteger(row?.profile?.elo) ? row.profile.elo : sample.elo;
  let matchId = sample.matchId || row?.profile?.lastMatch?.matchId || '';
  if (!matchId && row?.answers) {
    for (const entry of Object.values(row.answers)) {
      const last = typeof entry?.body === 'string' ? lastMatchFromHistory(entry.body) : null;
      if (last?.matchId) {
        matchId = last.matchId;
        break;
      }
    }
  }
  return { ...sample, guid, elo, matchId };
}

function samplePointFrom(sample, at) {
  return {
    ts: at instanceof Date ? at.getTime() : Number(at) || Date.now(),
    elo: Number.isInteger(sample.elo) ? sample.elo : null,
    viewers: Number.isInteger(sample.viewers) ? sample.viewers : null,
    matchId: typeof sample.matchId === 'string' ? sample.matchId : '',
  };
}

async function pushHotSample(slug, point) {
  if (!slug || !point?.ts) return;
  await redisCall(async (redis) => {
    const key = `${STREAMERS_SAMPLES_PREFIX}${slug}`;
    await redis.lpush(key, JSON.stringify(point));
    await redis.ltrim(key, 0, STREAMERS_SAMPLES_KEEP - 1);
    await redis.expire(key, STREAMER_KEEP_DAYS * 24 * 3600);
  });
}

async function loadHotSamples(slug) {
  const raw = await redisCall((redis) => redis.lrange(`${STREAMERS_SAMPLES_PREFIX}${slug}`, 0, STREAMERS_SAMPLES_KEEP - 1));
  if (!Array.isArray(raw) || !raw.length) return [];
  return raw
    .map((entry) => {
      try {
        return typeof entry === 'string' ? JSON.parse(entry) : entry;
      } catch {
        return null;
      }
    })
    .filter((point) => point && Number.isFinite(Number(point.ts)))
    .map((point) => ({
      ts: Number(point.ts),
      elo: Number.isInteger(Number(point.elo)) ? Number(point.elo) : null,
      viewers: Number.isInteger(Number(point.viewers)) ? Number(point.viewers) : null,
      matchId: typeof point.matchId === 'string' ? point.matchId : '',
    }))
    .sort((a, b) => a.ts - b.ts);
}

function shapeSessions(points) {
  return groupStreamerSessions(points)
    .slice(0, MAX_SESSIONS)
    .map((session) => ({
      ...session,
      points: downsamplePoints(session.points, MAX_SESSION_POINTS),
    }));
}

export function ingestLiveStreamers(players, at = new Date()) {
  const samples = (players || []).map(playerToSample).filter((sample) => sample && streamerSlugFrom(sample));
  if (!samples.length) return Promise.resolve();
  ingestQueue.push({ samples, at });
  return streamerDebounce.run('ingest', async () => {
    do {
      const batch = ingestQueue;
      ingestQueue = [];
      for (const { samples: group, at: when } of batch) {
        for (const sample of group) {
          const slug = streamerSlugFrom(sample);
          if (isLiveStreamerSample(sample)) {
            liveOverlay.set(slug, { viewers: sample.viewers ?? 0, elo: sample.elo ?? null, at: Date.now() });
            const rich = await faceitBits({ ...sample, live: true });
            await recordStreamerSample(rich, when);
            await pushHotSample(slug, samplePointFrom(rich, when));
          } else {
            liveOverlay.delete(slug);
            await recordStreamerSample({ ...sample, live: false, viewers: null }, when);
          }
        }
      }
    } while (ingestQueue.length);
  });
}

function rankingPayload(rows, archive, days) {
  return {
    ok: true,
    days,
    historyDays: STREAMER_KEEP_DAYS,
    generatedAt: Date.now(),
    cacheSeconds: STREAMERS_TTL_SECONDS,
    streamers: rows.map((row) => {
      const live = liveOverlay.get(row.slug);
      return {
        slug: row.slug,
        nickname: row.nickname || row.slug,
        avatar: row.avatar || null,
        platform: row.platform || (row.twitch ? 'twitch' : 'kick'),
        twitch: row.twitch || null,
        kick: row.kick || null,
        viewersPeak: Number(row.viewersPeak) || 0,
        viewersAvg: Number(row.viewersAvg) || 0,
        matches: Number(row.matches) || 0,
        elo: Number.isInteger(Number(row.elo)) ? Number(row.elo) : live?.elo ?? null,
        live: Boolean(live),
        viewers: live ? live.viewers : 0,
      };
    }),
    archive: (archive || []).map((row) => ({
      slug: row.slug,
      nickname: row.nickname || row.slug,
      avatar: row.avatar || null,
      platform: row.platform || (row.twitch ? 'twitch' : 'kick'),
      twitch: row.twitch || null,
      kick: row.kick || null,
      elo: Number.isInteger(Number(row.elo)) ? Number(row.elo) : null,
      lastDay: row.lastDay || null,
    })),
  };
}

export async function buildStreamerRanking(days = RANK_DAYS) {
  return streamerDebounce.run('rank', async () => {
    const cached = await redisCall((redis) => redis.get(STREAMERS_RANK_KEY));
    if (typeof cached === 'string') {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.streamers)) {
          lastGoodRank = parsed;
          return parsed;
        }
      } catch {
        /* rebuild from Postgres / memory */
      }
    }
    try {
      const [rows, archive] = await Promise.all([streamerRankingRows(days), streamerArchiveRows()]);
      const body = rankingPayload(rows, archive, days);
      lastGoodRank = body;
      await redisCall((redis) => redis.set(STREAMERS_RANK_KEY, JSON.stringify(body), 'EX', STREAMERS_TTL_SECONDS));
      return body;
    } catch {
      return (
        lastGoodRank || {
          ok: true,
          days,
          historyDays: STREAMER_KEEP_DAYS,
          generatedAt: Date.now(),
          cacheSeconds: STREAMERS_TTL_SECONDS,
          streamers: [],
          archive: [],
          stale: true,
        }
      );
    }
  });
}

function pagePayload(slug, identity, history, sessions) {
  const totals = summarizeStreamerDays(history.series);
  const live = liveOverlay.get(history.slug || slug);
  const found = Boolean(
    identity ||
      history.series.some((point) => point.viewersSamples || point.matches || point.elo != null) ||
      (sessions || []).length
  );
  return {
    ok: true,
    found,
    generatedAt: Date.now(),
    cacheSeconds: STREAMERS_TTL_SECONDS,
    streamer: {
      slug: history.slug || slug,
      nickname: identity?.nickname || history.slug || slug,
      avatar: identity?.avatar || null,
      platform: identity?.platform || (identity?.twitch ? 'twitch' : 'kick'),
      twitch: identity?.twitch || null,
      kick: identity?.kick || null,
      elo: totals.elo,
      viewersPeak: totals.viewersPeak,
      viewersAvg: totals.viewersAvg,
      matches: totals.matches,
      live: Boolean(live),
      viewers: live ? live.viewers : 0,
    },
    days: history.days,
    series: history.series,
    sessions: sessions || [],
  };
}

async function loadPagePoints(slug, days) {
  const stored = await streamerSamplePoints(slug, days);
  if (stored.points.length) return stored.points;
  return loadHotSamples(slug);
}

export async function buildStreamerPage(slug, days = STREAMER_KEEP_DAYS) {
  const key = String(slug || '').toLowerCase();
  if (isReservedStreamerSlug(key)) return buildStreamerRanking(RANK_DAYS);
  if (!SLUG.test(key)) {
    return {
      ok: true,
      found: false,
      generatedAt: Date.now(),
      cacheSeconds: STREAMERS_TTL_SECONDS,
      streamer: { slug: key, nickname: key, viewersPeak: 0, viewersAvg: 0, matches: 0, elo: null, live: false, viewers: 0 },
      days,
      series: fillStreamerDays([], days),
      sessions: [],
    };
  }
  return streamerDebounce.run(`page:${key}`, async () => {
    const redisKey = `${STREAMERS_PAGE_PREFIX}${key}`;
    const cached = await redisCall((redis) => redis.get(redisKey));
    if (typeof cached === 'string') {
      try {
        const parsed = JSON.parse(cached);
        if (parsed?.streamer && Array.isArray(parsed.series)) {
          lastGoodPage.set(key, parsed);
          return parsed;
        }
      } catch {
        /* rebuild */
      }
    }
    try {
      const [identity, history, points] = await Promise.all([
        streamerIdentity(key),
        streamerDailySeries(key, days),
        loadPagePoints(key, days),
      ]);
      const body = pagePayload(key, identity, history, shapeSessions(points));
      lastGoodPage.set(key, body);
      await redisCall((redis) => redis.set(redisKey, JSON.stringify(body), 'EX', STREAMERS_TTL_SECONDS));
      return body;
    } catch {
      return (
        lastGoodPage.get(key) || {
          ok: true,
          found: false,
          generatedAt: Date.now(),
          cacheSeconds: STREAMERS_TTL_SECONDS,
          streamer: { slug: key, nickname: key, viewersPeak: 0, viewersAvg: 0, matches: 0, elo: null, live: false, viewers: 0 },
          days,
          series: fillStreamerDays([], days),
          sessions: [],
          stale: true,
        }
      );
    }
  });
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', `public, max-age=${STREAMERS_TTL_SECONDS}`);
  res.end(JSON.stringify(data));
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLiveHtml() {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Nasi streamerzy FACEIT Banner</title><meta name="description" content="Kanały Twitch i Kick na żywo z banerem FACEIT. Ranking i pełna historia są na osobnej stronie."><link rel="canonical" href="https://faceitbanner.vxh.pl/streamers"></head><body><h1>Nasi streamerzy</h1><p><a href="/streamers/ranking">Ranking i historia streamerów</a></p></body></html>`;
}

function renderRankHtml(rank) {
  const items = (rank.streamers || [])
    .map(
      (row) =>
        `<li><a href="/streamers/${escapeHtml(row.slug)}">${escapeHtml(row.nickname)}</a> — śr. ${row.viewersAvg} widzów</li>`
    )
    .join('');
  const archive = (rank.archive || [])
    .map((row) => `<li><a href="/streamers/${escapeHtml(row.slug)}">${escapeHtml(row.nickname)}</a></li>`)
    .join('');
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Ranking streamerów FACEIT – widzowie z 7 dni</title><meta name="description" content="Ranking streamerów Twitch i Kick z banerem FACEIT. Widzowie z 7 dni, średnia, ELO i mecze CS2."><link rel="canonical" href="https://faceitbanner.vxh.pl/streamers/ranking"></head><body><p><a href="/streamers">Nasi streamerzy</a></p><h1>Ranking streamerów – 7 dni</h1><ol>${items || '<li>Brak zapisanych widzów.</li>'}</ol><h2>Pełna historia streamerów</h2><ul>${archive || '<li>Brak zapisanych streamerów.</li>'}</ul></body></html>`;
}

function renderPageHtml(page) {
  const name = escapeHtml(page.streamer?.nickname || page.streamer?.slug);
  const slug = escapeHtml(page.streamer?.slug);
  const rows = (page.series || [])
    .map((point) => `<tr><td>${escapeHtml(point.day)}</td><td>${point.viewersAvg}</td><td>${point.elo ?? '—'}</td><td>${point.matches}</td></tr>`)
    .join('');
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${name} · Streamerzy FACEIT Banner</title><meta name="description" content="${name} na FACEIT Banner: widzowie, ELO i mecze z każdego dnia."><link rel="canonical" href="https://faceitbanner.vxh.pl/streamers/${slug}"></head><body><p><a href="/streamers">Wszyscy streamerzy</a> · <a href="/streamers/ranking">Ranking</a></p><h1>${name}</h1><table><thead><tr><th>Dzień</th><th>Widzowie</th><th>ELO</th><th>Mecze</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

function isRankingPath(pathname) {
  return pathname === '/streamers/ranking' || pathname === '/streamers/stats' || pathname === '/api/streamers/ranking' || pathname === '/api/streamers/stats';
}

export function createStreamersMiddleware() {
  return async (req, res, next) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = url.pathname;
    if (req.method !== 'GET') return next();
    if (pathname === '/api/streamers' || pathname === '/api/streamers/ranking' || pathname === '/api/streamers/stats') {
      return sendJson(res, 200, await buildStreamerRanking(RANK_DAYS));
    }
    const api = pathname.match(/^\/api\/streamers\/([A-Za-z0-9_-]{3,25})$/i);
    if (api) {
      const slug = api[1].toLowerCase();
      if (isReservedStreamerSlug(slug)) return sendJson(res, 200, await buildStreamerRanking(RANK_DAYS));
      return sendJson(res, 200, await buildStreamerPage(slug));
    }
    if (BOT.test(String(req.headers['user-agent'] || ''))) {
      if (pathname === '/streamers') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end(renderLiveHtml());
      }
      if (isRankingPath(pathname)) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end(renderRankHtml(await buildStreamerRanking(RANK_DAYS)));
      }
      const page = pathname.match(/^\/streamers\/([A-Za-z0-9_-]{3,25})$/i);
      if (page && !isReservedStreamerSlug(page[1])) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end(renderPageHtml(await buildStreamerPage(page[1].toLowerCase())));
      }
    }
    return next();
  };
}
