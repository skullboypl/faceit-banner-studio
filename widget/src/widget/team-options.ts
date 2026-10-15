export const TEAM_DENSITIES = ['comfortable', 'compact'] as const;
export const TEAM_THEMES = ['dark', 'glass', 'light', 'clear'] as const;
export const TEAM_ROWS = ['cards', 'flat'] as const;
export const TEAM_AVATAR_SHAPES = ['circle', 'rounded', 'square'] as const;
export const TEAM_ANIMATIONS = ['none', 'fade', 'stagger'] as const;
/** What the list can be ordered by; "order" keeps the names as they were typed. */
export const TEAM_SORTS = ['order', 'elo', 'kd', 'wr', 'hs', 'adr', 'matches'] as const;
/** How many recent matches the roster stats and the win/loss form are counted from. */
export const TEAM_WINDOWS = [20, 30] as const;

export type TeamDensity = (typeof TEAM_DENSITIES)[number];
export type TeamTheme = (typeof TEAM_THEMES)[number];
export type TeamRows = (typeof TEAM_ROWS)[number];
export type TeamAvatarShape = (typeof TEAM_AVATAR_SHAPES)[number];
export type TeamAnimation = (typeof TEAM_ANIMATIONS)[number];
export type TeamSort = (typeof TEAM_SORTS)[number];
export type TeamWindow = (typeof TEAM_WINDOWS)[number];

export type TeamOptions = {
  avatars: boolean;
  levels: boolean;
  /** Stat columns, in the order they are drawn. */
  elo: boolean;
  kd: boolean;
  winRate: boolean;
  hs: boolean;
  adr: boolean;
  kr: boolean;
  matches: boolean;
  wins: boolean;
  streak: boolean;
  /** Win/loss form of the person whose banner this is, in the header. */
  form: boolean;
  /** The same recent form on every roster row. */
  playerForm: boolean;
  /** Recent matches the stats and the form are counted from. */
  matchWindow: TeamWindow;
  /** Small captions (ELO, K/D...) under the numbers. */
  labels: boolean;
  /** Average ELO of the roster in the header. */
  average: boolean;
  sort: TeamSort;
  density: TeamDensity;
  /** Header text; empty means the default "Roster". */
  title: string;
  theme: TeamTheme;
  /** Corner radius of the panel, in px. */
  radius: number;
  /** Panel opacity, in percent. */
  opacity: number;
  rows: TeamRows;
  avatarShape: TeamAvatarShape;
  /** Place number in front of each player. */
  rank: boolean;
  /** Thin bar under each nickname: ELO as a share of the best player's. */
  eloBar: boolean;
  /** Accent glow on the player with the best ELO. */
  highlightTop: boolean;
  /** Text size, in percent. */
  fontScale: number;
  animation: TeamAnimation;
  /** Six hex digits, or empty to follow the theme. */
  panelColor: string;
  textColor: string;
  barColor: string;
  topColor: string;
};

export const TEAM_TITLE_MAX = 24;

export const TEAM_RANGES = {
  radius: [0, 28],
  opacity: [40, 100],
  fontScale: [80, 140],
} as const;

export const TEAM_DEFAULTS: TeamOptions = {
  avatars: true,
  levels: true,
  elo: true,
  kd: true,
  winRate: true,
  hs: false,
  adr: false,
  kr: false,
  matches: false,
  wins: false,
  streak: false,
  form: true,
  playerForm: false,
  matchWindow: 20,
  labels: true,
  average: true,
  sort: 'order',
  density: 'comfortable',
  title: '',
  theme: 'dark',
  radius: 16,
  opacity: 92,
  rows: 'cards',
  avatarShape: 'circle',
  rank: false,
  eloBar: false,
  highlightTop: false,
  fontScale: 100,
  animation: 'stagger',
  panelColor: '',
  textColor: '',
  barColor: '',
  topColor: '',
};

const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
const pick = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  (options as readonly unknown[]).includes(value) ? (value as T) : fallback;
const clamp = (value: unknown, [min, max]: readonly [number, number], fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const color = (value: unknown) => (typeof value === 'string' && /^[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : '');

/** "ff8800" → "255, 136, 0", for use inside rgba(var(--x), alpha). */
export const hexToRgb = (hex: string) =>
  [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)).join(', ');

/** Builds the roster banner options from the settings store; anything missing or invalid takes its default. */
export function readTeamOptions(get: (key: string) => unknown): TeamOptions {
  const d = TEAM_DEFAULTS;
  const title = get('teamTitle');
  return {
    avatars: flag(get('teamShowAvatars'), d.avatars),
    levels: flag(get('teamShowLevels'), d.levels),
    elo: flag(get('teamShowElo'), d.elo),
    kd: flag(get('teamShowKd'), d.kd),
    winRate: flag(get('teamShowWinRate'), d.winRate),
    hs: flag(get('teamShowHs'), d.hs),
    adr: flag(get('teamShowAdr'), d.adr),
    kr: flag(get('teamShowKr'), d.kr),
    matches: flag(get('teamShowMatches'), d.matches),
    wins: flag(get('teamShowWins'), d.wins),
    streak: flag(get('teamShowStreak'), d.streak),
    form: flag(get('teamShowForm'), d.form),
    playerForm: flag(get('teamShowPlayerForm'), d.playerForm),
    matchWindow: get('teamMatchWindow') === 30 || get('teamMatchWindow') === '30' ? 30 : 20,
    labels: flag(get('teamLabels'), d.labels),
    average: flag(get('teamShowAvg'), d.average),
    sort: pick(get('teamSort'), TEAM_SORTS, d.sort),
    density: pick(get('teamDensity'), TEAM_DENSITIES, d.density),
    title: typeof title === 'string' ? title.trim().slice(0, TEAM_TITLE_MAX) : d.title,
    theme: pick(get('teamTheme'), TEAM_THEMES, d.theme),
    radius: clamp(get('teamRadius'), TEAM_RANGES.radius, d.radius),
    opacity: clamp(get('teamOpacity'), TEAM_RANGES.opacity, d.opacity),
    rows: pick(get('teamRows'), TEAM_ROWS, d.rows),
    avatarShape: pick(get('teamAvatarShape'), TEAM_AVATAR_SHAPES, d.avatarShape),
    rank: flag(get('teamShowRank'), d.rank),
    eloBar: flag(get('teamEloBar'), d.eloBar),
    highlightTop: flag(get('teamHighlightTop'), d.highlightTop),
    fontScale: clamp(get('teamFontScale'), TEAM_RANGES.fontScale, d.fontScale),
    animation: pick(get('teamAnimation'), TEAM_ANIMATIONS, d.animation),
    panelColor: color(get('teamPanelColor')),
    textColor: color(get('teamTextColor')),
    barColor: color(get('teamBarColor')),
    topColor: color(get('teamTopColor')),
  };
}

/** Width of one stat cell, matching the stylesheet. */
const STAT_WIDTH = { elo: 58, kd: 46, wr: 42, hs: 42, adr: 42, kr: 42, matches: 52, wins: 52, streak: 42, form: 58 } as const;
/** Narrowest nickname that still reads well. */
const NAME_MIN = 130;
const PANEL_PADDING = 36;
const SHEET_COLUMN_GAP = 10;

/**
 * Width the roster banner needs for what it shows, in the pixels the OBS source should have: every visible
 * picture, number and stat cell, plus a readable nickname, scaled with the text size and rounded up to ten.
 * The two-column sheet needs two rows side by side.
 */
export function teamRecommendedWidth(options: TeamOptions, layout: 'lineup' | 'sheet'): number {
  const compact = options.density === 'compact';
  const sheet = layout === 'sheet';
  const gap = compact || sheet ? 6 : 8;
  const sides = compact ? 14 : sheet ? 12 : 16;
  const items = [
    options.rank ? 18 : 0,
    options.avatars ? (compact ? 24 : sheet ? 28 : 32) : 0,
    options.levels ? (compact ? 18 : sheet ? 20 : 22) : 0,
    NAME_MIN,
    ...(options.elo ? [STAT_WIDTH.elo] : []),
    ...(options.kd ? [STAT_WIDTH.kd] : []),
    ...(options.winRate ? [STAT_WIDTH.wr] : []),
    ...(options.hs ? [STAT_WIDTH.hs] : []),
    ...(options.adr ? [STAT_WIDTH.adr] : []),
    ...(options.kr ? [STAT_WIDTH.kr] : []),
    ...(options.matches ? [STAT_WIDTH.matches] : []),
    ...(options.wins ? [STAT_WIDTH.wins] : []),
    ...(options.streak ? [STAT_WIDTH.streak] : []),
    ...(options.playerForm ? [STAT_WIDTH.form] : []),
  ].filter((width) => width > 0);
  const row = sides + items.reduce((sum, width) => sum + width, 0) + gap * (items.length - 1);
  const panel = sheet ? PANEL_PADDING + 2 * row + SHEET_COLUMN_GAP : PANEL_PADDING + row;
  return Math.ceil((panel * options.fontScale) / 100 / 10) * 10;
}
