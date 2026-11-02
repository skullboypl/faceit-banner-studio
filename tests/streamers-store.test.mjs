import assert from 'node:assert/strict';
import { test } from 'node:test';

delete process.env.DATABASE_URL;
delete process.env.REDIS_URL;

const {
  fillStreamerDays,
  recordStreamerSample,
  resetStreamerStoreForTests,
  streamerDailySeries,
  streamerRankingRows,
  summarizeStreamerDays,
} = await import('../server/store.mjs');

test('fillStreamerDays keeps quiet days at zero', () => {
  const now = new Date('2026-11-02T18:00:00.000Z');
  const series = fillStreamerDays(
    [
      { day: '2026-11-02', viewersPeak: 40, viewersAvg: 20, viewersSamples: 2, elo: 2100, matches: 1 },
      { day: '2026-10-31', viewersPeak: 10, viewersAvg: 10, viewersSamples: 1, elo: 2000, matches: 0 },
    ],
    4,
    now
  );
  assert.deepEqual(
    series.map((point) => [point.day, point.viewersAvg, point.elo, point.matches]),
    [
      ['2026-10-30', 0, null, 0],
      ['2026-10-31', 10, 2000, 0],
      ['2026-11-01', 0, null, 0],
      ['2026-11-02', 20, 2100, 1],
    ]
  );
});

test('recordStreamerSample folds viewers, peak, elo and unique matches in memory', async () => {
  resetStreamerStoreForTests();
  const at = new Date('2026-11-02T15:10:00.000Z');
  await recordStreamerSample(
    { twitch: 's1mple', nickname: 's1mple', viewers: 80, elo: 2400, matchId: 'm1' },
    at
  );
  await recordStreamerSample(
    { twitch: 's1mple', nickname: 's1mple', viewers: 120, elo: 2410, matchId: 'm1' },
    new Date('2026-11-02T16:10:00.000Z')
  );
  await recordStreamerSample(
    { twitch: 's1mple', nickname: 's1mple', viewers: 40, elo: 2390, matchId: 'm2' },
    new Date('2026-11-02T17:10:00.000Z')
  );
  const page = await streamerDailySeries('s1mple', 3, at);
  const today = page.series.find((point) => point.day === '2026-11-02');
  assert.equal(today.viewersPeak, 120);
  assert.equal(today.viewersAvg, Math.round((80 + 120 + 40) / 3));
  assert.equal(today.elo, 2390);
  assert.equal(today.matches, 2);
  const totals = summarizeStreamerDays(page.series);
  assert.equal(totals.viewersPeak, 120);
  assert.equal(totals.matches, 2);
  const rank = await streamerRankingRows(7, at);
  assert.equal(rank[0].slug, 's1mple');
  assert.equal(rank[0].viewersPeak, 120);
  assert.equal(rank[0].matches, 2);
});
