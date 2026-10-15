import { CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { averageElo } from '../../../shared/banner-modes.mjs';
import { LevelMark } from '../components/LevelMark';
import { fetchLatestMatch, LiveMatch, PlayerStats, RosterPlayer } from '../utils/faceit_match';
import { mapArt } from './map-art';
import { POPUP_ME_STATS, PopupMeStat, PopupOptions, fontKeysFor, lookFor, popupMinWidth } from './popup-options';

type Phase = 'pre' | 'live' | 'post';

type Props = {
  preview: boolean;
  playerId: string;
  username: string;
  phase: Phase;
  options: PopupOptions;
  translate: (text: string, args?: string[]) => string;
};

const statsLine = ([kills, deaths, assists, adr, hs, mvps]: [number, number, number, number, number, number]): PlayerStats => ({
  kills,
  deaths,
  assists,
  adr,
  hs,
  mvps,
  kd: Math.round((kills / deaths) * 100) / 100,
});

function sample(username: string, phase: Phase): LiveMatch {
  const mine = (name: string, elo: number, level: number, line?: [number, number, number, number, number, number]): RosterPlayer => ({
    nickname: name,
    elo,
    level,
    stats: line && phase === 'post' ? statsLine(line) : undefined,
  });
  const left = [
    mine(username || 'Player', 1874, 8, [22, 14, 6, 91, 54, 4]),
    mine('ropz', 2010, 10, [25, 12, 2, 98, 61, 5]),
    mine('broky', 1766, 7, [14, 16, 5, 70, 38, 1]),
    mine('frozen', 1922, 9, [18, 15, 7, 80, 47, 2]),
    mine('karrigan', 1688, 6, [11, 17, 4, 62, 29, 0]),
  ];
  const right = [
    mine('NiKo', 2144, 10, [20, 17, 2, 88, 58, 3]),
    mine('m0NESY', 2088, 10, [17, 18, 3, 79, 44, 2]),
    mine('huNter', 1890, 8, [15, 17, 6, 71, 40, 1]),
    mine('nexa', 1712, 7, [12, 18, 8, 66, 33, 1]),
    mine('Snax', 1640, 6, [9, 19, 3, 52, 27, 0]),
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
    me: phase === 'post' ? statsLine([22, 14, 6, 91, 54, 4]) : undefined,
  };
}

const ME_LABEL: Record<PopupMeStat, { label: string; value: (me: PlayerStats) => string | number }> = {
  kills: { label: 'K', value: (me) => me.kills },
  deaths: { label: 'D', value: (me) => me.deaths },
  assists: { label: 'A', value: (me) => me.assists },
  kd: { label: 'K/D', value: (me) => me.kd },
  adr: { label: 'ADR', value: (me) => me.adr },
  hs: { label: 'HS%', value: (me) => me.hs },
  mvps: { label: 'MVP', value: (me) => me.mvps },
};

function StripTeam({ side, lead, options }: { side: LiveMatch['sides'][number]; lead: boolean; options: PopupOptions }) {
  return (
    <section className={`popup-strip-team${lead ? ' is-lead' : ''}`}>
      {(options.showTeams || options.showAvg) && (
        <header>
          {options.showTeams && <strong>{side.name}</strong>}
          {options.showAvg && (
            <em>
              {side.avg || '—'} <small>ELO</small>
            </em>
          )}
        </header>
      )}
      {options.showAvatars && (
        <span className="popup-avatars">
          {side.players.map((player) => (
            <span key={player.nickname} className="popup-avatar" title={player.nickname}>
              {player.avatar ? <img src={player.avatar} alt="" loading="lazy" /> : player.nickname.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </span>
      )}
    </section>
  );
}

function Table({
  players,
  username,
  options,
  translate,
}: {
  players: RosterPlayer[];
  username: string;
  options: PopupOptions;
  translate: Props['translate'];
}) {
  const columns = POPUP_ME_STATS.filter((key) => options.me[key]);
  const mine = username.trim().toLowerCase();
  const ranked = [...players].sort((a, b) => (b.stats?.kills ?? 0) - (a.stats?.kills ?? 0));
  return (
    <table className="popup-table">
      <thead>
        <tr>
          <th />
          {columns.map((key) => (
            <th key={key}>{ME_LABEL[key].label}</th>
          ))}
          {options.showElo && <th>ELO</th>}
        </tr>
      </thead>
      <tbody>
        {ranked.map((player) => (
          <tr key={player.nickname} className={options.highlightMe && mine && player.nickname.toLowerCase() === mine ? 'is-me' : undefined}>
            <td>
              <span className="popup-player">
                {options.showAvatars && (
                  <span className="popup-avatar">
                    {player.avatar ? <img src={player.avatar} alt="" loading="lazy" /> : player.nickname.slice(0, 1).toUpperCase()}
                  </span>
                )}
                {options.showLevels && <LevelMark level={player.level || 1} ranking={player.ranking} unranked={player.calibrating} />}
                <span className="popup-nick">{player.nickname}</span>
              </span>
            </td>
            {columns.map((key) => (
              <td key={key} className="stat">
                {player.stats ? ME_LABEL[key].value(player.stats) : '—'}
              </td>
            ))}
            {options.showElo && (
              <td className="stat">
                <span className={player.calibrating ? 'elo-stack' : undefined}>
                  {player.elo > 0 ? player.elo : '—'}
                  {player.calibrating && <small className="elo-known">{translate('widget.elo_known')}</small>}
                </span>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Side({
  side,
  lead,
  username,
  options,
  table,
  translate,
}: {
  side: LiveMatch['sides'][number];
  lead: boolean;
  username: string;
  options: PopupOptions;
  table: boolean;
  translate: Props['translate'];
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
      {table && <Table players={players} username={username} options={options} translate={translate} />}
      {!options.compact && !table && (
        <ol>
          {players.map((player) => (
            <li
              key={player.nickname}
              className={options.highlightMe && mine && player.nickname.toLowerCase() === mine ? 'is-me' : undefined}
            >
              {options.showAvatars && (
                <span className="popup-avatar">
                  {player.avatar ? <img src={player.avatar} alt="" loading="lazy" /> : player.nickname.slice(0, 1).toUpperCase()}
                </span>
              )}
              {options.showLevels && <LevelMark level={player.level || 1} ranking={player.ranking} unranked={player.calibrating} />}
              <span className="popup-nick">{player.nickname}</span>
              {options.showElo && (
                <b className={player.calibrating ? 'elo-stack' : undefined}>
                  {player.elo > 0 ? player.elo : '—'}
                  {player.calibrating && <small className="elo-known">{translate('widget.elo_known')}</small>}
                </b>
              )}
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
  const cardRef = useRef<HTMLElement>(null);
  const [cardWidth, setCardWidth] = useState(0);

  useEffect(() => {
    if (preview) {
      if (!playerId) {
        setMatch(sample(username, phase));
        setVisible(true);
        return;
      }
      let cancel = false;
      fetchLatestMatch(playerId).then((next) => {
        if (cancel) return;
        const real = next && next.sides.some((side) => side.players.length > 0) ? next : undefined;
        setMatch(real ? { ...real, phase } : sample(username, phase));
        setVisible(true);
      });
      return () => {
        cancel = true;
      };
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

  // The card measures itself, so a small OBS source or preview stacks the columns instead of clipping them.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const measure = () => setCardWidth(card.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    return () => observer.disconnect();
  });

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
  const view = lookFor(options, current);
  const title =
    current === 'pre' ? translate('popup.before_title') : current === 'post' ? translate('popup.after_title') : translate('popup.live_title');
  const [left, right] = match.sides;
  const stats = POPUP_ME_STATS.filter((key) => view.me[key]);
  const table =
    view.scoreboard &&
    !view.compact &&
    view.layout !== 'strip' &&
    current === 'post' &&
    match.sides.some((side) => side.players.some((player) => player.stats));
  const minWidth = popupMinWidth(view, current);
  const narrow = view.layout !== 'stack' && cardWidth > 0 && cardWidth < minWidth;

  const style = {
    '--popup-scale': String(view.scale / 100),
    '--popup-width': String(view.widthPct),
    '--popup-radius': `${view.radius}px`,
    '--popup-opacity': String(view.opacity / 100),
    '--popup-map-blur': `${view.mapBlur}px`,
    '--popup-map-opacity': String(view.mapOpacity / 100),
    '--popup-min': `${minWidth}px`,
  } as CSSProperties;
  const sizes = view.fonts[view.layout] ?? {};
  for (const key of fontKeysFor(view.layout)) {
    const percent = sizes[key];
    if (percent !== undefined) (style as Record<string, string>)[`--fs-${key}`] = String(percent / 100);
  }
  const art = view.mapBg ? mapArt(match.map) : undefined;
  const articleStyle = art ? ({ '--popup-map': `url(${art})` } as CSSProperties) : undefined;

  const scoreNode =
    view.showScore &&
    (match.score ? (
      <p className="popup-score" data-winner={match.winner || 'none'}>
        <b>{match.score[0]}</b>
        <i />
        <b>{match.score[1]}</b>
      </p>
    ) : (
      <p className="popup-vs">VS</p>
    ));

  return (
    <div
      className={`match-popup phase-${current}${visible ? ' is-in' : ''}${view.compact ? ' is-compact' : ''}${table ? ' has-table' : ''}${narrow ? ' is-narrow' : ''}`}
      data-layout={view.layout}
      data-position={view.position}
      data-theme={view.theme}
      data-animation={view.animation}
      data-map-bg={art ? 'on' : 'off'}
      style={style}
    >
      <article ref={cardRef} style={articleStyle}>
        <header className="popup-kicker">
          <span className={current === 'live' ? 'live-dot' : undefined}>{title}</span>
          {view.showMap && match.map && <em>{match.map}</em>}
        </header>
        {view.layout === 'strip' ? (
          <div className="popup-strip">
            <StripTeam side={left} lead={match.winner === 'a'} options={view} />
            {scoreNode}
            <StripTeam side={right} lead={match.winner === 'b'} options={view} />
          </div>
        ) : (
          <>
            {scoreNode}
            <div className={`popup-sides${table ? ' has-table' : ''}`}>
              <Side side={left} lead={match.winner === 'a'} username={username} options={view} table={table} translate={translate} />
              <Side side={right} lead={match.winner === 'b'} username={username} options={view} table={table} translate={translate} />
            </div>
          </>
        )}
        {current === 'post' && view.showMe && match.me && stats.length > 0 && (
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
