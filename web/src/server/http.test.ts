import { afterEach, describe, expect, test } from 'vitest';
import { isAdmin, originAllowed } from './http';

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

  test('dev:admin may change tickets from the local studio', () => {
    process.env.DEV_ADMIN = '1';
    process.env.NODE_ENV = 'development';
    process.env.PUBLIC_URL = 'https://faceitbanner.vxh.pl';
    const local = new Request('http://127.0.0.1:3100/api/admin/posts/x', {
      method: 'PATCH',
      headers: { origin: 'http://127.0.0.1:5173', host: '127.0.0.1:3100' },
    });
    expect(originAllowed(local)).toBe(true);
    expect(isAdmin({ guid: 'dev-admin' })).toBe(true);
    const remote = new Request('http://127.0.0.1:3100/api/admin/posts/x', {
      method: 'PATCH',
      headers: { origin: 'https://evil.example', host: 'faceitbanner.vxh.pl' },
    });
    expect(originAllowed(remote)).toBe(false);
    process.env.NODE_ENV = 'production';
    expect(isAdmin({ guid: 'dev-admin' })).toBe(false);
    delete process.env.DEV_ADMIN;
    process.env.NODE_ENV = 'test';
  });
});
