import assert from 'node:assert/strict';
import test from 'node:test';
import { createKickLookup, readKickChannel } from '../server/kick-live.mjs';
import { cleanKick } from '../server/store.mjs';

test('cleanKick keeps a plain channel name and drops anything else', () => {
  assert.equal(cleanKick('MapeT'), 'MapeT');
  assert.equal(cleanKick('  mapet_tv '), 'mapet_tv');
  assert.equal(cleanKick('john-doe'), 'john-doe');
  assert.equal(cleanKick('../evil'), '');
  assert.equal(cleanKick('ab'), '');
});

test('readKickChannel maps a live payload and treats a missing livestream as offline', () => {
  assert.deepEqual(readKickChannel({ livestream: null }), { state: 'offline' });
  assert.deepEqual(
    readKickChannel({
      livestream: {
        viewer_count: 42,
        session_title: 'CS2',
        thumbnail: { url: 'https://kick.com/thumb.jpg' },
        categories: [{ name: 'Counter-Strike' }],
        created_at: '2026-11-02T18:00:00Z',
      },
    }),
    {
      state: 'live',
      viewers: 42,
      title: 'CS2',
      game: 'Counter-Strike',
      thumbnail: 'https://kick.com/thumb.jpg',
      startedAt: '2026-11-02T18:00:00Z',
    }
  );
});

test('the Kick lookup attaches live status without blocking the list', async () => {
  const lookup = createKickLookup({
    now: () => 0,
    store: { loadList: async () => new Map(), saveList: async () => undefined },
    fetcher: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ livestream: { viewer_count: 7, session_title: 'Live' } }),
    }),
  });
  const players = await lookup([{ nickname: 'P', kick: 'mapet' }]);
  assert.equal(players[0].kickStatus.state, 'live');
  assert.equal(players[0].kickStatus.viewers, 7);
});
