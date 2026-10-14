import { getRedis } from './redis';
import type { SessionUser } from './repo-users';

const SESSION_COOKIE = 'fb_session';
const SESSION_ID = /^[a-f0-9]{48}$/;

function readCookie(header: string | null, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/**
 * Reads the login session written by server/auth.mjs (`fb:session:{id}` in Redis).
 * Without REDIS_URL there is nothing shared to read, so nobody is logged in here.
 */
export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const id = readCookie(request.headers.get('cookie'), SESSION_COOKIE);
  if (!id || !SESSION_ID.test(id)) return null;

  const redis = await getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(`fb:session:${id}`);
    if (!raw) return null;
    const user = JSON.parse(raw) as Partial<SessionUser>;
    if (typeof user.guid !== 'string' || typeof user.nickname !== 'string') return null;
    return { guid: user.guid, nickname: user.nickname, avatar: user.avatar ?? null };
  } catch {
    return null;
  }
}
