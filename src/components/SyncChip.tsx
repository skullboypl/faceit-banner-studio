import { useContext } from 'react';
import type { User } from '../cloud/api';
import type { SyncState } from '../cloud/useCloudSync';
import { LanguageContext } from '../generator/contexts';
import { StudioIcon } from './StudioIcon';

const LOGIN_URL = '/api/auth/login';

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const SyncChip = ({
  state,
  lastSavedAt,
  user,
  showUser = true,
}: {
  state: SyncState;
  lastSavedAt: number | null;
  user: User | null;
  /** Hide the nickname where the surrounding UI already shows it. */
  showUser?: boolean;
}) => {
  const tl = useContext(LanguageContext);
  if (!tl) return null;

  if (!user) {
    return (
      <div className="sync-chip sync-chip--guest" title={tl('cloud.login_cta')}>
        <StudioIcon name="cloud" />
        <span>{tl('cloud.login_cta')}</span>
        <a className="sync-chip-action" href={LOGIN_URL}>
          {tl('cloud.login')}
        </a>
      </div>
    );
  }

  const label =
    state === 'saving'
      ? tl('cloud.saving')
      : state === 'saved'
        ? lastSavedAt
          ? tl('cloud.saved_at', [formatTime(lastSavedAt)])
          : tl('cloud.saved')
        : state === 'offline'
          ? tl('cloud.offline')
          : state === 'error'
            ? tl('cloud.error')
            : state === 'unauthorized'
              ? tl('cloud.error')
              : tl('cloud.idle');

  return (
    <div className={`sync-chip sync-chip--${state}`} role="status" aria-live="polite" title={label}>
      <StudioIcon name="cloud" />
      <span className="sync-chip-label">{label}</span>
      {state === 'unauthorized' && (
        <a className="sync-chip-action" href={LOGIN_URL}>
          {tl('cloud.relogin')}
        </a>
      )}
      {showUser && <small className="sync-chip-user">{user.nickname}</small>}
    </div>
  );
};
