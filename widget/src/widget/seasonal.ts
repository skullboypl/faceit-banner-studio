/** Christmas extras any banner can wear: lights along the top, falling snow, a snow cap and frosted corners. All off by default. */
export const XMAS_LIGHT_COLORS = ['classic', 'warm', 'faceit', 'ice'] as const;
export type XmasLightColors = (typeof XMAS_LIGHT_COLORS)[number];

export const XMAS_SNOW_AMOUNTS = ['light', 'medium', 'heavy'] as const;
export type XmasSnowAmount = (typeof XMAS_SNOW_AMOUNTS)[number];

/** Flakes on screen at once for each amount. */
export const XMAS_FLAKES: Record<XmasSnowAmount, number> = { light: 14, medium: 28, heavy: 48 };

/** Enough bulbs for the widest banner; the row is clipped to the banner's own width. */
export const XMAS_BULBS = 90;

export type XmasOptions = {
  lights: boolean;
  colors: XmasLightColors;
  snow: boolean;
  amount: XmasSnowAmount;
  cap: boolean;
  frost: boolean;
};

const pick = <T extends string>(list: readonly T[], value: unknown, fallback: T): T => list.find((entry) => entry === value) ?? fallback;

export function readXmasOptions(get: (key: string) => unknown): XmasOptions {
  return {
    lights: get('xmasLights') === true,
    colors: pick(XMAS_LIGHT_COLORS, get('xmasLightColors'), 'classic'),
    snow: get('xmasSnow') === true,
    amount: pick(XMAS_SNOW_AMOUNTS, get('xmasSnowAmount'), 'medium'),
    cap: get('xmasCap') === true,
    frost: get('xmasFrost') === true,
  };
}

/** True when at least one extra is switched on, so nothing is drawn for everyone else. */
export const xmasActive = (options: XmasOptions) => options.lights || options.snow || options.cap || options.frost;
