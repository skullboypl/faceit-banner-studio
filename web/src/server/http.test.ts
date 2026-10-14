import { afterEach, describe, expect, test } from 'vitest';
import { originAllowed } from './http';

const request = (origin?: string) => new Request('http://localhost:3100/api/x', { method: 'POST', headers: origin ? { origin } : {} });
const original = process.env.PUBLIC_URL;
afterEach(() => {
  process.env.PUBLIC_URL = original;
});

describe('originAllowed', () => {
  test('accepts the configured origin', () => {
    process.env.PUBLIC_URL = 'https://faceitbanner.vxh.pl';
    expect(originAllowed(request('https://faceitbanner.vxh.pl'))).toBe(true);
  });

  test('accepts any origin of a comma-separated list (local http and https)', () => {
    process.env.PUBLIC_URL = 'http://localhost:5173, https://localhost:5173';
    expect(originAllowed(request('http://localhost:5173'))).toBe(true);
    expect(originAllowed(request('https://localhost:5173'))).toBe(true);
  });

  test('ignores a trailing slash or path in the configured value', () => {
    process.env.PUBLIC_URL = 'https://faceitbanner.vxh.pl/';
    expect(originAllowed(request('https://faceitbanner.vxh.pl'))).toBe(true);
  });

  test('rejects other origins, a missing Origin and a missing configuration', () => {
    process.env.PUBLIC_URL = 'https://faceitbanner.vxh.pl';
    expect(originAllowed(request('https://evil.example'))).toBe(false);
    expect(originAllowed(request('http://faceitbanner.vxh.pl'))).toBe(false);
    expect(originAllowed(request())).toBe(false);
    delete process.env.PUBLIC_URL;
    expect(originAllowed(request('https://faceitbanner.vxh.pl'))).toBe(false);
  });
});
