import { useContext, useEffect, useState } from 'react';
import { LanguageContext } from '../generator/contexts';
import {
  getLiveBoard,
  PRESENCE_REFRESH_MS,
  type LivePlayer,
} from '../utils/presence';
import { VerifiedBadgeIcon } from '../assets/icons/faceit/VerifiedBadgeIcon';
import { VerifiedGoldBadgeIcon } from '../assets/icons/faceit/VerifiedGoldBadgeIcon';
import { FaceitLevel } from './FaceitLevel';

const PAGE_SIZE = 15;

function pageWindow(current: number, count: number) {
  const pages = new Set([0, count - 1, current - 1, current, current + 1]);
  return [...pages]
    .filter((page) => page >= 0 && page < count)
    .sort((a, b) => a - b);
}

const flagUrl = (country: string) => `https://flagcdn.com/${country}.svg`;

function faceitProfile(nickname: string) {
  return `https://www.faceit.com/en/players/${encodeURIComponent(nickname)}`;
}

export function LiveRanking() {
  const t = useContext(LanguageContext);
  const [players, setPlayers] = useState<LivePlayer[] | null>(null);
  const [online, setOnline] = useState(0);
  const [error, setError] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    if (!t) return;
    const previousTitle = document.title;
    document.title = t('live.title');
    let active = true;
    let pending = false;
    let refreshedAt = -Infinity;
    const controller = new AbortController();
    const refresh = async () => {
      if (
        pending ||
        document.hidden ||
        Date.now() - refreshedAt < PRESENCE_REFRESH_MS
      )
        return;
      pending = true;
      refreshedAt = Date.now();
      try {
        const board = await getLiveBoard(controller.signal);
        if (!active) return;
        setPlayers(board.players);
        setOnline(board.online);
        setError(false);
      } catch {
        if (active) setError(true);
      } finally {
        pending = false;
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, PRESENCE_REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      document.title = previousTitle;
    };
  }, [t]);

  if (!t) return null;

  const pageCount = Math.max(1, Math.ceil((players?.length ?? 0) / PAGE_SIZE));
  const page = Math.min(pageIndex, pageCount - 1);
  const start = page * PAGE_SIZE;
  const visible = (players ?? []).slice(start, start + PAGE_SIZE);
  const pages = pageWindow(page, pageCount);

  return (
    <div className="settings live-panel">
      <div className="live-summary">
        <p className="live-kicker">
          <i />
          {online.toLocaleString()} {t('studio.online_now')}
        </p>
        <span>{t('live.players', [String(players?.length ?? 0)])}</span>
      </div>
      {error && players !== null && (
        <p role="status" className="live-warning">
          {t('live.stale')}
        </p>
      )}
      {error && players === null ? (
        <p className="live-empty" role="alert">
          {t('live.error')}
        </p>
      ) : players === null ? (
        <p className="live-empty" role="status">
          {t('live.loading')}
        </p>
      ) : players && players.length === 0 ? (
        <p className="live-empty">{t('live.empty')}</p>
      ) : (
        <>
          <div className="live-columns" aria-hidden="true">
            <span>#</span>
            <span>{t('live.player')}</span>
            <span>{t('live.level_heading')}</span>
            <span>ELO</span>
          </div>
          <ol className="live-list" start={start + 1}>
            {visible.map((player, index) => {
              const rank = start + index + 1;
              return (
                <li
                  key={`${player.nickname}-${rank}`}
                  className={
                    rank <= 3 ? `live-row live-row--${rank}` : 'live-row'
                  }
                >
                  <span className="live-rank">
                    {String(rank).padStart(2, '0')}
                  </span>
                  <div className="live-identity">
                    <span className="live-avatar" aria-hidden="true">
                      {player.nickname.charAt(0).toUpperCase()}
                      {player.avatar && (
                        <img
                          src={player.avatar}
                          alt=""
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.hidden = true;
                          }}
                        />
                      )}
                    </span>
                    <div className="live-profile">
                      <div className="live-player-name">
                        <a
                          className="live-nick"
                          href={faceitProfile(player.nickname)}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {player.nickname}
                        </a>
                        {player.confirmed === true && (
                          <span
                            className="live-confirmed"
                            role="img"
                            aria-label={t('live.confirmed')}
                            title={t('live.confirmed')}
                          >
                            <svg viewBox="0 0 16 16" aria-hidden="true">
                              <circle cx="8" cy="8" r="6.25" />
                              <path d="M4.8 8.2 7 10.3 11.3 5.7" />
                            </svg>
                          </span>
                        )}
                        {(player.verifiedBadge === 'verified' ||
                          player.verifiedBadge === 'gold') && (
                          <span
                            className="live-verified"
                            role="img"
                            aria-label={t(
                              player.verifiedBadge === 'gold'
                                ? 'live.verified_gold'
                                : 'live.verified'
                            )}
                            title={t(
                              player.verifiedBadge === 'gold'
                                ? 'live.verified_gold'
                                : 'live.verified'
                            )}
                          >
                            {player.verifiedBadge === 'gold' ? (
                              <VerifiedGoldBadgeIcon />
                            ) : (
                              <VerifiedBadgeIcon />
                            )}
                          </span>
                        )}
                      </div>
                      <span className="live-player-meta">
                        {player.country &&
                          /^[a-z]{2}$/i.test(player.country) && (
                            <>
                              <img
                                className="live-flag"
                                src={flagUrl(player.country.toLowerCase())}
                                alt=""
                              />
                              {player.country.toUpperCase()}
                              <span>·</span>
                            </>
                          )}
                        CS2
                      </span>
                    </div>
                  </div>
                  <FaceitLevel
                    level={player.level}
                    ranking={player.ranking}
                    label={
                      player.ranking
                        ? t('live.challenger', [String(player.ranking)])
                        : player.level
                        ? t('live.level', [String(player.level)])
                        : t('live.level_unknown')
                    }
                  />
                  <strong className="live-elo">
                    {Number.isInteger(player.elo)
                      ? player.elo!.toLocaleString()
                      : '—'}
                    <small>ELO</small>
                  </strong>
                </li>
              );
            })}
          </ol>
        </>
      )}
      {players && players.length > PAGE_SIZE && (
        <nav className="live-pages" aria-label={t('live.pages')}>
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPageIndex(page - 1)}
          >
            {t('live.prev')}
          </button>
          <span className="live-pages-status">
            {t('live.page', [String(page + 1), String(pageCount)])}
          </span>
          <span className="live-pages-nums">
            {pages.map((entry, index) => {
              const gap = index > 0 && entry - pages[index - 1] > 1;
              return (
                <span key={entry}>
                  {gap && <span className="live-pages-gap">…</span>}
                  <button
                    type="button"
                    aria-current={entry === page ? 'page' : undefined}
                    onClick={() => setPageIndex(entry)}
                  >
                    {entry + 1}
                  </button>
                </span>
              );
            })}
          </span>
          <button
            type="button"
            disabled={page >= pageCount - 1}
            onClick={() => setPageIndex(page + 1)}
          >
            {t('live.next')}
          </button>
        </nav>
      )}
      <p className="live-note">{t('live.note')}</p>
    </div>
  );
}
