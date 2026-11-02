const PRESENCE_ID_KEY = 'fcw_presence_id';
const STUDIO_PRESENCE_ID_KEY = 'fcw_studio_presence_id';
const HEARTBEAT_MS = 60_000;
/** Wait for /api/auth/me before the first studio ping, and collapse focus bursts. */
export const STUDIO_PRESENCE_DEBOUNCE_MS = 800;
export const FACEIT_PLAYER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Matches the server snapshot TTL. The menu count and the live list both use it. */
export const PRESENCE_REFRESH_MS = 30_000;
/** The live list is a saved copy on the server, so asking more often than once a minute gains nothing. */
export const LIVE_LIST_REFRESH_MS = 60_000;

/** Keeps navigation counters readable in the narrow rail without hiding the real scale. */
export function formatMenuCount(count: number | null | undefined) {
  if (count === null || count === undefined) return '—';
  if (count < 1_000) return count.toLocaleString();
  if (count < 10_000) return `${(count / 1_000).toFixed(1).replace('.0', '')}k`;
  if (count < 1_000_000) return `${Math.floor(count / 1_000)}k`;
  return `${(count / 1_000_000).toFixed(1).replace('.0', '')}m`;
}

type OnlineListener = (count: number) => void;
const onlineListeners = new Set<OnlineListener>();
let lastOnline: number | null = null;
const streamerListeners = new Set<OnlineListener>();
let lastStreamerOnline: number | null = null;

function publishOnlineCount(count: number) {
  lastOnline = count;
  for (const listener of onlineListeners) listener(count);
}

/** The live list and the menu share one number so a studio on /live does not fetch it twice. */
export function subscribeOnlineCount(listener: OnlineListener) {
  onlineListeners.add(listener);
  if (lastOnline !== null) listener(lastOnline);
  return () => {
    onlineListeners.delete(listener);
  };
}

export function subscribeLiveStreamerCount(listener: OnlineListener) {
  streamerListeners.add(listener);
  if (lastStreamerOnline !== null) listener(lastStreamerOnline);
  return () => {
    streamerListeners.delete(listener);
  };
}

function publishLiveStreamerCount(players: LivePlayer[]) {
  const count = players.filter((player) => player.twitchStatus?.state === 'live' || player.kickStatus?.state === 'live').length;
  lastStreamerOnline = count;
  for (const listener of streamerListeners) listener(count);
}

export type PresenceInfo = {
  nickname?: string;
  playerId?: string;
  elo?: number;
  level?: number;
  country?: string;
  /** Season placements are unfinished, so elo is the last known value and level is omitted. */
  calibrating?: boolean;
  style?: string;
};

function getPresenceId(key = PRESENCE_ID_KEY) {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return saved;
    const id = crypto.randomUUID().replace(/-/g, '');
    localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID().replace(/-/g, '');
  }
}

export function isFaceitPlayerId(value: string | null | undefined): value is string {
  return typeof value === 'string' && FACEIT_PLAYER_ID.test(value.trim());
}

/** Studio heartbeat payload: FACEIT guid only. Dev Admin and leftover cookies produce nothing. */
export function studioPresenceInfo(
  user?: { guid?: string | null; nickname?: string | null } | null,
  extras?: Pick<PresenceInfo, 'elo' | 'level' | 'country' | 'calibrating'>
): PresenceInfo | undefined {
  const guid = typeof user?.guid === 'string' ? user.guid.trim() : '';
  if (!isFaceitPlayerId(guid)) return undefined;
  const nickname = typeof user?.nickname === 'string' ? user.nickname.trim() : '';
  return {
    playerId: guid.toLowerCase(),
    ...(nickname ? { nickname } : {}),
    ...(typeof extras?.elo === 'number' ? { elo: extras.elo } : {}),
    ...(extras?.calibrating === true
      ? { calibrating: true }
      : typeof extras?.level === 'number'
        ? { level: extras.level }
        : {}),
    ...(extras?.country ? { country: extras.country } : {}),
  };
}

export function startPresenceHeartbeat(readInfo?: () => PresenceInfo | undefined) {
  const id = getPresenceId();
  const ping = () => {
    const info = readInfo?.();
    void fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(info ? { id, info } : { id }),
      cache: 'no-store',
      keepalive: true,
    }).catch(() => undefined);
  };

  ping();
  const interval = window.setInterval(ping, HEARTBEAT_MS);
  const onVisibility = () => {
    if (document.visibilityState === 'visible') ping();
  };
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

/**
 * Focused studio tab of a real FACEIT account. Same playerId as the session guid,
 * so the live board shows one FACEIT row — never Dev Admin and never a nameless cookie.
 */
export function startStudioPresenceHeartbeat(readInfo: () => PresenceInfo | undefined) {
  const id = getPresenceId(STUDIO_PRESENCE_ID_KEY);
  let lastSent = 0;
  let debounceTimer = 0;

  const ping = () => {
    const info = studioPresenceInfo(
      { guid: readInfo()?.playerId, nickname: readInfo()?.nickname },
      readInfo()
    );
    if (!info?.playerId) return;
    if (document.visibilityState === 'hidden') return;
    const now = Date.now();
    if (lastSent && now - lastSent < STUDIO_PRESENCE_DEBOUNCE_MS) return;
    lastSent = now;
    void fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, info }),
      cache: 'no-store',
      keepalive: true,
    }).catch(() => undefined);
  };

  const schedule = () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(ping, STUDIO_PRESENCE_DEBOUNCE_MS);
  };

  schedule();
  const interval = window.setInterval(ping, HEARTBEAT_MS);
  const onVisibility = () => {
    if (document.visibilityState === 'visible') schedule();
  };
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    window.clearTimeout(debounceTimer);
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

export async function getOnlineBannerCount(signal?: AbortSignal) {
  const response = await fetch('/api/presence', { cache: 'default', signal });
  if (!response.ok) throw new Error('presence_unavailable');
  const data = (await response.json()) as { online?: number };
  const count = Math.max(0, Number(data.online) || 0);
  publishOnlineCount(count);
  return count;
}

export type StreamStatus = {
  state: 'live' | 'offline' | 'missing' | 'unknown';
  viewers?: number;
  title?: string;
  game?: string;
  thumbnail?: string;
  startedAt?: string;
};

export type LivePlayer = {
  nickname: string;
  avatar?: string;
  verifiedBadge?: 'none' | 'verified' | 'gold';
  /** The paid FACEIT plan, taken from the profile on the server. Free accounts have none. */
  membership?: 'plus' | 'premium';
  /** Has an ESEA membership. */
  esea?: boolean;
  /** Holds a Super Match Token. */
  token?: boolean;
  /** Channel name of the Twitch account linked on FACEIT. */
  twitch?: string;
  twitchStatus?: StreamStatus;
  /** Channel name of the Kick account paired in the studio, or taken from FACEIT when present. */
  kick?: string;
  kickStatus?: StreamStatus;
  /** True when this FACEIT account has signed in to the studio. No date and no account id. */
  confirmed?: boolean;
  elo?: number;
  level?: number;
  /** Season placements are unfinished. elo is the last known value and there is no level. */
  calibrating?: boolean;
  /** Region place, only when a level-10 player is inside the top 1000. */
  ranking?: number;
  country?: string;
  style?: string;
};

export type LiveBoard = {
  online: number;
  ranked: number;
  windowSeconds: number;
  /** How long the server keeps the list before building it again. */
  cacheSeconds?: number;
  /** When the server made this copy of the list, in epoch milliseconds. */
  generatedAt?: number;
  players: LivePlayer[];
};

export async function getLiveBoard(signal?: AbortSignal): Promise<LiveBoard> {
  const response = await fetch('/api/presence/live', { cache: 'default', signal });
  if (!response.ok) throw new Error('presence_unavailable');
  const data = (await response.json()) as Partial<LiveBoard>;
  const players = Array.isArray(data.players) ? data.players.filter((player) => player && typeof player.nickname === 'string') : [];
  const online = Math.max(0, Number(data.online) || 0);
  publishOnlineCount(online);
  publishLiveStreamerCount(players);
  return {
    online,
    ranked: Math.max(0, Number(data.ranked) || players.length),
    windowSeconds: Math.max(0, Number(data.windowSeconds) || 0),
    cacheSeconds: typeof data.cacheSeconds === 'number' ? data.cacheSeconds : undefined,
    generatedAt: typeof data.generatedAt === 'number' ? data.generatedAt : undefined,
    players,
  };
}
