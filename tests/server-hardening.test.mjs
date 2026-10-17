import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createAuthMiddleware } from '../server/auth.mjs';
import { createPresenceMiddleware } from '../server/presence.mjs';

process.env.PUBLIC_URL = 'https://faceitbanner.vxh.pl';
process.env.FACEIT_OAUTH_CLIENT_ID = 'client';
process.env.FACEIT_OAUTH_CLIENT_SECRET = 'secret';

async function serve(...middlewares) {
  const server = createServer((req, res) => {
    const run = (index) => {
      if (index >= middlewares.length) {
        res.statusCode = 404;
        return res.end();
      }
      middlewares[index](req, res, () => run(index + 1));
    };
    run(0);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((resolve) => server.close(resolve)) };
}

const hit = (base, path, { method = 'GET', ip = '198.51.100.1', headers = {}, body } = {}) =>
  fetch(base + path, {
    method,
    redirect: 'manual',
    headers: { 'x-forwarded-for': ip, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

test('login is limited per IP and then locked out', async () => {
  const { base, close } = await serve(createAuthMiddleware());
  try {
    const statuses = [];
    for (let i = 0; i < 25; i++) statuses.push((await hit(base, '/api/auth/login')).status);
    assert.equal(statuses.slice(0, 10).every((s) => s === 302), true, 'first 10 pass');
    assert.equal(statuses.slice(10).every((s) => s === 429), true, 'the rest are rejected');
    assert.equal((await hit(base, '/api/auth/login', { ip: '198.51.100.2' })).status, 302, 'other IPs are fine');
    const pkce = await hit(base, '/api/auth/login', { ip: '198.51.100.20' });
    const location = new URL(pkce.headers.get('location'));
    assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(location.searchParams.get('redirect_popup'), 'true');
    assert.equal(location.pathname, '/accounts');
    assert.ok(location.searchParams.get('code_challenge'));
  } finally {
    await close();
  }
});

test('429 carries Retry-After', async () => {
  const { base, close } = await serve(createAuthMiddleware());
  try {
    let last;
    for (let i = 0; i < 15; i++) last = await hit(base, '/api/auth/login', { ip: '198.51.100.3' });
    assert.equal(last.status, 429);
    assert.ok(Number(last.headers.get('retry-after')) > 0);
  } finally {
    await close();
  }
});

test('a spoofed first X-Forwarded-For entry does not dodge the login limit', async () => {
  const { base, close } = await serve(createAuthMiddleware());
  try {
    const statuses = [];
    for (let i = 0; i < 15; i++) statuses.push((await hit(base, '/api/auth/login', { ip: `10.9.9.${i}, 198.51.100.4` })).status);
    assert.equal(statuses.filter((s) => s === 429).length, 5);
  } finally {
    await close();
  }
});

test('logout needs a same-origin Origin header (no logout CSRF)', async () => {
  const { base, close } = await serve(createAuthMiddleware());
  try {
    assert.equal((await hit(base, '/api/auth/logout', { method: 'POST', ip: '198.51.100.5' })).status, 403);
    assert.equal((await hit(base, '/api/auth/logout', { method: 'POST', ip: '198.51.100.5', headers: { origin: 'https://evil.example' } })).status, 403);
    assert.equal((await hit(base, '/api/auth/logout', { method: 'POST', ip: '198.51.100.5', headers: { origin: 'https://faceitbanner.vxh.pl' } })).status, 200);
  } finally {
    await close();
  }
});

test('the presence heartbeat is limited per IP', async () => {
  const { base, close } = await serve(createPresenceMiddleware());
  try {
    const beat = (i) =>
      hit(base, '/api/presence', { method: 'POST', ip: '198.51.100.6', headers: { 'content-type': 'application/json' }, body: { id: `abcdefghijklmnop${i}` } });
    const statuses = [];
    for (let i = 0; i < 40; i++) statuses.push((await beat(i)).status);
    assert.equal(statuses.filter((s) => s === 200).length, 12);
    assert.equal(statuses.filter((s) => s === 429).length, 28);
  } finally {
    await close();
  }
});

test('one IP cannot fake more than 30 distinct banners', async () => {
  const { base, close } = await serve(createPresenceMiddleware({ unlimitedRate: true }));
  try {
    const statuses = [];
    for (let i = 0; i < 40; i++) {
      statuses.push(
        (await hit(base, '/api/presence', { method: 'POST', ip: '198.51.100.7', headers: { 'content-type': 'application/json' }, body: { id: `zyxwvutsrqponm${String(i).padStart(2, '0')}` } })).status
      );
    }
    assert.equal(statuses.filter((s) => s === 200).length, 30);
    assert.equal(statuses.filter((s) => s === 429).length, 10);
  } finally {
    await close();
  }
});

test('reading the counter is limited per IP too', async () => {
  const { base, close } = await serve(createPresenceMiddleware());
  try {
    const statuses = [];
    for (let i = 0; i < 80; i++) statuses.push((await hit(base, '/api/presence', { ip: '198.51.100.8' })).status);
    assert.equal(statuses.filter((s) => s === 200).length, 60);
  } finally {
    await close();
  }
});

test('a live page of 100 avatars is not rate limited and does not lock the visitor out', async () => {
  const { base, close } = await serve(createPresenceMiddleware());
  try {
    const statuses = [];
    for (let i = 0; i < 100; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      statuses.push((await hit(base, `/api/presence/avatar/${id}`, { ip: '198.51.100.30' })).status);
    }
    assert.equal(statuses.filter((s) => s === 429).length, 0);
    /* the counter and the list still answer the same visitor */
    assert.equal((await hit(base, '/api/presence/live', { ip: '198.51.100.30' })).status, 200);
  } finally {
    await close();
  }
});

test('a missing avatar is remembered for a minute, not ten', async () => {
  const { base, close } = await serve(createPresenceMiddleware({ unlimitedRate: true }));
  try {
    const response = await hit(base, '/api/presence/avatar/00000000-0000-4000-8000-0000000000aa', { ip: '198.51.100.31' });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=60');
  } finally {
    await close();
  }
});
