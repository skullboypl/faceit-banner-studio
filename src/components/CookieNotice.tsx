import { useContext, useEffect, useState } from 'react';
import { LanguageContext } from '../generator/contexts';

const STORAGE_KEY = 'fb_cookie_notice';

/** Notice for the login session cookie. Not mounted on the OBS widget. */
export const CookieNotice = ({ placement = 'studio' }: { placement?: 'studio' | 'plain' }) => {
  const tl = useContext(LanguageContext);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (window.self !== window.top) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return;
    } catch {
      /* Private mode still gets the notice; dismissing it only lasts for this view. */
    }
    setOpen(true);
  }, []);

  if (!open || !tl) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* The bar still closes for this visit. */
    }
    setOpen(false);
  };

  return (
    <aside className={`cookie-notice cookie-notice--${placement}`} aria-label={tl('cookie.title')}>
      <p>
        {tl('cookie.body')} <a href="/privacy/">{tl('footer.privacy')}</a>
      </p>
      <button type="button" onClick={dismiss}>
        {tl('cookie.ok')}
      </button>
    </aside>
  );
};
