import { randomBytes } from 'node:crypto';
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
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || null;
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
  await saveState(state);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: `${publicUrl(req)}/api/auth/callback`,
    scope: 'openid profile',
    state,
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
  if (!(await consumeState(state))) return redirect(res, '/?login=expired');

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

export function createAuthMiddleware() {
  return async (req, res, next) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const { pathname } = url;
    if (!pathname.startsWith('/api/auth/') && pathname !== '/api/admin/overview') {
      return next();
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
        const id = parseCookies(req.headers.cookie)[SESSION_COOKIE];
        if (id) await deleteSession(id);
        setCookie(res, req, '', 0);
        return sendJson(res, 200, { ok: true });
      }
      if (pathname === '/api/admin/overview' && req.method === 'GET') {
        const user = await currentUser(req);
        if (!user) return sendJson(res, 401, { error: 'unauthorized' });
        if (!isAdmin(user)) return sendJson(res, 403, { error: 'forbidden' });
        const presence = await fetchPresence(req);
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

/** The presence middleware lives in the same process, so ask it directly over HTTP loopback. */
async function fetchPresence(req) {
  try {
    const origin = `http://${req.headers.host}`;
    const response = await fetch(`${origin}/api/presence`, { cache: 'no-store' });
    return (await response.json()).online ?? null;
  } catch {
    return null;
  }
}
