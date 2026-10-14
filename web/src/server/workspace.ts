import { getRedis } from './redis';
import { loadWorkspace, saveWorkspace } from './repo-workspace';

export const WORKSPACE_TTL_SECONDS = 60 * 60 * 24 * 7;
export const FLUSH_INTERVAL_MS = 30_000;

const DIRTY_SET = 'fb:workspace:dirty';
const key = (guid: string) => `fb:workspace:${guid}`;

export type WorkspaceSnapshot = { settings: Record<string, unknown>; version: number; deviceId: string };
export type PutResult =
  | { status: 'ok'; version: number }
  | { status: 'conflict'; current: WorkspaceSnapshot };

type PutInput = { settings: Record<string, unknown>; deviceId: string; baseVersion: number };

/** Atomic compare-and-bump: ARGV = baseVersion, deviceId, settingsJson, ttl, guid. */
const PUT_SCRIPT = `
local version = tonumber(redis.call('HGET', KEYS[1], 'version') or '0')
local device = redis.call('HGET', KEYS[1], 'device')
if version > 0 and tonumber(ARGV[1]) < version and device ~= ARGV[2] then
  return {'conflict', redis.call('HGET', KEYS[1], 'settings'), tostring(version), device}
end
version = version + 1
redis.call('HSET', KEYS[1], 'settings', ARGV[3], 'version', version, 'device', ARGV[2])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
redis.call('SADD', KEYS[2], ARGV[5])
return {'ok', '', tostring(version), ARGV[2]}
`;

/** Copies a Postgres snapshot into Redis only when the key is absent (never over a newer write). */
const HYDRATE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  redis.call('HSET', KEYS[1], 'settings', ARGV[1], 'version', ARGV[2], 'device', ARGV[3])
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
end
return 1
`;

type Hash = Record<string, string>;

const fromHash = (hash: Hash): WorkspaceSnapshot => ({
  settings: JSON.parse(hash.settings),
  version: Number(hash.version),
  deviceId: hash.device,
});

async function hydrate(guid: string): Promise<void> {
  const redis = await getRedis();
  if (!redis || (await redis.exists(key(guid)))) return;
  const stored = await loadWorkspace(guid);
  if (!stored) return;
  await redis.eval(
    HYDRATE_SCRIPT,
    1,
    key(guid),
    JSON.stringify(stored.settings),
    String(stored.version),
    stored.deviceId,
    String(WORKSPACE_TTL_SECONDS)
  );
}

/** Degraded path while Redis is down: same rules, written straight to Postgres. */
async function putDirect(guid: string, input: PutInput): Promise<PutResult> {
  const current = await loadWorkspace(guid);
  if (current && input.baseVersion < current.version && current.deviceId !== input.deviceId) {
    return {
      status: 'conflict',
      current: { settings: current.settings, version: current.version, deviceId: current.deviceId },
    };
  }
  const version = (current?.version ?? 0) + 1;
  await saveWorkspace(guid, { settings: input.settings, version, deviceId: input.deviceId });
  return { status: 'ok', version };
}

export async function putWorkspace(guid: string, input: PutInput): Promise<PutResult> {
  const redis = await getRedis();
  if (!redis) return putDirect(guid, input);
  try {
    await hydrate(guid);
    const [status, settings, version, deviceId] = (await redis.eval(
      PUT_SCRIPT,
      2,
      key(guid),
      DIRTY_SET,
      String(input.baseVersion),
      input.deviceId,
      JSON.stringify(input.settings),
      String(WORKSPACE_TTL_SECONDS),
      guid
    )) as string[];
    if (status === 'ok') return { status: 'ok', version: Number(version) };
    return { status: 'conflict', current: { settings: JSON.parse(settings), version: Number(version), deviceId } };
  } catch {
    return putDirect(guid, input);
  }
}

export async function getWorkspace(guid: string): Promise<WorkspaceSnapshot | null> {
  const redis = await getRedis();
  if (redis) {
    try {
      await hydrate(guid);
      const hash = await redis.hgetall(key(guid));
      if (hash.version) return fromHash(hash);
      return null;
    } catch {
      // fall through to Postgres
    }
  }
  const stored = await loadWorkspace(guid);
  return stored && { settings: stored.settings, version: stored.version, deviceId: stored.deviceId };
}

/** Moves changed workspaces from Redis to Postgres; users whose write fails go back to the dirty set. */
export async function flushNow(): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    for (;;) {
      const batch = await redis.spop(DIRTY_SET, 50);
      if (batch.length === 0) return;
      for (const guid of batch) {
        try {
          const hash = await redis.hgetall(key(guid));
          if (!hash.version) continue;
          await saveWorkspace(guid, fromHash(hash));
        } catch {
          await redis.sadd(DIRTY_SET, guid).catch(() => undefined);
        }
      }
      if (batch.length < 50) return;
    }
  } catch {
    // Redis went away mid-flush; the next tick retries.
  }
}

export function startFlushWorker(intervalMs = FLUSH_INTERVAL_MS) {
  let running: Promise<void> | null = null;
  const tick = () => {
    running ??= flushNow().finally(() => {
      running = null;
    });
    return running;
  };
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref?.();
  return {
    flushNow: tick,
    async stop() {
      clearInterval(timer);
      await running;
      await flushNow();
    },
  };
}
