import {
  CSSProperties,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { MAP_ART, mapStillLayers } from './map-art';
import {
  type SceneKind,
  type SceneOptions,
  type ScenePart,
  type SceneSocial,
  SCENE_MOTION_FACTOR,
  formatCountdown,
  levelProgress,
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
    /** null when the session began on this load, so its starting ELO is unknown. */
    eloDiff: number | null;
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

type Cell = {
  id: ScenePart;
  label: string;
  value: string;
  fill?: number;
  tone?: 'is-up' | 'is-down';
};

const EMBERS = 26;
const RAYS = 14;
const TICK_MS = 1000;
const COUNT_MS = 1400;
const COUNT_STEP_MS = 30;
/** How far below the real ELO the counter starts: enough to see it run, short enough to read. */
const COUNT_FROM = 260;

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

/** Time left on the scene timer; it starts when the OBS source loads (or the scene is shown again). */
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

/** The ELO runs up to its value when it first appears and when it changes, easing out at the end. */
export function useCountUp(target: number) {
  const [shown, setShown] = useState(() => Math.max(0, target - COUNT_FROM));
  const from = useRef(shown);
  useEffect(() => {
    const start = Date.now();
    const origin = from.current;
    if (origin === target) return;
    const timer = window.setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / COUNT_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(origin + (target - origin) * eased);
      from.current = value;
      setShown(value);
      if (t >= 1) window.clearInterval(timer);
    }, COUNT_STEP_MS);
    return () => window.clearInterval(timer);
  }, [target]);
  return shown;
}

function Background({
  animation,
  map,
  mapBlur,
  dim,
}: Pick<SceneOptions, 'animation' | 'map' | 'mapBlur' | 'dim'>) {
  const still = map ? MAP_ART[map] : undefined;
  return (
    <div
      className={`scene-bg scene-bg--${animation}${still ? ' has-map' : ''}`}
      aria-hidden="true"
    >
      {still && (
        <i
          className="scene-map"
          style={
            {
              backgroundImage: mapStillLayers(still),
              '--blur': `${mapBlur}px`,
            } as CSSProperties
          }
        />
      )}
      {(animation === 'aurora' || animation === 'embers') && (
        <>
          <i className="scene-blob scene-blob--a" />
          {animation === 'aurora' && <i className="scene-blob scene-blob--b" />}
          {animation === 'aurora' && <i className="scene-blob scene-blob--c" />}
        </>
      )}
      {animation === 'grid' && (
        <>
          <i className="scene-horizon" />
          <i className="scene-floor" />
        </>
      )}
      {animation === 'embers' &&
        Array.from({ length: EMBERS }, (_, index) => (
          <i key={index} className="scene-ember" style={emberStyle(index)} />
        ))}
      {animation === 'rays' && <i className="scene-rays" />}
      {animation === 'waves' && (
        <svg
          className="scene-waves"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
        >
          <path
            className="scene-wave scene-wave--a"
            d="M0 200 C 240 140 480 260 720 200 C 960 140 1200 260 1440 200 V 320 H 0 Z"
          />
          <path
            className="scene-wave scene-wave--b"
            d="M0 230 C 240 280 480 170 720 230 C 960 290 1200 170 1440 230 V 320 H 0 Z"
          />
          <path
            className="scene-wave scene-wave--c"
            d="M0 260 C 240 220 480 300 720 260 C 960 220 1200 300 1440 260 V 320 H 0 Z"
          />
        </svg>
      )}
      <i className="scene-vignette" />
      {dim > 0 && <i className="scene-dim" style={{ opacity: dim / 100 }} />}
    </div>
  );
}

const signed = (value: number) => (value > 0 ? `+${value}` : String(value));
const ratio = (value: string | null, max: number) =>
  value === null ? 0 : Math.min(1, Math.max(0, Number.parseFloat(value) / max));

/** Recent averages and today's session, each kept to the parts switched on. */
export function sceneCells(
  data: SceneData,
  parts: ReadonlySet<ScenePart>,
  translate: Props['translate']
) {
  const { recent, session } = data;
  const drafts: (Omit<Cell, 'value'> & { value: string | null })[] = [
    { id: 'kd', label: 'K/D', value: recent.kd, fill: ratio(recent.kd, 2) },
    {
      id: 'adr',
      label: 'ADR',
      value: recent.adr,
      fill: ratio(recent.adr, 120),
    },
    {
      id: 'hs',
      label: 'HS',
      value: recent.hs ? `${recent.hs}%` : null,
      fill: ratio(recent.hs, 100),
    },
    {
      id: 'winrate',
      label: translate('scene.winrate'),
      value: recent.winRate ? `${recent.winRate}%` : null,
      fill: ratio(recent.winRate, 100),
    },
  ];
  const recentCells = drafts.filter(
    (cell): cell is Cell => cell.value !== null && parts.has(cell.id)
  );
  const played = session.wins + session.losses;
  const sessionAll: Cell[] = [
    {
      id: 'record',
      label: translate('scene.record'),
      value: `${session.wins}–${session.losses}`,
    },
    ...(session.eloDiff !== null
      ? [
          {
            id: 'elochange' as const,
            label: translate('scene.elo_today'),
            value: signed(session.eloDiff),
            tone:
              session.eloDiff > 0
                ? ('is-up' as const)
                : session.eloDiff < 0
                  ? ('is-down' as const)
                  : undefined,
          },
        ]
      : []),
    ...(session.kd !== null
      ? [
          {
            id: 'sessionkd' as const,
            label: `K/D · ${translate('scene.today')}`,
            value: session.kd.toFixed(2),
          },
        ]
      : []),
  ];
  const sessionCells =
    played > 0 ? sessionAll.filter((cell) => parts.has(cell.id)) : [];
  return {
    recentCells,
    sessionCells,
    played,
    form: parts.has('form') ? session.form.slice(0, 10) : [],
  };
}

function Cells({ cells, bars }: { cells: Cell[]; bars: boolean }) {
  return (
    <div className="scene-cells">
      {cells.map((cell) => (
        <span
          className={`scene-cell${cell.tone ? ` ${cell.tone}` : ''}`}
          key={cell.id}
        >
          <b>{cell.value}</b>
          <small>{cell.label}</small>
          {bars && cell.fill !== undefined && (
            <i
              className="scene-cell-bar"
              style={{ '--fill': cell.fill } as CSSProperties}
              aria-hidden="true"
            />
          )}
        </span>
      ))}
    </div>
  );
}

/** The streamer: avatar, name, ELO and level progress, then the numbers the parts allow. */
function Player({
  kind,
  options,
  data,
  translate,
}: {
  kind: SceneKind;
  options: SceneOptions;
  data: SceneData;
  translate: Props['translate'];
}) {
  const { parts, theme } = options;
  const elo = useCountUp(data.elo);
  const { progress, toNext, nextLevel } = levelProgress(data.elo, data.level);
  const { recentCells, sessionCells, played, form } = sceneCells(
    data,
    parts,
    translate
  );
  const bars = theme === 'broadcast';
  const recentGroup = recentCells.length > 0 && (
    <div className="scene-group" key="recent">
      <span className="scene-group-label">
        {translate('scene.recent', [String(data.recent.matches || 20)])}
      </span>
      <Cells cells={recentCells} bars={bars} />
    </div>
  );
  const sessionWanted =
    parts.has('record') ||
    parts.has('elochange') ||
    parts.has('sessionkd') ||
    parts.has('form');
  const sessionGroup = sessionWanted &&
    (sessionCells.length > 0 || form.length > 0 || kind === 'ending') && (
      <div className="scene-group" key="session">
        <span className="scene-group-label">
          {played > 0
            ? translate('scene.today')
            : translate('scene.no_matches')}
        </span>
        {sessionCells.length > 0 && <Cells cells={sessionCells} bars={false} />}
        {form.length > 0 && (
          <div className="scene-form" aria-label={translate('scene.today')}>
            {form.map((mark, index) => (
              <i
                key={index}
                className={mark === 'W' ? 'is-win' : 'is-loss'}
                style={{ '--i': index } as CSSProperties}
              >
                {mark}
              </i>
            ))}
          </div>
        )}
      </div>
    );
  /* The end of a stream leads with the session; before it and in a break the recent form says more */
  const groups =
    kind === 'ending'
      ? [sessionGroup, recentGroup]
      : [recentGroup, sessionGroup];

  return (
    <section className="scene-player" aria-label={data.username}>
      {theme === 'spotlight' && (
        <div className="scene-spot-rays" aria-hidden="true">
          {Array.from({ length: RAYS }, (_, index) => (
            <i
              key={index}
              style={{ '--r': `${(360 / RAYS) * index}deg` } as CSSProperties}
            />
          ))}
        </div>
      )}
      <div className="scene-player-id">
        {parts.has('avatar') && (
          <span className="scene-avatar">
            <i className="scene-avatar-ring" aria-hidden="true" />
            <span className="scene-avatar-photo">
              {data.avatar ? (
                <img src={data.avatar} alt="" />
              ) : (
                <span>{data.username.slice(0, 1).toUpperCase()}</span>
              )}
            </span>
            {parts.has('level') && (
              <span className="scene-avatar-level" aria-hidden="true">
                {data.levelIcon}
              </span>
            )}
          </span>
        )}
        <div className="scene-player-text">
          <strong className="scene-player-name">{data.username}</strong>
          <div className="scene-elo">
            {!parts.has('avatar') && parts.has('level') && (
              <span className="scene-elo-level" aria-hidden="true">
                {data.levelIcon}
              </span>
            )}
            <b data-elo={data.elo}>{elo}</b>
            <small>ELO</small>
            {parts.has('rank') && data.ranking ? (
              <em>#{data.ranking}</em>
            ) : null}
          </div>
          {parts.has('progress') && !data.calibrating && (
            <div className="scene-progress">
              <i
                style={{ '--p': progress } as CSSProperties}
                aria-hidden="true"
              />
              <span>
                {toNext !== null && nextLevel !== null
                  ? translate('scene.to_level', [
                      String(toNext),
                      String(nextLevel),
                    ])
                  : translate('scene.max_level')}
              </span>
            </div>
          )}
        </div>
      </div>
      {groups.some(Boolean) && <div className="scene-groups">{groups}</div>}
    </section>
  );
}

/** The broadcast theme runs the numbers and the socials along the bottom, like a sports channel. */
function Ticker({
  options,
  data,
  translate,
}: {
  options: SceneOptions;
  data: SceneData;
  translate: Props['translate'];
}) {
  const { recentCells, sessionCells } = sceneCells(
    data,
    options.parts,
    translate
  );
  const items = [
    ...(data.username && data.elo > 0
      ? [`${data.username} · ${data.elo} ELO`]
      : []),
    ...recentCells.map((cell) => `${cell.label} ${cell.value}`),
    ...sessionCells.map((cell) => `${cell.label} ${cell.value}`),
    ...(options.parts.has('socials')
      ? options.socials.map((social) =>
          socialAddress(social.kind, social.handle)
        )
      : []),
  ];
  if (!items.length) return null;
  /* Twice in a row, so the loop has no seam */
  const line = [...items, ...items];
  return (
    <div className="scene-ticker" aria-hidden="true">
      <span className="scene-ticker-tag">FACEIT</span>
      <div className="scene-ticker-track">
        <div className="scene-ticker-run">
          {line.map((item, index) => (
            <span key={index}>{item}</span>
          ))}
        </div>
      </div>
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
  const { parts, theme } = options;
  const timed =
    sceneHasCountdown(kind, options.countdown) && parts.has('timer');
  const left = useCountdown(timed, options.countdown);
  const title = options.titles[kind] || translate(`scene.${kind}.title`);
  const note = options.notes[kind] || translate(`scene.${kind}.note`);
  const words = useMemo(() => title.split(/\s+/).filter(Boolean), [title]);
  /* No player until FACEIT has answered: zeros look broken on stream */
  const ready = options.stats && Boolean(data.username) && data.elo > 0;
  const socials = parts.has('socials') ? options.socials : [];

  const look = {
    '--k': options.scale / 100,
    '--tk': options.titleScale / 100,
    '--chat-w': options.chatWidth,
    '--m': SCENE_MOTION_FACTOR[options.motion],
  } as CSSProperties;

  return (
    <div className="scene-frame" style={look}>
      <div
        className={`scene-screen scene-theme--${theme} scene-screen--${kind} chat-${options.chat ? options.chatSide : 'none'} chat-style--${options.chatStyle}${ready ? ' has-player' : ''}`}
        data-scene={kind}
        data-theme={theme}
      >
        <Background
          animation={options.animation}
          map={options.map}
          mapBlur={options.mapBlur}
          dim={options.dim}
        />
        {theme === 'neon' && (
          <i className="scene-scanlines" aria-hidden="true" />
        )}
        <main className="scene-main">
          <div className="scene-head">
            {parts.has('badge') && (
              <span className="scene-badge">
                <i className={kind === 'ending' ? 'is-off' : ''} />
                {translate(`scene.badge.${kind}`)}
                {data.username ? <b>{data.username}</b> : null}
              </span>
            )}
            <h1 className="scene-title" aria-label={title} data-text={title}>
              {words.map((word, index) => (
                <span
                  key={`${word}-${index}`}
                  style={{ '--i': index } as CSSProperties}
                  data-text={word}
                  aria-hidden="true"
                >
                  {word}
                </span>
              ))}
            </h1>
            {parts.has('note') && note && <p className="scene-note">{note}</p>}
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
          {ready && (
            <Player
              kind={kind}
              options={options}
              data={data}
              translate={translate}
            />
          )}
          {socials.length > 0 && theme !== 'broadcast' && (
            <ul className="scene-socials">
              {socials.map((social, index) => (
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
        {theme === 'broadcast' && (
          <Ticker options={options} data={data} translate={translate} />
        )}
      </div>
    </div>
  );
}
