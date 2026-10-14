import { createHash, randomBytes } from 'node:crypto';
import { clientIp as resolveClientIp } from '../shared/client-ip.mjs';
import { createRateLimiter } from '../shared/rate-limit.mjs';
import { getPresenceCount } from './presence.mjs';
import {
  consumeState,
  deleteSession,
  loadSession,
  recentLogins,
  recordLogin,
  saveSession,
  saveState,
  storageStatus,
} from './store.mjs';

const AUTHORIZE_URL = 'https://accounts.faceit.com';
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

export function isAdmin(user) {
  const admins = String(process.env.ADMIN_FACEIT_GUIDS || process.env.ADMIN_FACEIT_GUID || '')
    .split(',')
    .map((guid) => guid.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(user && admins.includes(String(user.guid).toLowerCase()));
}

async function currentUser(req) {
  const id = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!id || !/^[a-f0-9]{48}$/.test(id)) return null;
  return loadSession(id);
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
  redirect(res, isAdmin(user) ? '/admin' : '/');
}

const LOCKOUT = { strikes: 5, windowMs: 5 * 60_000, blockMs: 15 * 60_000 };

/** PUBLIC_URL may list several origins, comma separated. */
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const wanted = new URL(origin).origin;
    return String(process.env.PUBLIC_URL ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .some((value) => new URL(value).origin === wanted);
  } catch {
    return false;
  }
}

export function createAuthMiddleware() {
  const limits = {
    login: createRateLimiter({ perMinute: 10, blockAfter: LOCKOUT }),
    callback: createRateLimiter({ perMinute: 20, blockAfter: LOCKOUT }),
    me: createRateLimiter({ perMinute: 120, blockAfter: LOCKOUT }),
    logout: createRateLimiter({ perMinute: 20, blockAfter: LOCKOUT }),
    admin: createRateLimiter({ perMinute: 60, blockAfter: LOCKOUT }),
  };

  return async (req, res, next) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const { pathname } = url;
    if (!pathname.startsWith('/api/auth/') && pathname !== '/api/admin/overview') {
      return next();
    }

    const ip = clientIp(req);
    const bucket = pathname.endsWith('/login')
      ? 'login'
      : pathname.endsWith('/callback')
        ? 'callback'
        : pathname.endsWith('/me')
          ? 'me'
          : pathname.endsWith('/logout')
            ? 'logout'
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
      if (pathname === '/api/auth/logout' && req.method === 'POST') {
        if (!originAllowed(req)) return sendJson(res, 403, { error: 'bad_origin' });
        const id = parseCookies(req.headers.cookie)[SESSION_COOKIE];
        if (id) await deleteSession(id);
        setCookie(res, req, '', 0);
        return sendJson(res, 200, { ok: true });
      }
      if (pathname === '/api/admin/overview' && req.method === 'GET') {
        const user = await currentUser(req);
        if (!user) return sendJson(res, 401, { error: 'unauthorized' });
        if (!isAdmin(user)) return sendJson(res, 403, { error: 'forbidden' });
        const presence = getPresenceCount();
        return sendJson(res, 200, {
          online: presence,
          storage: await storageStatus(),
          logins: await recentLogins(50),
        });
      }
      res.statusCode = 404;
      return res.end();
    } catch {
      return sendJson(res, 500, { error: 'server_error' });
    }
  };
}
