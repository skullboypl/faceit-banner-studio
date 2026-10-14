import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { applyBannerCatalog, defaultBannerCatalog } from '../shared/banner-catalog.mjs';
import {
  CATALOG_TTL_SECONDS,
  readBannerCatalog,
  resetBannerCatalogForTests,
  useCatalogRedisForTests,
  writeBannerCatalog,
} from '../server/catalog.mjs';
import { createAuthMiddleware } from '../server/auth.mjs';

const savedEnv = {
  REDIS_URL: process.env.REDIS_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  DEV_ADMIN: process.env.DEV_ADMIN,
  NODE_ENV: process.env.NODE_ENV,
};
delete process.env.REDIS_URL;
delete process.env.DATABASE_URL;
process.on('exit', () => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('a partial edit keeps the modes that were not sent', () => {
  const next = applyBannerCatalog(defaultBannerCatalog(), { team: true, nope: true, solo: 'yes' });
  assert.equal(next.team, true);
  assert.equal(next.solo, true);
  assert.equal(next.versus, true);
  assert.equal(next.split, false);
  assert.equal(next.popup, false);
});

test('an admin edit replaces the redis read cache', async () => {
  const saved = new Map();
  const redis = {
    async get(key) {
      return saved.get(key) ?? null;
    },
    async set(key, value, mode, ttl) {
      assert.equal(mode, 'EX');
      assert.equal(ttl, CATALOG_TTL_SECONDS);
      saved.set(key, value);
    },
    async del(key) {
      saved.delete(key);
    },
  };
  useCatalogRedisForTests(redis);
  resetBannerCatalogForTests();
  try {
    assert.equal((await readBannerCatalog()).team, false);
    const written = await writeBannerCatalog({ team: true });
    assert.equal(written.team, true);
    assert.equal(JSON.parse(saved.get('fb:catalog:modes')).team, true);
    assert.equal((await readBannerCatalog()).split, false);
    assert.equal((await readBannerCatalog()).popup, false);
  } finally {
    useCatalogRedisForTests(undefined);
    resetBannerCatalogForTests();
  }
});

test('the public catalog hides new modes and an admin can open one', async () => {
  delete process.env.DEV_ADMIN;
  process.env.NODE_ENV = 'development';
  resetBannerCatalogForTests();
  const middleware = createAuthMiddleware();
  const server = createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const open = await (await fetch(`${base}/api/catalog`)).json();
    assert.deepEqual(open.modes, defaultBannerCatalog());
    const anonymous = await fetch(`${base}/api/admin/catalog`, {
      method: 'PUT',
      headers: { origin: base, 'content-type': 'application/json' },
      body: JSON.stringify({ modes: { team: true } }),
    });
    assert.equal(anonymous.status, 401);
    process.env.DEV_ADMIN = '1';
    const denied = await fetch(`${base}/api/admin/catalog`, {
      method: 'PUT',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: JSON.stringify({ modes: { team: true } }),
    });
    assert.equal(denied.status, 403);
    const saved = await fetch(`${base}/api/admin/catalog`, {
      method: 'PUT',
      headers: { origin: base, 'content-type': 'application/json' },
      body: JSON.stringify({ modes: { split: true } }),
    });
    assert.equal(saved.status, 200);
    const after = await (await fetch(`${base}/api/catalog`)).json();
    assert.equal(after.modes.split, true);
    assert.equal(after.modes.team, false);
    assert.equal(after.modes.solo, true);
  } finally {
    delete process.env.DEV_ADMIN;
    resetBannerCatalogForTests();
    await new Promise((resolve) => server.close(resolve));
  }
});
