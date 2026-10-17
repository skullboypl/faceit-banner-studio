import { useContext, useEffect, useState } from 'react';
import { LanguageContext } from '../generator/contexts';
import { FaceitLevel } from '../live/FaceitLevel';
import { VerifiedBadgeIcon } from '../assets/icons/faceit/VerifiedBadgeIcon';
import { VerifiedGoldBadgeIcon } from '../assets/icons/faceit/VerifiedGoldBadgeIcon';
import { ProfileImages } from './ProfileImages';
import { StudioIcon } from './StudioIcon';

type FaceitCard = {
  elo: number | null;
  level: number | null;
  country: string | null;
  ranking: number | null;
  verifiedBadge: 'none' | 'verified' | 'gold';
  /** Season placements are unfinished, so elo is the last known value. */
  calibrating?: boolean;
};

type Profile = {
  nickname: string;
  avatar: string | null;
  faceit: FaceitCard | null;
  logins: { createdAt: string }[];
};

async function clearOwnCache() {
  const response = await fetch('/api/auth/profile/cache', { method: 'POST', cache: 'no-store', credentials: 'same-origin' });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(body.error || 'cache');
}

function ProfileCacheCard({
  tl,
  busy,
  done,
  error,
  onClear,
}: {
  tl: (key: string, args?: string[]) => string;
  busy: boolean;
  done: boolean;
  error: string;
  onClear: () => void;
}) {
  return (
    <section className="settings profile-cache">
      <h3 className="card-heading">
        <StudioIcon name="cloud" />
        {tl('profile.cache.title')}
      </h3>
      <p>{tl('profile.cache.note')}</p>
      {error && <p className="profile-empty" role="alert">{error}</p>}
      {done && !error && (
        <p className="profile-cache-done" role="status">
          {tl('profile.cache.done')}
        </p>
      )}
      <button type="button" disabled={busy} onClick={onClear}>
        {busy ? tl('profile.cache.busy') : tl('profile.cache.clear')}
      </button>
    </section>
  );
}

export function ProfilePanel({
  clearCache = clearOwnCache,
}: {
  clearCache?: () => Promise<void>;
}) {
  const tl = useContext(LanguageContext);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState(false);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [cacheDone, setCacheDone] = useState(false);
  const [cacheError, setCacheError] = useState('');

  useEffect(() => {
    let cancel = false;
    fetch('/api/auth/profile', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('profile');
        return response.json();
      })
      .then((body) => {
        if (!cancel) setProfile(body);
      })
      .catch(() => {
        if (!cancel) setError(true);
      });
    return () => {
      cancel = true;
    };
  }, []);

  if (!tl) return null;

  const runClear = () => {
    setCacheBusy(true);
    setCacheDone(false);
    setCacheError('');
    void clearCache()
      .then(() => setCacheDone(true))
      .catch((failure) => {
        const code = failure instanceof Error ? failure.message : '';
        setCacheError(tl(code === 'too_soon' ? 'profile.cache.soon' : 'profile.cache.error'));
      })
      .finally(() => setCacheBusy(false));
  };
  const cacheCard = (
    <ProfileCacheCard tl={tl} busy={cacheBusy} done={cacheDone} error={cacheError} onClear={runClear} />
  );
  if (error) {
    return (
      <div className="profile-panel">
        <p className="profile-empty" role="alert">{tl('profile.unavailable')}</p>
        {cacheCard}
      </div>
    );
  }
  if (!profile) return <p className="profile-empty" role="status">{tl('profile.loading')}</p>;

  const faceit = profile.faceit;
  const when = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  };

  return (
    <div className="profile-panel">
      <section className="settings">
        <div className="profile-identity">
          <span className="profile-avatar" aria-hidden="true">
            {profile.nickname.charAt(0).toUpperCase()}
            {profile.avatar && (
              <img
                src={profile.avatar}
                alt=""
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            )}
          </span>
          <div>
            <h3 className="profile-name">
              {profile.nickname}
              {faceit?.verifiedBadge === 'gold' && <VerifiedGoldBadgeIcon />}
              {faceit?.verifiedBadge === 'verified' && <VerifiedBadgeIcon />}
            </h3>
            <p>
              {faceit?.country ? faceit.country.toUpperCase() : 'FACEIT'}
              <span>·</span>
              CS2
            </p>
          </div>
          {faceit?.calibrating ? (
            <FaceitLevel unranked label={tl('live.calibrating')} />
          ) : faceit?.level ? (
            <FaceitLevel
              level={faceit.level}
              ranking={faceit.ranking ?? undefined}
              label={
                faceit.ranking
                  ? tl('live.challenger', [String(faceit.ranking)])
                  : tl('live.level', [String(faceit.level)])
              }
            />
          ) : null}
        </div>
        <ul className="profile-stats">
          <li>
            <strong>{faceit?.elo ? faceit.elo.toLocaleString() : '—'}</strong>
            <span>{faceit?.calibrating ? tl('widget.elo_known') : 'ELO'}</span>
          </li>
          <li>
            <strong>{faceit?.calibrating ? '—' : (faceit?.level ?? '—')}</strong>
            <span>{tl('profile.level')}</span>
          </li>
          <li>
            <strong>{faceit?.ranking ? `#${faceit.ranking}` : '—'}</strong>
            <span>{tl('profile.place')}</span>
          </li>
        </ul>
      </section>
      <ProfileImages />
      {cacheCard}
      <section className="settings profile-logins">
        <h3 className="card-heading">
          <StudioIcon name="book" />
          {tl('profile.logins')}
        </h3>
        <p>{tl('profile.logins_note')}</p>
        {profile.logins.length === 0 ? (
          <p className="profile-empty">{tl('profile.logins_empty')}</p>
        ) : (
          <ol>
            {profile.logins.map((entry) => (
              <li key={entry.createdAt}>{when(entry.createdAt)}</li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
