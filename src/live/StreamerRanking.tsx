import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LanguageContext } from '../generator/contexts';
import { getStreamerRanking, type StreamerRankRow } from './streamer-api';
import { streamerPath } from './streamer-seo';
import { KickIcon, TwitchIcon } from './MemberIcons';

function PlatformMark({ row }: { row: StreamerRankRow }) {
  if (row.kick && !row.twitch) return <KickIcon size={14} />;
  return <TwitchIcon size={14} />;
}

export function StreamerRanking() {
  const t = useContext(LanguageContext);
  const [rows, setRows] = useState<StreamerRankRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!t) return;
    const controller = new AbortController();
    let active = true;
    void getStreamerRanking(controller.signal)
      .then((board) => {
        if (!active) return;
        setRows(board.streamers);
        setError(false);
      })
      .catch(() => {
        if (active && !controller.signal.aborted) setError(true);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [t]);

  if (!t) return null;

  return (
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
        <ol className="streamers-analytics-list">
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
  );
}
