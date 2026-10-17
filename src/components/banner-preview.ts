import { parseRoster } from '../../shared/banner-modes.mjs';
import { broadcastPresets, resolveBannerStyle } from '../../widget/src/styles/styles';
import {
  type BannerSizeMode,
  getBannerSizeLimits,
  getRecommendedWidth,
  resolveBannerSize,
} from '../../widget/src/utils/banner_size';
import { readTeamOptions, teamRecommendedHeight, teamRecommendedWidth } from '../../widget/src/widget/team-options';
import type { SettingKey } from '../settings/manager';
import { toQueryString, widgetQueryParams } from '../settings/widget-query';

type Get = (key: SettingKey) => unknown;

/** The size, in pixels, the widget is laid out in before the preview shrinks it into its card. */
export type PreviewFrame = { width: number; height: number; left?: number; top?: number };

const asMode = (value: unknown): BannerSizeMode =>
  value === 'manual' || value === 'auto' || value === 'recommended' ? value : 'recommended';

/**
 * A thumbnail has no OBS window, so AUTO is treated as the banner's own size. Manual width/height
 * stay as the saved banner stored them.
 */
export function previewFrame(get: Get): PreviewFrame {
  const mode = get('widgetMode');
  if (mode === 'popup') return { width: 1920, height: 1080 };
  if (mode === 'split') return { width: 300, height: 300 };
  const style = resolveBannerStyle(String(get('style')), String(get('bannerDesign')));
  const preset = broadcastPresets.find((entry) => entry.id === style);
  const options = readTeamOptions((key) => get(key as SettingKey));
  const layout = style === 'sheet' ? 'sheet' : 'lineup';
  const teamWidth = teamRecommendedWidth(options, layout);
  const teamHeight = teamRecommendedHeight(options, layout, parseRoster(String(get('teamRoster') || '')).length);
  const fallback = mode === 'team'
    ? { width: teamWidth, height: teamHeight }
    : { width: preset?.width ?? 500, height: preset?.height ?? 180 };

  if (String(get('bannerDesign')) === '2026' && getBannerSizeLimits(style)) {
    const sized = resolveBannerSize({
      style,
      widthMode: asMode(get('bannerWidthMode')) === 'auto' ? 'recommended' : asMode(get('bannerWidthMode')),
      width: Number(get('bannerWidth')) || fallback.width,
      heightMode: asMode(get('bannerHeightMode')) === 'auto' ? 'recommended' : asMode(get('bannerHeightMode')),
      height: Number(get('bannerHeight')) || fallback.height,
      recommendedWidth: mode === 'team' ? teamWidth : getRecommendedWidth(style, Boolean(get('showStatistics'))),
      viewportWidth: Infinity,
      viewportHeight: Infinity,
    });
    if (sized) {
      return { width: sized.width, height: sized.height ?? fallback.height };
    }
  }

  return fallback;
}

/**
 * A roomy iframe so the banner can paint at its full width. The card then scales and crops the
 * view to that painting — the iframe size itself must not shrink or the widget clips.
 */
export function previewStage(frame: PreviewFrame): PreviewFrame {
  if (frame.width >= 1600) return { width: 1920, height: 1080 };
  return { width: 1920, height: Math.max(frame.height, 720) };
}

const previewRoot = (doc: Document): HTMLElement | null =>
  (doc.querySelector('.team-banner') as HTMLElement | null) ||
  (doc.querySelector('.match-popup > article') as HTMLElement | null) ||
  (doc.querySelector('.split-plate') as HTMLElement | null) ||
  (doc.querySelector('.wrapper') as HTMLElement | null);

/** Border-box of a node plus anything that paints outside it, so the scale never slices a column. */
function paintedExtent(root: HTMLElement): PreviewFrame {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  const add = (el: Element) => {
    const box = el.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return;
    left = Math.min(left, box.left);
    top = Math.min(top, box.top);
    right = Math.max(right, box.right);
    bottom = Math.max(bottom, box.bottom);
  };
  add(root);
  root.querySelectorAll('*').forEach(add);
  const width = Number.isFinite(left)
    ? right - left
    : Math.max(root.scrollWidth, root.offsetWidth);
  const height = Number.isFinite(top)
    ? bottom - top
    : Math.max(root.scrollHeight, root.offsetHeight);
  return {
    width: Math.ceil(Math.max(width, root.scrollWidth, root.offsetWidth)),
    height: Math.ceil(Math.max(height, root.scrollHeight, root.offsetHeight)),
    left: Math.floor(Number.isFinite(left) ? left : 0),
    top: Math.floor(Number.isFinite(top) ? top : 0),
  };
}

/** The painted widget inside the iframe, ignoring leftover page around it. */
export function measureBanner(doc: Document): PreviewFrame | null {
  const node = previewRoot(doc);
  if (!node) return null;
  const box = paintedExtent(node);
  if (box.width < 8 || box.height < 8) return null;
  return box;
}

/** The iframe page must not fill the card with a white sheet around the banner. */
export function paintPreviewPage(doc: Document) {
  const html = doc.documentElement;
  html.classList.remove('banner-sized');
  html.style.background = 'transparent';
  html.style.colorScheme = 'dark';
  html.style.setProperty('overflow', 'visible', 'important');
  if (doc.body) {
    doc.body.style.background = 'transparent';
    doc.body.style.margin = '0';
    doc.body.style.setProperty('overflow', 'visible', 'important');
  }
  const wrapper = doc.querySelector('.wrapper') as HTMLElement | null;
  if (wrapper && !doc.querySelector('.match-popup')) {
    wrapper.style.setProperty('width', 'max-content', 'important');
    wrapper.style.setProperty('height', 'max-content', 'important');
    wrapper.style.setProperty('max-width', 'none', 'important');
    wrapper.style.setProperty('overflow', 'visible', 'important');
    wrapper.style.zoom = '1';
  }
}

/**
 * The widget page for a saved banner, as OBS would load it, with what a preview must not do switched off:
 * it is not counted as an open banner, it shows no news intro and it does not touch the session of the studio.
 */
export function previewUrl(get: Get, languageId: string, origin: string): string {
  const mode = get('widgetMode');
  const params = {
    ...widgetQueryParams(get, languageId),
    presence: 'off',
    intro: false,
    save_session: false,
    thumb: true,
    ...(mode === 'popup' ? { popup_preview: 'pre' } : {}),
    ...(mode === 'split' ? { part: 'radar' } : {}),
    ...(mode === 'popup'
      ? {}
      : { banner_width_mode: 'recommended', banner_height_mode: 'recommended' }),
  };
  return `${origin}/widget/${toQueryString(params)}`;
}
