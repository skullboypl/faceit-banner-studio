import { useContext, useEffect, useState } from 'react';
import type { User } from '../cloud/api';
import { apiMessage } from '../cloud/messages';
import { FaceitLoginButton } from '../components/FaceitLoginButton';
import { LanguageContext } from '../generator/contexts';
import {
  POST_STATUSES,
  addComment,
  adminDeleteComment,
  adminDeletePost,
  adminExport,
  adminSetStatus,
  deletePost,
  getPost,
  type FeedbackDetail,
  type FeedbackPost,
  type PostStatus,
} from './api';
import { StatusBadge } from './StatusBadge';

type Props = {
  summary: FeedbackPost;
  user: User | null;
  admin: boolean;
  onBack: () => void;
  onChanged: (post: FeedbackPost) => void;
  onDeleted: (id: string) => void;
};

export const PostDetail = ({ summary, user, admin, onBack, onChanged, onDeleted }: Props) => {
  const tl = useContext(LanguageContext);
  const [post, setPost] = useState<FeedbackDetail | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const id = summary.id;
  const guid = user?.guid;
  useEffect(() => {
    if (!guid) return;
    let cancelled = false;
    getPost(id)
      .then(({ post: loaded }) => !cancelled && setPost(loaded))
      .catch((failure) => !cancelled && setError(failure instanceof Error ? failure.message : String(failure)));
    return () => {
      cancelled = true;
    };
  }, [id, guid]);

  if (!tl) return null;

  const explain = (failure: unknown) => apiMessage(tl, failure);

  const attempt = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (failure) {
      setError(explain(failure));
    } finally {
      setBusy(false);
    }
  };

  const shown = post ?? { ...summary, body: '', context: null, thread: [] };

  const sendComment = () =>
    attempt(async () => {
      const { comment: created } = await addComment(id, comment.trim());
      setPost((current) => current && { ...current, comments: current.comments + 1, thread: [...current.thread, created] });
      onChanged({ ...summary, comments: summary.comments + 1 });
      setComment('');
    });

  const changeStatus = (status: PostStatus) =>
    attempt(async () => {
      const { post: updated } = await adminSetStatus(id, status);
      setPost((current) => current && { ...current, status: updated.status });
      onChanged({ ...summary, status: updated.status });
    });

  const copyForClaude = () =>
    attempt(async () => {
      await navigator.clipboard.writeText(await adminExport(id));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });

  const remove = () => {
    if (!window.confirm(tl('feedback.delete_confirm', [summary.title]))) return;
    return attempt(async () => {
      await (admin ? adminDeletePost(id) : deletePost(id));
      onDeleted(id);
    });
  };

  const removeComment = (commentId: string) =>
    attempt(async () => {
      await adminDeleteComment(commentId);
      setPost((current) => current && { ...current, comments: current.comments - 1, thread: current.thread.filter((c) => c.id !== commentId) });
      onChanged({ ...summary, comments: Math.max(0, summary.comments - 1) });
    });

  return (
    <article className="feedback-detail">
      <button type="button" className="feedback-back" onClick={onBack}>
        {tl('feedback.back')}
      </button>
      <header>
        <StatusBadge status={shown.status} />
        <h3>{shown.title}</h3>
        <small>
          {tl(`feedback.kind.${shown.kind}`)} · {new Date(shown.createdAt).toLocaleDateString()}
          {user && shown.author ? ` · ${tl('feedback.by', [shown.author])}` : ''}
        </small>
      </header>

      {!user ? (
        <div className="feedback-login">
          <p>{tl('feedback.login_cta')}</p>
          <FaceitLoginButton className="login-cta" />
        </div>
      ) : (
        <>
          <p className="feedback-body">{shown.body}</p>
          {shown.context && (
            <details className="feedback-context">
              <summary>{tl('feedback.context')}</summary>
              <pre>{JSON.stringify(shown.context, null, 2)}</pre>
            </details>
          )}

          {(admin || shown.mine) && (
            <div className="feedback-admin">
              {admin && (
                <label>
                  <span>{tl('feedback.admin.status')}</span>
                  <select aria-label="Status" value={shown.status} disabled={busy} onChange={(event) => void changeStatus(event.target.value as PostStatus)}>
                    {POST_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {tl(`feedback.status.${status}`)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {admin && (
                <button type="button" disabled={busy} onClick={() => void copyForClaude()}>
                  {tl('feedback.admin.copy')}
                </button>
              )}
              {copied && <span role="status">{tl('feedback.admin.copied')}</span>}
              <button type="button" className="danger" disabled={busy} onClick={() => void remove()}>
                {tl('feedback.admin.delete')}
              </button>
            </div>
          )}

          <section className="feedback-comments">
            <h4>
              {tl('feedback.comments')} ({shown.comments})
            </h4>
            {shown.thread.map((entry) => (
              <div key={entry.id} className="feedback-comment">
                <div>
                  <strong>{entry.author}</strong>
                  {entry.byAdmin && <em className="admin-badge">admin</em>}
                  <small>{new Date(entry.createdAt).toLocaleString()}</small>
                  {admin && (
                    <button type="button" className="danger" disabled={busy} aria-label={tl('feedback.admin.delete_comment')} onClick={() => void removeComment(entry.id)}>
                      ×
                    </button>
                  )}
                </div>
                <p>{entry.body}</p>
              </div>
            ))}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (comment.trim() && !busy) void sendComment();
              }}
            >
              <textarea
                rows={3}
                value={comment}
                maxLength={2000}
                placeholder={tl('feedback.comment_placeholder')}
                aria-label={tl('feedback.comment_placeholder')}
                onChange={(event) => setComment(event.target.value)}
              />
              <button type="submit" className="primary-action" disabled={busy || comment.trim() === ''}>
                {tl('feedback.comment_submit')}
              </button>
            </form>
          </section>
          {error && (
            <p className="feedback-error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </article>
  );
};
