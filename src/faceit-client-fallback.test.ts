import { afterEach, describe, expect, test, vi } from 'vitest';
import { faceitGet } from '../widget/src/utils/faceit_util';

const reply = (status: number) => Promise.resolve(new Response('{}', { status }));
type Call = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('faceitGet: our server first, the browser with its own client key only when the server cannot answer', () => {
  test('the server answer is used when it works, and no key is sent from the browser', async () => {
    vi.stubEnv('VITE_FACEIT_CLIENT_KEY', 'client-key');
    const fetchMock = vi.fn<Call>(() => reply(200));
    vi.stubGlobal('fetch', fetchMock);
    expect((await faceitGet('/players/abc')).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/faceit/v4/players/abc');
  });

  test.each([429, 502, 503])('a %i from our server is retried straight against FACEIT with the client key', async (status) => {
    vi.stubEnv('VITE_FACEIT_CLIENT_KEY', 'client-key');
    const fetchMock = vi.fn<Call>((url) => (String(url).startsWith('/api/faceit') ? reply(status) : reply(200)));
    vi.stubGlobal('fetch', fetchMock);
    const response = await faceitGet('/players/abc');
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toBe('https://open.faceit.com/data/v4/players/abc');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer client-key');
  });

  test('a network failure on our server falls back the same way', async () => {
    vi.stubEnv('VITE_FACEIT_CLIENT_KEY', 'client-key');
    const fetchMock = vi.fn<Call>((url) => (String(url).startsWith('/api/faceit') ? Promise.reject(new Error('offline')) : reply(200)));
    vi.stubGlobal('fetch', fetchMock);
    expect((await faceitGet('/players/abc')).status).toBe(200);
  });

  test('without a client key nothing leaves for FACEIT and the server answer is returned as it is', async () => {
    vi.stubEnv('VITE_FACEIT_CLIENT_KEY', '');
    const fetchMock = vi.fn<Call>(() => reply(429));
    vi.stubGlobal('fetch', fetchMock);
    expect((await faceitGet('/players/abc')).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('a missing player (404) is not retried: it is an answer, not a failure', async () => {
    vi.stubEnv('VITE_FACEIT_CLIENT_KEY', 'client-key');
    const fetchMock = vi.fn<Call>(() => reply(404));
    vi.stubGlobal('fetch', fetchMock);
    expect((await faceitGet('/players/abc')).status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
