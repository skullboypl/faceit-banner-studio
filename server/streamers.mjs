/**
 * Streamer analytics: daily rollups already live in store.mjs (Postgres + memory).
 * Redis holds the hot ranking / page snapshots. One in-flight build per key so a
 * burst of /streamers hits does not stampede FACEIT, Twitch or Kick.
 *
 * Viewer counts come from the existing Twitch enrich (`custom_twitch_api`) and
 * Kick public v2 — not Helix. TWITCH_CLIENT_ID/SECRET and KICK_* are OAuth pairing
 * only; Helix `streams:read` is unused.
 */
import {
  fillStreamerDays,
  guidForChannel,
  lastMatchFromHistory,
  loadFaceitProfile,
  recordStreamerSample,
  redisCall,
  streamerDailySeries,
  streamerIdentity,
  streamerRankingRows,
  streamerSlugFrom,
  summarizeStreamerDays,
} from './store.mjs';

export const STREAMERS_RANK_KEY = 'fb:streamers:rank';
export const STREAMERS_PAGE_PREFIX = 'fb:streamers:page:';
export const STREAMERS_TTL_SECONDS = 60;
const RANK_DAYS = 7;
const SLUG = /^[A-Za-z0-9_-]{3,25}$/;
const BOT =
  /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex|facebookexternalhit|twitterbot|linkedinbot|embedly|whatsapp|telegrambot/i;

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
  return {
    twitch: player.twitch,
    kick: player.kick,
    nickname: player.nickname,
    avatar: player.avatar,
    elo: player.elo,
    guid: player.playerId,
    viewers,
    live: viewers != null,
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
          if (sample.live) liveOverlay.set(slug, { viewers: sample.viewers ?? 0, elo: sample.elo ?? null, at: Date.now() });
          else liveOverlay.delete(slug);
          const rich = await faceitBits(sample);
          await recordStreamerSample(rich, when);
        }
      }
    } while (ingestQueue.length);
  });
}

function rankingPayload(rows, days) {
  return {
    ok: true,
    days,
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
      const body = rankingPayload(await streamerRankingRows(days), days);
      lastGoodRank = body;
      await redisCall((redis) => redis.set(STREAMERS_RANK_KEY, JSON.stringify(body), 'EX', STREAMERS_TTL_SECONDS));
      return body;
    } catch {
      return (
        lastGoodRank || {
          ok: true,
          days,
          generatedAt: Date.now(),
          cacheSeconds: STREAMERS_TTL_SECONDS,
          streamers: [],
          stale: true,
        }
      );
    }
  });
}

function pagePayload(slug, identity, history) {
  const totals = summarizeStreamerDays(history.series);
  const live = liveOverlay.get(history.slug || slug);
  const found = Boolean(
    identity || history.series.some((point) => point.viewersSamples || point.matches || point.elo != null)
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
  };
}

export async function buildStreamerPage(slug, days = RANK_DAYS) {
  const key = String(slug || '').toLowerCase();
  if (!SLUG.test(key)) {
    return {
      ok: true,
      found: false,
      generatedAt: Date.now(),
      cacheSeconds: STREAMERS_TTL_SECONDS,
      streamer: { slug: key, nickname: key, viewersPeak: 0, viewersAvg: 0, matches: 0, elo: null, live: false, viewers: 0 },
      days,
      series: fillStreamerDays([], days),
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
      const [identity, history] = await Promise.all([streamerIdentity(key), streamerDailySeries(key, days)]);
      const body = pagePayload(key, identity, history);
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

function renderRankHtml(rank) {
  const items = (rank.streamers || [])
    .map(
      (row) =>
        `<li><a href="/streamers/${escapeHtml(row.slug)}">${escapeHtml(row.nickname)}</a> — śr. ${row.viewersAvg} widzów</li>`
    )
    .join('');
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Ranking streamerów FACEIT – widzowie z 7 dni</title><meta name="description" content="Ranking streamerów Twitch i Kick z banerem FACEIT. Widzowie z 7 dni, średnia, ELO i mecze CS2."><link rel="canonical" href="https://faceitbanner.vxh.pl/streamers"></head><body><h1>Ranking streamerów – 7 dni</h1><ol>${items || '<li>Brak zapisanych widzów.</li>'}</ol></body></html>`;
}

function renderPageHtml(page) {
  const name = escapeHtml(page.streamer?.nickname || page.streamer?.slug);
  const slug = escapeHtml(page.streamer?.slug);
  const rows = (page.series || [])
    .map((point) => `<tr><td>${escapeHtml(point.day)}</td><td>${point.viewersAvg}</td><td>${point.elo ?? '—'}</td><td>${point.matches}</td></tr>`)
    .join('');
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${name} · Streamerzy FACEIT Banner</title><meta name="description" content="${name} na FACEIT Banner: widzowie, ELO i mecze z każdego dnia."><link rel="canonical" href="https://faceitbanner.vxh.pl/streamers/${slug}"></head><body><p><a href="/streamers">Wszyscy streamerzy</a></p><h1>${name}</h1><table><thead><tr><th>Dzień</th><th>Widzowie</th><th>ELO</th><th>Mecze</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

export function createStreamersMiddleware() {
  return async (req, res, next) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = url.pathname;
    if (req.method !== 'GET') return next();
    if (pathname === '/api/streamers') return sendJson(res, 200, await buildStreamerRanking(RANK_DAYS));
    const api = pathname.match(/^\/api\/streamers\/([A-Za-z0-9_-]{3,25})$/i);
    if (api) return sendJson(res, 200, await buildStreamerPage(api[1].toLowerCase(), RANK_DAYS));
    if (BOT.test(String(req.headers['user-agent'] || ''))) {
      if (pathname === '/streamers') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end(renderRankHtml(await buildStreamerRanking(RANK_DAYS)));
      }
      const page = pathname.match(/^\/streamers\/([A-Za-z0-9_-]{3,25})$/i);
      if (page) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end(renderPageHtml(await buildStreamerPage(page[1].toLowerCase(), RANK_DAYS)));
      }
    }
    return next();
  };
}
