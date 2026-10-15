import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { applyOverride, fetchProfileOverride, resetProfileOverrides } from '../widget/src/utils/profile_override';
import { getPlayerProfile, lookupPlayer } from '../widget/src/utils/faceit_util';

const ID = '0a1b2c3d-1111-4222-8333-444455556666';
const OVERRIDE = {
  avatar: { url: 'https://fbstorage.vxh.pl/pf/avatar/aa.webp', width: 512, height: 512 },
  cover: { url: 'https://fbstorage.vxh.pl/pf/cover/bb.webp', width: 1600, height: 900 },
};

const reply = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

beforeEach(() => resetProfileOverrides());
afterEach(() => vi.unstubAllGlobals());

describe('fetchProfileOverride', () => {
  test('returns the approved avatar and cover addresses', async () => {
    const fetcher = vi.fn(async () => reply(OVERRIDE));
    expect(await fetchProfileOverride(ID, { fetch: fetcher })).toEqual({ avatar: OVERRIDE.avatar.url, cover: OVERRIDE.cover.url });
    expect(fetcher).toHaveBeenCalledWith(`/api/profiles/${ID}`, expect.objectContaining({ credentials: 'omit' }));
  });

  test('a player with nothing set yields an empty override', async () => {
    expect(await fetchProfileOverride(ID, { fetch: async () => reply({}) })).toEqual({});
  });

  test('only https (or local http) pictures are accepted', async () => {
    const hostile = { avatar: { url: 'javascript:alert(1)' }, cover: { url: 'data:image/svg+xml;base64,AAAA' } };
    expect(await fetchProfileOverride(ID, { fetch: async () => reply(hostile) })).toEqual({});
    resetProfileOverrides();
    const local = { avatar: { url: 'http://localhost:9000/a.webp' }, cover: { url: 'http://evil.example/b.webp' } };
    expect(await fetchProfileOverride(ID, { fetch: async () => reply(local) })).toEqual({ avatar: 'http://localhost:9000/a.webp' });
  });

  test('keeps the answer for ten minutes, then asks again', async () => {
    let now = 1_000;
    const fetcher = vi.fn(async () => reply(OVERRIDE));
    const options = { fetch: fetcher, now: () => now };
    await fetchProfileOverride(ID, options);
    now += 9 * 60_000;
    await fetchProfileOverride(ID, options);
    expect(fetcher).toHaveBeenCalledTimes(1);
    now += 2 * 60_000;
    await fetchProfileOverride(ID, options);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test('parallel callers share one request', async () => {
    const fetcher = vi.fn(async () => reply(OVERRIDE));
    await Promise.all([fetchProfileOverride(ID, { fetch: fetcher }), fetchProfileOverride(ID, { fetch: fetcher }), fetchProfileOverride(ID, { fetch: fetcher })]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('a failing server never breaks the banner: empty override, no throw', async () => {
    expect(await fetchProfileOverride(ID, { fetch: async () => reply({}, false) })).toEqual({});
    resetProfileOverrides();
    expect(await fetchProfileOverride(ID, { fetch: async () => Promise.reject(new Error('offline')) })).toEqual({});
    resetProfileOverrides();
    expect(await fetchProfileOverride(ID, { fetch: async () => ({ ok: true, json: async () => Promise.reject(new Error('bad json')) }) as unknown as Response })).toEqual({});
  });

  test('a failure is remembered briefly, so a broken server is not hammered', async () => {
    let now = 0;
    const fetcher = vi.fn(async () => reply({}, false));
    const options = { fetch: fetcher, now: () => now };
    await fetchProfileOverride(ID, options);
    await fetchProfileOverride(ID, options);
    expect(fetcher).toHaveBeenCalledTimes(1);
    now += 90_000;
    await fetchProfileOverride(ID, options);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test('does not ask for something that is not a player id', async () => {
    const fetcher = vi.fn(async () => reply(OVERRIDE));
    for (const bad of ['', '../x', 'a b', "x'--"]) expect(await fetchProfileOverride(bad, { fetch: fetcher })).toEqual({});
    expect(fetcher).not.toHaveBeenCalled();
  });

  test('survives a page reload through session storage', async () => {
    const store = new Map<string, string>();
    const storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value) };
    const first = vi.fn(async () => reply(OVERRIDE));
    await fetchProfileOverride(ID, { fetch: first, storage });
    resetProfileOverrides();
    const second = vi.fn(async () => reply({}));
    expect(await fetchProfileOverride(ID, { fetch: second, storage })).toEqual({ avatar: OVERRIDE.avatar.url, cover: OVERRIDE.cover.url });
    expect(second).not.toHaveBeenCalled();
  });
});

describe('applyOverride', () => {
  const profile = { player_id: ID, nickname: 'skull', avatar: 'https://cdn.faceit/a.jpg', cover_image: 'https://cdn.faceit/c.jpg' };

  test('replaces only what was set and says which', () => {
    expect(applyOverride(profile, { avatar: 'https://x/a.webp' })).toMatchObject({
      avatar: 'https://x/a.webp',
      cover_image: 'https://cdn.faceit/c.jpg',
      overridden: { avatar: true },
    });
    expect(applyOverride(profile, { cover: 'https://x/c.webp' })).toMatchObject({ avatar: 'https://cdn.faceit/a.jpg', cover_image: 'https://x/c.webp', overridden: { cover: true } });
  });

  test('an empty override leaves the profile as FACEIT sent it', () => {
    expect(applyOverride(profile, {})).toEqual(profile);
  });
});

describe('the FACEIT lookups use the override', () => {
  const faceitProfile = { player_id: ID, nickname: 'skull', avatar: 'https://cdn.faceit/a.jpg', cover_image: 'https://cdn.faceit/c.jpg', games: { cs2: { faceit_elo: 2000, skill_level: 10 } } };

  const stub = (override: unknown, overrideOk = true) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => (String(url).startsWith('/api/profiles/') ? reply(override, overrideOk) : reply(faceitProfile)))
    );

  test('getPlayerProfile returns the custom avatar and cover with the flag', async () => {
    stub(OVERRIDE);
    const profile = await getPlayerProfile('skull');
    expect(profile?.avatar).toBe(OVERRIDE.avatar.url);
    expect(profile?.cover_image).toBe(OVERRIDE.cover.url);
    expect(profile?.overridden).toEqual({ avatar: true, cover: true });
  });

  test('lookupPlayer does too, so rosters and versus rows match the banner', async () => {
    stub({ avatar: OVERRIDE.avatar });
    const profile = await lookupPlayer('skull');
    expect(profile?.avatar).toBe(OVERRIDE.avatar.url);
    expect(profile?.cover_image).toBe('https://cdn.faceit/c.jpg');
  });

  test('when the override server is down the plain FACEIT profile is used', async () => {
    stub({}, false);
    const profile = await getPlayerProfile('skull');
    expect(profile?.avatar).toBe('https://cdn.faceit/a.jpg');
    expect(profile?.overridden).toBeUndefined();
  });
});
