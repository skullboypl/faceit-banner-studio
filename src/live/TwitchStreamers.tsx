import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LanguageContext } from '../generator/contexts';
import { getLiveBoard, LIVE_LIST_REFRESH_MS, type LivePlayer } from '../utils/presence';
import { TwitchIcon } from './MemberIcons';

const TWITCH_LOGIN = /^[A-Za-z0-9_]{3,25}$/;
const TOP_LIMIT = 10;

function viewers(player: LivePlayer) {
  return player.twitchStatus?.state === 'live' && Number.isInteger(player.twitchStatus.viewers)
    ? player.twitchStatus.viewers!
    : 0;
}

function channelUrl(player: LivePlayer) {
  return `https://www.twitch.tv/${player.twitch}`;
}

function embedUrl(channel: string) {
  const url = new URL('https://player.twitch.tv/');
  url.searchParams.set('channel', channel);
  url.searchParams.set('parent', window.location.hostname || 'localhost');
  url.searchParams.set('autoplay', 'false');
  url.searchParams.set('muted', 'true');
  return url.toString();
}

function StreamerAvatar({ player }: { player: LivePlayer }) {
  return (
    <span className="streamer-avatar" aria-hidden="true">
      {player.nickname.charAt(0).toUpperCase()}
      {player.avatar && <img src={player.avatar} alt="" loading="lazy" />}
    </span>
  );
}

export function TwitchStreamers() {
  const t = useContext(LanguageContext);
  const [players, setPlayers] = useState<LivePlayer[] | null>(null);
  const [selectedLogin, setSelectedLogin] = useState('');
  const [error, setError] = useState(false);
  const rail = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!t) return;
    const previousTitle = document.title;
    document.title = t('streamers.title');
    let active = true;
    let pending = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const board = await getLiveBoard(controller.signal);
        if (active) {
          setPlayers(board.players);
          setError(false);
        }
      } catch {
        if (active && !controller.signal.aborted) setError(true);
      } finally {
        pending = false;
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, LIVE_LIST_REFRESH_MS);
    const onVisibility = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      document.title = previousTitle;
    };
  }, [t]);

  const linked = useMemo(
    () => (players ?? []).filter((player) =>
      typeof player.twitch === 'string' &&
      TWITCH_LOGIN.test(player.twitch) &&
      player.twitchStatus?.state !== 'missing'
    ),
    [players]
  );
  const live = useMemo(
    () => linked
      .filter((player) => player.twitchStatus?.state === 'live')
      .sort((a, b) => viewers(b) - viewers(a) || a.nickname.localeCompare(b.nickname)),
    [linked]
  );
  const top = live.slice(0, TOP_LIMIT);
  const rest = [
    ...live.slice(TOP_LIMIT),
    ...linked
      .filter((player) => player.twitchStatus?.state !== 'live')
      .sort((a, b) => a.nickname.localeCompare(b.nickname)),
  ];
  const selected = top.find((player) => player.twitch?.toLowerCase() === selectedLogin) ?? top[0];

  useEffect(() => {
    const first = top[0]?.twitch?.toLowerCase() ?? '';
    if (!top.some((player) => player.twitch?.toLowerCase() === selectedLogin)) setSelectedLogin(first);
  }, [selectedLogin, top]);

  if (!t) return null;

  return (
    <div className="streamers-page">
      <aside className="streamers-rule" role="note">
        <TwitchIcon size={20} />
        <p><strong>{t('streamers.how.title')}</strong> {t('streamers.how.body')}</p>
      </aside>

      {error && players === null ? (
        <p className="streamers-empty" role="alert">{t('streamers.error')}</p>
      ) : players === null ? (
        <p className="streamers-empty" role="status">{t('streamers.loading')}</p>
      ) : top.length === 0 ? (
        <section className="streamers-empty streamers-empty--invite">
          <TwitchIcon size={34} />
          <h3>{t('streamers.empty.title')}</h3>
          <p>{t('streamers.empty.body')}</p>
        </section>
      ) : (
        <>
          <section className="streamers-feature" aria-labelledby="featured-stream-title">
            <div className="streamers-feature-head">
              <div>
                <span className="streamers-live-mark"><i /> LIVE</span>
                <h3 id="featured-stream-title">{selected.nickname}</h3>
                <p>{selected.twitchStatus?.title || selected.twitchStatus?.game || t('streamers.now_live')}</p>
              </div>
              <div className="streamers-feature-meta">
                <strong>{viewers(selected).toLocaleString()}</strong>
                <span>{t('streamers.viewers')}</span>
              </div>
            </div>
            <div className="streamers-player-scroll">
              <iframe
                key={selected.twitch}
                className="streamers-player"
                src={embedUrl(selected.twitch!)}
                title={t('streamers.player_title', [selected.nickname])}
                width="100%"
                height="100%"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
            <a className="streamers-open-twitch" href={channelUrl(selected)} target="_blank" rel="noreferrer noopener">
              <TwitchIcon size={16} /> {t('streamers.open_twitch')}
            </a>
          </section>

          <section className="streamers-top" aria-labelledby="streamers-top-title">
            <div className="streamers-section-head">
              <div>
                <span>{t('streamers.ranking')}</span>
                <h3 id="streamers-top-title">{t('streamers.top')}</h3>
              </div>
              {top.length > 1 && (
                <div className="streamers-arrows">
                  <button type="button" aria-label={t('streamers.previous')} onClick={() => rail.current?.scrollBy({ left: -280, behavior: 'smooth' })}>←</button>
                  <button type="button" aria-label={t('streamers.next')} onClick={() => rail.current?.scrollBy({ left: 280, behavior: 'smooth' })}>→</button>
                </div>
              )}
            </div>
            <div className="streamers-rail" ref={rail}>
              {top.map((player, index) => (
                <button
                  type="button"
                  className="streamers-card"
                  aria-pressed={player.twitch === selected.twitch}
                  onClick={() => setSelectedLogin(player.twitch!.toLowerCase())}
                  key={player.twitch}
                >
                  {player.twitchStatus?.thumbnail && <img src={player.twitchStatus.thumbnail} alt="" loading="lazy" />}
                  <span className="streamers-card-shade" />
                  <span className="streamers-card-rank">#{index + 1}</span>
                  <span className="streamers-card-live"><i /> LIVE</span>
                  <span className="streamers-card-name">{player.nickname}</span>
                  <span className="streamers-card-viewers">{viewers(player).toLocaleString()} {t('streamers.viewers')}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {players !== null && rest.length > 0 && (
        <section className="streamers-rest" aria-labelledby="streamers-rest-title">
          <div className="streamers-section-head">
            <div>
              <span>{t('streamers.community')}</span>
              <h3 id="streamers-rest-title">{t('streamers.rest')}</h3>
            </div>
            <strong>{rest.length}</strong>
          </div>
          <ul>
            {rest.map((player) => {
              const isLive = player.twitchStatus?.state === 'live';
              const status = isLive
                ? `${viewers(player).toLocaleString()} ${t('streamers.viewers')}`
                : player.twitchStatus?.state === 'offline'
                  ? t('streamers.offline')
                  : 'TWITCH';
              return (
                <li key={player.twitch}>
                  <StreamerAvatar player={player} />
                  <span className="streamers-rest-person">
                    <strong>{player.nickname}</strong>
                    <small>@{player.twitch}</small>
                  </span>
                  <span className={isLive ? 'streamers-status is-live' : 'streamers-status'}>
                    {status}
                  </span>
                  <a href={channelUrl(player)} target="_blank" rel="noreferrer noopener" aria-label={t('streamers.open_channel', [player.nickname])}>↗</a>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
