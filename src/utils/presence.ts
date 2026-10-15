const PRESENCE_ID_KEY = 'fcw_presence_id';
const HEARTBEAT_MS = 60_000;
/** Matches the server snapshot TTL. The menu count and the live list both use it. */
export const PRESENCE_REFRESH_MS = 30_000;

type OnlineListener = (count: number) => void;
const onlineListeners = new Set<OnlineListener>();
let lastOnline: number | null = null;

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

function getPresenceId() {
  try {
    const saved = localStorage.getItem(PRESENCE_ID_KEY);
    if (saved) return saved;
    const id = crypto.randomUUID().replace(/-/g, '');
    localStorage.setItem(PRESENCE_ID_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID().replace(/-/g, '');
  }
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

export async function getOnlineBannerCount(signal?: AbortSignal) {
  const response = await fetch('/api/presence', { cache: 'default', signal });
  if (!response.ok) throw new Error('presence_unavailable');
  const data = (await response.json()) as { online?: number };
  const count = Math.max(0, Number(data.online) || 0);
  publishOnlineCount(count);
  return count;
}

export type LivePlayer = {
  nickname: string;
  avatar?: string;
  verifiedBadge?: 'none' | 'verified' | 'gold';
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
  players: LivePlayer[];
};

export async function getLiveBoard(signal?: AbortSignal): Promise<LiveBoard> {
  const response = await fetch('/api/presence/live', { cache: 'default', signal });
  if (!response.ok) throw new Error('presence_unavailable');
  const data = (await response.json()) as Partial<LiveBoard>;
  const players = Array.isArray(data.players) ? data.players.filter((player) => player && typeof player.nickname === 'string') : [];
  const online = Math.max(0, Number(data.online) || 0);
  publishOnlineCount(online);
  return {
    online,
    ranked: Math.max(0, Number(data.ranked) || players.length),
    windowSeconds: Math.max(0, Number(data.windowSeconds) || 0),
    players,
  };
}
