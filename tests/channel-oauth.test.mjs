import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { createAuthMiddleware } from '../server/auth.mjs';
import {
  authorizeUrl,
  beginPairingState,
  kickOAuthConfigured,
  loginFromProvider,
  pairingRedirectUri,
  parsePairingState,
  readKickLogin,
  readTwitchLogin,
  twitchOAuthConfigured,
} from '../server/channel-oauth.mjs';
import { saveSession, setKick, setTwitch, twitchForUser } from '../server/store.mjs';

const GUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SESSION = 'ab'.repeat(24);

process.env.PUBLIC_URL = 'https://faceitbanner.vxh.pl';

async function serve(middleware) {
  const server = createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function signed(path, { method = 'GET', body, origin = 'https://faceitbanner.vxh.pl' } = {}) {
  const { base, close } = await serve(createAuthMiddleware());
  await saveSession(SESSION, { guid: GUID, nickname: 'P', avatar: null });
  try {
    return await fetch(base + path, {
      method,
      redirect: 'manual',
      headers: {
        cookie: `fb_session=${SESSION}`,
        ...(origin ? { origin } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } finally {
    await close();
  }
}

test('a typed nick is not a verified connection', async () => {
  const twitch = await signed('/api/auth/twitch', { method: 'PUT', body: { twitch: 'SkullBoyPL' } });
  assert.equal(twitch.status, 400);
  assert.equal((await twitch.json()).error, 'oauth_required');
  const kick = await signed('/api/auth/kick', { method: 'PUT', body: { kick: 'MapeT' } });
  assert.equal(kick.status, 400);
  assert.equal((await kick.json()).error, 'oauth_required');
});

test('PUT unlink still clears a stored login', async () => {
  await setTwitch(GUID, 'SkullBoyPL');
  const response = await signed('/api/auth/twitch', { method: 'PUT', body: { twitch: null } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { twitch: null });
  assert.equal(await twitchForUser(GUID), null);
});

test('missing keys do not start pairing', async () => {
  const previous = {
    twitchId: process.env.TWITCH_CLIENT_ID,
    twitchSecret: process.env.TWITCH_CLIENT_SECRET,
    kickId: process.env.KICK_CLIENT_ID,
    kickSecret: process.env.KICK_CLIENT_SECRET,
  };
  delete process.env.TWITCH_CLIENT_ID;
  delete process.env.TWITCH_CLIENT_SECRET;
  delete process.env.KICK_CLIENT_ID;
  delete process.env.KICK_CLIENT_SECRET;
  try {
    assert.equal(twitchOAuthConfigured(), false);
    assert.equal(kickOAuthConfigured(), false);
    const twitch = await signed('/api/auth/twitch');
    assert.equal(twitch.status, 503);
    assert.equal((await twitch.json()).error, 'oauth_not_configured');
    const kick = await signed('/api/auth/kick');
    assert.equal(kick.status, 503);
  } finally {
    for (const [name, value] of [
      ['TWITCH_CLIENT_ID', previous.twitchId],
      ['TWITCH_CLIENT_SECRET', previous.twitchSecret],
      ['KICK_CLIENT_ID', previous.kickId],
      ['KICK_CLIENT_SECRET', previous.kickSecret],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

function withTwitchKeys() {
  const previous = { id: process.env.TWITCH_CLIENT_ID, secret: process.env.TWITCH_CLIENT_SECRET };
  process.env.TWITCH_CLIENT_ID = 'twitch-id';
  process.env.TWITCH_CLIENT_SECRET = 'twitch-secret';
  return () => {
    if (previous.id === undefined) delete process.env.TWITCH_CLIENT_ID;
    else process.env.TWITCH_CLIENT_ID = previous.id;
    if (previous.secret === undefined) delete process.env.TWITCH_CLIENT_SECRET;
    else process.env.TWITCH_CLIENT_SECRET = previous.secret;
  };
}

test('loginFromProvider stores only the provider login, not a typed nick', async () => {
  const restore = withTwitchKeys();
  try {
  const fetchFn = async (url) => {
    const href = String(url);
    if (href.includes('id.twitch.tv/oauth2/token')) {
      return { ok: true, json: async () => ({ access_token: 'tok' }) };
    }
    if (href.includes('api.twitch.tv/helix/users')) {
      return { ok: true, json: async () => ({ data: [{ login: 'SkullBoyPL' }] }) };
    }
    throw new Error(href);
  };
  const verified = await loginFromProvider('twitch', {
    code: 'code',
    verifier: 'verifier',
    redirectUri: pairingRedirectUri('https://faceitbanner.vxh.pl', 'twitch'),
    fetch: fetchFn,
  });
  assert.deepEqual(verified, { ok: true, login: 'SkullBoyPL' });
  const saved = await setTwitch(GUID, verified.login);
  assert.equal(saved.ok, true);
  assert.equal(await twitchForUser(GUID), 'SkullBoyPL');
  const taken = await setTwitch(OTHER, 'skullboypl');
  assert.equal(taken.ok, false);
  assert.equal(taken.error, 'taken');
  await setTwitch(GUID, null);
  } finally {
    restore();
  }
});

test('the OAuth callback writes the verified login for the signed-in account', async () => {
  const restore = withTwitchKeys();
  const { state } = await beginPairingState('twitch', GUID);
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const href = String(url);
    if (href.startsWith('http://127.0.0.1')) return realFetch(url, init);
    if (href.includes('id.twitch.tv/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
    }
    if (href.includes('api.twitch.tv/helix/users')) {
      return new Response(JSON.stringify({ data: [{ login: 'OAuthTwitch' }] }), { status: 200 });
    }
    return new Response('nope', { status: 500 });
  };
  await saveSession(SESSION, { guid: GUID, nickname: 'P', avatar: null });
  const { base, close } = await serve(createAuthMiddleware());
  try {
    const response = await realFetch(`${base}/api/auth/twitch/callback?code=abc&state=${state}`, {
      redirect: 'manual',
      headers: { cookie: `fb_session=${SESSION}` },
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/?panel=profile&pair=twitch');
    assert.equal(await twitchForUser(GUID), 'OAuthTwitch');
  } finally {
    globalThis.fetch = realFetch;
    await setTwitch(GUID, null);
    restore();
    await close();
  }
});

test('authorize URL uses PKCE and the app callback', () => {
  const url = new URL(
    authorizeUrl('twitch', {
      clientId: 'id',
      redirectUri: pairingRedirectUri('https://faceitbanner.vxh.pl', 'twitch'),
      state: 's',
      challenge: 'c',
    })
  );
  assert.equal(url.origin + url.pathname, 'https://id.twitch.tv/oauth2/authorize');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://faceitbanner.vxh.pl/api/auth/twitch/callback');
  assert.equal(url.searchParams.get('scope'), 'user:read:email');
  const kick = new URL(
    authorizeUrl('kick', {
      clientId: 'id',
      redirectUri: pairingRedirectUri('http://localhost:5173', 'kick'),
      state: 's',
      challenge: 'c',
    })
  );
  assert.equal(kick.origin + kick.pathname, 'https://id.kick.com/oauth/authorize');
  assert.equal(kick.searchParams.get('redirect_uri'), 'http://localhost:5173/api/auth/kick/callback');
  assert.equal(kick.searchParams.get('scope'), 'user:read channel:read');
});

test('readTwitchLogin and readKickLogin keep only a plain channel', () => {
  assert.equal(readTwitchLogin({ data: [{ login: 'SkullBoyPL' }] }), 'SkullBoyPL');
  assert.equal(readTwitchLogin({ data: [{ login: 'a b' }] }), '');
  assert.equal(readKickLogin({ data: [{ name: 'John Doe' }] }, { data: [{ slug: 'john-doe' }] }), 'john-doe');
  assert.equal(readKickLogin({ data: [{ name: 'John Doe' }] }, null), '');
});

test('pairing state is not a FACEIT verifier string', () => {
  assert.equal(parsePairingState('plain-verifier'), null);
  assert.deepEqual(parsePairingState('pair:{"v":"abc","p":"twitch","g":"AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA"}'), {
    verifier: 'abc',
    provider: 'twitch',
    guid: GUID,
  });
});
