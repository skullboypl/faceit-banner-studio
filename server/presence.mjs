import { clientIp } from '../shared/client-ip.mjs';
import { createRateLimiter } from '../shared/rate-limit.mjs';
import { fillFromPlayerId, publicRanking, sanitizeInfo } from './live.mjs';

const ACTIVE_WINDOW_MS = 135_000;
const MAX_SESSIONS = 100_000;
/** More distinct banners than this from one address is not a streamer, it is somebody inflating the counter. */
const MAX_BANNERS_PER_IP = 30;
const LOCKOUT = { strikes: 5, windowMs: 5 * 60_000, blockMs: 15 * 60_000 };

/** id → { lastSeen, ip }; the id is a random string the widget keeps in its own localStorage. */
const sessions = new Map();
const bannersPerIp = new Map();

function forget(id) {
  const entry = sessions.get(id);
  if (!entry) return;
  sessions.delete(id);
  const left = (bannersPerIp.get(entry.ip) ?? 1) - 1;
  if (left > 0) bannersPerIp.set(entry.ip, left);
  else bannersPerIp.delete(entry.ip);
}

function prune(now = Date.now()) {
  for (const [id, entry] of sessions) {
    if (now - entry.lastSeen > ACTIVE_WINDOW_MS) forget(id);
  }
}

function sendJson(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2048) reject(new Error('payload_too_large'));
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

/** Banners seen in the activity window (read in-process by the admin overview). */
export const getPresenceCount = () => {
  prune();
  return sessions.size;
};

/** Public board: nick, ELO, level, country. No session id and no address. */
export async function getLiveBoard() {
  prune();
  const entries = [];
  for (const entry of sessions.values()) {
    if (entry.info) entries.push({ info: { ...entry.info }, lastSeen: entry.lastSeen });
  }
  await fillFromPlayerId(entries);
  const players = publicRanking(entries);
  return {
    online: sessions.size,
    ranked: players.length,
    windowSeconds: ACTIVE_WINDOW_MS / 1000,
    players: players.slice(0, 200),
  };
}

const trustedHops = () => Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);

export function createPresenceMiddleware({ unlimitedRate = false } = {}) {
  const allow = () => true;
  const postLimit = unlimitedRate ? allow : createRateLimiter({ perMinute: 12, blockAfter: LOCKOUT });
  const getLimit = unlimitedRate ? allow : createRateLimiter({ perMinute: 60, blockAfter: LOCKOUT });

  return async (req, res, next) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    if (pathname !== '/api/presence' && pathname !== '/api/presence/live') return next();

    const now = Date.now();
    prune(now);
    const ip = clientIp(req.headers, req.socket.remoteAddress, trustedHops());

    if (req.method === 'GET') {
      if (!getLimit(ip)) return sendJson(res, 429, { error: 'rate_limited' }, { 'Retry-After': '60' });
      if (pathname === '/api/presence/live') return sendJson(res, 200, await getLiveBoard());
      return sendJson(res, 200, {
        online: sessions.size,
        windowSeconds: ACTIVE_WINDOW_MS / 1000,
      });
    }

    if (pathname !== '/api/presence' || req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return sendJson(res, 405, { error: 'method_not_allowed' });
    }

    if (!postLimit(ip)) return sendJson(res, 429, { error: 'rate_limited' }, { 'Retry-After': '60' });

    try {
      const body = await readJson(req);
      const id = typeof body.id === 'string' ? body.id : '';
      if (!/^[a-zA-Z0-9_-]{16,80}$/.test(id)) {
        return sendJson(res, 400, { error: 'invalid_session' });
      }
      const known = sessions.get(id);
      if (!known) {
        if (sessions.size >= MAX_SESSIONS) {
          prune(now);
          if (sessions.size >= MAX_SESSIONS) return sendJson(res, 503, { error: 'capacity' });
        }
        if ((bannersPerIp.get(ip) ?? 0) >= MAX_BANNERS_PER_IP) {
          return sendJson(res, 429, { error: 'too_many_banners' }, { 'Retry-After': '120' });
        }
        bannersPerIp.set(ip, (bannersPerIp.get(ip) ?? 0) + 1);
      }
      const info = body.info === undefined ? known?.info ?? null : sanitizeInfo(body.info) ?? known?.info ?? null;
      sessions.set(id, { lastSeen: now, ip: known?.ip ?? ip, info, firstSeen: known?.firstSeen ?? now });
      return sendJson(res, 200, {
        online: sessions.size,
        windowSeconds: ACTIVE_WINDOW_MS / 1000,
      });
    } catch (error) {
      return sendJson(res, error.message === 'payload_too_large' ? 413 : 400, {
        error: error.message,
      });
    }
  };
}
