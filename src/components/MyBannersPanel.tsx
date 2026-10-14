import { useCallback, useContext, useEffect, useState } from 'react';
import {
  ApiError,
  createBanner,
  deleteBanner,
  listBanners,
  updateBanner,
  type SavedBanner,
  type User,
} from '../cloud/api';
import { fromDelta, toDelta } from '../cloud/delta';
import { LanguageContext, SettingsContext } from '../generator/contexts';
import type { SettingKey } from '../settings/manager';

const LOGIN_URL = '/api/auth/login';

export const MyBannersPanel = ({ user }: { user: User | null }) => {
  const tl = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
  const [banners, setBanners] = useState<SavedBanner[]>([]);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);

  const guid = user?.guid;
  useEffect(() => {
    if (!guid) return;
    let cancelled = false;
    setLoading(true);
    listBanners()
      .then((data) => {
        if (cancelled) return;
        setBanners(data.banners);
        setLimit(data.limit);
        setError(null);
      })
      .catch(() => !cancelled && setError(tl?.('banners.load_failed') ?? 'error'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [guid]);

  const attempt = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }, []);

  if (!tl || !settings) return null;

  if (!user) {
    return (
      <div className="settings my-banners">
        <h3 className="card-heading">{tl('banners.title')}</h3>
        <p className="subtext">{tl('banners.login_cta')}</p>
        <a className="primary-action login-cta" href={LOGIN_URL}>
          {tl('cloud.login')}
        </a>
      </div>
    );
  }

  const atLimit = banners.length >= limit;
  const replace = (banner: SavedBanner) =>
    setBanners((list) => list.map((entry) => (entry.id === banner.id ? banner : entry)));

  const save = () =>
    attempt(async () => {
      const { banner } = await createBanner(name, toDelta(settings.settings));
      setBanners((list) => [banner, ...list]);
      setName('');
    });

  const load = (banner: SavedBanner) => {
    for (const [key, value] of Object.entries(fromDelta(banner.settings))) {
      settings.set(key as SettingKey, value as never);
    }
  };

  const overwrite = (banner: SavedBanner) => {
    if (!window.confirm(tl('banners.overwrite_confirm', [banner.name]))) return;
    return attempt(async () => replace((await updateBanner(banner.id, { settings: toDelta(settings.settings) })).banner));
  };

  const rename = (banner: SavedBanner) =>
    attempt(async () => {
      replace((await updateBanner(banner.id, { name: editName })).banner);
      setEditingId(null);
    });

  const remove = (banner: SavedBanner) => {
    if (!window.confirm(tl('banners.delete_confirm', [banner.name]))) return;
    return attempt(async () => {
      await deleteBanner(banner.id);
      setBanners((list) => list.filter((entry) => entry.id !== banner.id));
    });
  };

  return (
    <div className="settings my-banners">
      <div className="my-banners-heading">
        <h3 className="card-heading">{tl('banners.title')}</h3>
        <span className="my-banners-counter">{tl('banners.counter', [String(banners.length), String(limit)])}</span>
      </div>
      <p className="subtext">{tl('banners.help')}</p>

      <form
        className="my-banners-save"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <input
          type="text"
          value={name}
          maxLength={60}
          placeholder={tl('banners.name_placeholder')}
          aria-label={tl('banners.name_placeholder')}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className="primary-action" disabled={busy || atLimit || name.trim() === ''}>
          {tl('banners.save_as')}
        </button>
      </form>
      {atLimit && <p className="subtext">{tl('banners.limit_reached')}</p>}
      {error && (
        <p className="my-banners-error" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="subtext">{tl('banners.loading')}</p>}
      {!loading && banners.length === 0 && !error && <p className="subtext">{tl('banners.empty')}</p>}

      <ul className="my-banners-list">
        {banners.map((banner) => (
          <li key={banner.id} className="my-banners-item">
            {editingId === banner.id ? (
              <div className="my-banners-rename">
                <input
                  type="text"
                  value={editName}
                  maxLength={60}
                  aria-label={tl('banners.rename')}
                  onChange={(event) => setEditName(event.target.value)}
                />
                <button type="button" disabled={busy || editName.trim() === ''} onClick={() => void rename(banner)}>
                  {tl('banners.save_name')}
                </button>
              </div>
            ) : (
              <div className="my-banners-meta">
                <strong>{banner.name}</strong>
                <small>{new Date(banner.updatedAt).toLocaleDateString()}</small>
              </div>
            )}
            <div className="my-banners-actions">
              <button type="button" onClick={() => load(banner)}>
                {tl('banners.load')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingId(banner.id);
                  setEditName(banner.name);
                }}
              >
                {tl('banners.rename')}
              </button>
              <button type="button" disabled={busy} onClick={() => void overwrite(banner)}>
                {tl('banners.overwrite')}
              </button>
              <button type="button" className="danger" disabled={busy} onClick={() => void remove(banner)}>
                {tl('banners.delete')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
