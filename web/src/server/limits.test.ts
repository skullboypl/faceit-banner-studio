import { describe, expect, test } from 'vitest';
import { POLICY, createLimits } from './limits';

const request = (ip: string, headers: Record<string, string> = {}) =>
  new Request('http://localhost:3100/api/posts', { headers: { 'x-forwarded-for': ip, ...headers } });

describe('limits policy', () => {
  test('is deliberately tight', () => {
    expect(POLICY.post).toMatchObject({ perHour: 3, perDay: 10 });
    expect(POLICY.comment).toMatchObject({ perMinute: 6, perHour: 40 });
    expect(POLICY.vote).toMatchObject({ perMinute: 20, perHour: 200 });
    expect(POLICY.banner).toMatchObject({ perMinute: 12 });
    expect(POLICY.ipRead.perMinute).toBe(120);
    expect(POLICY.ipWrite.perMinute).toBe(20);
  });

  test('an IP flood is rejected after the per-minute read limit', () => {
    const limits = createLimits();
    let allowed = 0;
    for (let i = 0; i < 200; i++) if (limits.ip(request('203.0.113.7'), false)) allowed++;
    expect(allowed).toBe(POLICY.ipRead.perMinute);
  });

  test('writes have a stricter IP limit than reads', () => {
    const limits = createLimits();
    let allowed = 0;
    for (let i = 0; i < 100; i++) if (limits.ip(request('203.0.113.8'), true)) allowed++;
    expect(allowed).toBe(POLICY.ipWrite.perMinute);
  });

  test('another IP is not affected', () => {
    const limits = createLimits();
    for (let i = 0; i < 300; i++) limits.ip(request('203.0.113.9'), false);
    expect(limits.ip(request('203.0.113.10'), false)).toBe(true);
  });

  test('a spoofed first X-Forwarded-For entry does not dodge the limit', () => {
    const limits = createLimits();
    let allowed = 0;
    for (let i = 0; i < 200; i++) if (limits.ip(request(`10.9.9.${i % 250}, 203.0.113.11`), false)) allowed++;
    expect(allowed).toBe(POLICY.ipRead.perMinute);
  });

  test('unlimited mode never blocks (tests only)', () => {
    const limits = createLimits(true);
    for (let i = 0; i < 1000; i++) expect(limits.ip(request('203.0.113.12'), true)).toBe(true);
  });
});
