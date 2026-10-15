import { useContext, useEffect, useState } from 'react';
import { LanguageContext } from '../generator/contexts';
import {
  fetchReviewQueue,
  reviewQueueImage,
  type ReviewAction,
  type ReviewFilter,
  type ReviewImage,
} from '../profile/images';

const FILTERS: ReviewFilter[] = ['pending', 'reported', 'hidden', 'all'];

type Api = {
  list: (filter: ReviewFilter) => Promise<ReviewImage[]>;
  review: (id: string, action: ReviewAction, reason?: string) => Promise<unknown>;
};

const defaultApi: Api = { list: fetchReviewQueue, review: reviewQueueImage };

/** Moderation of the pictures players set for the banners: approve, refuse with a reason, or remove. */
export function AdminProfileImages({ api = defaultApi }: { api?: Api }) {
  const tl = useContext(LanguageContext);
  const [filter, setFilter] = useState<ReviewFilter>('pending');
  const [rows, setRows] = useState<ReviewImage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancel = false;
    setLoaded(false);
    api
      .list(filter)
      .then((list) => {
        if (!cancel) {
          setRows(list);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancel) {
          setRows([]);
          setLoaded(true);
        }
      });
    return () => {
      cancel = true;
    };
  }, [api, filter]);

  if (!tl) return null;

  const decide = async (row: ReviewImage, action: ReviewAction) => {
    setError(false);
    try {
      await api.review(row.id, action, action === 'reject' ? reason : undefined);
      setRows((current) => current.filter((entry) => entry.id !== row.id));
      setRejecting(null);
      setReason('');
    } catch {
      setError(true);
    }
  };

  return (
    <section className="admin-card admin-images">
      <h2>{tl('admin.images.title')}</h2>
      <div className="admin-images-filters" role="group">
        {FILTERS.map((entry) => (
          <button key={entry} type="button" aria-pressed={filter === entry} onClick={() => setFilter(entry)}>
            {tl(`admin.images.filter.${entry}`)}
          </button>
        ))}
      </div>
      {error && (
        <p className="admin-images-error" role="alert">
          {tl('admin.images.failed')}
        </p>
      )}
      {loaded && rows.length === 0 && <p className="subtext">{tl('admin.images.empty')}</p>}
      <ul className="admin-images-list">
        {rows.map((row) => (
          <li key={row.id} className={`is-${row.kind}`}>
            {row.url && <img src={row.url} alt={`${row.nickname} · ${tl(`profile.images.name.${row.kind}`)}`} loading="lazy" />}
            <div className="admin-images-meta">
              <strong>{row.nickname}</strong>
              <span>
                {tl(`profile.images.card.${row.kind}`)} · {tl(`profile.images.status.${row.status}`)}
              </span>
              {row.reports > 0 && <span className="admin-images-reports">{tl('admin.images.reports', [String(row.reports)])}</span>}
            </div>
            <div className="admin-images-actions">
              {row.status !== 'approved' && (
                <button type="button" onClick={() => void decide(row, 'approve')}>
                  {tl('admin.images.approve')}
                </button>
              )}
              {rejecting === row.id ? (
                <label className="admin-images-reason">
                  <span>{tl('admin.images.reason')}</span>
                  <input value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} />
                </label>
              ) : null}
              <button
                type="button"
                onClick={() => (rejecting === row.id ? void decide(row, 'reject') : (setRejecting(row.id), setReason('')))}
              >
                {tl('admin.images.reject')}
              </button>
              <button type="button" onClick={() => void decide(row, 'remove')}>
                {tl('admin.images.remove')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
