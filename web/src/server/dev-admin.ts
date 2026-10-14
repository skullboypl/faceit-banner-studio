/** Same gates as server/auth.mjs: local `dev:admin` only, never production, never a public host. */
export const DEV_ADMIN_USER = { guid: 'dev-admin', nickname: 'Dev Admin', avatar: null };

export function localDevAdmin(request: { headers: { get(name: string): string | null } }): boolean {
  if (process.env.DEV_ADMIN !== '1' || process.env.NODE_ENV === 'production') return false;
  const raw = request.headers.get('host') ?? '';
  const host = raw.startsWith('[') ? raw.slice(1, Math.max(raw.indexOf(']'), 1)) : raw.split(':')[0];
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}
