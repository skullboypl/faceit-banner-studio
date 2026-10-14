import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import {
  createPresenceMiddleware,
  resetPresenceForTests,
  usePresenceRedis,
} from '../server/presence.mjs';

process.env.LIVE_BOARD_TTL_MS = '0';
delete process.env.FACEIT_API_KEY;
delete process.env.VITE_FACEIT_API_KEY;

function fakeRedis() {
  const data = new Map();
  return {
    data,
    async set(key, value, mode, ttl) {
      assert.equal(mode, 'EX');
      assert.equal(ttl, 15 * 60);
      data.set(key, value);
    },
    async del(key) {
      data.delete(key);
    },
    async scan() {
      return ['0', [...data.keys()]];
    },
    async mget(...keys) {
      return keys.map((key) => data.get(key) ?? null);
    },
  };
}

function serve(middleware) {
  const server = createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        base: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

test('a process restart keeps the live list from Redis and drops an expired banner', async () => {
  const redis = fakeRedis();
  usePresenceRedis(redis);
  resetPresenceForTests();
  const middleware = createPresenceMiddleware({ unlimitedRate: true });
  const { base, close } = await serve(middleware);
  try {
    const posted = await fetch(`${base}/api/presence`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.80' },
      body: JSON.stringify({ id: 'abcdefghijklmnop01', info: { nickname: 'OldBanner', elo: 1800, level: 8 } }),
    });
    assert.equal(posted.status, 200);
    assert.equal(redis.data.size, 1);

    resetPresenceForTests();
    const count = await (await fetch(`${base}/api/presence`, { headers: { 'x-forwarded-for': '203.0.113.81' } })).json();
    assert.equal(count.online, 1);
    const board = await (await fetch(`${base}/api/presence/live`, { headers: { 'x-forwarded-for': '203.0.113.82' } })).json();
    assert.deepEqual(board.players.map((player) => player.nickname), ['OldBanner']);
    assert.equal(board.online, 1);

    redis.data.set(
      'fb:live:abcdefghijklmnop02',
      JSON.stringify({ lastSeen: Date.now() - 16 * 60_000, firstSeen: Date.now() - 20 * 60_000, ip: '203.0.113.9', info: { nickname: 'Gone' } })
    );
    resetPresenceForTests();
    const after = await (await fetch(`${base}/api/presence`, { headers: { 'x-forwarded-for': '203.0.113.83' } })).json();
    assert.equal(after.online, 1);
    const names = await (await fetch(`${base}/api/presence/live`, { headers: { 'x-forwarded-for': '203.0.113.84' } })).json();
    assert.deepEqual(names.players.map((player) => player.nickname), ['OldBanner']);
  } finally {
    usePresenceRedis(undefined);
    resetPresenceForTests();
    await close();
  }
});
