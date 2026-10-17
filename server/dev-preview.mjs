/**
 * Local-only: cookie `fb_dev_preview=SkullBoy` makes /api/auth/me and /api/me/banners
 * answer as SkullBoy with a handful of saved banners, so the studio can be checked
 * without FACEIT login or Postgres. Production and any public host never enter here.
 */
const PLAYER = 'e5e8e2a6-d716-4493-b949-e16965f41654';
const USER = { guid: PLAYER, nickname: 'SkullBoy', avatar: null };

const at = (day) => `2026-10-${day}T10:00:00.000Z`;

const banner = (id, name, day, settings) => ({
  id,
  name,
  settings: { playerId: PLAYER, bannerDesign: '2026', ...settings },
  schemaVersion: 1,
  visibility: 'private',
  createdAt: at(day),
  updatedAt: at(day),
});

const publication = (banner, votes, body) => ({
  id: `pub-${banner.id}`,
  bannerId: banner.id,
  title: banner.name,
  body,
  status: 'approved',
  votes,
  vote: 0,
  settings: banner.settings,
  schemaVersion: 1,
  createdAt: banner.createdAt,
  author: USER.nickname,
});

const BANNERS = [
  banner('preview-small', 'SMALL', '15', { style: 'prime' }),
  banner('preview-pulse', 'Pulse', '16', { style: 'pulse' }),
  banner('preview-halo', 'Halo', '16', { style: 'halo' }),
  banner('preview-roster', 'Roster', '17', {
    widgetMode: 'team',
    style: 'lineup',
    teamRoster: 'SkullBoy,SweetGrandpa',
  }),
  banner('preview-popup', 'Popup', '17', { widgetMode: 'popup' }),
];

const PUBLICATIONS = [
  publication(BANNERS[1], 12, 'Okrągły Pulse pod kamerkę — lokalny podgląd galerii.'),
  publication(BANNERS[2], 7, 'Halo z poświatą levelu, czytelny na 1080p.'),
  publication(BANNERS[0], 3, 'Mały pasek solo do dolnej krawędzi overlayu.'),
];

function requestHost(req) {
  const raw = String(req.headers.host || '');
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']');
    return end === -1 ? raw : raw.slice(1, end);
  }
  return raw.split(':')[0];
}

function local(req) {
  if (process.env.NODE_ENV === 'production') return false;
  const host = requestHost(req);
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function previewOn(req) {
  if (!local(req)) return false;
  const cookie = String(req.headers.cookie || '');
  return /(?:^|;\s*)fb_dev_preview=SkullBoy(?:;|$)/.test(cookie);
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export function createDevPreviewMiddleware() {
  return (req, res, next) => {
    if (!previewOn(req)) return next();
    const path = String(req.url || '').split('?')[0];
    if (path === '/api/auth/me' && req.method === 'GET') {
      return send(res, 200, { user: USER, admin: false });
    }
    if (path === '/api/me/workspace' && req.method === 'GET') {
      return send(res, 200, { workspace: null });
    }
    if (path === '/api/me/workspace' && req.method === 'PUT') {
      return send(res, 200, { version: 1 });
    }
    if (path === '/api/me/banners' && req.method === 'GET') {
      return send(res, 200, { banners: BANNERS, limit: 25 });
    }
    if (path === '/api/catalog/banners' && req.method === 'GET') {
      return send(res, 200, { publications: PUBLICATIONS, next: null });
    }
    if (path === '/api/me/publications' && req.method === 'GET') {
      return send(res, 200, { publications: PUBLICATIONS.map((item) => ({ ...item, mine: true })) });
    }
    next();
  };
}
