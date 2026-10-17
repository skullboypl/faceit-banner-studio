import { createHash, randomBytes } from 'node:crypto';
import { clientIp as resolveClientIp } from '../shared/client-ip.mjs';
import { createRateLimiter } from '../shared/rate-limit.mjs';
import { clearLiveBoard, getPresenceCount, hydratePresence } from './presence.mjs';
import { clearFaceitCache } from './faceit-proxy.mjs';
import { readBannerCatalog, writeBannerCatalog } from './catalog.mjs';
import { clearLiveCache, lookupPlayer, lookupRanking } from './live.mjs';
import { purgeFrontCache } from './cdn-cache.mjs';
import {
  consumeState,
  deleteSession,
  loadSession,
  loginActivity,
  onlineHistory,
  recentLogins,
  loginsForUser,
  recordLogin,
  saveSession,
  saveState,
  storageStatus,
} from './store.mjs';

const AUTHORIZE_URL = 'https://accounts.faceit.com/accounts';
const TOKEN_URL = 'https://api.faceit.com/auth/v1/oauth/token';
const USERINFO_URL = 'https://api.faceit.com/auth/v1/resources/userinfo';
const SESSION_COOKIE = 'fb_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const trustedHops = () => Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim().split('='))
      .filter(([name]) => name)
      .map(([name, ...rest]) => [name, decodeURIComponent(rest.join('='))])
  );
}

function publicUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers.host}`;
}

function setCookie(res, req, value, maxAge) {
  const secure = publicUrl(req).startsWith('https://') ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
  );
}

function clientIp(req) {
  return resolveClientIp(req.headers, req.socket.remoteAddress, trustedHops());
}

const DEV_ADMIN_USER = { guid: 'dev-admin', nickname: 'Dev Admin', avatar: null };

function requestHost(req) {
  const raw = String(req.headers.host || '');
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']');
    return end === -1 ? raw : raw.slice(1, end);
  }
  return raw.split(':')[0];
}

/** Local `dev:admin` only. Production and any public host never receive this user. */
export function localDevAdmin(req) {
  if (process.env.DEV_ADMIN !== '1' || process.env.NODE_ENV === 'production') return false;
  const host = requestHost(req);
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export function isAdmin(user) {
  if (
    user?.guid === DEV_ADMIN_USER.guid &&
    process.env.DEV_ADMIN === '1' &&
    process.env.NODE_ENV !== 'production'
  ) {
    return true;
  }
  const admins = String(process.env.ADMIN_FACEIT_GUIDS || process.env.ADMIN_FACEIT_GUID || '')
    .split(',')
    .map((guid) => guid.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(user && admins.includes(String(user.guid).toLowerCase()));
}

async function currentUser(req) {
  const id = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (id && /^[a-f0-9]{48}$/.test(id)) {
    const user = await loadSession(id);
    if (user) return user;
  }
  return localDevAdmin(req) ? DEV_ADMIN_USER : null;
}

async function handleLogin(req, res) {
  const clientId = process.env.FACEIT_OAUTH_CLIENT_ID;
  if (!clientId) return sendJson(res, 503, { error: 'oauth_not_configured' });
  const state = randomBytes(24).toString('hex');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  await saveState(state, verifier);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: `${publicUrl(req)}/api/auth/callback`,
    scope: 'openid profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    redirect_popup: 'true',
  });
  redirect(res, `${AUTHORIZE_URL}?${params}`);
}

async function handleCallback(req, res, url) {
  const clientId = process.env.FACEIT_OAUTH_CLIENT_ID;
  const secret = process.env.FACEIT_OAUTH_CLIENT_SECRET;
  if (!clientId || !secret) return sendJson(res, 503, { error: 'oauth_not_configured' });

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (url.searchParams.get('error') || !code || !state) {
    return redirect(res, '/?login=cancelled');
  }
  const verifier = await consumeState(state);
  if (!verifier) return redirect(res, '/?login=expired');

  const basic = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const tokenResponse = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${publicUrl(req)}/api/auth/callback`,
      code_verifier: verifier,
    }),
  });
  if (!tokenResponse.ok) return redirect(res, '/?login=failed');
  const { access_token: accessToken } = await tokenResponse.json();

  const infoResponse = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!infoResponse.ok) return redirect(res, '/?login=failed');
  const info = await infoResponse.json();

  const user = {
    guid: String(info.guid ?? info.sub ?? ''),
    nickname: String(info.nickname ?? info.preferred_username ?? info.name ?? 'player'),
    avatar: info.picture ?? info.avatar ?? null,
  };
  if (!user.guid) return redirect(res, '/?login=failed');

  const sessionId = randomBytes(24).toString('hex');
  await saveSession(sessionId, user);
  await recordLogin(user, clientIp(req)).catch(() => undefined);
  setCookie(res, req, sessionId, SESSION_MAX_AGE);
  redirect(res, '/');
}

const LOCKOUT = { strikes: 5, windowMs: 5 * 60_000, blockMs: 15 * 60_000 };

/** PUBLIC_URL may list several origins, comma separated. */
function readJson(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 8192) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        resolve(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null);
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const wanted = new URL(origin);
    if (
      process.env.DEV_ADMIN === '1' &&
      process.env.NODE_ENV !== 'production' &&
      (wanted.hostname === '127.0.0.1' || wanted.hostname === 'localhost' || wanted.hostname === '::1')
    ) {
      return true;
    }
    const wantedOrigin = wanted.origin;
    return String(process.env.PUBLIC_URL ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .some((value) => new URL(value).origin === wantedOrigin);
  } catch {
    return false;
  }
}

/** FACEIT answers and the live board. CSS on Cloudflare is a separate button: it talks to the CDN. */
const CACHE_KINDS = ['faceit', 'profiles', 'avatars', 'rankings', 'live'];

export function createAuthMiddleware() {
  const limits = {
    login: createRateLimiter({ perMinute: 10, blockAfter: LOCKOUT }),
    callback: createRateLimiter({ perMinute: 20, blockAfter: LOCKOUT }),
    me: createRateLimiter({ perMinute: 120, blockAfter: LOCKOUT }),
    logout: createRateLimiter({ perMinute: 20, blockAfter: LOCKOUT }),
    catalog: createRateLimiter({ perMinute: 120, blockAfter: LOCKOUT }),
    admin: createRateLimiter({ perMinute: 60, blockAfter: LOCKOUT }),
  };

  return async (req, res, next) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const { pathname } = url;
    if (
      !pathname.startsWith('/api/auth/') &&
      pathname !== '/api/admin/overview' &&
      pathname !== '/api/admin/cache' &&
      pathname !== '/api/catalog' &&
      pathname !== '/api/admin/catalog'
    ) {
      return next();
    }

    const ip = clientIp(req);
    const bucket = pathname.endsWith('/login')
      ? 'login'
      : pathname.endsWith('/callback')
        ? 'callback'
        : pathname.endsWith('/me') || pathname.endsWith('/profile')
          ? 'me'
        : pathname.endsWith('/logout')
          ? 'logout'
          : pathname === '/api/catalog'
            ? 'catalog'
            : 'admin';
    if (!limits[bucket](ip)) {
      res.setHeader('Retry-After', '60');
      return sendJson(res, 429, { error: 'rate_limited' });
    }

    try {
      if (pathname === '/api/auth/login' && req.method === 'GET') {
        return await handleLogin(req, res);
      }
      if (pathname === '/api/auth/callback' && req.method === 'GET') {
        return await handleCallback(req, res, url);
      }
      if (pathname === '/api/auth/me' && req.method === 'GET') {
        const user = await currentUser(req);
        return sendJson(res, 200, user ? { user, admin: isAdmin(user) } : { user: null, admin: false });
      }
      if (pathname === '/api/auth/profile' && req.method === 'GET') {
        const user = await currentUser(req);
        if (!user) return sendJson(res, 401, { error: 'unauthorized' });
        const faceitId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.guid)
          ? user.guid.toLowerCase()
          : '';
        const profile = faceitId ? await lookupPlayer(faceitId) : null;
        const ranking = !profile?.calibrating && profile?.level === 10 ? await lookupRanking(faceitId, profile.region) : null;
        const logins = await loginsForUser(user.guid, 8);
        return sendJson(res, 200, {
          nickname: user.nickname,
          avatar: faceitId ? `/api/presence/avatar/${faceitId}` : null,
          faceit: profile
            ? {
                elo: Number.isInteger(profile.elo) ? profile.elo : null,
                level: profile.calibrating || !Number.isInteger(profile.level) ? null : profile.level,
                calibrating: profile.calibrating === true,
                country: profile.country || null,
                ranking: profile.calibrating || !(Number.isInteger(ranking) && ranking >= 1 && ranking <= 1000) ? null : ranking,
                verifiedBadge: profile.verifiedBadge || 'none',
              }
            : null,
          logins: logins.map((entry) => ({ createdAt: entry.createdAt })),
        });
      }
      if (pathname === '/api/auth/logout' && req.method === 'POST') {
        if (!originAllowed(req)) return sendJson(res, 403, { error: 'bad_origin' });
        const id = parseCookies(req.headers.cookie)[SESSION_COOKIE];
        if (id) await deleteSession(id);
        setCookie(res, req, '', 0);
        return sendJson(res, 200, { ok: true });
      }
      if (pathname === '/api/catalog' && req.method === 'GET') {
        return sendJson(res, 200, { modes: await readBannerCatalog() });
      }
      if (pathname === '/api/admin/catalog' && (req.method === 'GET' || req.method === 'PUT')) {
        const user = await currentUser(req);
        if (!user) return sendJson(res, 401, { error: 'unauthorized' });
        if (!isAdmin(user)) return sendJson(res, 403, { error: 'forbidden' });
        if (req.method === 'GET') return sendJson(res, 200, { modes: await readBannerCatalog() });
        if (!originAllowed(req)) return sendJson(res, 403, { error: 'bad_origin' });
        const body = await readJson(req);
        const patch = body?.modes;
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
          return sendJson(res, 400, { error: 'invalid_body' });
        }
        return sendJson(res, 200, { modes: await writeBannerCatalog(patch) });
      }
      if (pathname === '/api/admin/cache' && req.method === 'POST') {
        const user = await currentUser(req);
        if (!user) return sendJson(res, 401, { error: 'unauthorized' });
        if (!isAdmin(user)) return sendJson(res, 403, { error: 'forbidden' });
        if (!originAllowed(req)) return sendJson(res, 403, { error: 'bad_origin' });
        const scope = (await readJson(req))?.scope;
        if (scope === 'css') {
          try {
            return sendJson(res, 200, { cleared: await purgeFrontCache() });
          } catch (failure) {
            const code = failure?.code || failure?.message;
            if (code === 'cdn_not_configured') return sendJson(res, 503, { error: 'cdn_not_configured' });
            return sendJson(res, 502, { error: 'cdn_purge_failed' });
          }
        }
        const kinds = scope === 'all' ? CACHE_KINDS : CACHE_KINDS.includes(scope) ? [scope] : null;
        if (!kinds) return sendJson(res, 400, { error: 'invalid_scope' });
        for (const kind of kinds) {
          if (kind === 'faceit') clearFaceitCache();
          else if (kind === 'live') clearLiveBoard();
          else await clearLiveCache(kind);
        }
        return sendJson(res, 200, { cleared: kinds });
      }
      if (pathname === '/api/admin/overview' && req.method === 'GET') {
        const user = await currentUser(req);
        if (!user) return sendJson(res, 401, { error: 'unauthorized' });
        if (!isAdmin(user)) return sendJson(res, 403, { error: 'forbidden' });
        await hydratePresence();
        const presence = getPresenceCount();
        return sendJson(res, 200, {
          online: presence,
          storage: await storageStatus(),
          logins: await recentLogins(50),
          activity: await loginActivity(30),
          onlineHistory: await onlineHistory(24 * 30),
        });
      }
      res.statusCode = 404;
      return res.end();
    } catch {
      return sendJson(res, 500, { error: 'server_error' });
    }
  };
}
