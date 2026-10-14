import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createAuthMiddleware, localDevAdmin } from '../server/auth.mjs';

const prevDev = process.env.DEV_ADMIN;
const prevNode = process.env.NODE_ENV;

test('dev:admin answers /api/auth/me as the fake admin on localhost only', async () => {
  process.env.DEV_ADMIN = '1';
  process.env.NODE_ENV = 'development';
  assert.equal(localDevAdmin({ headers: { host: '127.0.0.1:5173' } }), true);
  assert.equal(localDevAdmin({ headers: { host: 'localhost:5173' } }), true);
  assert.equal(localDevAdmin({ headers: { host: '[::1]:5173' } }), true);
  assert.equal(localDevAdmin({ headers: { host: 'faceitbanner.vxh.pl' } }), false);
  process.env.NODE_ENV = 'production';
  assert.equal(localDevAdmin({ headers: { host: '127.0.0.1:5173' } }), false);
  process.env.NODE_ENV = 'development';
  const middleware = createAuthMiddleware();
  const server = createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const me = await (await fetch(`${base}/api/auth/me`)).json();
    assert.equal(me.admin, true);
    assert.equal(me.user.nickname, 'Dev Admin');
    assert.equal(me.user.guid, 'dev-admin');
  } finally {
    if (prevDev === undefined) delete process.env.DEV_ADMIN;
    else process.env.DEV_ADMIN = prevDev;
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
    await new Promise((resolve) => server.close(resolve));
  }
});
