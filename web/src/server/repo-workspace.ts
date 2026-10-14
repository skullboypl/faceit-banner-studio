import { getPool } from './db';

export type WorkspaceState = {
  settings: Record<string, unknown>;
  version: number;
  deviceId: string;
  updatedAt?: string;
};

export async function loadWorkspace(guid: string): Promise<WorkspaceState | null> {
  const pool = await getPool();
  if (!pool) return null;
  const { rows } = await pool.query(
    'SELECT settings, version, device_id, updated_at FROM user_workspace WHERE user_guid = $1',
    [guid]
  );
  if (!rows[0]) return null;
  return {
    settings: rows[0].settings,
    version: Number(rows[0].version),
    deviceId: rows[0].device_id,
    updatedAt: rows[0].updated_at.toISOString(),
  };
}

/** An older version never overwrites a newer one (the flush worker can race a direct write). */
export async function saveWorkspace(
  guid: string,
  state: { settings: Record<string, unknown>; version: number; deviceId: string }
): Promise<void> {
  const pool = await getPool();
  if (!pool) return;
  await pool.query(
    `INSERT INTO user_workspace (user_guid, settings, version, device_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_guid) DO UPDATE
       SET settings = EXCLUDED.settings, version = EXCLUDED.version,
           device_id = EXCLUDED.device_id, updated_at = NOW()
       WHERE user_workspace.version <= EXCLUDED.version`,
    [guid, JSON.stringify(state.settings), state.version, state.deviceId]
  );
}
