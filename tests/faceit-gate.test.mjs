import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFaceitGate } from '../server/faceit-gate.mjs';

const API = 'https://open.faceit.com/data/v4/players/x';

/** A virtual clock: sleeping moves time forward, so rate limits are checked without waiting. */
function clock() {
  let time = 0;
  return { now: () => time, sleep: async (ms) => void (time += ms), at: () => time };
}

test('never starts more than the allowed requests inside one second, even for a burst', async () => {
  const c = clock();
  const starts = [];
  const gate = createFaceitGate({
    rps: 10,
    now: c.now,
    sleep: c.sleep,
    fetcher: async () => {
      starts.push(c.at());
      return new Response('{}', { status: 200 });
    },
  });
  const responses = await Promise.all(Array.from({ length: 45 }, () => gate.fetch(API, { timeoutMs: 1000 })));
  assert.equal(responses.every((r) => r.status === 200), true);
  assert.equal(starts.length, 45);
  for (const start of starts) {
    const inWindow = starts.filter((other) => other >= start && other < start + 1000).length;
    assert.ok(inWindow <= 10, `${inWindow} requests inside one second`);
  }
});

test('a 429 is retried after the pause FACEIT asks for, and the caller gets the good answer', async () => {
  const c = clock();
  let calls = 0;
  const gate = createFaceitGate({
    rps: 10,
    now: c.now,
    sleep: c.sleep,
    fetcher: async () => {
      calls++;
      return calls === 1 ? new Response('{}', { status: 429, headers: { 'retry-after': '2' } }) : new Response('{"ok":true}', { status: 200 });
    },
  });
  const response = await gate.fetch(API, { timeoutMs: 1000 });
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.ok(c.at() >= 2000, 'waited for Retry-After');
});

test('a 429 that keeps coming is handed back after two retries, not retried forever', async () => {
  const c = clock();
  let calls = 0;
  const gate = createFaceitGate({
    rps: 10,
    now: c.now,
    sleep: c.sleep,
    fetcher: async () => {
      calls++;
      return new Response('{}', { status: 429 });
    },
  });
  assert.equal((await gate.fetch(API, { timeoutMs: 1000 })).status, 429);
  assert.equal(calls, 3);
});

test('other hosts are not held back, and the timeout starts when the request is sent', async () => {
  const c = clock();
  let signalSeen = null;
  const gate = createFaceitGate({
    rps: 1,
    now: c.now,
    sleep: c.sleep,
    fetcher: async (url, init) => {
      signalSeen = init.signal;
      return new Response('{}', { status: 200 });
    },
  });
  await Promise.all(Array.from({ length: 5 }, () => gate.fetch('https://www.faceit.com/api/users/v1/users/x', { timeoutMs: 4000 })));
  assert.equal(c.at(), 0, 'no waiting for another host');
  assert.ok(signalSeen instanceof AbortSignal);
});

test('a runaway queue is refused instead of growing without end', async () => {
  const c = clock();
  const gate = createFaceitGate({ rps: 1, maxQueue: 5, now: c.now, sleep: c.sleep, fetcher: async () => new Response('{}', { status: 200 }) });
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => gate.fetch(API, { timeoutMs: 1000 })));
  assert.ok(results.some((r) => r.status === 'rejected'));
  assert.ok(results.filter((r) => r.status === 'fulfilled').length >= 5);
});

test('background work yields to banners and never uses the last slots of each second', async () => {
  const c = clock();
  const order = [];
  const starts = [];
  const gate = createFaceitGate({
    rps: 10,
    reserve: 4,
    now: c.now,
    sleep: c.sleep,
    fetcher: async (url) => {
      order.push(String(url).endsWith('low') ? 'low' : 'banner');
      starts.push(c.at());
      return new Response('{}', { status: 200 });
    },
  });
  /* the first second is full of banner requests; behind them wait background jobs, and later banners */
  const jobs = [
    ...Array.from({ length: 10 }, () => gate.fetch(`${API}/banner`, { timeoutMs: 1000 })),
    ...Array.from({ length: 8 }, () => gate.fetch(`${API}/low`, { timeoutMs: 1000, priority: 'low' })),
    ...Array.from({ length: 8 }, () => gate.fetch(`${API}/banner`, { timeoutMs: 1000 })),
  ];
  await Promise.all(jobs);
  assert.deepEqual(order.slice(10, 18), Array(8).fill('banner'), 'banners that arrive later still go before waiting background work');
  for (const start of starts) {
    const lowInWindow = starts.filter((other, index) => order[index] === 'low' && other >= start && other < start + 1000).length;
    assert.ok(lowInWindow <= 6, `${lowInWindow} background requests in a second`);
  }
  assert.equal(order.length, 26);
});

test('pressure rises with the queue and falls back to zero when it is empty', async () => {
  const c = clock();
  let release;
  const gate = createFaceitGate({
    rps: 2,
    now: c.now,
    sleep: async () => new Promise((resolve) => (release = resolve)),
    fetcher: async () => new Response('{}', { status: 200 }),
  });
  assert.equal(gate.pressure(), 0);
  const pending = Array.from({ length: 12 }, () => gate.fetch(API, { timeoutMs: 1000 }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(gate.pressure() > 0.5);
  void pending;
});

test('the server key is FACEIT_SERVER_KEY, then the older FACEIT_API_KEY, then VITE_FACEIT_API_KEY', async () => {
  const { faceitServerKey } = await import('../server/faceit-gate.mjs');
  const names = ['FACEIT_SERVER_KEY', 'FACEIT_API_KEY', 'VITE_FACEIT_API_KEY'];
  const before = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    assert.equal(faceitServerKey(), '');
    process.env.VITE_FACEIT_API_KEY = 'old-build-key';
    assert.equal(faceitServerKey(), 'old-build-key');
    process.env.FACEIT_API_KEY = 'runtime-key';
    assert.equal(faceitServerKey(), 'runtime-key');
    process.env.FACEIT_SERVER_KEY = 'server-key';
    assert.equal(faceitServerKey(), 'server-key');
  } finally {
    for (const name of names) {
      if (before[name] === undefined) delete process.env[name];
      else process.env[name] = before[name];
    }
  }
});
