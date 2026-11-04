import { useContext, useEffect, useState } from 'react';
import { LanguageContext, SettingsContext } from '../generator/contexts';
import { StudioIcon } from './StudioIcon';

const XMAS_KEYS = ['xmasLights', 'xmasSnow', 'xmasCap', 'xmasDrift', 'xmasFrost'] as const;

/** Stable across renders, so the delay below is not restarted by every studio update. */
const systemNow = () => new Date();

/** 1 November to 6 January: the weeks the Christmas extras are worth a word. */
export const inXmasSeason = (date: Date) => {
  const month = date.getMonth();
  return month === 10 || month === 11 || (month === 0 && date.getDate() <= 6);
};

/** One key per season, so a bubble closed this year comes back next November. */
export const xmasNoticeKey = (date: Date) => `fb_xmas_notice_${date.getMonth() === 0 ? date.getFullYear() - 1 : date.getFullYear()}`;

const readFlag = (key: string) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

const writeFlag = (key: string) => {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* Blocked storage: the bubble still closes for this visit. */
  }
};

/**
 * Studio only: a small bubble about the Christmas extras. Never mounted on the OBS widget, hidden inside frames, out of
 * season, once closed, and as soon as any extra is already switched on.
 */
export function SeasonalNotice({ onOpen, now = systemNow }: { onOpen: () => void; now?: () => Date }) {
  const tl = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
  const [ready, setReady] = useState(false);
  const [closed, setClosed] = useState(false);
  const [key] = useState(() => xmasNoticeKey(now()));

  useEffect(() => {
    if (window.self !== window.top || !inXmasSeason(now()) || readFlag(key)) return;
    /* Let the studio settle first, so the bubble does not fight the first paint */
    const timer = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(timer);
  }, [key, now]);

  const anyOn = Boolean(settings && XMAS_KEYS.some((setting) => settings.get(setting) === true));
  if (!tl || !ready || closed || anyOn) return null;

  const close = () => {
    writeFlag(key);
    setClosed(true);
  };

  return (
    <aside className="seasonal-notice" role="status" aria-label={tl('xmas.notice.title')} data-testid="seasonal-notice">
      <span className="seasonal-notice-bulbs" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="seasonal-notice-icon" aria-hidden="true">
        <StudioIcon name="snowflake" />
      </span>
      <div className="seasonal-notice-text">
        <small>{tl('xmas.notice.badge')}</small>
        <strong>{tl('xmas.notice.title')}</strong>
        <p>{tl('xmas.notice.body')}</p>
        <div className="seasonal-notice-actions">
          <button
            type="button"
            className="seasonal-notice-open"
            onClick={() => {
              close();
              onOpen();
            }}
          >
            {tl('xmas.notice.open')}
          </button>
          <button type="button" className="seasonal-notice-later" onClick={close}>
            {tl('xmas.notice.later')}
          </button>
        </div>
      </div>
      <button type="button" className="seasonal-notice-close" aria-label={tl('xmas.notice.close')} onClick={close}>
        <span aria-hidden="true">×</span>
      </button>
    </aside>
  );
}
