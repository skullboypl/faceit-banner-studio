import assert from 'node:assert/strict';
import { test } from 'node:test';

delete process.env.DATABASE_URL;
delete process.env.REDIS_URL;

const { fillHourlyCounts, onlineHistory, recordOnlineSample } = await import('../server/store.mjs');
const { captureOnlineSample, resetPresenceForTests, usePresenceRedis } = await import('../server/presence.mjs');

test('fillHourlyCounts starts at the first sample and keeps a missed hour at zero', () => {
  const now = new Date('2026-10-15T03:40:00.000Z');
  const series = fillHourlyCounts(
    [
      { bucket: '2026-10-15T01:00:00.000Z', online: 4 },
      { bucket: '2026-10-15T03:00:00.000Z', online: 9 },
    ],
    24,
    now
  );
  assert.deepEqual(
    series.map((point) => [point.hour, point.online]),
    [
      ['2026-10-15T01:00:00.000Z', 4],
      ['2026-10-15T02:00:00.000Z', 0],
      ['2026-10-15T03:00:00.000Z', 9],
    ]
  );
  assert.deepEqual(fillHourlyCounts([], 24, now), []);
});

test('recordOnlineSample keeps one count per hour when postgres is absent', async () => {
  const at = new Date('2026-10-15T04:10:00.000Z');
  await recordOnlineSample(3, at);
  await recordOnlineSample(8, new Date('2026-10-15T04:50:00.000Z'));
  await recordOnlineSample(2, new Date('2026-10-15T04:55:00.000Z'));
  await recordOnlineSample(1, new Date('2026-10-15T05:05:00.000Z'));
  const history = await onlineHistory(6, new Date('2026-10-15T05:30:00.000Z'));
  assert.deepEqual(
    history.series.map((point) => [point.hour, point.online]),
    [
      ['2026-10-15T04:00:00.000Z', 8],
      ['2026-10-15T05:00:00.000Z', 1],
    ]
  );
});

test('capture counts banners restored from Redis and skips a failed load', async () => {
  const now = Date.now();
  usePresenceRedis({
    async set() {},
    async del() {},
    async scan() {
      return ['0', ['fb:live:abcdefghijklmnop01']];
    },
    async mget() {
      return [JSON.stringify({ lastSeen: now, firstSeen: now, ip: '203.0.113.10', info: null })];
    },
  });
  resetPresenceForTests();
  assert.equal(await captureOnlineSample(), 1);

  usePresenceRedis({
    async set() {},
    async del() {},
    async scan() {
      throw new Error('down');
    },
    async mget() {
      return [];
    },
  });
  resetPresenceForTests();
  assert.equal(await captureOnlineSample(), null);
  usePresenceRedis(undefined);
  resetPresenceForTests();
});
