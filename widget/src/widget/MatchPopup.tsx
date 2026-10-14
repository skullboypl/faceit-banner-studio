import { CSSProperties, useEffect, useRef, useState } from 'react';
import { averageElo } from '../../../shared/banner-modes.mjs';
import { LevelMark } from '../components/LevelMark';
import { fetchLatestMatch, LiveMatch, RosterPlayer } from '../utils/faceit_match';
import { POPUP_ME_STATS, PopupMeStat, PopupOptions } from './popup-options';

type Phase = 'pre' | 'live' | 'post';

type Props = {
  preview: boolean;
  playerId: string;
  username: string;
  phase: Phase;
  options: PopupOptions;
  translate: (text: string, args?: string[]) => string;
};

function sample(username: string, phase: Phase): LiveMatch {
  const mine = (name: string, elo: number, level: number): RosterPlayer => ({
    nickname: name,
    elo,
    level,
  });
  const left = [
    mine(username || 'Player', 1874, 8),
    mine('ropz', 2010, 10),
    mine('broky', 1766, 7),
    mine('frozen', 1922, 9),
    mine('karrigan', 1688, 6),
  ];
  const right = [
    mine('NiKo', 2144, 10),
    mine('m0NESY', 2088, 10),
    mine('huNter', 1890, 8),
    mine('nexa', 1712, 7),
    mine('Snax', 1640, 6),
  ];
  return {
    id: `sample-${phase}`,
    phase,
    map: 'mirage',
    score: phase === 'post' ? [13, 9] : phase === 'live' ? [7, 6] : undefined,
    winner: phase === 'post' ? 'a' : undefined,
    sides: [
      { name: 'A', players: left, avg: averageElo(left) },
      { name: 'B', players: right, avg: averageElo(right) },
    ],
    me: phase === 'post' ? { kills: 22, deaths: 14, assists: 6, adr: 91, kd: 1.57, hs: 54, mvps: 4 } : undefined,
  };
}

const ME_LABEL: Record<PopupMeStat, { label: string; value: (me: NonNullable<LiveMatch['me']>) => string | number }> = {
  kills: { label: 'K', value: (me) => me.kills },
  deaths: { label: 'D', value: (me) => me.deaths },
  assists: { label: 'A', value: (me) => me.assists },
  kd: { label: 'K/D', value: (me) => me.kd },
  adr: { label: 'ADR', value: (me) => me.adr },
  hs: { label: 'HS%', value: (me) => me.hs },
  mvps: { label: 'MVP', value: (me) => me.mvps },
};

function Side({
  side,
  lead,
  username,
  options,
}: {
  side: LiveMatch['sides'][number];
  lead: boolean;
  username: string;
  options: PopupOptions;
}) {
  const players = options.sortElo ? [...side.players].sort((a, b) => b.elo - a.elo) : side.players;
  const mine = username.trim().toLowerCase();
  const showHeader = options.showTeams || options.showAvg;
  return (
    <section className={lead ? 'is-lead' : undefined}>
      {showHeader && (
        <header>
          {options.showTeams && <strong>{side.name}</strong>}
          {options.showAvg && (
            <em>
              {side.avg || '—'} <small>ELO</small>
            </em>
          )}
        </header>
      )}
      {!options.compact && (
        <ol>
          {players.map((player) => (
            <li
              key={player.nickname}
              className={options.highlightMe && mine && player.nickname.toLowerCase() === mine ? 'is-me' : undefined}
            >
              {options.showLevels && <LevelMark level={player.level || 1} />}
              <span>{player.nickname}</span>
              {options.showElo && <b>{player.elo > 0 ? player.elo : '—'}</b>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function MatchPopup({ preview, playerId, username, phase, options, translate }: Props) {
  const [match, setMatch] = useState<LiveMatch | undefined>(() => (preview ? sample(username, phase) : undefined));
  const [visible, setVisible] = useState(preview);
  const shown = useRef('');
  const hideTimer = useRef<number>();
  const showTimer = useRef<number>();

  useEffect(() => {
    if (preview) {
      setMatch(sample(username, phase));
      setVisible(true);
      return;
    }
    let cancel = false;
    const load = () => {
      fetchLatestMatch(playerId).then((next) => {
        if (!cancel) setMatch(next);
      });
    };
    load();
    const timer = window.setInterval(load, 20_000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [preview, playerId, phase, username]);

  const enabled =
    match?.phase === 'pre'
      ? options.pre
      : match?.phase === 'live'
        ? options.live
        : match?.phase === 'post'
          ? options.post
          : false;
  const stale =
    !preview &&
    match?.phase === 'post' &&
    typeof match.finishedAt === 'number' &&
    Date.now() - match.finishedAt * 1000 > 3 * 60_000;

  useEffect(() => {
    if (preview) return;
    if (!match || !enabled || stale || match.phase === 'idle') {
      setVisible(false);
      return;
    }
    const token = `${match.id}:${match.phase}`;
    if (shown.current === token) return;
    shown.current = token;
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
    showTimer.current = window.setTimeout(() => {
      setVisible(true);
      hideTimer.current = window.setTimeout(() => setVisible(false), Math.max(6, options.seconds) * 1000);
    }, options.delay * 1000);
  }, [preview, match, enabled, stale, options.seconds, options.delay]);

  useEffect(
    () => () => {
      window.clearTimeout(showTimer.current);
      window.clearTimeout(hideTimer.current);
    },
    []
  );

  if (!preview && !visible) return null;
  if (!match || match.phase === 'idle') return null;
  const current = match.phase as Phase;
  const title =
    current === 'pre' ? translate('popup.before_title') : current === 'post' ? translate('popup.after_title') : translate('popup.live_title');
  const [left, right] = match.sides;
  const stats = POPUP_ME_STATS.filter((key) => options.me[key]);
  const style = {
    '--popup-scale': String(options.scale / 100),
    '--popup-width': `${options.width}px`,
    '--popup-radius': `${options.radius}px`,
    '--popup-opacity': String(options.opacity / 100),
  } as CSSProperties;

  return (
    <div
      className={`match-popup phase-${current}${visible ? ' is-in' : ''}${options.compact ? ' is-compact' : ''}`}
      data-position={options.position}
      data-theme={options.theme}
      data-animation={options.animation}
      style={style}
    >
      <article>
        <header className="popup-kicker">
          <span className={current === 'live' ? 'live-dot' : undefined}>{title}</span>
          {options.showMap && match.map && <em>{match.map}</em>}
        </header>
        {options.showScore &&
          (match.score ? (
            <p className="popup-score" data-winner={match.winner || 'none'}>
              <b>{match.score[0]}</b>
              <i />
              <b>{match.score[1]}</b>
            </p>
          ) : (
            <p className="popup-vs">VS</p>
          ))}
        <div className="popup-sides">
          <Side side={left} lead={match.winner === 'a'} username={username} options={options} />
          <Side side={right} lead={match.winner === 'b'} username={username} options={options} />
        </div>
        {current === 'post' && options.showMe && match.me && stats.length > 0 && (
          <footer className="popup-me">
            {stats.map((key) => (
              <span key={key}>
                <b>{ME_LABEL[key].value(match.me!)}</b> {ME_LABEL[key].label}
              </span>
            ))}
          </footer>
        )}
      </article>
    </div>
  );
}
