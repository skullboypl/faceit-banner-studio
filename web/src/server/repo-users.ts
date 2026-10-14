import { getPool } from './db';

export type SessionUser = { guid: string; nickname: string; avatar: string | null };

/** Keeps the account row in step with the FACEIT profile; called on every authenticated request. */
export async function upsertUser(user: SessionUser): Promise<void> {
  const pool = await getPool();
  if (!pool) return;
  await pool.query(
    `INSERT INTO users (guid, nickname, avatar) VALUES ($1, $2, $3)
     ON CONFLICT (guid) DO UPDATE SET nickname = EXCLUDED.nickname, avatar = EXCLUDED.avatar`,
    [user.guid, user.nickname.slice(0, 64), user.avatar]
  );
}
