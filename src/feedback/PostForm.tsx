import { useContext, useRef, useState } from 'react';
import pkg from '../../package.json';
import { apiMessage } from '../cloud/messages';
import { toDelta } from '../cloud/delta';
import { LanguageContext, SettingsContext } from '../generator/contexts';
import { createPost, uploadAttachment, type FeedbackAttachment, type FeedbackPost, type PostKind } from './api';
import { compressImage, MAX_BYTES } from './compressImage';

const TITLE_MIN = 3;
const TITLE_MAX = 120;
const BODY_MAX = 4000;

export const PostForm = ({
  kind,
  onCreated,
  onCancel,
}: {
  kind: PostKind;
  onCreated: (post: FeedbackPost) => void;
  onCancel: () => void;
}) => {
  const tl = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [website, setWebsite] = useState('');
  const [attachSettings, setAttachSettings] = useState(true);
  const [shots, setShots] = useState<FeedbackAttachment[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picking = useRef(false);
  if (!tl) return null;

  const addShot = async (file: File) => {
    if (picking.current || shots.length >= 3) {
      if (shots.length >= 3) setError(tl('attachment.limit'));
      return;
    }
    picking.current = true;
    setError(null);
    setProgress(0);
    try {
      const blob = await compressImage(file);
      if (blob.size > MAX_BYTES) {
        setError(tl('attachment.too_big'));
        return;
      }
      const saved = await uploadAttachment(blob, setProgress);
      setShots((current) => (current.length >= 3 ? current : [...current, saved]));
    } catch (failure) {
      setError(apiMessage(tl, failure));
    } finally {
      picking.current = false;
      setProgress(null);
    }
  };

  const valid = title.trim().length >= TITLE_MIN && body.trim().length >= 1;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const input =
        kind === 'bug'
          ? {
              kind,
              title: title.trim(),
              body: body.trim(),
              website,
              context: {
                userAgent: navigator.userAgent,
                appVersion: pkg.version,
                ...(attachSettings && settings ? { settings: toDelta(settings.settings) } : {}),
              },
            }
          : { kind, title: title.trim(), body: body.trim(), website };
      const { post } = await createPost(shots.length ? { ...input, attachmentIds: shots.map((shot) => shot.id) } : input);
      onCreated(post);
    } catch (failure) {
      setError(apiMessage(tl, failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="feedback-form"
      onPaste={(event) => {
        if (kind !== 'bug') return;
        const file = [...event.clipboardData.files].find((entry) => entry.type.startsWith('image/'));
        if (!file) return;
        event.preventDefault();
        void addShot(file);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !busy) void submit();
      }}
    >
      <h4>{kind === 'bug' ? tl('feedback.form.bug_heading') : tl('feedback.form.request_heading')}</h4>
      <div className="feedback-hp" aria-hidden="true">
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </label>
      </div>
      <label>
        <span>{tl('feedback.form.title')}</span>
        <input type="text" value={title} maxLength={TITLE_MAX} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label>
        <span>{tl('feedback.form.body')}</span>
        <textarea rows={6} value={body} maxLength={BODY_MAX} onChange={(event) => setBody(event.target.value)} />
      </label>
      {kind === 'bug' && (
        <label className="feedback-attach">
          <input type="checkbox" checked={attachSettings} onChange={(event) => setAttachSettings(event.target.checked)} />
          <span>{tl('feedback.form.attach_settings')}</span>
        </label>
      )}
      {kind === 'bug' && (
        <div
          className="attachment-drop"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files[0];
            if (file) void addShot(file);
          }}
        >
          <span>{tl('attachment.screenshot')}</span>
          <p>{tl('attachment.drop')}</p>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label={tl('attachment.screenshot')}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void addShot(file);
            }}
          />
          {progress !== null && (
            <progress value={progress} max={1} aria-label={tl('attachment.screenshot')} />
          )}
          {shots.length > 0 && (
            <ul className="attachment-drafts">
              {shots.map((shot) => (
                <li key={shot.id}>
                  <img src={shot.url} alt="" width={shot.width} height={shot.height} />
                  <button type="button" onClick={() => setShots((current) => current.filter((entry) => entry.id !== shot.id))}>
                    {tl('attachment.remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      )}
      <div className="feedback-form-actions">
        <button type="submit" className="primary-action" disabled={!valid || busy || progress !== null}>
          {tl('feedback.form.submit')}
        </button>
        <button type="button" onClick={onCancel}>
          {tl('feedback.form.cancel')}
        </button>
      </div>
    </form>
  );
};
