const PRESENCE_ID_KEY = 'fcw_presence_id';
const HEARTBEAT_MS = 60_000;

export type PresenceInfo = {
  nickname?: string;
  playerId?: string;
  elo?: number;
  level?: number;
  country?: string;
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
  const response = await fetch('/api/presence', { cache: 'no-store', signal });
  if (!response.ok) throw new Error('presence_unavailable');
  const data = (await response.json()) as { online?: number };
  return Math.max(0, Number(data.online) || 0);
}

export type LivePlayer = {
  nickname: string;
  elo?: number;
  level?: number;
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
  const response = await fetch('/api/presence/live', { cache: 'no-store', signal });
  if (!response.ok) throw new Error('presence_unavailable');
  const data = (await response.json()) as Partial<LiveBoard>;
  const players = Array.isArray(data.players) ? data.players.filter((player) => player && typeof player.nickname === 'string') : [];
  return {
    online: Math.max(0, Number(data.online) || 0),
    ranked: Math.max(0, Number(data.ranked) || players.length),
    windowSeconds: Math.max(0, Number(data.windowSeconds) || 0),
    players,
  };
}
