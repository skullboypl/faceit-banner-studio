import { describe, expect, test } from 'vitest';
import { createRateLimiter } from './rate-limit';

describe('createRateLimiter', () => {
  test('allows one request per second', () => {
    let now = 0;
    const allow = createRateLimiter({ perSecond: 1, perMinute: 60, now: () => now });
    expect(allow('a')).toBe(true);
    expect(allow('a')).toBe(false);
    now = 1001;
    expect(allow('a')).toBe(true);
  });

  test('allows 60 per minute and then blocks until the window slides', () => {
    let now = 0;
    const allow = createRateLimiter({ perMinute: 60, now: () => now });
    for (let i = 0; i < 60; i++) expect(allow('a')).toBe(true);
    expect(allow('a')).toBe(false);
    now = 60_001;
    expect(allow('a')).toBe(true);
  });

  test('keys are independent', () => {
    const allow = createRateLimiter({ perMinute: 1 });
    expect(allow('a')).toBe(true);
    expect(allow('b')).toBe(true);
    expect(allow('a')).toBe(false);
  });

  test('a blocked request does not extend the block', () => {
    let now = 0;
    const allow = createRateLimiter({ perMinute: 1, now: () => now });
    allow('a');
    for (now = 1000; now < 60_000; now += 1000) allow('a');
    now = 60_001;
    expect(allow('a')).toBe(true);
  });
});
