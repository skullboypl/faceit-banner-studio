import { useCallback, useContext, useEffect, useState } from 'react';
import { ApiError, type User } from '../cloud/api';
import { fromDelta } from '../cloud/delta';
import { apiMessage } from '../cloud/messages';
import { FaceitLoginButton, LOGIN_URL } from '../components/FaceitLoginButton';
import { LanguageContext, SettingsContext } from '../generator/contexts';
import type { SettingKey } from '../settings/manager';
import { CatalogCard } from './CatalogCard';
import {
  listCatalog,
  listMinePublications,
  votePublication,
  withdrawPublication,
  type CatalogPublication,
} from './api';

type Shelf = 'public' | 'mine';

const languageId = () => {
  try {
    return localStorage.getItem('fcw_lang') || 'pl';
  } catch {
    return 'pl';
  }
};

export const CatalogBoard = ({
  user,
  onOpenSettings,
}: {
  user: User | null;
  onOpenSettings?: () => void;
}) => {
  const tl = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
  const [shelf, setShelf] = useState<Shelf>('public');
  const [sort, setSort] = useState<'top' | 'new'>('top');
  const [items, setItems] = useState<CatalogPublication[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginPrompt, setLoginPrompt] = useState(false);
  const guid = user?.guid;
  const studioPlayer = settings?.get('playerId');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (shelf === 'mine') {
        if (!guid) {
          setItems([]);
          setNext(null);
          return;
        }
        const page = await listMinePublications();
        setItems(Array.isArray(page.publications) ? page.publications : []);
        setNext(null);
      } else {
        const page = await listCatalog(sort);
        setItems(Array.isArray(page.publications) ? page.publications : []);
        setNext(page.next ?? null);
      }
      setError(null);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setLoading(false);
    }
  }, [shelf, sort, guid]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!tl) return null;

  const replace = (id: string, patch: Partial<CatalogPublication>) =>
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const vote = async (item: CatalogPublication, value: 1 | -1) => {
    if (item.status !== 'approved') return;
    if (!user) {
      setLoginPrompt(true);
      return;
    }
    try {
      const result = await votePublication(item.id, value);
      replace(item.id, result);
    } catch (failure) {
      setError(tl ? apiMessage(tl, failure) : String(failure));
    }
  };

  const applyLook = (item: CatalogPublication) => {
    if (!settings) return;
    const loaded = fromDelta(item.settings);
    for (const [key, value] of Object.entries(loaded)) {
      if (key === 'playerId') continue;
      settings.set(key as SettingKey, value as never);
    }
    onOpenSettings?.();
  };

  const withdraw = async (item: CatalogPublication) => {
    if (!window.confirm(tl('catalog.withdraw_confirm', [item.title]))) return;
    try {
      await withdrawPublication(item.id);
      setItems((list) => list.filter((entry) => entry.id !== item.id));
    } catch (failure) {
      setError(tl ? apiMessage(tl, failure) : String(failure));
    }
  };

  const loadMore = async () => {
    if (!next) return;
    setLoading(true);
    try {
      const page = await listCatalog(sort, next);
      setItems((list) => [...list, ...page.publications]);
      setNext(page.next);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : String(failure));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings catalog-board">
      <div className="feedback-head">
        <h3 className="card-heading">{tl('catalog.title')}</h3>
      </div>
      <p className="subtext">{tl('catalog.help')}</p>

      <div className="feedback-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={shelf === 'public'} onClick={() => setShelf('public')}>
          {tl('catalog.feed')}
        </button>
        <button type="button" role="tab" aria-selected={shelf === 'mine'} onClick={() => setShelf('mine')}>
          {tl('catalog.mine')}
        </button>
      </div>

      {shelf === 'public' && (
        <div className="feedback-toolbar">
          <select aria-label={tl('catalog.sort')} value={sort} onChange={(event) => setSort(event.target.value as 'top' | 'new')}>
            <option value="top">{tl('catalog.sort.top')}</option>
            <option value="new">{tl('catalog.sort.new')}</option>
          </select>
        </div>
      )}

      {error && (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      )}

      {loginPrompt && !user && (
        <div className="catalog-login-cta" role="status">
          <p>{tl('catalog.login_vote')}</p>
          <FaceitLoginButton className="login-cta" />
        </div>
      )}

      {shelf === 'mine' && !user && (
        <p className="subtext">
          <a href={LOGIN_URL}>{tl('catalog.login_mine')}</a>
        </p>
      )}

      {!loading && !error && items.length === 0 && shelf === 'public' && <p className="subtext">{tl('catalog.empty')}</p>}
      {!loading && !error && items.length === 0 && shelf === 'mine' && user && <p className="subtext">{tl('catalog.mine_empty')}</p>}

      <ul className="catalog-list">
        {items.map((item) => (
          <CatalogCard
            key={item.id}
            item={item}
            languageId={languageId()}
            studioPlayer={studioPlayer}
            canVote={Boolean(user) && item.status === 'approved'}
            statusLabel={shelf === 'mine' ? (status) => tl(`catalog.status.${status}`) : undefined}
            byLabel={tl('catalog.by', [item.author])}
            up={tl('catalog.vote.up')}
            down={tl('catalog.vote.down')}
            loadLabel={tl('catalog.load')}
            onVote={(value) => void vote(item, value)}
            onLoad={() => applyLook(item)}
            extra={
              shelf === 'mine' && item.mine ? (
                <button type="button" className="catalog-withdraw" onClick={() => void withdraw(item)}>
                  {tl('catalog.withdraw')}
                </button>
              ) : null
            }
          />
        ))}
      </ul>

      {next && (
        <button type="button" className="feedback-more" disabled={loading} onClick={() => void loadMore()}>
          {tl('catalog.load_more')}
        </button>
      )}
    </div>
  );
};
