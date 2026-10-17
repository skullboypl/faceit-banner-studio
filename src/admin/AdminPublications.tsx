import { useContext, useEffect, useState } from 'react';
import { CatalogCard } from '../catalog/CatalogCard';
import {
  adminListPublications,
  adminSetPublicationStatus,
  type CatalogPublication,
  type PublicationStatus,
} from '../catalog/api';
import { ApiError } from '../cloud/api';
import { LanguageContext } from '../generator/contexts';

export const AdminPublications = () => {
  const tl = useContext(LanguageContext);
  const [status, setStatus] = useState<PublicationStatus>('pending');
  const [items, setItems] = useState<CatalogPublication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminListPublications(status)
      .then((page) => {
        if (cancelled) return;
        setItems(page.publications);
        setError(null);
      })
      .catch((failure) => !cancelled && setError(failure instanceof ApiError ? failure.message : String(failure)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (!tl) return null;

  const decide = async (item: CatalogPublication, next: 'approved' | 'declined') => {
    setBusy(item.id);
    try {
      const { publication } = await adminSetPublicationStatus(item.id, next);
      setItems((list) => list.filter((entry) => entry.id !== item.id).concat(status === publication.status ? [publication] : []));
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="admin-card">
      <div className="feedback-head">
        <h2>Banery publiczne</h2>
        <select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value as PublicationStatus)}>
          <option value="pending">{tl('catalog.status.pending')}</option>
          <option value="approved">{tl('catalog.status.approved')}</option>
          <option value="declined">{tl('catalog.status.declined')}</option>
        </select>
      </div>
      <p>Zatwierdź wygląd i opis, zanim baner trafi na publiczną listę.</p>
      {error && <p className="feedback-error">{error}</p>}
      {loading && <p>Ładowanie…</p>}
      {!loading && items.length === 0 && <p>Nic w tej kolejce.</p>}
      <ul className="catalog-list">
        {items.map((item) => (
          <CatalogCard
            key={item.id}
            item={item}
            languageId="pl"
            canVote={false}
            askLogin={false}
            statusLabel={(entry) => tl(`catalog.status.${entry}`)}
            byLabel={tl('catalog.by', [item.author])}
            up={tl('catalog.vote.up')}
            down={tl('catalog.vote.down')}
            onVote={() => undefined}
            extra={
              <div className="admin-publication-actions">
                {item.status !== 'approved' && (
                  <button type="button" className="is-overwrite has-icon" disabled={busy === item.id} onClick={() => void decide(item, 'approved')}>
                    Zatwierdź
                  </button>
                )}
                {item.status !== 'declined' && (
                  <button type="button" className="is-delete has-icon" disabled={busy === item.id} onClick={() => void decide(item, 'declined')}>
                    Odrzuć
                  </button>
                )}
              </div>
            }
          />
        ))}
      </ul>
    </section>
  );
};
