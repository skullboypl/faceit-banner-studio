import { useCallback, useContext, useRef, useState } from 'react';
import type { User } from '../cloud/api';
import type { SyncState } from '../cloud/useCloudSync';
import { LanguageContext } from '../generator/contexts';
import { FaceitLoginButton } from './FaceitLoginButton';
import { StudioIcon } from './StudioIcon';
import { SyncChip } from './SyncChip';
import { useDismiss } from './useDismiss';

type Props = {
  user: User | null;
  admin: boolean;
  syncState: SyncState;
  lastSavedAt: number | null;
  onOpenBanners: () => void;
  onLogout: () => void;
};

/** Top-bar account area: a FACEIT login button for guests, avatar + nickname with a menu once logged in. */
export const AccountMenu = ({ user, admin, syncState, lastSavedAt, onOpenBanners, onLogout }: Props) => {
  const tl = useContext(LanguageContext);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, root, close);
  if (!tl) return null;

  if (!user) {
    return (
      <FaceitLoginButton />
    );
  }

  const choose = (action: () => void) => () => {
    close();
    action();
  };

  return (
    <div className="account-menu" ref={root}>
      <button
        type="button"
        className="account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${tl('account.menu')}: ${user.nickname}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="account-avatar">
          {user.avatar ? <img src={user.avatar} alt="" /> : <span>{user.nickname.charAt(0).toUpperCase()}</span>}
          <i className={`account-dot account-dot--${syncState}`} aria-hidden="true" />
        </span>
        <span className="account-name">{user.nickname}</span>
        <StudioIcon name="chevron" />
      </button>
      {open && (
        <div className="account-popup" role="menu" aria-label={tl('account.menu')}>
          <SyncChip state={syncState} lastSavedAt={lastSavedAt} user={user} showUser={false} />
          <button type="button" role="menuitem" onClick={choose(onOpenBanners)}>
            <StudioIcon name="cloud" />
            {tl('banners.title')}
          </button>
          {admin && (
            <a role="menuitem" href="/admin" onClick={close}>
              <StudioIcon name="settings" />
              {tl('account.admin')}
            </a>
          )}
          <button type="button" role="menuitem" className="account-logout" onClick={choose(onLogout)}>
            <StudioIcon name="back" />
            {tl('account.logout')}
          </button>
        </div>
      )}
    </div>
  );
};
