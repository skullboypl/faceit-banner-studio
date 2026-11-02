import assert from 'node:assert/strict';
import { test } from 'node:test';

delete process.env.DATABASE_URL;
delete process.env.REDIS_URL;

const {
  fillStreamerDays,
  groupStreamerSessions,
  isLiveStreamerSample,
  recordStreamerSample,
  resetStreamerStoreForTests,
  STREAMER_SESSION_GAP_MS,
  streamerArchiveRows,
  streamerDailySeries,
  streamerRankingRows,
  streamerSamplePoints,
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
    { twitch: 's1mple', nickname: 's1mple', viewers: 80, live: true, elo: 2400, matchId: 'm1' },
    at
  );
  await recordStreamerSample(
    { twitch: 's1mple', nickname: 's1mple', viewers: 120, live: true, elo: 2410, matchId: 'm1' },
    new Date('2026-11-02T16:10:00.000Z')
  );
  await recordStreamerSample(
    { twitch: 's1mple', nickname: 's1mple', viewers: 40, live: true, elo: 2390, matchId: 'm2' },
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

test('offline 0s do not lower a live average or enter the ranking', async () => {
  resetStreamerStoreForTests();
  const at = new Date('2026-11-02T15:10:00.000Z');
  assert.equal(isLiveStreamerSample({ viewers: 50, live: true }), true);
  assert.equal(isLiveStreamerSample({ viewers: 0, live: false }), false);
  assert.equal(isLiveStreamerSample({ viewers: 0 }), false);
  await recordStreamerSample({ twitch: 'ace', nickname: 'Ace', viewers: 50, live: true, elo: 2100 }, at);
  await recordStreamerSample({ twitch: 'ace', nickname: 'Ace', viewers: 0, live: false, elo: 2100 }, new Date('2026-11-02T16:10:00.000Z'));
  await recordStreamerSample({ twitch: 'ghost', nickname: 'Ghost', viewers: 0, live: false }, at);
  const page = await streamerDailySeries('ace', 1, at);
  const today = page.series.find((point) => point.day === '2026-11-02');
  assert.equal(today.viewersAvg, 50);
  assert.equal(today.viewersSamples, 1);
  const rank = await streamerRankingRows(7, at);
  assert.equal(rank.length, 1);
  assert.equal(rank[0].slug, 'ace');
  assert.equal(rank[0].viewersAvg, 50);
  const samples = await streamerSamplePoints('ace', 7, at);
  assert.equal(samples.points.length, 1);
  assert.equal(samples.points[0].viewers, 50);
  const archive = await streamerArchiveRows();
  assert.ok(archive.some((row) => row.slug === 'ghost'));
});

test('groupStreamerSessions splits on a gap and keeps one stream together', () => {
  const t0 = Date.parse('2026-11-02T12:00:00.000Z');
  const sessions = groupStreamerSessions(
    [
      { ts: t0, elo: 2000, viewers: 40 },
      { ts: t0 + 10 * 60 * 1000, elo: 2010, viewers: 55 },
      { ts: t0 + 20 * 60 * 1000, elo: 1990, viewers: 60 },
      { ts: t0 + STREAMER_SESSION_GAP_MS + 21 * 60 * 1000, elo: 2050, viewers: 30 },
      { ts: t0 + STREAMER_SESSION_GAP_MS + 31 * 60 * 1000, elo: 2060, viewers: 28 },
    ],
    STREAMER_SESSION_GAP_MS
  );
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].eloStart, 2050);
  assert.equal(sessions[0].eloEnd, 2060);
  assert.equal(sessions[0].points.length, 2);
  assert.equal(sessions[1].eloStart, 2000);
  assert.equal(sessions[1].eloEnd, 1990);
  assert.equal(sessions[1].points.length, 3);
});
