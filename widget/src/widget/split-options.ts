/** Stats that can sit on the radar. A preset only fills this list; any mix is allowed. */
export const SPLIT_AXES = ['kd', 'adr', 'hs', 'wr', 'kills', 'kr', 'wins', 'losses', 'streak'] as const;
export type SplitAxis = (typeof SPLIT_AXES)[number];

/** Pieces that can sit on the bar under the camera. */
export const SPLIT_BITS = ['avatar', 'name', 'level', 'elo', 'rank', 'session', 'streak', 'wr'] as const;
export type SplitBit = (typeof SPLIT_BITS)[number];

export const SPLIT_THEMES = ['dark', 'glass', 'light', 'clear'] as const;
export type SplitTheme = (typeof SPLIT_THEMES)[number];

/** How the radar source is drawn. The camera bar is unchanged. */
export const SPLIT_VIEWS = ['chart', 'data', 'motion'] as const;
export type SplitView = (typeof SPLIT_VIEWS)[number];

/** Where the chart prints its numbers. */
export const SPLIT_CHART_LOOKS = ['side', 'ring'] as const;
export type SplitChartLook = (typeof SPLIT_CHART_LOOKS)[number];

/** Text-only arrangements of the same stats. */
export const SPLIT_DATA_LOOKS = ['tiles', 'list', 'hero'] as const;
export type SplitDataLook = (typeof SPLIT_DATA_LOOKS)[number];

/** Motion arrangements of the same stats. */
export const SPLIT_MOTION_LOOKS = ['bars', 'cycle'] as const;
export type SplitMotionLook = (typeof SPLIT_MOTION_LOOKS)[number];

export const SPLIT_RANGES = {
  radius: [8, 48] as const,
  opacity: [40, 100] as const,
  font: [70, 150] as const,
};

/** How far a stat reaches the edge of the radar. */
export const SPLIT_AXIS_MAX: Record<SplitAxis, number> = {
  kd: 2,
  adr: 120,
  hs: 70,
  wr: 80,
  kills: 30,
  kr: 1.5,
  wins: 30,
  losses: 30,
  streak: 12,
};

export const SPLIT_AXIS_LABEL: Record<SplitAxis, string> = {
  kd: 'K/D',
  adr: 'ADR',
  hs: 'HS',
  wr: 'WR',
  kills: 'K',
  kr: 'KR',
  wins: 'W',
  losses: 'L',
  streak: 'S',
};

export const RADAR_PRESETS: Record<'combat' | 'aim' | 'results' | 'full', SplitAxis[]> = {
  combat: ['kd', 'adr', 'hs', 'wr', 'kills'],
  aim: ['hs', 'kr', 'adr', 'kd', 'kills'],
  results: ['wr', 'streak', 'wins', 'losses', 'kd'],
  full: ['kd', 'adr', 'hs', 'wr', 'kills', 'kr', 'wins', 'losses', 'streak'],
};

export const CAMERA_PRESETS: Record<'identity' | 'elo' | 'session' | 'form' | 'bar', SplitBit[]> = {
  identity: ['avatar', 'name', 'level', 'elo', 'rank'],
  elo: ['elo', 'level'],
  session: ['session'],
  form: ['streak', 'wr'],
  bar: ['elo', 'session'],
};

export type SplitStats = Record<SplitAxis, number>;

export type SplitOptions = {
  axes: SplitAxis[];
  bits: SplitBit[];
  view: SplitView;
  chartLook: SplitChartLook;
  dataLook: SplitDataLook;
  motionLook: SplitMotionLook;
  theme: SplitTheme;
  /** Accent without the hash. Empty keeps the layout accent. */
  accent: string;
  radius: number;
  opacity: number;
  font: number;
};

const clamp = (value: unknown, range: readonly [number, number], fallback: number) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(range[1], Math.max(range[0], Math.round(number)));
};

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const text = String(value ?? '');
  return (allowed as readonly string[]).includes(text) ? (text as T) : fallback;
}

function listed<T extends string>(value: unknown, allowed: readonly T[], fallback: readonly T[]): T[] {
  const text = String(value ?? '').trim();
  if (text === 'none') return [];
  if (!text) return [...fallback];
  const picked = new Set(text.split(',').map((part) => part.trim()));
  const known = allowed.filter((item) => picked.has(item));
  return known.length ? known : [...fallback];
}

export function sameChoice(current: readonly string[], preset: readonly string[]) {
  return current.length === preset.length && preset.every((id) => current.includes(id));
}

/** Keeps the chosen order of the catalogue, so a preset and a hand-built list compare cleanly. */
export function writeChoice<T extends string>(allowed: readonly T[], current: readonly T[], id: T, on: boolean) {
  const next = allowed.filter((item) => (item === id ? on : current.includes(item)));
  return next.length ? next.join(',') : 'none';
}

export function readSplitOptions(get: (key: string) => unknown): SplitOptions {
  const radar = String(get('splitRadar') || 'combat');
  const camera = String(get('splitMini') || 'identity');
  const theme = String(get('splitTheme') || 'dark');
  return {
    axes: listed(get('splitAxes'), SPLIT_AXES, RADAR_PRESETS[radar as keyof typeof RADAR_PRESETS] ?? RADAR_PRESETS.combat),
    bits: listed(get('splitCamera'), SPLIT_BITS, CAMERA_PRESETS[camera as keyof typeof CAMERA_PRESETS] ?? CAMERA_PRESETS.identity),
    view: oneOf(get('splitView'), SPLIT_VIEWS, 'chart'),
    chartLook: oneOf(get('splitChartLook'), SPLIT_CHART_LOOKS, 'side'),
    dataLook: oneOf(get('splitDataLook'), SPLIT_DATA_LOOKS, 'tiles'),
    motionLook: oneOf(get('splitMotionLook'), SPLIT_MOTION_LOOKS, 'bars'),
    theme: (SPLIT_THEMES as readonly string[]).includes(theme) ? (theme as SplitTheme) : 'dark',
    accent: /^[0-9a-fA-F]{6}$/.test(String(get('splitAccent') || '')) ? String(get('splitAccent')) : '',
    radius: clamp(get('splitRadius'), SPLIT_RANGES.radius, 32),
    opacity: clamp(get('splitOpacity'), SPLIT_RANGES.opacity, 96),
    font: clamp(get('splitFont'), SPLIT_RANGES.font, 100),
  };
}
