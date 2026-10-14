import { useCallback, useContext, useEffect, useState } from 'react';
import { ApiError, type User } from '../cloud/api';
import { LOGIN_URL } from '../components/FaceitLoginButton';
import { LanguageContext } from '../generator/contexts';
import {
  POST_STATUSES,
  listPosts,
  vote,
  type FeedbackPost,
  type PostKind,
  type PostStatus,
} from './api';
import { PostDetail } from './PostDetail';
import { PostForm } from './PostForm';
import { StatusBadge } from './StatusBadge';

type View = { type: 'list' } | { type: 'form' } | { type: 'detail'; post: FeedbackPost };

const KINDS: PostKind[] = ['request', 'bug'];

export const FeedbackBoard = ({ user, admin }: { user: User | null; admin: boolean }) => {
  const tl = useContext(LanguageContext);
  const [kind, setKind] = useState<PostKind>('request');
  const [status, setStatus] = useState<PostStatus | ''>('');
  const [sort, setSort] = useState<'top' | 'new'>('top');
  const [posts, setPosts] = useState<FeedbackPost[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ type: 'list' });

  const guid = user?.guid;
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listPosts({ kind, status: status || undefined, sort })
      .then((page) => {
        if (cancelled) return;
        setPosts(page.posts);
        setNext(page.next);
        setError(null);
      })
      .catch((failure) => !cancelled && setError(failure instanceof ApiError ? failure.message : String(failure)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [kind, status, sort, guid]);

  const loadMore = useCallback(async () => {
    if (!next) return;
    setLoading(true);
    try {
      const page = await listPosts({ kind, status: status || undefined, sort, cursor: next });
      setPosts((current) => [...current, ...page.posts]);
      setNext(page.next);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setLoading(false);
    }
  }, [kind, status, sort, next]);

  if (!tl) return null;

  const replace = (updated: FeedbackPost) =>
    setPosts((current) => current.map((entry) => (entry.id === updated.id ? { ...entry, ...updated } : entry)));

  const toggleVote = async (post: FeedbackPost) => {
    try {
      const result = await vote(post.id);
      replace({ ...post, voted: result.voted, votes: result.votes });
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    }
  };

  const voteLabel = (post: FeedbackPost) =>
    `${post.kind === 'bug' ? tl('feedback.vote.bug') : tl('feedback.vote.request')}: ${post.votes}`;

  if (view.type === 'detail') {
    const current = posts.find((entry) => entry.id === view.post.id) ?? view.post;
    return (
      <div className="settings feedback-board">
        <PostDetail
          summary={current}
          user={user}
          admin={admin}
          onBack={() => setView({ type: 'list' })}
          onChanged={replace}
          onDeleted={(id) => {
            setPosts((list) => list.filter((entry) => entry.id !== id));
            setView({ type: 'list' });
          }}
        />
      </div>
    );
  }

  if (view.type === 'form') {
    return (
      <div className="settings feedback-board">
        <PostForm
          kind={kind}
          onCancel={() => setView({ type: 'list' })}
          onCreated={(post) => {
            setPosts((list) => [post, ...list]);
            setView({ type: 'list' });
          }}
        />
      </div>
    );
  }

  return (
    <div className="settings feedback-board">
      <div className="feedback-head">
        <h3 className="card-heading">{tl('feedback.title')}</h3>
        {user ? (
          <button type="button" className="primary-action" onClick={() => setView({ type: 'form' })}>
            {tl('feedback.new')}
          </button>
        ) : (
          <a className="primary-action" href={LOGIN_URL}>
            {tl('feedback.new')}
          </a>
        )}
      </div>

      <div className="feedback-tabs" role="tablist">
        {KINDS.map((entry) => (
          <button
            key={entry}
            type="button"
            role="tab"
            aria-selected={kind === entry}
            onClick={() => setKind(entry)}
          >
            {tl(entry === 'bug' ? 'feedback.bugs' : 'feedback.requests')}
          </button>
        ))}
      </div>

      <div className="feedback-toolbar">
        <select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value as PostStatus | '')}>
          <option value="">{tl('feedback.all_statuses')}</option>
          {POST_STATUSES.map((entry) => (
            <option key={entry} value={entry}>
              {tl(`feedback.status.${entry}`)}
            </option>
          ))}
        </select>
        <select aria-label={tl('feedback.sort')} value={sort} onChange={(event) => setSort(event.target.value as 'top' | 'new')}>
          <option value="top">{tl('feedback.sort.top')}</option>
          <option value="new">{tl('feedback.sort.new')}</option>
        </select>
      </div>

      {error && (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && posts.length === 0 && <p className="subtext">{tl('feedback.empty')}</p>}

      <ul className="feedback-list">
        {posts.map((post) => (
          <li key={post.id} className="feedback-item">
            {user ? (
              <button
                type="button"
                className="feedback-vote"
                aria-label={voteLabel(post)}
                aria-pressed={Boolean(post.voted)}
                onClick={() => void toggleVote(post)}
              >
                <span aria-hidden="true">▲</span>
                <b>{post.votes}</b>
              </button>
            ) : (
              <a className="feedback-vote" href={LOGIN_URL} aria-label={voteLabel(post)}>
                <span aria-hidden="true">▲</span>
                <b>{post.votes}</b>
              </a>
            )}
            <div className="feedback-main">
              <button type="button" className="feedback-title" onClick={() => setView({ type: 'detail', post })}>
                {post.title}
              </button>
              <small>
                <StatusBadge status={post.status} />
                <span>
                  {tl('feedback.comments_short', [String(post.comments)])}
                </span>
                {user && post.author && <span>{tl('feedback.by', [post.author])}</span>}
              </small>
            </div>
          </li>
        ))}
      </ul>

      {next && (
        <button type="button" className="feedback-more" disabled={loading} onClick={() => void loadMore()}>
          {tl('feedback.load_more')}
        </button>
      )}
    </div>
  );
};
