import { useContext, useEffect, useState } from 'react';
import { ApiError, type User } from '../cloud/api';
import { PostDetail } from '../feedback/PostDetail';
import { LanguageContext } from '../generator/contexts';
import {
  POST_STATUSES,
  adminDeleteAttachment,
  adminDeletePost,
  adminExport,
  adminList,
  adminSetStatus,
  type FeedbackPost,
  type PostStatus,
} from '../feedback/api';
import { StatusBadge } from '../feedback/StatusBadge';

const message = (failure: unknown) =>
  failure instanceof ApiError || failure instanceof Error
    ? failure.message
    : String(failure);

/** Posts waiting for the admin, filtered by status; the same actions as in the board's detail view. */
export const AdminQueue = ({
  initialStatus = 'new',
  user,
}: {
  initialStatus?: PostStatus;
  user?: User;
}) => {
  const tl = useContext(LanguageContext);
  const [status, setStatus] = useState<PostStatus>(initialStatus);
  const [posts, setPosts] = useState<FeedbackPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [sort, setSort] = useState('new');
  const [revision, setRevision] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [detail, setDetail] = useState<FeedbackPost | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPosts([]);
    setNext(null);
    setError(null);
    adminList(status)
      .then((page) => {
        if (cancelled) return;
        setPosts(page.posts);
        setNext(page.next);
        setError(null);
      })
      .catch((failure) => !cancelled && setError(message(failure)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [status, revision]);

  if (!tl) return null;

  const needle = query.trim().toLowerCase();
  const visible = posts
    .filter(
      (post) =>
        (kind === 'all' || post.kind === kind) &&
        (!needle ||
          `${post.title} ${post.author ?? ''}`.toLowerCase().includes(needle))
    )
    .sort((a, b) =>
      sort === 'votes'
        ? b.votes - a.votes
        : sort === 'comments'
          ? b.comments - a.comments
          : Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
  const loadMore = async () => {
    if (!next || loading || busyId) return;
    setLoading(true);
    setError(null);
    try {
      const page = await adminList(status, next);
      setPosts((current) => [
        ...current,
        ...page.posts.filter(
          (post) => !current.some((entry) => entry.id === post.id)
        ),
      ]);
      setNext(page.next);
    } catch (failure) {
      setError(message(failure));
    } finally {
      setLoading(false);
    }
  };

  const act = async (id: string, work: () => Promise<void>) => {
    if (busyId || loading) return;
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
          ? list.map((entry) =>
              entry.id === post.id
                ? { ...entry, status: updated.status }
                : entry
            )
          : list.filter((entry) => entry.id !== post.id)
      );
    });

  const copy = (post: FeedbackPost) =>
    act(post.id, async () => {
      await navigator.clipboard.writeText(await adminExport(post.id));
      setCopiedId(post.id);
      setTimeout(
        () => setCopiedId((current) => (current === post.id ? null : current)),
        2500
      );
    });

  const remove = (post: FeedbackPost) => {
    if (!window.confirm(tl('feedback.delete_confirm', [post.title]))) return;
    return act(post.id, async () => {
      await adminDeletePost(post.id);
      setPosts((list) => list.filter((entry) => entry.id !== post.id));
    });
  };

  if (detail && user)
    return (
      <section className="admin-card">
        <PostDetail
          summary={detail}
          user={user}
          admin
          onBack={() => {
            setDetail(null);
            setRevision((value) => value + 1);
          }}
          onChanged={(updated) => {
            setDetail(updated);
          }}
          onDeleted={() => {
            setDetail(null);
            setRevision((value) => value + 1);
          }}
        />
      </section>
    );

  return (
    <section className="admin-card admin-queue">
      <div className="admin-queue-head">
        <div>
          <h2>{tl('admin.queue')}</h2>
          <p>
            Filtruj wczytane zgłoszenia, ustal priorytety i aktualizuj status.
          </p>
        </div>
        <button
          type="button"
          disabled={loading || !!busyId}
          onClick={() => setRevision((value) => value + 1)}
        >
          Odśwież zgłoszenia ↻
        </button>
      </div>
      <div className="admin-filters">
        <label className="admin-search">
          Szukaj zgłoszenia
          <input
            type="search"
            placeholder="Tytuł lub autor…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          Status
          <select
            aria-label="Status"
            value={status}
            disabled={loading || !!busyId}
            onChange={(event) => setStatus(event.target.value as PostStatus)}
          >
            {POST_STATUSES.map((entry) => (
              <option key={entry} value={entry}>
                {tl(`feedback.status.${entry}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Typ zgłoszenia
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="all">Wszystkie typy</option>
            <option value="bug">Błędy</option>
            <option value="request">Pomysły</option>
          </select>
        </label>
        <label>
          Sortowanie
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="new">Najnowsze</option>
            <option value="votes">Najwięcej głosów</option>
            <option value="comments">Najwięcej komentarzy</option>
          </select>
        </label>
      </div>
      <div className="admin-filter-summary">
        <span>
          Wyniki: <b>{visible.length}</b> / {posts.length} wczytanych
        </span>
        {(query || kind !== 'all' || sort !== 'new') && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setKind('all');
              setSort('new');
            }}
          >
            Wyczyść filtry ×
          </button>
        )}
      </div>

      {error && (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && posts.length === 0 && (
        <p className="admin-queue-empty">{tl('admin.queue_empty')}</p>
      )}
      {!loading && posts.length > 0 && visible.length === 0 && (
        <p className="admin-empty">Brak zgłoszeń pasujących do filtrów.</p>
      )}
      {loading && (
        <p role="status" className="admin-muted">
          Ładowanie zgłoszeń…
        </p>
      )}

      <ul className="admin-queue-list">
        {visible.map((post) => (
          <li key={post.id}>
            <div className="admin-queue-main">
              <span className={`admin-kind admin-kind--${post.kind}`}>
                {tl(
                  post.kind === 'bug'
                    ? 'feedback.kind.bug'
                    : 'admin.kind.request'
                )}
              </span>
              {user ? (
                <button
                  type="button"
                  className="admin-post-title"
                  disabled={loading || !!busyId}
                  onClick={() => setDetail(post)}
                >
                  {post.title} ↗
                </button>
              ) : (
                <strong>{post.title}</strong>
              )}
              <small>
                <StatusBadge status={post.status} />{' '}
                {post.author ? tl('feedback.by', [post.author]) : ''} · ▲{' '}
                <span>{post.votes}</span> ·{' '}
                {tl('feedback.comments_short', [String(post.comments)])}
              </small>
            </div>
            <div className="admin-queue-actions">
              <select
                aria-label={`${tl('feedback.admin.status')}: ${post.title}`}
                value={post.status}
                disabled={!!busyId || loading}
                onChange={(event) =>
                  void changeStatus(post, event.target.value as PostStatus)
                }
              >
                {POST_STATUSES.map((entry) => (
                  <option key={entry} value={entry}>
                    {tl(`feedback.status.${entry}`)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!!busyId || loading}
                aria-label={`${tl('feedback.admin.copy')}: ${post.title}`}
                onClick={() => void copy(post)}
              >
                {tl('feedback.admin.copy')}
              </button>
              {copiedId === post.id && (
                <span role="status">{tl('feedback.admin.copied')}</span>
              )}
              <button
                type="button"
                className="danger"
                disabled={!!busyId || loading}
                aria-label={`${tl('feedback.admin.delete')}: ${post.title}`}
                onClick={() => void remove(post)}
              >
                {tl('feedback.admin.delete')}
              </button>
              {(post.attachments ?? []).map((shot) => (
                <span key={shot.id} className="admin-shot">
                  <img src={shot.url} alt="" width={shot.width} height={shot.height} loading="lazy" decoding="async" />
                  <button
                    type="button"
                    className="danger"
                    disabled={!!busyId || loading}
                    aria-label={`${tl('attachment.remove')}: ${post.title}`}
                    onClick={() =>
                      void act(post.id, async () => {
                        await adminDeleteAttachment(shot.id);
                        setPosts((list) =>
                          list.map((entry) =>
                            entry.id === post.id
                              ? { ...entry, attachments: (entry.attachments ?? []).filter((image) => image.id !== shot.id) }
                              : entry
                          )
                        );
                      })
                    }
                  >
                    {tl('attachment.remove')}
                  </button>
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {next && (
        <button
          type="button"
          disabled={loading || !!busyId}
          onClick={() => void loadMore()}
        >
          Wczytaj kolejne zgłoszenia
        </button>
      )}
    </section>
  );
};
