const ACTIVE_WINDOW_MS = 135_000;
const MAX_SESSIONS = 100_000;
const sessions = new Map();

function prune(now = Date.now()) {
  for (const [id, lastSeen] of sessions) {
    if (now - lastSeen > ACTIVE_WINDOW_MS) sessions.delete(id);
  }
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024) reject(new Error('payload_too_large'));
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

export function createPresenceMiddleware() {
  return async (req, res, next) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    if (pathname !== '/api/presence') return next();

    const now = Date.now();
    prune(now);

    if (req.method === 'GET') {
      return sendJson(res, 200, {
        online: sessions.size,
        windowSeconds: ACTIVE_WINDOW_MS / 1000,
      });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return sendJson(res, 405, { error: 'method_not_allowed' });
    }

    try {
      const body = await readJson(req);
      const id = typeof body.id === 'string' ? body.id : '';
      if (!/^[a-zA-Z0-9_-]{16,80}$/.test(id)) {
        return sendJson(res, 400, { error: 'invalid_session' });
      }
      if (!sessions.has(id) && sessions.size >= MAX_SESSIONS) {
        prune(now);
        if (sessions.size >= MAX_SESSIONS)
          return sendJson(res, 503, { error: 'capacity' });
      }
      sessions.set(id, now);
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

export const presenceConfig = { activeWindowMs: ACTIVE_WINDOW_MS };
