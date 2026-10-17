import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createAuthMiddleware } from '../server/auth.mjs';

async function serve() {
  const middleware = createAuthMiddleware();
  const server = createServer((req, res) =>
    middleware(req, res, () => {
      res.statusCode = 404;
      res.end();
    })
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((resolve) => server.close(resolve)) };
}

const post = (base, body, headers = {}) =>
  fetch(`${base}/api/admin/cache`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:5173', ...headers },
    body: JSON.stringify(body),
  });

const withDevAdmin = async (run) => {
  const prev = { dev: process.env.DEV_ADMIN, node: process.env.NODE_ENV };
  process.env.DEV_ADMIN = '1';
  process.env.NODE_ENV = 'development';
  try {
    await run();
  } finally {
    for (const [key, value] of [['DEV_ADMIN', prev.dev], ['NODE_ENV', prev.node]]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test('only an admin can clear the caches', async () => {
  const { base, close } = await serve();
  try {
    assert.equal((await post(base, { scope: 'all' })).status, 401);
  } finally {
    await close();
  }
});

test('an admin clears everything or one kind of cache; an unknown kind is refused', async () => {
  await withDevAdmin(async () => {
    const { base, close } = await serve();
    try {
      const all = await post(base, { scope: 'all' });
      assert.equal(all.status, 200);
      assert.deepEqual((await all.json()).cleared.sort(), ['avatars', 'faceit', 'live', 'profiles', 'rankings']);
      const one = await post(base, { scope: 'avatars' });
      assert.deepEqual((await one.json()).cleared, ['avatars']);
      assert.equal((await post(base, { scope: 'css' })).status, 503);
      const css = await (await post(base, { scope: 'css' })).json();
      assert.equal(css.error, 'cdn_not_configured');
      assert.equal((await post(base, { scope: 'secrets' })).status, 400);
      assert.equal((await post(base, {})).status, 400);
    } finally {
      await close();
    }
  });
});

test('clearing needs a same-origin request', async () => {
  await withDevAdmin(async () => {
    const { base, close } = await serve();
    try {
      assert.equal((await post(base, { scope: 'all' }, { origin: 'https://evil.example' })).status, 403);
    } finally {
      await close();
    }
  });
});
