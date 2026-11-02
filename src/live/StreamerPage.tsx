import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LanguageContext } from '../generator/contexts';
import { getStreamerPage, type StreamerDay, type StreamerDetail, type StreamerSamplePoint, type StreamerSession } from './streamer-api';
import {
  applyStreamerMeta,
  parseStreamerPath,
  STREAMER_RANKING_PATH,
  streamerPageDescription,
  streamerPageTitle,
  streamerPath,
} from './streamer-seo';
import { KickIcon, TwitchIcon } from './MemberIcons';

function channelHref(detail: StreamerDetail) {
  if (detail.streamer.twitch) return `https://www.twitch.tv/${detail.streamer.twitch}`;
  if (detail.streamer.kick) return `https://kick.com/${detail.streamer.kick}`;
  return '';
}

function DayChart({
  series,
  valueOf,
  label,
  tone,
}: {
  series: StreamerDay[];
  valueOf: (point: StreamerDay) => number;
  label: string;
  tone: 'twitch' | 'kick' | 'elo';
}) {
  const max = Math.max(1, ...series.map(valueOf));
  return (
    <section className="streamers-daychart" aria-label={label}>
      <h3>{label}</h3>
      <ol>
        {series.map((point) => {
          const value = valueOf(point);
          return (
            <li key={`${label}-${point.day}`}>
              <span>{point.day.slice(5)}</span>
              <span className="streamers-daychart-bar" data-tone={tone}>
                <i style={{ width: `${Math.round((value / max) * 100)}%` }} />
              </span>
              <strong>{value.toLocaleString()}</strong>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function EloLine({ points, empty }: { points: StreamerSamplePoint[]; empty: string }) {
  const series = points.filter((point) => Number.isInteger(point.elo));
  if (series.length === 0) return <p className="streamers-session-empty">{empty}</p>;
  const elos = series.map((point) => point.elo as number);
  const min = Math.min(...elos);
  const max = Math.max(...elos);
  const span = Math.max(1, max - min);
  const t0 = series[0].ts;
  const t1 = series[series.length - 1].ts;
  const tspan = Math.max(1, t1 - t0);
  const width = 640;
  const height = 120;
  const pad = 8;
  const coords = series.map((point, index) => {
    const x = pad + ((point.ts - t0) / tspan) * (width - pad * 2);
    const y = pad + (1 - ((point.elo as number) - min) / span) * (height - pad * 2);
    return `${Number.isFinite(x) ? x : pad + index} ${y}`;
  });
  return (
    <svg className="streamers-elo-line" viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
      <polyline fill="none" stroke="#ff5500" strokeWidth="2.5" points={coords.join(' ')} />
    </svg>
  );
}

function sessionStamp(ts: number) {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function SessionBlock({ session, index, lastLabel, pastLabel, empty }: { session: StreamerSession; index: number; lastLabel: string; pastLabel: string; empty: string }) {
  const change = session.eloStart != null && session.eloEnd != null ? session.eloEnd - session.eloStart : null;
  return (
    <article className="streamers-session">
      <header>
        <h4>{index === 0 ? lastLabel : pastLabel}</h4>
        <p>
          {sessionStamp(session.startedAt)}
          {session.endedAt !== session.startedAt ? ` – ${sessionStamp(session.endedAt)}` : ''}
          {' · '}
          {session.eloStart == null ? '—' : session.eloStart.toLocaleString()}
          {' → '}
          {session.eloEnd == null ? '—' : session.eloEnd.toLocaleString()}
          {change != null ? ` (${change > 0 ? '+' : ''}${change.toLocaleString()})` : ''}
        </p>
      </header>
      <EloLine points={session.points} empty={empty} />
    </article>
  );
}

export function StreamerPage({ slug }: { slug: string }) {
  const t = useContext(LanguageContext);
  const [detail, setDetail] = useState<StreamerDetail | null>(null);
  const [error, setError] = useState(false);
  const login = parseStreamerPath(streamerPath(slug)) || slug.toLowerCase();

  useEffect(() => {
    if (!t) return;
    const previous = {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    };
    applyStreamerMeta(
      streamerPageTitle(login, t('streamers.title')),
      streamerPageDescription(login, t('streamers.page.description')),
      streamerPath(login)
    );
    const controller = new AbortController();
    let active = true;
    void getStreamerPage(login, controller.signal)
      .then((page) => {
        if (!active) return;
        setDetail(page);
        setError(false);
        const name = page.streamer.nickname || login;
        applyStreamerMeta(
          streamerPageTitle(name, t('streamers.title')),
          streamerPageDescription(name, t('streamers.page.description')),
          streamerPath(page.streamer.slug || login)
        );
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
  }, [login, t]);

  if (!t) return null;
  const name = detail?.streamer.nickname || login;
  const href = detail ? channelHref(detail) : '';
  const series = detail?.series ?? [];
  const sessions = detail?.sessions ?? [];
  const kickOnly = Boolean(detail?.streamer.kick && !detail.streamer.twitch);

  return (
    <div className="streamers-page streamers-profile">
      <p className="streamers-profile-back">
        <Link to="/streamers">{t('streamers.page.back')}</Link>
        {' · '}
        <Link to={STREAMER_RANKING_PATH}>{t('streamers.rank.open')}</Link>
      </p>
      <header className="streamers-profile-head">
        <h3>{name}</h3>
        <p>@{detail?.streamer.slug || login}</p>
        {detail && (
          <ul className="streamers-profile-stats">
            <li>
              <b>{detail.streamer.viewersAvg.toLocaleString()}</b>
              <span>{t('streamers.analytics.avg')}</span>
            </li>
            <li>
              <b>{detail.streamer.viewersPeak.toLocaleString()}</b>
              <span>{t('streamers.analytics.peak')}</span>
            </li>
            <li>
              <b>{detail.streamer.elo == null ? '—' : detail.streamer.elo.toLocaleString()}</b>
              <span>{t('streamers.analytics.elo')}</span>
            </li>
            <li>
              <b>{detail.streamer.matches.toLocaleString()}</b>
              <span>{t('streamers.analytics.matches')}</span>
            </li>
          </ul>
        )}
        {href && (
          <a
            className={kickOnly ? 'streamers-open-kick' : 'streamers-open-twitch'}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
          >
            {kickOnly ? <KickIcon size={16} /> : <TwitchIcon size={16} />}
            {t(kickOnly ? 'streamers.open_kick' : 'streamers.open_twitch')}
          </a>
        )}
      </header>
      {error && !detail ? (
        <p className="streamers-empty" role="alert">{t('streamers.analytics.error')}</p>
      ) : !detail ? (
        <p className="streamers-empty" role="status">{t('streamers.analytics.loading')}</p>
      ) : (
        <>
          <section className="streamers-elo-stream" aria-labelledby="streamers-elo-stream-title">
            <h3 id="streamers-elo-stream-title">{t('streamers.page.elo_stream')}</h3>
            {sessions.length === 0 ? (
              <p className="streamers-empty">{t('streamers.page.elo_stream_empty')}</p>
            ) : (
              sessions.map((session, index) => (
                <SessionBlock
                  key={`${session.startedAt}-${session.endedAt}`}
                  session={session}
                  index={index}
                  lastLabel={t('streamers.page.last_stream')}
                  pastLabel={t('streamers.page.past_stream')}
                  empty={t('streamers.page.elo_stream_empty')}
                />
              ))
            )}
          </section>
          <h3 className="streamers-profile-daily">{t('streamers.page.daily')}</h3>
          <DayChart series={series} valueOf={(point) => point.viewersAvg} label={t('streamers.page.viewers_day')} tone="twitch" />
          <DayChart series={series} valueOf={(point) => point.elo ?? 0} label={t('streamers.page.elo_day')} tone="elo" />
          <DayChart series={series} valueOf={(point) => point.matches} label={t('streamers.page.matches_day')} tone="kick" />
          <div className="streamers-daytable-wrap">
            <table className="streamers-daytable">
              <thead>
                <tr>
                  <th>{t('streamers.page.history_days')}</th>
                  <th>{t('streamers.page.viewers_day')}</th>
                  <th>{t('streamers.page.elo_day')}</th>
                  <th>{t('streamers.page.matches_day')}</th>
                </tr>
              </thead>
              <tbody>
                {series.map((point) => (
                  <tr key={point.day}>
                    <td>{point.day}</td>
                    <td>{point.viewersAvg.toLocaleString()}</td>
                    <td>{point.elo == null ? '—' : point.elo.toLocaleString()}</td>
                    <td>{point.matches.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!detail.found && <p className="streamers-empty">{t('streamers.page.missing')}</p>}
        </>
      )}
    </div>
  );
}
