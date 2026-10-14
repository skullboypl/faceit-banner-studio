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
export const POPUP_THEMES = ['dark', 'glass', 'light', 'clear'] as const;
export const POPUP_ANIMATIONS = ['rise', 'fade', 'slide', 'zoom', 'none'] as const;
export const POPUP_ME_STATS = ['kills', 'deaths', 'assists', 'kd', 'adr', 'hs', 'mvps'] as const;

export type PopupPosition = (typeof POPUP_POSITIONS)[number];
export type PopupTheme = (typeof POPUP_THEMES)[number];
export type PopupAnimation = (typeof POPUP_ANIMATIONS)[number];
export type PopupMeStat = (typeof POPUP_ME_STATS)[number];

export type PopupOptions = {
  pre: boolean;
  live: boolean;
  post: boolean;
  seconds: number;
  delay: number;
  position: PopupPosition;
  scale: number;
  width: number;
  radius: number;
  opacity: number;
  theme: PopupTheme;
  animation: PopupAnimation;
  compact: boolean;
  showMap: boolean;
  showScore: boolean;
  showAvg: boolean;
  showTeams: boolean;
  showElo: boolean;
  showLevels: boolean;
  highlightMe: boolean;
  sortElo: boolean;
  showMe: boolean;
  me: Record<PopupMeStat, boolean>;
};

export const POPUP_DEFAULTS: PopupOptions = {
  pre: true,
  live: true,
  post: true,
  seconds: 12,
  delay: 0,
  position: 'center',
  scale: 100,
  width: 760,
  radius: 18,
  opacity: 94,
  theme: 'dark',
  animation: 'rise',
  compact: false,
  showMap: true,
  showScore: true,
  showAvg: true,
  showTeams: true,
  showElo: true,
  showLevels: true,
  highlightMe: true,
  sortElo: false,
  showMe: true,
  me: { kills: true, deaths: true, assists: false, kd: true, adr: true, hs: false, mvps: false },
};

/** Ranges shared by the generator sliders and the widget, so both clamp the same way. */
export const POPUP_RANGES = {
  seconds: [6, 40],
  delay: [0, 30],
  scale: [60, 160],
  width: [420, 1200],
  radius: [0, 32],
  opacity: [40, 100],
} as const;

const clamp = (value: unknown, [min, max]: readonly [number, number], fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
const pick = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;
const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

/** Builds the options from the settings store; anything missing or invalid takes its default. */
export function readPopupOptions(get: (key: string) => unknown): PopupOptions {
  const d = POPUP_DEFAULTS;
  return {
    pre: flag(get('popupPre'), d.pre),
    live: flag(get('popupLive'), d.live),
    post: flag(get('popupPost'), d.post),
    seconds: clamp(get('popupSeconds'), POPUP_RANGES.seconds, d.seconds),
    delay: clamp(get('popupDelay'), POPUP_RANGES.delay, d.delay),
    position: pick(get('popupPosition'), POPUP_POSITIONS, d.position),
    scale: clamp(get('popupScale'), POPUP_RANGES.scale, d.scale),
    width: clamp(get('popupWidth'), POPUP_RANGES.width, d.width),
    radius: clamp(get('popupRadius'), POPUP_RANGES.radius, d.radius),
    opacity: clamp(get('popupOpacity'), POPUP_RANGES.opacity, d.opacity),
    theme: pick(get('popupTheme'), POPUP_THEMES, d.theme),
    animation: pick(get('popupAnimation'), POPUP_ANIMATIONS, d.animation),
    compact: flag(get('popupCompact'), d.compact),
    showMap: flag(get('popupShowMap'), d.showMap),
    showScore: flag(get('popupShowScore'), d.showScore),
    showAvg: flag(get('popupShowAvg'), d.showAvg),
    showTeams: flag(get('popupShowTeams'), d.showTeams),
    showElo: flag(get('popupShowElo'), d.showElo),
    showLevels: flag(get('popupShowLevels'), d.showLevels),
    highlightMe: flag(get('popupHighlightMe'), d.highlightMe),
    sortElo: flag(get('popupSortElo'), d.sortElo),
    showMe: flag(get('popupShowMe'), d.showMe),
    me: {
      kills: flag(get('popupMeKills'), d.me.kills),
      deaths: flag(get('popupMeDeaths'), d.me.deaths),
      assists: flag(get('popupMeAssists'), d.me.assists),
      kd: flag(get('popupMeKd'), d.me.kd),
      adr: flag(get('popupMeAdr'), d.me.adr),
      hs: flag(get('popupMeHs'), d.me.hs),
      mvps: flag(get('popupMeMvps'), d.me.mvps),
    },
  };
}
