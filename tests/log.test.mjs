import assert from 'node:assert/strict';
import { test } from 'node:test';
import { count, formatSummary, peak, takeSnapshot, once } from '../server/log.mjs';

test('counters are collected and reset when the summary is taken', () => {
  takeSnapshot();
  count('faceit.sent', 3);
  count('faceit.sent');
  peak('faceit.queue', 5);
  peak('faceit.queue', 2);
  const first = takeSnapshot();
  assert.equal(first['faceit.sent'], 4);
  assert.equal(first['faceit.queue'], 5);
  assert.deepEqual(takeSnapshot(), {});
});

test('a quiet minute prints nothing, a busy one prints one readable line', () => {
  assert.equal(formatSummary({}, 60), null);
  const line = formatSummary(
    { 'faceit.sent': 120, 'faceit.r429': 2, 'faceit.queue': 7, 'cache.hit': 300, 'cache.miss': 120, 'cache.stale': 1, 'live.builds': 2, 'live.partial': 1, 'img.copy': 40, 'img.redirect': 3 },
    60
  );
  assert.ok(line);
  assert.equal(line.includes('\n'), false);
  assert.match(line, /FACEIT: 120 req \(2\.0\/s\)/);
  assert.match(line, /429: 2/);
  assert.match(line, /queue peak: 7/);
  assert.match(line, /cache: 300 hit, 120 miss, 1 stale/);
  assert.match(line, /live list: 2 builds, 1 partial/);
  assert.match(line, /images: 40 copy, 3 redirect/);
});

test('once() lets a repeated problem through only once per interval', () => {
  let time = 0;
  assert.equal(once('x', 1000, () => time), true);
  time = 500;
  assert.equal(once('x', 1000, () => time), false);
  assert.equal(once('y', 1000, () => time), true);
  time = 1500;
  assert.equal(once('x', 1000, () => time), true);
});
