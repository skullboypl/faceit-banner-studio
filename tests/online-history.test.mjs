import assert from 'node:assert/strict';
import { test } from 'node:test';

delete process.env.DATABASE_URL;

const { fillHourlyCounts, onlineHistory, recordOnlineSample } = await import('../server/store.mjs');

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
