import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LanguageContext } from '../generator/contexts';
import { getLiveBoard, LIVE_LIST_REFRESH_MS, type LivePlayer } from '../utils/presence';
import { KickIcon, TwitchIcon } from './MemberIcons';
import { applyStreamerMeta, streamerIndexDescription, streamerIndexTitle, streamerPath, streamerSlugOf } from './streamer-seo';
import { StreamerRanking } from './StreamerRanking';

const CHANNEL_LOGIN = /^[A-Za-z0-9_]{3,25}$/;
const TOP_LIMIT = 10;

type Platform = 'twitch' | 'kick';

function hasChannel(player: LivePlayer, platform: Platform) {
  const login = player[platform];
  const status = platform === 'twitch' ? player.twitchStatus : player.kickStatus;
  return typeof login === 'string' && CHANNEL_LOGIN.test(login) && status?.state !== 'missing';
}

function liveViewers(player: LivePlayer, platform: Platform) {
  const status = platform === 'twitch' ? player.twitchStatus : player.kickStatus;
  return status?.state === 'live' && Number.isInteger(status.viewers) ? status.viewers! : status?.state === 'live' ? 0 : -1;
}

function featuredPlatform(player: LivePlayer): Platform {
  const twitchLive = liveViewers(player, 'twitch');
  const kickLive = liveViewers(player, 'kick');
  if (twitchLive >= 0 && twitchLive >= kickLive) return 'twitch';
  if (kickLive >= 0) return 'kick';
  return hasChannel(player, 'twitch') ? 'twitch' : 'kick';
}

function viewers(player: LivePlayer) {
  return Math.max(liveViewers(player, 'twitch'), liveViewers(player, 'kick'), 0);
}

function isLive(player: LivePlayer) {
  return liveViewers(player, 'twitch') >= 0 || liveViewers(player, 'kick') >= 0;
}

function channelUrl(player: LivePlayer, platform = featuredPlatform(player)) {
  return platform === 'kick' ? `https://kick.com/${player.kick}` : `https://www.twitch.tv/${player.twitch}`;
}

function playerKey(player: LivePlayer) {
  return `${featuredPlatform(player)}:${(player[featuredPlatform(player)] || '').toLowerCase()}`;
}

function embedUrl(channel: string) {
  const url = new URL('https://player.twitch.tv/');
  url.searchParams.set('channel', channel);
  url.searchParams.set('parent', window.location.hostname || 'localhost');
  url.searchParams.set('autoplay', 'true');
  url.searchParams.set('muted', 'true');
  return url.toString();
}

const TWITCH_MIN_WIDTH = 400;
const TWITCH_MIN_HEIGHT = 300;

/** Twitch refuses a player under 400×300. Scale that frame into the slot so the page stays at the viewport width. */
export function twitchPlayerFrame(containerWidth: number) {
  if (containerWidth < 1) return null;
  const displayHeight = (containerWidth * 9) / 16;
  const scaleNeed = Math.max(TWITCH_MIN_WIDTH / containerWidth, TWITCH_MIN_HEIGHT / displayHeight, 1);
  return {
    width: containerWidth * scaleNeed,
    height: displayHeight * scaleNeed,
    scale: 1 / scaleNeed,
  };
}

function FeaturedPlayer({ player, title }: { player: LivePlayer; title: string }) {
  const platform = featuredPlatform(player);
  const box = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<ReturnType<typeof twitchPlayerFrame>>(null);
  const channel = platform === 'kick' ? player.kick! : player.twitch!;

  useEffect(() => {
    const node = box.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const measure = () => setFrame(platform === 'twitch' ? twitchPlayerFrame(node.clientWidth) : null);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [platform]);

  const src = platform === 'kick' ? `https://player.kick.com/${encodeURIComponent(channel)}` : embedUrl(channel);

  return (
    <div className="streamers-player-slot" ref={box} data-platform={platform}>
      <iframe
        key={`${platform}:${channel}`}
        className="streamers-player"
        src={src}
        title={title}
        style={frame ? { width: `${frame.width}px`, height: `${frame.height}px`, transform: `scale(${frame.scale})` } : undefined}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
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
    applyStreamerMeta(streamerIndexTitle(t('streamers.analytics.title')), streamerIndexDescription(t('streamers.index.description')));
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
    () => (players ?? []).filter((player) => hasChannel(player, 'twitch') || hasChannel(player, 'kick')),
    [players]
  );
  const live = useMemo(
    () => linked
      .filter(isLive)
      .sort((a, b) => viewers(b) - viewers(a) || a.nickname.localeCompare(b.nickname)),
    [linked]
  );
  const top = live.slice(0, TOP_LIMIT);
  const moreLive = live.slice(TOP_LIMIT);
  const offline = useMemo(
    () =>
      linked
        .filter((player) => !isLive(player) && streamerSlugOf(player))
        .sort((a, b) => a.nickname.localeCompare(b.nickname)),
    [linked]
  );
  const selected = top.find((player) => playerKey(player) === selectedLogin) ?? top[0];

  useEffect(() => {
    const first = top[0] ? playerKey(top[0]) : '';
    if (!top.some((player) => playerKey(player) === selectedLogin)) setSelectedLogin(first);
  }, [selectedLogin, top]);

  if (!t) return null;

  return (
    <div className="streamers-page">
      <aside className="streamers-rule" role="note">
        <span className="streamers-rule-brands" aria-hidden="true">
          <TwitchIcon size={20} />
          <KickIcon size={20} />
        </span>
        <p><strong>{t('streamers.how.title')}</strong> {t('streamers.how.body')}</p>
      </aside>
      <StreamerRanking />

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
                <p>{(featuredPlatform(selected) === 'kick' ? selected.kickStatus : selected.twitchStatus)?.title
                  || (featuredPlatform(selected) === 'kick' ? selected.kickStatus : selected.twitchStatus)?.game
                  || t('streamers.now_live')}</p>
              </div>
              <div className="streamers-feature-meta">
                <strong>{viewers(selected).toLocaleString()}</strong>
                <span>{t('streamers.viewers')}</span>
              </div>
            </div>
            <FeaturedPlayer
              player={selected}
              title={t(featuredPlatform(selected) === 'kick' ? 'streamers.player_title_kick' : 'streamers.player_title', [selected.nickname])}
            />
            <a
              className={featuredPlatform(selected) === 'kick' ? 'streamers-open-kick' : 'streamers-open-twitch'}
              href={channelUrl(selected)}
              target="_blank"
              rel="noreferrer noopener"
            >
              {featuredPlatform(selected) === 'kick' ? <KickIcon size={16} /> : <TwitchIcon size={16} />}
              {t(featuredPlatform(selected) === 'kick' ? 'streamers.open_kick' : 'streamers.open_twitch')}
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
                  aria-pressed={playerKey(player) === playerKey(selected)}
                  onClick={() => setSelectedLogin(playerKey(player))}
                  key={playerKey(player)}
                >
                  {(featuredPlatform(player) === 'kick' ? player.kickStatus : player.twitchStatus)?.thumbnail && (
                    <img src={(featuredPlatform(player) === 'kick' ? player.kickStatus : player.twitchStatus)?.thumbnail} alt="" loading="lazy" />
                  )}
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

      {players !== null && moreLive.length > 0 && (
        <section className="streamers-rest" aria-labelledby="streamers-rest-title">
          <div className="streamers-section-head">
            <div>
              <span>{t('streamers.community')}</span>
              <h3 id="streamers-rest-title">{t('streamers.rest')}</h3>
            </div>
            <strong>{moreLive.length}</strong>
          </div>
          <ul>
            {moreLive.map((player) => {
              const platform = featuredPlatform(player);
              const login = player[platform];
              return (
                <li key={playerKey(player)}>
                  <StreamerAvatar player={player} />
                  <span className="streamers-rest-person">
                    <strong>{player.nickname}</strong>
                    <small>@{login}</small>
                  </span>
                  <span className="streamers-status is-live">
                    {`${viewers(player).toLocaleString()} ${t('streamers.viewers')}`}
                  </span>
                  <a
                    href={channelUrl(player, platform)}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={t(platform === 'kick' ? 'streamers.open_channel_kick' : 'streamers.open_channel', [player.nickname])}
                  >
                    ↗
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {players !== null && offline.length > 0 && (
        <section className="streamers-offline" aria-labelledby="streamers-offline-title">
          <h3 id="streamers-offline-title">{t('streamers.offline_heading')}</h3>
          <p className="streamers-offline-nicks">
            {offline.map((player, index) => {
              const slug = streamerSlugOf(player);
              return (
                <span key={playerKey(player)}>
                  {index > 0 ? <span aria-hidden="true"> · </span> : null}
                  <Link to={streamerPath(slug)}>{player.nickname}</Link>
                </span>
              );
            })}
          </p>
        </section>
      )}
    </div>
  );
}
