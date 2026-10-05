const PRESENCE_ID_KEY = 'fcw_presence_id';
const HEARTBEAT_MS = 60_000;

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

export function startPresenceHeartbeat() {
  const id = getPresenceId();
  const ping = () => {
    void fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
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
