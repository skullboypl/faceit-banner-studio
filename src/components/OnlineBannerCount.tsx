import { Link, useLocation } from 'react-router-dom';
import { useContext, useEffect, useState } from 'react';
import { LanguageContext } from '../generator/contexts';
import { getOnlineBannerCount } from '../utils/presence';

const REFRESH_MS = 30_000;

export function OnlineBannerCount() {
  const tl = useContext(LanguageContext);
  const onLive = useLocation().pathname === '/live';
  const [count, setCount] = useState<number | null>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const value = await getOnlineBannerCount(controller.signal);
        if (active) {
          setCount(value);
          setAvailable(true);
        }
      } catch {
        if (active) setAvailable(false);
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, REFRESH_MS);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

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
