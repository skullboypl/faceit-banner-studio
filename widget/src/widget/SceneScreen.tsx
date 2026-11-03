import { CSSProperties, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  type SceneKind,
  type SceneOptions,
  type SceneSocial,
  formatCountdown,
  sceneHasCountdown,
  socialAddress,
} from './scene-options';

export type SceneData = {
  username: string;
  avatar?: string;
  elo: number;
  level: number;
  calibrating: boolean;
  /** Regional place, only for the top 1000. */
  ranking?: number;
  levelIcon: ReactNode;
  /** Averages of the recent matches; null when FACEIT gave nothing. */
  recent: {
    kd: string | null;
    adr: string | null;
    hs: string | null;
    winRate: string | null;
    matches: number;
  };
  /** Since the session started: the same numbers the banner header counts. */
  session: {
    wins: number;
    losses: number;
    eloDiff: number;
    kd: number | null;
    form: ('W' | 'L')[];
  };
};

type Props = {
  preview: boolean;
  kind: SceneKind;
  options: SceneOptions;
  data: SceneData;
  translate: (key: string, args?: string[]) => string;
};

const EMBERS = 26;
const TICK_MS = 1000;

/** Fixed spread for the embers, so a reload paints the same sky and nothing depends on Math.random. */
const emberStyle = (index: number): CSSProperties =>
  ({
    '--x': `${(index * 37) % 100}%`,
    '--size': `${0.35 + ((index * 13) % 7) / 10}cqh`,
    '--rise': `${11 + ((index * 7) % 9)}s`,
    '--delay': `${-((index * 23) % 17)}s`,
    '--drift': `${((index * 29) % 9) - 4}cqw`,
  }) as CSSProperties;

const SOCIAL_PATHS: Record<Exclude<SceneSocial, 'kick'>, string[]> = {
  twitch: ['M5 4l-2 4v11h4v3l3 -3h4l5 -5v-10z', 'M10 9l0 3', 'M14 9l0 3'],
  youtube: [
    'M2 8.5a2.5 2.5 0 0 1 2.5 -2.5h15a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1 -2.5 2.5h-15a2.5 2.5 0 0 1 -2.5 -2.5z',
    'M10 9l5 3l-5 3z',
  ],
  x: [
    'M4 4l11.733 16h4.267l-11.733 -16z',
    'M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772',
  ],
  instagram: [
    'M4 8a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4z',
    'M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0',
    'M16.5 7.5v.01',
  ],
  tiktok: ['M9 12a4 4 0 1 0 4 4v-9a5 5 0 0 0 5 5'],
  discord: [
    'M8 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0',
    'M14 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0',
    'M15.5 17c0 1 1.5 3 2 3c1.5 0 2.833 -1.667 3.5 -3c.667 -1.667 .5 -5.833 -1.5 -11.5c-1.457 -1.015 -3 -1.34 -4.5 -1.5l-.972 1.923a11.913 11.913 0 0 0 -4.053 0l-.975 -1.923c-1.5 .16 -3.043 .485 -4.5 1.5c-2 5.667 -2.167 9.833 -1.5 11.5c.667 1.333 2 3 3.5 3c.5 0 2 -2 2 -3',
    'M7 16.5c3.5 1 6.5 1 10 0',
  ],
};

function SocialIcon({ kind }: { kind: SceneSocial }) {
  if (kind === 'kick') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M4 3h6.2v7.1L16.6 3H24l-7.8 8.4L24 21h-7.3l-6.5-7.2V21H4z" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {SOCIAL_PATHS[kind].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Seconds left on the scene timer; it starts when the OBS source loads (or the scene is shown again). */
function useCountdown(active: boolean, minutes: number) {
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setStartedAt(Date.now());
    setNow(Date.now());
  }, [active, minutes]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [active]);
  return Math.max(0, startedAt + minutes * 60_000 - now);
}

function Background({ animation }: { animation: SceneOptions['animation'] }) {
  return (
    <div className={`scene-bg scene-bg--${animation}`} aria-hidden="true">
      {animation === 'aurora' && (
        <>
          <i className="scene-blob scene-blob--a" />
          <i className="scene-blob scene-blob--b" />
          <i className="scene-blob scene-blob--c" />
        </>
      )}
      {animation === 'grid' && (
        <>
          <i className="scene-horizon" />
          <i className="scene-floor" />
        </>
      )}
      {animation === 'embers' && (
        <>
          <i className="scene-blob scene-blob--a" />
          {Array.from({ length: EMBERS }, (_, index) => (
            <i key={index} className="scene-ember" style={emberStyle(index)} />
          ))}
        </>
      )}
      <i className="scene-vignette" />
    </div>
  );
}

const signed = (value: number) => (value > 0 ? `+${value}` : String(value));

function PlayerCard({
  kind,
  data,
  translate,
}: {
  kind: SceneKind;
  data: SceneData;
  translate: Props['translate'];
}) {
  const { session, recent } = data;
  const played = session.wins + session.losses;
  /* The end of a stream sums up the session; before it and in a break the recent form says more */
  const sessionFirst = kind === 'ending' || (kind === 'brb' && played > 0);
  const recentCells = [
    ['K/D', recent.kd],
    ['ADR', recent.adr],
    ['HS', recent.hs ? `${recent.hs}%` : null],
    [translate('scene.winrate'), recent.winRate ? `${recent.winRate}%` : null],
  ].filter((cell): cell is [string, string] => Boolean(cell[1]));
  const sessionCells: [string, string, string?][] = [
    [translate('scene.record'), `${session.wins}–${session.losses}`],
    [
      translate('scene.elo_today'),
      signed(session.eloDiff),
      session.eloDiff > 0
        ? 'is-up'
        : session.eloDiff < 0
          ? 'is-down'
          : undefined,
    ],
    ...(session.kd !== null
      ? [['K/D', session.kd.toFixed(2)] as [string, string]]
      : []),
  ];

  const cells = sessionFirst ? (played > 0 ? sessionCells : []) : recentCells;
  const label = sessionFirst
    ? played > 0
      ? translate('scene.today')
      : translate('scene.no_matches')
    : translate('scene.recent', [String(recent.matches || 20)]);
  /* Recent averages with nothing in them say nothing; "no matches today" is worth saying */
  const showStats = cells.length > 0 || sessionFirst;

  return (
    <div className="scene-card">
      <div className="scene-card-player">
        <span className="scene-avatar">
          {data.avatar ? (
            <img src={data.avatar} alt="" />
          ) : (
            <span>{data.username.slice(0, 1).toUpperCase()}</span>
          )}
        </span>
        <div className="scene-card-name">
          <strong>{data.username}</strong>
          <span className="scene-card-elo">
            <span className="scene-level" aria-hidden="true">
              {data.levelIcon}
            </span>
            <b>{data.elo}</b>
            <small>ELO</small>
            {data.ranking ? <em>#{data.ranking}</em> : null}
          </span>
        </div>
      </div>
      {showStats && (
        <div className="scene-card-stats">
          <span className="scene-card-label">{label}</span>
          {cells.length > 0 && (
            <div className="scene-cells">
              {cells.map(([name, value, tone]) => (
                <span
                  className={`scene-cell${tone ? ` ${tone}` : ''}`}
                  key={name}
                >
                  <b>{value}</b>
                  <small>{name}</small>
                </span>
              ))}
            </div>
          )}
          {sessionFirst && session.form.length > 0 && (
            <div className="scene-form" aria-label={translate('scene.today')}>
              {session.form.slice(0, 10).map((mark, index) => (
                <i key={index} className={mark === 'W' ? 'is-win' : 'is-loss'}>
                  {mark}
                </i>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** A full 1920 x 1080 scene: starting soon, be right back, or the end of the stream. */
export function SceneScreen({
  preview,
  kind,
  options,
  data,
  translate,
}: Props) {
  const timed = sceneHasCountdown(kind, options.countdown);
  const left = useCountdown(timed, options.countdown);
  const title = options.titles[kind] || translate(`scene.${kind}.title`);
  const note = options.notes[kind] || translate(`scene.${kind}.note`);
  const words = useMemo(() => title.split(/\s+/).filter(Boolean), [title]);

  return (
    <div
      className={`scene-screen scene-screen--${kind} chat-${options.chat ? options.chatSide : 'none'}`}
      data-scene={kind}
    >
      <Background animation={options.animation} />
      <main className="scene-main">
        <div className="scene-head">
          <span className="scene-badge">
            <i className={kind === 'ending' ? 'is-off' : ''} />
            {translate(`scene.badge.${kind}`)}
            {data.username ? <b>{data.username}</b> : null}
          </span>
          <h1 className="scene-title" aria-label={title}>
            {words.map((word, index) => (
              <span
                key={`${word}-${index}`}
                style={{ '--i': index } as CSSProperties}
                aria-hidden="true"
              >
                {word}
              </span>
            ))}
          </h1>
          {note && <p className="scene-note">{note}</p>}
          {timed && (
            <div
              className={`scene-timer${left === 0 ? ' is-done' : ''}`}
              role="timer"
            >
              <small>{translate(`scene.countdown.${kind}`)}</small>
              <b>
                {left === 0
                  ? translate(`scene.countdown.done.${kind}`)
                  : formatCountdown(left)}
              </b>
            </div>
          )}
        </div>
        <div className="scene-foot">
          {/* No card until FACEIT has answered: a card of zeros looks broken on stream */}
          {options.stats && data.username && data.elo > 0 && (
            <PlayerCard kind={kind} data={data} translate={translate} />
          )}
          {options.socials.length > 0 && (
            <ul className="scene-socials">
              {options.socials.map((social, index) => (
                <li key={social.kind} style={{ '--i': index } as CSSProperties}>
                  <span
                    className={`scene-social-icon scene-social-icon--${social.kind}`}
                  >
                    <SocialIcon kind={social.kind} />
                  </span>
                  <span>
                    <b>{social.handle}</b>
                    <small>{socialAddress(social.kind, social.handle)}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      {options.chat && (
        <aside className="scene-chat" aria-label={translate('scene.chat')}>
          <header>
            <i />
            {translate('scene.chat')}
          </header>
          {/* OBS puts the chat source here; only the studio shows where */}
          {preview && (
            <p className="scene-chat-hint">{translate('scene.chat.hint')}</p>
          )}
        </aside>
      )}
    </div>
  );
}
