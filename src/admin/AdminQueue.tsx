import { useContext, useEffect, useState } from 'react';
import { ApiError } from '../cloud/api';
import { LanguageContext } from '../generator/contexts';
import {
  POST_STATUSES,
  adminDeletePost,
  adminExport,
  adminList,
  adminSetStatus,
  type FeedbackPost,
  type PostStatus,
} from '../feedback/api';
import { StatusBadge } from '../feedback/StatusBadge';

const message = (failure: unknown) => (failure instanceof ApiError || failure instanceof Error ? failure.message : String(failure));

/** Posts waiting for the admin, filtered by status; the same actions as in the board's detail view. */
export const AdminQueue = ({ initialStatus = 'new' }: { initialStatus?: PostStatus }) => {
  const tl = useContext(LanguageContext);
  const [status, setStatus] = useState<PostStatus>(initialStatus);
  const [posts, setPosts] = useState<FeedbackPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminList(status)
      .then((page) => {
        if (cancelled) return;
        setPosts(page.posts);
        setError(null);
      })
      .catch((failure) => !cancelled && setError(message(failure)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (!tl) return null;

  const act = async (id: string, work: () => Promise<void>) => {
    setBusyId(id);
    setError(null);
    try {
      await work();
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusyId(null);
    }
  };

  const changeStatus = (post: FeedbackPost, next: PostStatus) =>
    act(post.id, async () => {
      const { post: updated } = await adminSetStatus(post.id, next);
      setPosts((list) =>
        updated.status === status
          ? list.map((entry) => (entry.id === post.id ? { ...entry, status: updated.status } : entry))
          : list.filter((entry) => entry.id !== post.id)
      );
    });

  const copy = (post: FeedbackPost) =>
    act(post.id, async () => {
      await navigator.clipboard.writeText(await adminExport(post.id));
      setCopiedId(post.id);
      setTimeout(() => setCopiedId((current) => (current === post.id ? null : current)), 2500);
    });

  const remove = (post: FeedbackPost) => {
    if (!window.confirm(tl('feedback.delete_confirm', [post.title]))) return;
    return act(post.id, async () => {
      await adminDeletePost(post.id);
      setPosts((list) => list.filter((entry) => entry.id !== post.id));
    });
  };

  return (
    <section className="admin-card admin-queue">
      <div className="admin-queue-head">
        <h2>{tl('admin.queue')}</h2>
        <select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value as PostStatus)}>
          {POST_STATUSES.map((entry) => (
            <option key={entry} value={entry}>
              {tl(`feedback.status.${entry}`)}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && posts.length === 0 && <p className="admin-queue-empty">{tl('admin.queue_empty')}</p>}

      <ul className="admin-queue-list">
        {posts.map((post) => (
          <li key={post.id}>
            <div className="admin-queue-main">
              <span className={`admin-kind admin-kind--${post.kind}`}>{tl(post.kind === 'bug' ? 'feedback.kind.bug' : 'admin.kind.request')}</span>
              <strong>{post.title}</strong>
              <small>
                <StatusBadge status={post.status} /> {post.author ? tl('feedback.by', [post.author]) : ''} · ▲ <span>{post.votes}</span> ·{' '}
                {tl('feedback.comments_short', [String(post.comments)])}
              </small>
            </div>
            <div className="admin-queue-actions">
              <select
                aria-label={`${tl('feedback.admin.status')}: ${post.title}`}
                value={post.status}
                disabled={busyId === post.id}
                onChange={(event) => void changeStatus(post, event.target.value as PostStatus)}
              >
                {POST_STATUSES.map((entry) => (
                  <option key={entry} value={entry}>
                    {tl(`feedback.status.${entry}`)}
                  </option>
                ))}
              </select>
              <button type="button" disabled={busyId === post.id} aria-label={`${tl('feedback.admin.copy')}: ${post.title}`} onClick={() => void copy(post)}>
                {tl('feedback.admin.copy')}
              </button>
              {copiedId === post.id && <span role="status">{tl('feedback.admin.copied')}</span>}
              <button type="button" className="danger" disabled={busyId === post.id} aria-label={`${tl('feedback.admin.delete')}: ${post.title}`} onClick={() => void remove(post)}>
                {tl('feedback.admin.delete')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
