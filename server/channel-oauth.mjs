/**
 * Twitch / Kick pairing. A typed channel name is not a connection:
 * only the login returned after OAuth (token + userinfo) is stored.
 */
import { createHash, randomBytes } from 'node:crypto';
import { cleanKick, cleanTwitch, saveState } from './store.mjs';

export const TWITCH_AUTHORIZE = 'https://id.twitch.tv/oauth2/authorize';
export const TWITCH_TOKEN = 'https://id.twitch.tv/oauth2/token';
export const TWITCH_USERS = 'https://api.twitch.tv/helix/users';
export const KICK_AUTHORIZE = 'https://id.kick.com/oauth/authorize';
export const KICK_TOKEN = 'https://id.kick.com/oauth/token';
export const KICK_USERS = 'https://api.kick.com/public/v1/users';
export const KICK_CHANNELS = 'https://api.kick.com/public/v1/channels';
export const TWITCH_SCOPE = 'user:read:email';
export const KICK_SCOPE = 'user:read channel:read';

export function twitchOAuthConfigured() {
  return Boolean(String(process.env.TWITCH_CLIENT_ID || '').trim() && String(process.env.TWITCH_CLIENT_SECRET || '').trim());
}

export function kickOAuthConfigured() {
  return Boolean(String(process.env.KICK_CLIENT_ID || '').trim() && String(process.env.KICK_CLIENT_SECRET || '').trim());
}

export function providerKeys(provider) {
  if (provider === 'twitch') {
    const id = String(process.env.TWITCH_CLIENT_ID || '').trim();
    const secret = String(process.env.TWITCH_CLIENT_SECRET || '').trim();
    return id && secret ? { id, secret } : null;
  }
  const id = String(process.env.KICK_CLIENT_ID || '').trim();
  const secret = String(process.env.KICK_CLIENT_SECRET || '').trim();
  return id && secret ? { id, secret } : null;
}

/** Helix `login` is the channel. Anything else is ignored. */
export function readTwitchLogin(body) {
  const row = Array.isArray(body?.data) ? body.data[0] : body;
  return cleanTwitch(row?.login);
}

/**
 * Kick channel slug from /channels, then a plain username on /users.
 * Display names with spaces are not a channel.
 */
export function readKickLogin(userBody, channelBody) {
  const channel = Array.isArray(channelBody?.data) ? channelBody.data[0] : channelBody;
  const fromChannel = cleanKick(channel?.slug || channel?.username || '');
  if (fromChannel) return fromChannel;
  const user = Array.isArray(userBody?.data) ? userBody.data[0] : userBody;
  return cleanKick(user?.slug || user?.username || user?.name || '');
}

export function pairingRedirectUri(origin, provider) {
  return `${String(origin || '').replace(/\/$/, '')}/api/auth/${provider}/callback`;
}

export function pairingReturnPath(status) {
  return `/?panel=profile&pair=${status}`;
}

export async function beginPairingState(provider, guid) {
  const state = randomBytes(24).toString('hex');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  await saveState(state, `pair:${JSON.stringify({ v: verifier, p: provider, g: guid })}`);
  return { state, verifier, challenge };
}

export function parsePairingState(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('pair:')) return null;
  try {
    const payload = JSON.parse(raw.slice(5));
    if ((payload.p !== 'twitch' && payload.p !== 'kick') || typeof payload.v !== 'string' || typeof payload.g !== 'string') {
      return null;
    }
    return { verifier: payload.v, provider: payload.p, guid: String(payload.g).toLowerCase() };
  } catch {
    return null;
  }
}

export function authorizeUrl(provider, { clientId, redirectUri, state, challenge }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: provider === 'twitch' ? TWITCH_SCOPE : KICK_SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return `${provider === 'twitch' ? TWITCH_AUTHORIZE : KICK_AUTHORIZE}?${params}`;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Exchange the OAuth code and return the verified channel login. Does not write storage. */
export async function loginFromProvider(provider, { code, verifier, redirectUri, fetch: fetchFn = globalThis.fetch }) {
  const creds = providerKeys(provider);
  if (!creds) return { ok: false, error: 'oauth_not_configured' };
  if (typeof code !== 'string' || !code || typeof verifier !== 'string' || !verifier) {
    return { ok: false, error: 'invalid' };
  }

  if (provider === 'twitch') {
    const tokenResponse = await fetchFn(TWITCH_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: creds.id,
        client_secret: creds.secret,
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    });
    if (!tokenResponse.ok) return { ok: false, error: 'failed' };
    const access = (await readJson(tokenResponse))?.access_token;
    if (!access) return { ok: false, error: 'failed' };
    const userResponse = await fetchFn(TWITCH_USERS, {
      headers: { Authorization: `Bearer ${access}`, 'Client-Id': creds.id },
    });
    if (!userResponse.ok) return { ok: false, error: 'failed' };
    const login = readTwitchLogin(await readJson(userResponse));
    if (!login) return { ok: false, error: 'invalid' };
    return { ok: true, login };
  }

  const tokenResponse = await fetchFn(KICK_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: creds.id,
      client_secret: creds.secret,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });
  if (!tokenResponse.ok) return { ok: false, error: 'failed' };
  const access = (await readJson(tokenResponse))?.access_token;
  if (!access) return { ok: false, error: 'failed' };
  const headers = { Authorization: `Bearer ${access}`, Accept: 'application/json' };
  const [userResponse, channelResponse] = await Promise.all([
    fetchFn(KICK_USERS, { headers }),
    fetchFn(KICK_CHANNELS, { headers }),
  ]);
  const userBody = userResponse.ok ? await readJson(userResponse) : null;
  const channelBody = channelResponse.ok ? await readJson(channelResponse) : null;
  const login = readKickLogin(userBody, channelBody);
  if (!login) return { ok: false, error: 'invalid' };
  return { ok: true, login };
}
