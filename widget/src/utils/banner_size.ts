import { broadcastPresets } from '../styles/styles';

/** Najmniejsza i największa skala, jaką może przyjąć baner 2026. */
export const BANNER_MIN_SCALE = 0.4;
export const BANNER_MAX_SCALE = 2.5;
/** Share of a size increase that enlarges text and icons; the rest becomes layout space. */
const GROWTH_SHARE = 0.6;

export type BannerSizeLimits = {
  width: number;
  height: number;
  square: boolean;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
};

export type BannerSizeMode = 'auto' | 'manual' | 'recommended';

export type BannerSizeInput = {
  style: string;
  widthMode: BannerSizeMode;
  width: number;
  heightMode: BannerSizeMode;
  height: number;
  /** Rozmiar okna przeglądarki OBS (lub podglądu); `Infinity` = bez limitu. */
  viewportWidth: number;
  viewportHeight: number;
  /** Zalecana szerokość dla aktualnie widocznych elementów (patrz `getRecommendedWidth`). */
  recommendedWidth?: number;
};

export type BannerSize = {
  /** Skala typografii i ikon; układ sam wypełnia resztę miejsca. */
  scale: number;
  /** Rzeczywisty rozmiar banera na ekranie; wysokość `undefined` = według zawartości (Zalecane). */
  width: number;
  height: number | undefined;
  /** Rozmiar układu w jednostkach przed skalą (width / scale). */
  layoutWidth: number;
  layoutHeight: number | undefined;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Naturalny rozmiar i dozwolone widełki dla danego banera; `undefined` dla stylów bez skalowania. */
export function getBannerSizeLimits(style: string): BannerSizeLimits | undefined {
  const preset = broadcastPresets.find((entry) => entry.id === style);
  if (!preset) return undefined;

  return {
    width: preset.width,
    height: preset.height,
    square: Boolean(preset.square),
    minWidth: Math.round(preset.width * BANNER_MIN_SCALE),
    maxWidth: Math.round(preset.width * BANNER_MAX_SCALE),
    minHeight: Math.round(preset.height * BANNER_MIN_SCALE),
    maxHeight: Math.round(preset.height * BANNER_MAX_SCALE),
  };
}

/** Value of one axis: AUTO follows the window, manual uses the typed value, recommended the banner's own size. */
const resolveAxis = (
  mode: BannerSizeMode,
  manual: number,
  viewport: number,
  recommended: number,
  min: number,
  max: number
) => {
  if (mode === 'recommended') return recommended;
  return clamp(mode === 'auto' ? viewport : manual, min, max);
};

/**
 * Baner dostaje dokładnie wybrany rozmiar, a jego układ (flex/grid) rozkłada zawartość w całym polu.
 * Skala typografii rośnie tylko częściowo, żeby większe pole dostawało więcej miejsca, a nie samo powiększenie.
 */
export function resolveBannerSize(input: BannerSizeInput): BannerSize | undefined {
  const limits = getBannerSizeLimits(input.style);
  if (!limits) return undefined;

  if (limits.square) {
    /* One side for both axes, so the banner stays 1:1. AUTO uses the smaller window side. */
    const side = resolveAxis(
      input.widthMode,
      input.width,
      Math.min(input.viewportWidth, input.viewportHeight),
      limits.width,
      limits.minWidth,
      limits.maxWidth
    );
    const squareScale = clamp(
      side / limits.width,
      BANNER_MIN_SCALE,
      BANNER_MAX_SCALE
    );
    return {
      scale: squareScale,
      width: Math.round(side),
      height: Math.round(side),
      layoutWidth: limits.width,
      layoutHeight: limits.height,
    };
  }

  const width = resolveAxis(
    input.widthMode,
    input.width,
    input.viewportWidth,
    input.recommendedWidth ?? limits.width,
    limits.minWidth,
    limits.maxWidth
  );
  /* Recommended height follows the content, so hiding elements makes the banner shorter. */
  const fitsContent = input.heightMode === 'recommended';
  /* Without a window height (the preview) the banner keeps its natural proportions. */
  const viewportHeight = Number.isFinite(input.viewportHeight)
    ? input.viewportHeight
    : (limits.height * width) / limits.width;
  const height = fitsContent
    ? undefined
    : resolveAxis(
        input.heightMode,
        input.height,
        viewportHeight,
        limits.height,
        limits.minHeight,
        limits.maxHeight
      );

  /* A recommended width is already the right size for the content, so it never shrinks the text. */
  const fit = Math.min(
    input.widthMode === 'recommended' ? 1 : width / limits.width,
    height === undefined ? Infinity : height / limits.height
  );
  /* Shrinking must fit the content; growing only partly enlarges it and the layout takes the rest. */
  const scale = clamp(
    fit < 1 ? fit : 1 + (fit - 1) * GROWTH_SHARE,
    BANNER_MIN_SCALE,
    BANNER_MAX_SCALE
  );

  return {
    scale,
    width: Math.round(width),
    height: height === undefined ? undefined : Math.round(height),
    layoutWidth: Math.round(width / scale),
    layoutHeight: height === undefined ? undefined : Math.round(height / scale),
  };
}

/** Zalecana szerokość: układy ze statystykami z boku robią się węższe, gdy statystyki są ukryte. */
export function getRecommendedWidth(
  style: string,
  showStatistics: boolean
): number | undefined {
  const limits = getBannerSizeLimits(style);
  if (!limits) return undefined;
  if (!showStatistics && (style === 'rail' || style === 'halo')) {
    return Math.round(limits.width * 0.65);
  }
  return limits.width;
}
