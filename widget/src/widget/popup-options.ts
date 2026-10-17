export const POPUP_POSITIONS = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
] as const;
export const POPUP_LAYOUTS = ['card', 'stack', 'strip'] as const;
export const POPUP_THEMES = ['dark', 'glass', 'light', 'clear', 'midnight', 'crimson', 'carbon', 'neon'] as const;
export const POPUP_ANIMATIONS = ['rise', 'fade', 'slide', 'zoom', 'none'] as const;
export const POPUP_ME_STATS = ['kills', 'deaths', 'assists', 'kd', 'adr', 'hs', 'mvps'] as const;

export type PopupPosition = (typeof POPUP_POSITIONS)[number];
export type PopupLayout = (typeof POPUP_LAYOUTS)[number];
export type PopupTheme = (typeof POPUP_THEMES)[number];
export type PopupAnimation = (typeof POPUP_ANIMATIONS)[number];
export type PopupMeStat = (typeof POPUP_ME_STATS)[number];
export type PopupPhase = 'pre' | 'live' | 'post';

/** Text elements whose size can be tuned, per layout. */
export const POPUP_FONT_KEYS = ['title', 'score', 'team', 'avg', 'nick', 'stats', 'me'] as const;
export type PopupFontKey = (typeof POPUP_FONT_KEYS)[number];

/** The strip has no roster, so it has no nickname or number text to size. */
export function fontKeysFor(layout: PopupLayout): readonly PopupFontKey[] {
  return layout === 'strip' ? POPUP_FONT_KEYS.filter((key) => key !== 'nick' && key !== 'stats') : POPUP_FONT_KEYS;
}

/** The appearance settings a phase can override when "separate look per phase" is on. */
export const POPUP_LOOK_KEYS = ['layout', 'theme', 'animation', 'position', 'scale', 'widthPct', 'radius', 'opacity', 'mapBg', 'mapBlur', 'mapOpacity'] as const;
export type PopupLookKey = (typeof POPUP_LOOK_KEYS)[number];

export type PopupOptions = {
  pre: boolean;
  live: boolean;
  post: boolean;
  seconds: number;
  delay: number;
  /** Hold and delay stored per match phase; missing phases use `seconds` / `delay`. */
  phaseTiming: Partial<Record<PopupPhase, { seconds?: number; delay?: number }>>;
  layout: PopupLayout;
  position: PopupPosition;
  scale: number;
  /** Card width as a share of the widget frame, in percent. */
  widthPct: number;
  radius: number;
  opacity: number;
  mapBg: boolean;
  mapBlur: number;
  mapOpacity: number;
  showAvatars: boolean;
  theme: PopupTheme;
  animation: PopupAnimation;
  compact: boolean;
  showMap: boolean;
  showScore: boolean;
  showAvg: boolean;
  showTeams: boolean;
  showElo: boolean;
  showLevels: boolean;
  showCountry: boolean;
  highlightMe: boolean;
  sortElo: boolean;
  showMe: boolean;
  scoreboard: boolean;
  me: Record<PopupMeStat, boolean>;
  fonts: Partial<Record<PopupLayout, Partial<Record<PopupFontKey, number>>>>;
  perPhase: boolean;
  phaseLook: Partial<Record<PopupPhase, Partial<Pick<PopupOptions, PopupLookKey>>>>;
};

export const POPUP_DEFAULTS: PopupOptions = {
  pre: true,
  live: true,
  post: true,
  seconds: 12,
  delay: 0,
  phaseTiming: {},
  layout: 'card',
  position: 'center',
  scale: 100,
  widthPct: 47,
  radius: 18,
  opacity: 94,
  mapBg: false,
  mapBlur: 14,
  mapOpacity: 100,
  showAvatars: false,
  theme: 'dark',
  animation: 'rise',
  compact: false,
  showMap: true,
  showScore: true,
  showAvg: true,
  showTeams: true,
  showElo: true,
  showLevels: true,
  showCountry: false,
  highlightMe: true,
  sortElo: false,
  showMe: true,
  scoreboard: false,
  me: { kills: true, deaths: true, assists: false, kd: true, adr: true, hs: false, mvps: false },
  fonts: {},
  perPhase: false,
  phaseLook: {},
};

/** Ranges shared by the generator sliders and the widget, so both clamp the same way. */
export const POPUP_RANGES = {
  seconds: [6, 40],
  delay: [0, 30],
  scale: [60, 160],
  widthPct: [30, 100],
  radius: [0, 32],
  opacity: [40, 100],
  mapBlur: [0, 30],
  mapOpacity: [10, 100],
  font: [60, 200],
} as const;

const clamp = (value: unknown, [min, max]: readonly [number, number], fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
const pick = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;
const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

const LOOK_RULES: Record<PopupLookKey, (value: unknown) => unknown> = {
  layout: (v) => (POPUP_LAYOUTS as readonly unknown[]).includes(v) ? v : undefined,
  theme: (v) => (POPUP_THEMES as readonly unknown[]).includes(v) ? v : undefined,
  animation: (v) => (POPUP_ANIMATIONS as readonly unknown[]).includes(v) ? v : undefined,
  position: (v) => (POPUP_POSITIONS as readonly unknown[]).includes(v) ? v : undefined,
  scale: (v) => (typeof v === 'number' ? clamp(v, POPUP_RANGES.scale, POPUP_DEFAULTS.scale) : undefined),
  widthPct: (v) => (typeof v === 'number' ? clamp(v, POPUP_RANGES.widthPct, POPUP_DEFAULTS.widthPct) : undefined),
  radius: (v) => (typeof v === 'number' ? clamp(v, POPUP_RANGES.radius, POPUP_DEFAULTS.radius) : undefined),
  opacity: (v) => (typeof v === 'number' ? clamp(v, POPUP_RANGES.opacity, POPUP_DEFAULTS.opacity) : undefined),
  mapBg: (v) => (typeof v === 'boolean' ? v : undefined),
  mapBlur: (v) => (typeof v === 'number' ? clamp(v, POPUP_RANGES.mapBlur, POPUP_DEFAULTS.mapBlur) : undefined),
  mapOpacity: (v) => (typeof v === 'number' ? clamp(v, POPUP_RANGES.mapOpacity, POPUP_DEFAULTS.mapOpacity) : undefined),
};

/** Keeps only known look keys with valid values; anything else a stored or hand-edited value carries is dropped. */
function sanitizeLook(raw: unknown): Partial<Pick<PopupOptions, PopupLookKey>> {
  const out: Record<string, unknown> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const key of POPUP_LOOK_KEYS) {
    const value = LOOK_RULES[key]((raw as Record<string, unknown>)[key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function parsePhaseLook(raw: unknown): PopupOptions['phaseLook'] {
  if (typeof raw !== 'string' || raw === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
  const result: PopupOptions['phaseLook'] = {};
  for (const phase of ['pre', 'live', 'post'] as const) {
    const look = sanitizeLook((parsed as Record<string, unknown>)[phase]);
    if (Object.keys(look).length) result[phase] = look;
  }
  return result;
}

function parsePhaseTiming(raw: unknown): PopupOptions['phaseTiming'] {
  if (typeof raw !== 'string' || raw === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
  const result: PopupOptions['phaseTiming'] = {};
  for (const phase of ['pre', 'live', 'post'] as const) {
    const own = (parsed as Record<string, unknown>)[phase];
    if (typeof own !== 'object' || own === null || Array.isArray(own)) continue;
    const seconds =
      typeof (own as { seconds?: unknown }).seconds === 'number'
        ? clamp((own as { seconds: number }).seconds, POPUP_RANGES.seconds, POPUP_DEFAULTS.seconds)
        : undefined;
    const delay =
      typeof (own as { delay?: unknown }).delay === 'number'
        ? clamp((own as { delay: number }).delay, POPUP_RANGES.delay, POPUP_DEFAULTS.delay)
        : undefined;
    if (seconds !== undefined || delay !== undefined) result[phase] = { ...(seconds !== undefined ? { seconds } : {}), ...(delay !== undefined ? { delay } : {}) };
  }
  return result;
}

/** Hold and delay for one match phase. Phases without an override keep the shared sliders. */
export function timingFor(options: PopupOptions, phase: PopupPhase): { seconds: number; delay: number } {
  const own = options.phaseTiming[phase];
  return {
    seconds: own?.seconds ?? options.seconds,
    delay: own?.delay ?? options.delay,
  };
}

function parseFonts(raw: unknown): PopupOptions['fonts'] {
  if (typeof raw !== 'string' || raw === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
  const result: PopupOptions['fonts'] = {};
  for (const layout of POPUP_LAYOUTS) {
    const own = (parsed as Record<string, unknown>)[layout];
    if (typeof own !== 'object' || own === null || Array.isArray(own)) continue;
    const sizes: Partial<Record<PopupFontKey, number>> = {};
    for (const key of fontKeysFor(layout)) {
      const value = (own as Record<string, unknown>)[key];
      if (typeof value === 'number' && Number.isFinite(value)) sizes[key] = Math.round(clamp(value, POPUP_RANGES.font, 100));
    }
    if (Object.keys(sizes).length) result[layout] = sizes;
  }
  return result;
}

/** The options as one match phase should draw them: the shared look, or that phase's own when enabled. */
export function lookFor(options: PopupOptions, phase: PopupPhase): PopupOptions {
  if (!options.perPhase) return options;
  const own = options.phaseLook[phase];
  return own ? { ...options, ...own } : options;
}

/** Builds the options from the settings store; anything missing or invalid takes its default. */
export function readPopupOptions(get: (key: string) => unknown): PopupOptions {
  const d = POPUP_DEFAULTS;
  return {
    pre: flag(get('popupPre'), d.pre),
    live: flag(get('popupLive'), d.live),
    post: flag(get('popupPost'), d.post),
    seconds: clamp(get('popupSeconds'), POPUP_RANGES.seconds, d.seconds),
    delay: clamp(get('popupDelay'), POPUP_RANGES.delay, d.delay),
    phaseTiming: parsePhaseTiming(get('popupPhaseTiming')),
    layout: pick(get('popupLayout'), POPUP_LAYOUTS, d.layout),
    position: pick(get('popupPosition'), POPUP_POSITIONS, d.position),
    scale: clamp(get('popupScale'), POPUP_RANGES.scale, d.scale),
    widthPct: clamp(get('popupWidthPct'), POPUP_RANGES.widthPct, d.widthPct),
    radius: clamp(get('popupRadius'), POPUP_RANGES.radius, d.radius),
    opacity: clamp(get('popupOpacity'), POPUP_RANGES.opacity, d.opacity),
    mapBg: flag(get('popupMapBg'), d.mapBg),
    mapBlur: clamp(get('popupMapBlur'), POPUP_RANGES.mapBlur, d.mapBlur),
    mapOpacity: clamp(get('popupMapOpacity'), POPUP_RANGES.mapOpacity, d.mapOpacity),
    showAvatars: flag(get('popupShowAvatars'), d.showAvatars),
    theme: pick(get('popupTheme'), POPUP_THEMES, d.theme),
    animation: pick(get('popupAnimation'), POPUP_ANIMATIONS, d.animation),
    compact: flag(get('popupCompact'), d.compact),
    showMap: flag(get('popupShowMap'), d.showMap),
    showScore: flag(get('popupShowScore'), d.showScore),
    showAvg: flag(get('popupShowAvg'), d.showAvg),
    showTeams: flag(get('popupShowTeams'), d.showTeams),
    showElo: flag(get('popupShowElo'), d.showElo),
    showLevels: flag(get('popupShowLevels'), d.showLevels),
    showCountry: flag(get('popupShowCountry'), d.showCountry),
    highlightMe: flag(get('popupHighlightMe'), d.highlightMe),
    sortElo: flag(get('popupSortElo'), d.sortElo),
    showMe: flag(get('popupShowMe'), d.showMe),
    scoreboard: flag(get('popupScoreboard'), d.scoreboard),
    me: {
      kills: flag(get('popupMeKills'), d.me.kills),
      deaths: flag(get('popupMeDeaths'), d.me.deaths),
      assists: flag(get('popupMeAssists'), d.me.assists),
      kd: flag(get('popupMeKd'), d.me.kd),
      adr: flag(get('popupMeAdr'), d.me.adr),
      hs: flag(get('popupMeHs'), d.me.hs),
      mvps: flag(get('popupMeMvps'), d.me.mvps),
    },
    fonts: parseFonts(get('popupFonts')),
    perPhase: flag(get('popupPerPhase'), d.perPhase),
    phaseLook: parsePhaseLook(get('popupPhaseLook')),
  };
}

const PAD = 52; // horizontal padding of the card
const GAP = 16; // gap between the two team columns
const NICK = 96; // narrowest comfortable nickname
const STAT = 46; // one stat column in the table

/** Recommended minimum card width for two team columns, whatever the content; 47% of a 1920 px source. */
export const POPUP_MIN_TWO_COLUMNS = 900;

/** Bigger nickname or number text widens every roster row by about as much. */
function textFactor(o: PopupOptions): number {
  const own = o.fonts[o.layout] ?? {};
  return Math.max(1, (own.nick ?? 100) / 100, (own.stats ?? 100) / 100);
}

/**
 * Card width, in the card's own pixels, that keeps two team columns with the chosen stats readable.
 * Stacked layouts need room for one team only; the strip and compact card have their own needs.
 */
export function popupMinWidth(options: PopupOptions, phase: PopupPhase): number {
  const o = options;
  if (o.layout === 'strip') {
    const team = Math.max(150, o.showAvatars ? 5 * 28 : 0);
    return 2 * team + 90 + 44 + 44;
  }
  if (o.compact) return 2 * 140 + GAP + PAD;
  const table = o.scoreboard && phase === 'post';
  const lead = (o.showAvatars ? 32 : 0) + (o.showLevels ? 30 : 0) + (o.showCountry ? 20 : 0);
  let side: number;
  if (table) {
    const stats = Object.values(o.me).filter(Boolean).length;
    side = lead + 90 + 12 + stats * STAT + (o.showElo ? 50 : 0);
  } else {
    side = lead + NICK + 12 + (o.showElo ? 52 : 0);
  }
  if (o.layout === 'stack') return side * textFactor(o) + PAD;
  return Math.max(POPUP_MIN_TWO_COLUMNS, 2 * side * textFactor(o) + GAP + PAD);
}

/** An OBS browser source for a full-screen overlay is 1920 x 1080. */
export const POPUP_FRAME_WIDTH = 1920;

/** Width the card really gets on a source of `frame` px: the share, floored by the minimum, capped by the frame. */
export function popupCardWidth(options: PopupOptions, phase: PopupPhase, frame = POPUP_FRAME_WIDTH): number {
  const view = lookFor(options, phase);
  const share = (frame * view.widthPct) / 100;
  const floor = (popupMinWidth(view, phase) * view.scale) / 100;
  return Math.round(Math.min(frame, Math.max(share, floor)));
}

/**
 * Zoom and anchor for the close-up preview: the card fills most of the pane, anchored where the card sits.
 * `measured` is the real card size as a share of the frame; a tall card (stacked teams) is limited by its height.
 */
export function popupCloseUp(
  options: PopupOptions,
  phase: PopupPhase,
  measured?: { width: number; height: number }
): { zoom: number; origin: string } {
  const view = lookFor(options, phase);
  const width = measured?.width ?? popupCardWidth(options, phase) / POPUP_FRAME_WIDTH;
  const height = measured?.height ?? 0;
  const fit = Math.min(width > 0 ? 0.9 / width : Infinity, height > 0 ? 0.9 / height : Infinity);
  const zoom = fit <= 1 ? 1 : Math.min(4, Math.floor(fit * 100) / 100);
  const x = view.position.includes('left') ? 0 : view.position.includes('right') ? 100 : 50;
  const y = view.position.startsWith('top') ? 0 : view.position.startsWith('bottom') ? 100 : 50;
  return { zoom, origin: `${x}% ${y}%` };
}
