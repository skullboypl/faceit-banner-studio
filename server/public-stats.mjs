// Public, read-only FACEIT summary for partner overlays (overlays.vxh.pl).
// GET /api/faceit/public/<player_id | nickname>?matches=20
// Answers one small JSON built from the same cached reads the banners use, so a webcam frame
// on overlays.vxh.pl can draw ELO and stats natively without its own FACEIT key.

import { createRateLimiter } from '../shared/rate-limit.mjs';
import { clientIp } from '../shared/client-ip.mjs';
import { readFaceit } from './faceit-proxy.mjs';

const PREFIX = '/api/faceit/public/';
const PLAYER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NICK = /^[A-Za-z0-9_.-]{2,32}$/;
/** Composed answers are reused this long; the FACEIT reads underneath have their own cache. */
const ANSWER_TTL_MS = 20_000;
const ANSWER_LIMIT = 500;

/** Sites allowed to read this from a browser. Local dev of the overlays studio is allowed too. */
export const PUBLIC_ORIGINS = [/^https:\/\/overlays\.vxh\.pl$/, /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
export const allowedOrigin = (origin) => (typeof origin === 'string' && PUBLIC_ORIGINS.some((r) => r.test(origin)) ? origin : '');

const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Same math as the banner widget: averages over the newest finished matches. */
export function summarize(items, limit) {
  const rows = (Array.isArray(items) ? items : []).slice(0, Math.max(0, limit));
  let kills = 0, deaths = 0, hsPct = 0, hsN = 0, adr = 0, adrN = 0, wins = 0, losses = 0;
  const form = [];
  for (const row of rows) {
    const s = row?.stats ?? {};
    kills += num(s.Kills);
    deaths += num(s.Deaths);
    if (num(s['Headshots %']) > 0) { hsPct += num(s['Headshots %']); hsN += 1; }
    const d = num(s.ADR ?? s['Average Damage per Round']);
    if (d > 0) { adr += d; adrN += 1; }
    const r = String(s.Result ?? '');
    if (r === '1') { wins += 1; form.push('W'); } else if (r === '0') { losses += 1; form.push('L'); }
  }
  let streak = 0;
  for (const m of form) { if (m !== 'W') break; streak += 1; }
  const played = wins + losses;
  return {
    matches: rows.length,
    kd: round(deaths > 0 ? kills / deaths : kills),
    avgKills: round(rows.length ? kills / rows.length : 0, 1),
    winRate: round(played ? (wins / played) * 100 : 0, 0),
    hs: round(hsN ? hsPct / hsN : 0, 0),
    adr: round(adrN ? adr / adrN : 0, 1),
    wins,
    losses,
    streak,
    form: form.slice(0, 10),
  };
}

const parse = (entry) => {
  if (!entry || entry.status !== 200) return null;
  try { return JSON.parse(entry.body); } catch { return null; }
};

/** Builds the summary. `load` is injectable for tests. */
export async function publicSummary(who, matches, load = readFaceit) {
  const profile = parse(await load(PLAYER.test(who) ? `/players/${who.toLowerCase()}` : `/players?nickname=${encodeURIComponent(who)}`));
  if (!profile?.player_id) return { status: 404, body: { error: 'player_not_found' } };
  const id = profile.player_id;
  const [recent, lifetime] = await Promise.all([
    load(`/players/${id}/games/cs2/stats?limit=${Math.min(100, Math.max(matches, 20))}`).then(parse),
    load(`/players/${id}/stats/cs2`).then(parse),
  ]);
  const cs2 = profile.games?.cs2 ?? {};
  const life = lifetime?.lifetime ?? {};
  return {
    status: 200,
    body: {
      player_id: id,
      nickname: profile.nickname,
      avatar: profile.avatar || '',
      country: profile.country || '',
      level: num(cs2.skill_level),
      elo: num(cs2.faceit_elo),
      calibrating: Boolean(profile.calibrating),
      recent: summarize(recent?.items, matches),
      lifetime: {
        matches: num(life.Matches),
        winRate: num(life['Win Rate %']),
        kd: num(life['Average K/D Ratio']),
        hs: num(life['Average Headshots %']),
        winStreak: num(life['Current Win Streak']),
        longestStreak: num(life['Longest Win Streak']),
      },
      updated: new Date().toISOString(),
    },
  };
}

const answers = new Map();
const limit = createRateLimiter({ perMinute: 120, blockAfter: { strikes: 8, windowMs: 60_000, blockMs: 60_000 } });

function send(res, status, body, origin) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=20');
  res.setHeader('Vary', 'Origin');
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  }
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

/** Returns false when the request is not for this endpoint. */
export async function handlePublicStats(req, res, { unlimitedRate = false, now = Date.now, load = readFaceit } = {}) {
  const url = new URL(req.url || '/', 'http://localhost');
  if (!url.pathname.startsWith(PREFIX)) return false;
  const origin = allowedOrigin(req.headers?.origin);
  if (req.method === 'OPTIONS') { send(res, 204, '', origin); return true; }
  if (req.method !== 'GET') { send(res, 405, { error: 'method_not_allowed' }, origin); return true; }

  const who = decodeURIComponent(url.pathname.slice(PREFIX.length)).trim();
  if (!PLAYER.test(who) && !NICK.test(who)) { send(res, 400, { error: 'bad_player' }, origin); return true; }
  const matches = Math.min(50, Math.max(1, Math.round(num(url.searchParams.get('matches')) || 20)));

  const ip = clientIp(req.headers, req.socket?.remoteAddress, Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1));
  if (!unlimitedRate && !limit(ip)) { send(res, 429, { error: 'rate_limited' }, origin); return true; }

  const key = `${who.toLowerCase()}|${matches}`;
  const hit = answers.get(key);
  if (hit && now() - hit.at < ANSWER_TTL_MS) { send(res, hit.status, hit.body, origin); return true; }

  let out;
  try {
    out = await publicSummary(who, matches, load);
  } catch {
    out = { status: 502, body: { error: 'faceit_unavailable' } };
  }
  const body = JSON.stringify(out.body);
  if (out.status === 200 || out.status === 404) {
    answers.delete(key);
    answers.set(key, { at: now(), status: out.status, body });
    while (answers.size > ANSWER_LIMIT) answers.delete(answers.keys().next().value);
  }
  send(res, out.status, body, origin);
  return true;
}
