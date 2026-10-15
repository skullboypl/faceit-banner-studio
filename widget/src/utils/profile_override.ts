/**
 * Custom avatar and cover that a player set for the banners (approved by an admin). They replace the
 * FACEIT pictures wherever this project draws that player. The lookup never breaks a banner: any
 * failure means "no override" and the FACEIT pictures stay.
 */
export type ProfileOverride = { avatar?: string; cover?: string };

type Options = {
  fetch?: typeof fetch;
  now?: () => number;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
};

const TTL_MS = 10 * 60_000;
const FAILURE_TTL_MS = 60_000;
const TIMEOUT_MS = 3_000;
const PLAYER_ID = /^[A-Za-z0-9][A-Za-z0-9-]{3,63}$/;
const STORAGE_PREFIX = 'fb:override:';

type Entry = { at: number; ttl: number; value: ProfileOverride };
const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<ProfileOverride>>();

/** Tests (and a logout) start from a clean slate. */
export function resetProfileOverrides() {
  memory.clear();
  inflight.clear();
  try {
    if (typeof sessionStorage === 'undefined') return;
    for (const key of Object.keys(sessionStorage)) if (key.startsWith(STORAGE_PREFIX)) sessionStorage.removeItem(key);
  } catch {
    /* storage blocked */
  }
}

/** Pictures come from our own storage over https; plain http is accepted only for a local dev bucket. */
const safeUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return value;
    if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return value;
  } catch {
    /* not a URL */
  }
  return undefined;
};

const parse = (body: unknown): ProfileOverride => {
  const source = (typeof body === 'object' && body !== null ? body : {}) as { avatar?: { url?: unknown }; cover?: { url?: unknown } };
  const value: ProfileOverride = {};
  const avatar = safeUrl(source.avatar?.url);
  const cover = safeUrl(source.cover?.url);
  if (avatar) value.avatar = avatar;
  if (cover) value.cover = cover;
  return value;
};

function stored(options: Options, id: string, now: number): ProfileOverride | undefined {
  try {
    const raw = options.storage?.getItem(STORAGE_PREFIX + id);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as Entry;
    return now - entry.at < entry.ttl ? entry.value : undefined;
  } catch {
    return undefined;
  }
}

function remember(options: Options, id: string, entry: Entry) {
  memory.set(id, entry);
  try {
    options.storage?.setItem(STORAGE_PREFIX + id, JSON.stringify(entry));
  } catch {
    /* storage full or blocked: the memory copy is enough */
  }
}

export async function fetchProfileOverride(playerId: string, options: Options = {}): Promise<ProfileOverride> {
  if (!PLAYER_ID.test(playerId)) return {};
  const now = options.now ?? Date.now;
  const cached = memory.get(playerId);
  if (cached && now() - cached.at < cached.ttl) return cached.value;
  const fromStorage = stored(options, playerId, now());
  if (fromStorage) return fromStorage;
  const pending = inflight.get(playerId);
  if (pending) return pending;

  const request = (async (): Promise<ProfileOverride> => {
    const controller = typeof AbortController === 'undefined' ? undefined : new AbortController();
    const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : undefined;
    try {
      const response = await (options.fetch ?? fetch)(`/api/profiles/${playerId}`, {
        credentials: 'omit',
        signal: controller?.signal,
      });
      if (!response.ok) throw new Error('override_unavailable');
      const value = parse(await response.json());
      remember(options, playerId, { at: now(), ttl: TTL_MS, value });
      return value;
    } catch {
      remember(options, playerId, { at: now(), ttl: FAILURE_TTL_MS, value: {} });
      return {};
    } finally {
      if (timer) clearTimeout(timer);
      inflight.delete(playerId);
    }
  })();
  inflight.set(playerId, request);
  return request;
}

/** The FACEIT profile with the custom pictures laid over it, and a flag for which ones were replaced. */
export function applyOverride<T extends { avatar?: string; cover_image?: string }>(
  profile: T,
  override: ProfileOverride
): T & { overridden?: { avatar?: boolean; cover?: boolean } } {
  if (!override.avatar && !override.cover) return profile;
  const overridden: { avatar?: boolean; cover?: boolean } = {};
  const next = { ...profile } as T & { overridden?: { avatar?: boolean; cover?: boolean } };
  if (override.avatar) {
    next.avatar = override.avatar;
    overridden.avatar = true;
  }
  if (override.cover) {
    next.cover_image = override.cover;
    overridden.cover = true;
  }
  next.overridden = overridden;
  return next;
}
