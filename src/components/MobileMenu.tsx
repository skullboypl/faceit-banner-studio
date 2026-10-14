import { useContext, useEffect, useRef } from 'react';
import type { User } from '../cloud/api';
import type { SyncState } from '../cloud/useCloudSync';
import { LanguageContext } from '../generator/contexts';
import type { Language } from '../translations/translations';
import { DonateLink } from './DonateLink';
import { FaceitLoginButton } from './FaceitLoginButton';
import { StudioIcon, type IconName } from './StudioIcon';
import { SyncChip } from './SyncChip';
import { useDismiss } from './useDismiss';

const flagUrl = (id: string) => `https://flagcdn.com/${id === 'en' ? 'gb' : id}.svg`;

type Props = {
  open: boolean;
  onClose: () => void;
  tabs: { name: string; icon: IconName }[];
  selectedIndex: number;
  onSelectTab: (index: number) => void;
  languages: Language[];
  currentLanguage: Language;
  onLanguage: (language: Language) => void;
  user: User | null;
  admin: boolean;
  syncState: SyncState;
  lastSavedAt: number | null;
  onLogout: () => void;
};

/** Phone menu: a full-screen sheet opened from the fourth icon of the bottom bar. */
export const MobileMenu = (props: Props) => {
  const { open, onClose, tabs, selectedIndex, onSelectTab, languages, currentLanguage, onLanguage, user, admin } = props;
  const tl = useContext(LanguageContext);
  const root = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useDismiss(open, root, onClose);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || !tl) return null;

  const done = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <div className="mobile-menu" role="dialog" aria-modal="true" aria-label={tl('menu.title')} ref={root}>
      <div className="mobile-menu-head">
        <strong>{tl('menu.title')}</strong>
        <button type="button" ref={closeButton} aria-label={tl('menu.close')} onClick={onClose}>
          <StudioIcon name="close" />
        </button>
      </div>

      <div className="mobile-menu-body">
        <section className="mobile-menu-section">
          <h3>{tl('studio.workspace')}</h3>
          {tabs.map((tab, index) => (
            <button
              key={tab.name}
              type="button"
              className="mobile-menu-item"
              aria-current={index === selectedIndex ? 'page' : undefined}
              onClick={done(() => onSelectTab(index))}
            >
              <StudioIcon name={tab.icon} />
              <span>{tab.name}</span>
            </button>
          ))}
          <a className="mobile-menu-item mobile-menu-item--hub" href="https://vxh.pl/">
            <StudioIcon name="home" />
            <span>{tl('studio.hub')}</span>
          </a>
          <a className="mobile-menu-item" href="/docs/">
            <StudioIcon name="book" />
            <span>{tl('studio.docs')}</span>
          </a>
        </section>

        <section className="mobile-menu-section">
          <h3>{tl('generator.settings.language')}</h3>
          <div className="mobile-menu-langs" role="radiogroup" aria-label={tl('generator.settings.language')}>
            {languages.map((language) => (
              <button
                key={language.id}
                type="button"
                role="radio"
                aria-checked={language.id === currentLanguage.id}
                onClick={() => onLanguage(language)}
              >
                <img className="flag" src={flagUrl(language.id)} alt="" />
                <span>{language.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mobile-menu-section">
          <h3>{tl('account.menu')}</h3>
          {user ? (
            <>
              <div className="mobile-menu-user">
                <span className="account-avatar">
                  {user.avatar ? <img src={user.avatar} alt="" /> : <span>{user.nickname.charAt(0).toUpperCase()}</span>}
                </span>
                <strong>{user.nickname}</strong>
              </div>
              <SyncChip state={props.syncState} lastSavedAt={props.lastSavedAt} user={user} showUser={false} />
              {admin && (
                <a className="mobile-menu-item" href="/admin">
                  <StudioIcon name="settings" />
                  <span>{tl('account.admin')}</span>
                </a>
              )}
              <button type="button" className="mobile-menu-item mobile-menu-item--danger" onClick={done(props.onLogout)}>
                <StudioIcon name="back" />
                <span>{tl('account.logout')}</span>
              </button>
            </>
          ) : (
            <FaceitLoginButton className="login-cta" />
          )}
        </section>

        <DonateLink variant="footer" />
      </div>
    </div>
  );
};
