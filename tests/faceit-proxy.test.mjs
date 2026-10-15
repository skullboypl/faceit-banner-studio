import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFaceitCache, faceitTarget } from '../server/faceit-proxy.mjs';

const id = '11111111-1111-4111-8111-111111111111';

test('faceitTarget keeps a player read and drops anything else', () => {
  const profile = faceitTarget(`/api/faceit/v4/players/${id}`);
  assert.equal(profile.upstream, `https://open.faceit.com/data/v4/players/${id}`);
  const nick = faceitTarget('/api/faceit/v4/players?nickname=Donk&limit=999');
  assert.equal(nick.upstream, 'https://open.faceit.com/data/v4/players?nickname=Donk');
  assert.equal(faceitTarget('/api/faceit/v4/players?nickname=Donk').key, nick.key);
  assert.equal(faceitTarget('/api/faceit/v4/organizers'), null);
  assert.equal(faceitTarget('/api/faceit/v4/players?nickname=<script>'), null);
  assert.equal(faceitTarget(`/api/faceit/v4/players/${id}/history?game=csgo&limit=1`), null);
});

test('the same player is fetched once inside 15 seconds, then again after', async () => {
  let clock = 1_000;
  const calls = [];
  const cache = createFaceitCache({
    now: () => clock,
    getKey: () => 'test-key',
    fetcher: async (url) => {
      calls.push(url);
      return { status: 200, text: async () => `{"url":${JSON.stringify(url)}}` };
    },
  });
  const target = faceitTarget(`/api/faceit/v4/players/${id}`);
  const other = faceitTarget(`/api/faceit/v4/players/${id}/stats/cs2`);
  const [first, second] = await Promise.all([cache.load(target), cache.load(target)]);
  assert.equal(calls.length, 1);
  assert.equal(first.body, second.body);
  clock += 10_000;
  await cache.load(target);
  assert.equal(calls.length, 1);
  clock += 6_000;
  await cache.load(target);
  assert.equal(calls.length, 2);
  await cache.load(other);
  assert.equal(calls.length, 3);
  assert.match(calls[2], /\/stats\/cs2$/);
});
