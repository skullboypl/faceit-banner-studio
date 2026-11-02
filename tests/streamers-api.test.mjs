import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';

delete process.env.DATABASE_URL;
delete process.env.REDIS_URL;

const { recordStreamerSample, resetStreamerStoreForTests } = await import('../server/store.mjs');
const {
  buildStreamerPage,
  buildStreamerRanking,
  createDebouncer,
  createStreamersMiddleware,
  ingestLiveStreamers,
  isReservedStreamerSlug,
  resetStreamerRuntimeForTests,
} = await import('../server/streamers.mjs');

async function serve() {
  const server = createServer(createStreamersMiddleware());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('createDebouncer shares one in-flight task per key', async () => {
  const debounce = createDebouncer();
  let runs = 0;
  const work = () =>
    debounce.run('rank', async () => {
      runs += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return runs;
    });
  const [a, b, c] = await Promise.all([work(), work(), work()]);
  assert.equal(runs, 1);
  assert.equal(a, 1);
  assert.equal(b, 1);
  assert.equal(c, 1);
  const later = await work();
  assert.equal(runs, 2);
  assert.equal(later, 2);
});

test('ingest and ranking builds coalesce bursts and return a shaped payload', async () => {
  resetStreamerStoreForTests();
  resetStreamerRuntimeForTests();
  const player = {
    nickname: 'Ace',
    twitch: 'liveace',
    elo: 2100,
    twitchStatus: { state: 'live', viewers: 55 },
  };
  const offline = {
    nickname: 'Ghost',
    twitch: 'ghostchan',
    elo: 1200,
    twitchStatus: { state: 'offline' },
  };
  await Promise.all([ingestLiveStreamers([player, offline]), ingestLiveStreamers([player, offline])]);
  const [first, second] = await Promise.all([buildStreamerRanking(7), buildStreamerRanking(7)]);
  assert.equal(first, second);
  assert.equal(first.ok, true);
  assert.equal(first.days, 7);
  assert.equal(first.historyDays, 90);
  assert.equal(first.cacheSeconds, 60);
  assert.ok(Array.isArray(first.streamers));
  assert.ok(Array.isArray(first.archive));
  assert.equal(first.streamers[0].slug, 'liveace');
  assert.equal(first.streamers[0].viewersAvg, 55);
  assert.equal(first.streamers[0].live, true);
  assert.equal(first.streamers.some((row) => row.slug === 'ghostchan'), false);
  const page = await buildStreamerPage('liveace', 7);
  assert.equal(page.ok, true);
  assert.equal(page.found, true);
  assert.equal(page.series.length, 7);
  assert.equal(page.streamer.elo, 2100);
  assert.ok(page.series.some((point) => point.viewersAvg === 55));
  assert.ok(Array.isArray(page.sessions));
  assert.equal(page.sessions.length, 1);
  assert.equal(page.sessions[0].eloEnd, 2100);
});

test('GET /api/streamers/ranking is reserved and serves ranking plus archive history', async () => {
  resetStreamerStoreForTests();
  resetStreamerRuntimeForTests();
  const now = new Date('2026-11-02T12:00:00.000Z');
  await recordStreamerSample({ twitch: 'mapet', nickname: 'Mapet', viewers: 33, live: true, elo: 1800, matchId: 'ab' }, now);
  await recordStreamerSample({ twitch: 'mapet', nickname: 'Mapet', viewers: 0, live: false }, now);
  assert.equal(isReservedStreamerSlug('ranking'), true);
  const { base, close } = await serve();
  try {
    const rank = await (await fetch(`${base}/api/streamers/ranking`)).json();
    assert.equal(rank.ok, true);
    assert.ok(Array.isArray(rank.streamers));
    assert.ok(Array.isArray(rank.archive));
    assert.equal(rank.historyDays, 90);
    assert.equal(rank.streamers[0].slug, 'mapet');
    assert.equal(rank.streamers[0].viewersAvg, 33);
    assert.equal(rank.found, undefined);
    const alias = await (await fetch(`${base}/api/streamers`)).json();
    assert.equal(alias.streamers[0].slug, 'mapet');
    const page = await (await fetch(`${base}/api/streamers/mapet`)).json();
    assert.equal(page.ok, true);
    assert.equal(page.found, true);
    assert.equal(page.series.length, 90);
    assert.equal(page.streamer.matches, 1);
    assert.ok(Array.isArray(page.sessions));
    const empty = await (await fetch(`${base}/api/streamers/unknownnick`)).json();
    assert.equal(empty.ok, true);
    assert.equal(empty.found, false);
    assert.equal(empty.series.length, 90);
    assert.deepEqual(empty.sessions, []);
  } finally {
    await close();
  }
});
