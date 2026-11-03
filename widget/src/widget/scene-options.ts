/** Full-screen scenes for the parts of a stream without the game: before it starts, a break, and the end. */
export const SCENE_KINDS = ['starting', 'brb', 'ending'] as const;
export type SceneKind = (typeof SCENE_KINDS)[number];

/** Moving backgrounds. `none` keeps the scene still, for slow PCs or a calm look. */
export const SCENE_ANIMATIONS = ['aurora', 'grid', 'embers', 'rays', 'waves', 'none'] as const;
export type SceneAnimation = (typeof SCENE_ANIMATIONS)[number];

/**
 * How the scene is built around the streamer. The ids stay as they were stored in links:
 * spotlight is "Centre", holo is "Card", neon is "HUD".
 */
export const SCENE_THEMES = ['spotlight', 'holo', 'broadcast', 'neon', 'classic'] as const;
export type SceneTheme = (typeof SCENE_THEMES)[number];

/** What a scene can show. The title and the ELO always stay. */
export const SCENE_PARTS = [
  'badge',
  'note',
  'timer',
  'avatar',
  'level',
  'rank',
  'progress',
  'kd',
  'adr',
  'hs',
  'winrate',
  'record',
  'elochange',
  'sessionkd',
  'form',
  'socials',
] as const;
export type ScenePart = (typeof SCENE_PARTS)[number];
/** The parts grouped the way the studio lists them. */
export const SCENE_PART_GROUPS: { group: 'head' | 'player' | 'recent' | 'session' | 'extra'; parts: ScenePart[] }[] = [
  { group: 'head', parts: ['badge', 'note', 'timer'] },
  { group: 'player', parts: ['avatar', 'level', 'rank', 'progress'] },
  { group: 'recent', parts: ['kd', 'adr', 'hs', 'winrate'] },
  { group: 'session', parts: ['record', 'elochange', 'sessionkd', 'form'] },
  { group: 'extra', parts: ['socials'] },
];
/** Stored when every part is switched off: an empty value would read back as the default. */
export const SCENE_PARTS_NONE = 'none';
export const SCENE_PARTS_REGEX = /^[a-z,]{0,200}$/;

export const SCENE_CHAT_SIDES = ['right', 'left'] as const;
export type SceneChatSide = (typeof SCENE_CHAT_SIDES)[number];

/** Social links shown at the bottom, in this order. */
export const SCENE_SOCIALS = ['twitch', 'kick', 'youtube', 'x', 'instagram', 'tiktok', 'discord'] as const;
export type SceneSocial = (typeof SCENE_SOCIALS)[number];

export const SCENE_CHAT_STYLES = ['glass', 'solid', 'outline', 'none'] as const;
export type SceneChatStyle = (typeof SCENE_CHAT_STYLES)[number];

/** How fast the loops run: the backgrounds, the rays, the floating card and the ticker. */
export const SCENE_MOTIONS = ['calm', 'normal', 'lively'] as const;
export type SceneMotion = (typeof SCENE_MOTIONS)[number];
/** Duration multiplier of each tempo: a calm scene runs its loops slower. */
export const SCENE_MOTION_FACTOR: Record<SceneMotion, number> = { calm: 1.8, normal: 1, lively: 0.6 };

export const SCENE_RANGES = {
  countdown: [0, 90] as [number, number],
  /** Size of everything on the scene, in percent. */
  scale: [70, 130] as [number, number],
  title: [60, 140] as [number, number],
  /** Width of the chat panel, in percent of a 16:9 frame. */
  chatWidth: [18, 40] as [number, number],
  /** How much the background is darkened, in percent. */
  dim: [0, 80] as [number, number],
  mapBlur: [0, 24] as [number, number],
};

/** Text a streamer types for a title or a note: no markup, no control characters. */
export const SCENE_TEXT_REGEX = /^[^<>\p{Cc}]{0,90}$/u;
/** A channel name, handle or invite code: letters, digits and the few marks they use. */
export const SCENE_HANDLE_REGEX = /^[\p{L}\p{N}_.\-/@]{0,48}$/u;

export type SceneOptions = {
  kind: SceneKind;
  titles: Record<SceneKind, string>;
  notes: Record<SceneKind, string>;
  /** Minutes the "starting" and "be right back" timers count down from when the source loads; 0 hides them. */
  countdown: number;
  chat: boolean;
  chatSide: SceneChatSide;
  stats: boolean;
  animation: SceneAnimation;
  theme: SceneTheme;
  parts: ReadonlySet<ScenePart>;
  scale: number;
  titleScale: number;
  chatWidth: number;
  chatStyle: SceneChatStyle;
  motion: SceneMotion;
  dim: number;
  /** A CS2 map still behind the scene, or '' for none. */
  map: string;
  mapBlur: number;
  socials: { kind: SceneSocial; handle: string }[];
};

type Get = (key: string) => unknown;

const pick = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  list.find((entry) => entry === value) ?? fallback;

/** A whole number inside the range, or the fallback. */
const within = (value: unknown, [min, max]: [number, number], fallback: number) => {
  const number = Number(value);
  return value === undefined || value === null || value === '' || !Number.isFinite(number)
    ? fallback
    : Math.min(max, Math.max(min, Math.round(number)));
};

const text = (value: unknown) => (typeof value === 'string' && SCENE_TEXT_REGEX.test(value) ? value.trim() : '');

/** Handles keep their own spelling, without a leading @ that chat names often carry. */
export const cleanHandle = (value: unknown) =>
  typeof value === 'string' && SCENE_HANDLE_REGEX.test(value.trim()) ? value.trim().replace(/^@+/, '') : '';

const capital = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Setting key of a per-scene text, e.g. sceneTitleBrb. */
export const sceneTextKey = (field: 'Title' | 'Note', kind: SceneKind) => `scene${field}${capital(kind)}`;
/** Setting key of a social handle, e.g. sceneTwitch. */
export const sceneSocialKey = (kind: SceneSocial) => `scene${capital(kind)}`;

export function readSceneOptions(get: Get): SceneOptions {
  const per = (field: 'Title' | 'Note') =>
    Object.fromEntries(SCENE_KINDS.map((kind) => [kind, text(get(sceneTextKey(field, kind)))])) as Record<SceneKind, string>;
  const countdown = Number(get('sceneCountdown'));
  return {
    kind: pick(SCENE_KINDS, get('sceneKind'), 'starting'),
    titles: per('Title'),
    notes: per('Note'),
    countdown: within(countdown, SCENE_RANGES.countdown, 5),
    chat: get('sceneChat') !== false,
    chatSide: pick(SCENE_CHAT_SIDES, get('sceneChatSide'), 'right'),
    stats: get('sceneStats') !== false,
    animation: pick(SCENE_ANIMATIONS, get('sceneAnimation'), 'aurora'),
    theme: pick(SCENE_THEMES, get('sceneTheme'), 'spotlight'),
    parts: readSceneParts(get('sceneParts')),
    scale: within(get('sceneScale'), SCENE_RANGES.scale, 100),
    titleScale: within(get('sceneTitleScale'), SCENE_RANGES.title, 100),
    chatWidth: within(get('sceneChatWidth'), SCENE_RANGES.chatWidth, 27),
    chatStyle: pick(SCENE_CHAT_STYLES, get('sceneChatStyle'), 'glass'),
    motion: pick(SCENE_MOTIONS, get('sceneMotion'), 'normal'),
    dim: within(get('sceneDim'), SCENE_RANGES.dim, 0),
    map: typeof get('sceneMap') === 'string' && /^[a-z0-9]{0,16}$/.test(String(get('sceneMap'))) ? String(get('sceneMap')) : '',
    mapBlur: within(get('sceneMapBlur'), SCENE_RANGES.mapBlur, 6),
    socials: SCENE_SOCIALS.map((kind) => ({ kind, handle: cleanHandle(get(sceneSocialKey(kind))) })).filter((entry) => entry.handle),
  };
}

/** The address a viewer would type, shown under the handle. */
export function socialAddress(kind: SceneSocial, handle: string): string {
  switch (kind) {
    case 'twitch':
      return `twitch.tv/${handle}`;
    case 'kick':
      return `kick.com/${handle}`;
    case 'youtube':
      return `youtube.com/@${handle}`;
    case 'x':
      return `x.com/${handle}`;
    case 'instagram':
      return `instagram.com/${handle}`;
    case 'tiktok':
      return `tiktok.com/@${handle}`;
    case 'discord':
      return handle.includes('/') ? handle : `discord.gg/${handle}`;
    default: {
      const unknown: never = kind;
      return unknown;
    }
  }
}

/** "4:05" for a countdown; hours appear only past one hour. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** Only the timer scenes count down; the end of a stream has nothing to wait for. */
export const sceneHasCountdown = (kind: SceneKind, minutes: number) => kind !== 'ending' && minutes > 0;

/** The parts switched on, from the stored list. A missing value shows everything; "none" shows nothing. */
export function readSceneParts(value: unknown): ReadonlySet<ScenePart> {
  if (typeof value !== 'string' || value === '') return new Set(SCENE_PARTS);
  if (value === SCENE_PARTS_NONE) return new Set();
  const asked = value.split(',');
  return new Set(SCENE_PARTS.filter((part) => asked.includes(part)));
}

/** The stored list for a set of parts, in the fixed order. */
export function writeSceneParts(parts: ReadonlySet<ScenePart>): string {
  const list = SCENE_PARTS.filter((part) => parts.has(part));
  return list.length ? list.join(',') : SCENE_PARTS_NONE;
}

/** Lowest ELO of each FACEIT level, 1 to 10. */
const LEVEL_FLOORS = [100, 501, 751, 901, 1051, 1201, 1351, 1531, 1751, 2001];

/** How far the player is through their level, and how much ELO the next one needs. Level 10 is full. */
export function levelProgress(elo: number, level: number): { progress: number; toNext: number | null; nextLevel: number | null } {
  if (!(level >= 1)) return { progress: 0, toNext: null, nextLevel: null };
  if (level >= 10) return { progress: 1, toNext: null, nextLevel: null };
  const floor = LEVEL_FLOORS[level - 1] ?? 100;
  const next = LEVEL_FLOORS[level] ?? floor;
  const progress = next > floor ? Math.min(1, Math.max(0, (elo - floor) / (next - floor))) : 0;
  return { progress, toNext: Math.max(0, next - elo), nextLevel: level + 1 };
}
