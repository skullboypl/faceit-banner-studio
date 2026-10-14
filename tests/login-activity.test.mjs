import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillDailyCounts } from '../server/store.mjs';

test('fillDailyCounts keeps quiet days and ignores days outside the window', () => {
  const now = new Date('2026-10-14T18:00:00.000Z');
  const series = fillDailyCounts(
    [
      { day: '2026-10-14', count: 3, players: 2 },
      { day: '2026-10-12', count: 1, players: 1 },
      { day: '2026-09-01', count: 9, players: 9 },
    ],
    4,
    now
  );
  assert.deepEqual(series, [
    { day: '2026-10-11', count: 0, players: 0 },
    { day: '2026-10-12', count: 1, players: 1 },
    { day: '2026-10-13', count: 0, players: 0 },
    { day: '2026-10-14', count: 3, players: 2 },
  ]);
});
