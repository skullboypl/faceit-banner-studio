import { useContext, useEffect, useRef, useState } from 'react';
import { ApiError } from '../cloud/api';
import { StudioIcon } from './StudioIcon';
import { LanguageContext } from '../generator/contexts';
import {
  fetchOwnProfileImages,
  prepareProfileImage,
  removeProfileImage,
  reportProfileImage,
  uploadProfileImage,
  type OwnProfileImage,
  type ProfileImageKind,
} from '../profile/images';

const KINDS: ProfileImageKind[] = ['avatar', 'cover'];
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

type Api = {
  list: () => Promise<OwnProfileImage[]>;
  upload: (kind: ProfileImageKind, file: Blob) => Promise<OwnProfileImage>;
  remove: (kind: ProfileImageKind) => Promise<unknown>;
};

const defaultApi: Api = { list: fetchOwnProfileImages, upload: uploadProfileImage, remove: removeProfileImage };

/** The short reason for a failed upload, in the user's language. */
function problem(error: unknown, tl: (key: string, args?: string[]) => string): string {
  if (error instanceof ApiError) {
    if (error.code === 'too_big') return tl('profile.images.err.too_big');
    if (error.code === 'bad_type') return tl('profile.images.err.bad_type');
    if (error.status === 429) return tl('profile.images.err.rate');
    if (error.status === 401) return tl('profile.images.err.login');
  }
  return tl('profile.images.err.other');
}

/**
 * "Look on banners": the player's own avatar and background for this project's banners. A new picture
 * waits for an admin; everybody who types the nickname sees it after approval.
 */
export function ProfileImages({
  api = defaultApi,
  prepare = prepareProfileImage,
}: {
  api?: Api;
  prepare?: (file: File, kind: ProfileImageKind) => Promise<Blob>;
}) {
  const tl = useContext(LanguageContext);
  const [images, setImages] = useState<Partial<Record<ProfileImageKind, OwnProfileImage>>>({});
  const [busy, setBusy] = useState<ProfileImageKind | null>(null);
  const [error, setError] = useState<Partial<Record<ProfileImageKind, string>>>({});
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    api
      .list()
      .then((list) => setImages(Object.fromEntries(list.map((image) => [image.kind, image]))))
      .catch(() => undefined);
  }, [api]);

  if (!tl) return null;

  const upload = async (kind: ProfileImageKind, file: File | undefined) => {
    if (!file) return;
    setError((current) => ({ ...current, [kind]: undefined }));
    if (!ACCEPTED.includes(file.type)) {
      setError((current) => ({ ...current, [kind]: tl('profile.images.err.bad_type') }));
      return;
    }
    setBusy(kind);
    try {
      const saved = await api.upload(kind, await prepare(file, kind));
      setImages((current) => ({ ...current, [kind]: saved }));
    } catch (failure) {
      setError((current) => ({ ...current, [kind]: problem(failure, tl) }));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (kind: ProfileImageKind) => {
    setBusy(kind);
    try {
      await api.remove(kind);
      setImages((current) => {
        const next = { ...current };
        delete next[kind];
        return next;
      });
    } catch (failure) {
      setError((current) => ({ ...current, [kind]: problem(failure, tl) }));
    } finally {
      setBusy(null);
    }
  };

  const statusText = (image: OwnProfileImage) => tl(`profile.images.status.${image.status}`);

  return (
    <section className="settings profile-images">
      <h3 className="card-heading">
        <StudioIcon name="palette" />
        {tl('profile.images.title')}
      </h3>
      <p>{tl('profile.images.note')}</p>
      <div className="profile-image-grid">
        {KINDS.map((kind) => {
          const image = images[kind];
          return (
            <article key={kind} className={`profile-image-card is-${kind}`} data-status={image?.status ?? 'none'}>
              <div className="profile-image-preview" aria-hidden={image ? undefined : true}>
                {image?.url ? (
                  <img src={image.url} alt="" loading="lazy" />
                ) : (
                  <span className="profile-image-fallback">
                    <StudioIcon name={kind === 'avatar' ? 'user' : 'monitor'} />
                  </span>
                )}
              </div>
              <div className="profile-image-body">
                <div className="profile-image-copy">
                  <h4>{tl(`profile.images.card.${kind}`)}</h4>
                  {!image && <p className="profile-image-default">{tl('profile.images.default')}</p>}
                  {image && (
                    <p className={`profile-image-status is-${image.status}`}>
                      <strong>{statusText(image)}</strong>
                      {image.status === 'rejected' && image.rejectReason && (
                        <small>{tl('profile.images.reason', [image.rejectReason])}</small>
                      )}
                    </p>
                  )}
                  {error[kind] && (
                    <p className="profile-image-error" role="alert">
                      {error[kind]}
                    </p>
                  )}
                </div>
                <div className="profile-image-actions">
                  <label className={`profile-image-pick${busy === kind ? ' is-busy' : ''}`}>
                    <input
                      type="file"
                      accept={ACCEPTED.join(',')}
                      data-kind={kind}
                      disabled={busy !== null}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = '';
                        void upload(kind, file);
                      }}
                    />
                    <span>{busy === kind ? tl('profile.images.working') : image ? tl('profile.images.change') : tl('profile.images.upload')}</span>
                  </label>
                  {image && (
                    <button
                      type="button"
                      className="profile-image-remove"
                      aria-label={tl('profile.images.remove_named', [tl(`profile.images.name.${kind}`)])}
                      disabled={busy !== null}
                      onClick={() => void remove(kind)}
                    >
                      {tl('profile.images.remove')}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Shown under the nickname field when the typed player replaced a picture for the banners. Logged-in
 * viewers (other than the owner) can report a picture that should not be there.
 */
export function OverrideNotice({
  playerId,
  overridden,
  loggedIn,
  own,
  report = reportProfileImage,
}: {
  playerId: string;
  overridden?: { avatar?: boolean; cover?: boolean };
  loggedIn: boolean;
  own: boolean;
  report?: (playerId: string, kind: ProfileImageKind, reason: string) => Promise<unknown>;
}) {
  const tl = useContext(LanguageContext);
  const [done, setDone] = useState<string>();
  if (!tl || own || !overridden || (!overridden.avatar && !overridden.cover)) return null;

  const send = async (kind: ProfileImageKind) => {
    try {
      await report(playerId, kind, '');
      setDone(tl('profile.report.thanks'));
    } catch (error) {
      setDone(error instanceof ApiError && error.status === 409 ? tl('profile.report.duplicate') : tl('profile.report.failed'));
    }
  };

  return (
    <div className="override-notice">
      <p>{tl('profile.override.notice')}</p>
      {loggedIn ? (
        <div className="override-actions">
          {KINDS.filter((kind) => overridden[kind]).map((kind) => (
            <button key={kind} type="button" onClick={() => void send(kind)}>
              {tl('profile.report.kind', [tl(`profile.images.name.${kind}`)])}
            </button>
          ))}
        </div>
      ) : (
        <p className="subtext">{tl('profile.report.login')}</p>
      )}
      {done && <p className="subtext" role="status">{done}</p>}
    </div>
  );
}
