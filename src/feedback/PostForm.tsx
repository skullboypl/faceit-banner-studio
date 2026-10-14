import { useContext, useState } from 'react';
import pkg from '../../package.json';
import { ApiError } from '../cloud/api';
import { toDelta } from '../cloud/delta';
import { LanguageContext, SettingsContext } from '../generator/contexts';
import { createPost, type FeedbackPost, type PostKind } from './api';

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
  const [attachSettings, setAttachSettings] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!tl) return null;

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
              context: {
                userAgent: navigator.userAgent,
                appVersion: pkg.version,
                ...(attachSettings && settings ? { settings: toDelta(settings.settings) } : {}),
              },
            }
          : { kind, title: title.trim(), body: body.trim() };
      const { post } = await createPost(input);
      onCreated(post);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="feedback-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !busy) void submit();
      }}
    >
      <h4>{kind === 'bug' ? tl('feedback.form.bug_heading') : tl('feedback.form.request_heading')}</h4>
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
      {error && (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      )}
      <div className="feedback-form-actions">
        <button type="submit" className="primary-action" disabled={!valid || busy}>
          {tl('feedback.form.submit')}
        </button>
        <button type="button" onClick={onCancel}>
          {tl('feedback.form.cancel')}
        </button>
      </div>
    </form>
  );
};
