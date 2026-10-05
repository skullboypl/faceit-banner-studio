import { useContext, useEffect, useState } from 'react';
import { LanguageContext } from '../generator/Generator';
import { getOnlineBannerCount } from '../utils/presence';

const REFRESH_MS = 30_000;

export function OnlineBannerCount() {
  const tl = useContext(LanguageContext);
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
  return (
    <div
      className={`online-banners${available ? '' : ' unavailable'}`}
      role="status"
      aria-live="polite"
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
    </div>
  );
}
