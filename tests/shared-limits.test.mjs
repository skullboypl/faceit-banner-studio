import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../shared/rate-limit.mjs';
import { clientIp } from '../shared/client-ip.mjs';

test('per-second, per-minute, per-hour and per-day windows all apply', () => {
  let now = 0;
  const allow = createRateLimiter({ perSecond: 1, perMinute: 3, perHour: 4, perDay: 5, now: () => now });
  assert.equal(allow('a'), true);
  assert.equal(allow('a'), false); // same second
  now = 2_000; assert.equal(allow('a'), true);
  now = 4_000; assert.equal(allow('a'), true);
  now = 6_000; assert.equal(allow('a'), false); // 3 in the last minute
  now = 61_000; assert.equal(allow('a'), true); // 4th in the hour
  now = 70_000; assert.equal(allow('a'), false); // hour cap
  now = 3_700_000; assert.equal(allow('a'), true); // 5th in the day
  now = 3_800_000; assert.equal(allow('a'), false); // day cap
  now = 86_400_000 + 3_700_001; assert.equal(allow('a'), true);
});

test('repeated rejections lock the key out for the block period', () => {
  let now = 0;
  const allow = createRateLimiter({ perMinute: 1, blockAfter: { strikes: 3, windowMs: 60_000, blockMs: 900_000 }, now: () => now });
  assert.equal(allow('ip'), true);
  for (let i = 0; i < 3; i++) { now += 1000; assert.equal(allow('ip'), false); }
  now = 61_000; // the plain window would be free again
  assert.equal(allow('ip'), false, 'blocked for 15 minutes after 3 strikes');
  now = 3 * 1000 + 900_001;
  assert.equal(allow('ip'), true);
});

test('strikes of one key do not affect another', () => {
  const allow = createRateLimiter({ perMinute: 1, blockAfter: { strikes: 1, windowMs: 60_000, blockMs: 60_000 } });
  allow('a'); allow('a'); allow('a');
  assert.equal(allow('b'), true);
});

test('a blocked key does not grow memory without bound', () => {
  const allow = createRateLimiter({ perMinute: 1, now: () => 0 });
  for (let i = 0; i < 100_000; i++) allow('same');
  assert.equal(allow('other'), true);
});

test('clientIp takes the entry added by the last trusted proxy, not the spoofable first one', () => {
  const h = (xff) => ({ 'x-forwarded-for': xff });
  assert.equal(clientIp(h('1.2.3.4'), '10.0.0.1', 1), '1.2.3.4');
  assert.equal(clientIp(h('6.6.6.6, 1.2.3.4'), '10.0.0.1', 1), '1.2.3.4');
  assert.equal(clientIp(h('6.6.6.6, 1.2.3.4, 10.0.0.9'), '10.0.0.1', 2), '1.2.3.4');
});

test('clientIp falls back to the socket and rejects garbage', () => {
  assert.equal(clientIp({}, '203.0.113.5', 1), '203.0.113.5');
  assert.equal(clientIp({ 'x-forwarded-for': 'not-an-ip' }, '203.0.113.5', 1), '203.0.113.5');
  assert.equal(clientIp({ 'x-forwarded-for': '2001:db8::1' }, '10.0.0.1', 1), '2001:db8::1');
  assert.equal(clientIp({}, undefined, 1), 'unknown');
  assert.equal(clientIp({ 'x-forwarded-for': "1.2.3.4'; DROP TABLE" }, '10.0.0.1', 1), '10.0.0.1');
});

test('clientIp strips the IPv4-mapped IPv6 prefix and ports', () => {
  assert.equal(clientIp({}, '::ffff:203.0.113.5', 1), '203.0.113.5');
  assert.equal(clientIp({ 'x-forwarded-for': '1.2.3.4:5555' }, '10.0.0.1', 1), '1.2.3.4');
});
