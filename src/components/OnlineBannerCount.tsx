import { Link, useLocation } from 'react-router-dom';
import { useContext, useEffect, useState } from 'react';
import { LanguageContext } from '../generator/contexts';
import { getOnlineBannerCount, PRESENCE_REFRESH_MS, subscribeOnlineCount } from '../utils/presence';

export function OnlineBannerCount() {
  const tl = useContext(LanguageContext);
  const pathname = useLocation().pathname;
  const onLive = pathname === '/live';
  const onPublicList = onLive || pathname === '/streamers';
  const [count, setCount] = useState<number | null>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const unsubscribe = subscribeOnlineCount((value) => {
      if (!active) return;
      setCount(value);
      setAvailable(true);
    });
    // On /live the ranking request already carries this number. A second poll would hit the same snapshot.
    let pending = false;
    let refreshedAt = -Infinity;
    const refresh = async () => {
      if (onPublicList || document.hidden || pending || Date.now() - refreshedAt < PRESENCE_REFRESH_MS) return;
      pending = true;
      refreshedAt = Date.now();
      try {
        await getOnlineBannerCount(controller.signal);
      } catch {
        if (active && !controller.signal.aborted) setAvailable(false);
      } finally {
        pending = false;
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, PRESENCE_REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      unsubscribe();
    };
  }, [onLive, onPublicList]);

  if (!tl) return null;
  const label = tl('live.open');
  return (
    <Link
      to="/live"
      className={`online-banners${available ? '' : ' unavailable'}${onLive ? ' is-current' : ''}`}
      aria-current={onLive ? 'page' : undefined}
      aria-label={label}
      title={label}
    >
      <span className="online-pulse" aria-hidden="true">
        <i />
      </span>
      <span className="online-copy">
        <strong>
          {available && count !== null ? count.toLocaleString() : '—'}
        </strong>
        <span>
          {available
            ? tl('studio.online_banners')
            : tl('studio.online_unavailable')}
        </span>
      </span>
      <small>{tl('studio.online_now')}</small>
    </Link>
  );
}
