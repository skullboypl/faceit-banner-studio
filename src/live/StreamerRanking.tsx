import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LanguageContext } from '../generator/contexts';
import { getStreamerRanking, type StreamerRankRow, type StreamerRanking } from './streamer-api';
import { applyStreamerMeta, STREAMER_RANKING_PATH, streamerIndexDescription, streamerIndexTitle, streamerPath } from './streamer-seo';
import { KickIcon, TwitchIcon } from './MemberIcons';

function PlatformMark({ row }: { row: StreamerRankRow }) {
  if (row.kick && !row.twitch) return <KickIcon size={14} />;
  return <TwitchIcon size={14} />;
}

export function StreamerRanking() {
  const t = useContext(LanguageContext);
  const [board, setBoard] = useState<StreamerRanking | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!t) return;
    const previous = {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    };
    applyStreamerMeta(streamerIndexTitle(t('streamers.analytics.title')), streamerIndexDescription(t('streamers.rank.description')), STREAMER_RANKING_PATH);
    const controller = new AbortController();
    let active = true;
    void getStreamerRanking(controller.signal)
      .then((next) => {
        if (!active) return;
        setBoard(next);
        setError(false);
      })
      .catch(() => {
        if (active && !controller.signal.aborted) setError(true);
      });
    return () => {
      active = false;
      controller.abort();
      document.title = previous.title;
      const description = document.querySelector('meta[name="description"]');
      if (description) description.setAttribute('content', previous.description);
    };
  }, [t]);

  if (!t) return null;
  const rows = board?.streamers ?? null;
  const archive = board?.archive ?? [];

  return (
    <div className="streamers-page streamers-ranking-page">
      <p className="streamers-profile-back">
        <Link to="/streamers">{t('streamers.page.back')}</Link>
      </p>
      <section className="streamers-analytics" aria-labelledby="streamers-analytics-title">
        <div className="streamers-section-head">
          <div>
            <span>{t('streamers.analytics.days')}</span>
            <h3 id="streamers-analytics-title">{t('streamers.analytics.title')}</h3>
          </div>
        </div>
        <p className="streamers-analytics-lead">{t('streamers.analytics.lead')}</p>
        {error && rows === null ? (
          <p className="streamers-empty" role="alert">{t('streamers.analytics.error')}</p>
        ) : rows === null ? (
          <p className="streamers-empty" role="status">{t('streamers.analytics.loading')}</p>
        ) : rows.length === 0 ? (
          <p className="streamers-empty">{t('streamers.analytics.empty')}</p>
        ) : (
          <ol className="streamers-analytics-list" aria-label={t('streamers.analytics.title')}>
            {rows.map((row, index) => (
              <li key={row.slug}>
                <Link to={streamerPath(row.slug)}>
                  <span className="streamers-analytics-rank">#{index + 1}</span>
                  <span className="streamers-analytics-name">
                    <PlatformMark row={row} />
                    <strong>{row.nickname}</strong>
                    <small>@{row.slug}</small>
                  </span>
                  <span>
                    <b>{row.viewersAvg.toLocaleString()}</b>
                    <i>{t('streamers.analytics.avg')}</i>
                  </span>
                  <span>
                    <b>{row.viewersPeak.toLocaleString()}</b>
                    <i>{t('streamers.analytics.peak')}</i>
                  </span>
                  <span>
                    <b>{row.matches.toLocaleString()}</b>
                    <i>{t('streamers.analytics.matches')}</i>
                  </span>
                  <span>
                    <b>{row.elo == null ? '—' : row.elo.toLocaleString()}</b>
                    <i>{t('streamers.analytics.elo')}</i>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="streamers-archive" aria-labelledby="streamers-history-title">
        <div className="streamers-section-head">
          <div>
            <span>{t('streamers.page.history_days')}</span>
            <h3 id="streamers-history-title">{t('streamers.history.title')}</h3>
          </div>
        </div>
        <p className="streamers-analytics-lead">{t('streamers.history.lead')}</p>
        {archive.length === 0 ? (
          <p className="streamers-empty">{t('streamers.history.empty')}</p>
        ) : (
          <ul className="streamers-archive-list" aria-label={t('streamers.history.title')}>
            {archive.map((row) => (
              <li key={row.slug}>
                <Link to={streamerPath(row.slug)}>
                  <PlatformMark row={row} />
                  <strong>{row.nickname}</strong>
                  <small>@{row.slug}</small>
                  {row.lastDay ? <i>{row.lastDay}</i> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
