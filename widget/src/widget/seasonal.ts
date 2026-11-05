/** Christmas extras any banner can wear: lights along the top, falling snow, snow on the top and bottom edges and frosted corners. All off by default. */
export const XMAS_LIGHT_COLORS = ['classic', 'warm', 'faceit', 'ice'] as const;
export type XmasLightColors = (typeof XMAS_LIGHT_COLORS)[number];

export const XMAS_SNOW_AMOUNTS = ['light', 'medium', 'heavy'] as const;
export type XmasSnowAmount = (typeof XMAS_SNOW_AMOUNTS)[number];

/** Flakes on screen at once for each amount. */
export const XMAS_FLAKES: Record<XmasSnowAmount, number> = { light: 14, medium: 28, heavy: 48 };

/** How far (px) the extras may be pulled in from the banner's edges, so they sit on its card and not on the shadow. */
export const XMAS_INSET_MAX = 40;

/** Enough bulbs for the widest banner; the row is clipped to the banner's own width. */
export const XMAS_BULBS = 90;

export type XmasOptions = {
  lights: boolean;
  colors: XmasLightColors;
  snow: boolean;
  amount: XmasSnowAmount;
  cap: boolean;
  /** A snow drift piled along the bottom edge */
  drift: boolean;
  frost: boolean;
  /** Gap between the banner's edges and the extras, in px of the banner. */
  inset: number;
};

const pick = <T extends string>(list: readonly T[], value: unknown, fallback: T): T => list.find((entry) => entry === value) ?? fallback;

export function readXmasOptions(get: (key: string) => unknown): XmasOptions {
  return {
    lights: get('xmasLights') === true,
    colors: pick(XMAS_LIGHT_COLORS, get('xmasLightColors'), 'classic'),
    snow: get('xmasSnow') === true,
    amount: pick(XMAS_SNOW_AMOUNTS, get('xmasSnowAmount'), 'medium'),
    cap: get('xmasCap') === true,
    drift: get('xmasDrift') === true,
    frost: get('xmasFrost') === true,
    inset: Math.max(0, Math.min(XMAS_INSET_MAX, Math.round(Number(get('xmasInset')) || 0))),
  };
}

/** True when at least one extra is switched on, so nothing is drawn for everyone else. */
export const xmasActive = (options: XmasOptions) => options.lights || options.snow || options.cap || options.drift || options.frost;
