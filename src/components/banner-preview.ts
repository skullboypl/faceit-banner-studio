import { parseRoster } from '../../shared/banner-modes.mjs';
import { broadcastPresets, resolveBannerStyle } from '../../widget/src/styles/styles';
import { getBannerSizeLimits, getRecommendedWidth, resolveBannerSize } from '../../widget/src/utils/banner_size';
import { readTeamOptions, teamRecommendedHeight, teamRecommendedWidth } from '../../widget/src/widget/team-options';
import type { SettingKey } from '../settings/manager';
import { toQueryString, widgetQueryParams } from '../settings/widget-query';

type Get = (key: SettingKey) => unknown;

/** The size, in pixels, the widget is laid out in before the preview shrinks it into its card. */
export type PreviewFrame = { width: number; height: number };

/** Painted box inside the iframe that the thumbnail should zoom to (the popup card, not the 1920 overlay). */
export type PreviewSubject = PreviewFrame & { x: number; y: number };

/** Tallest a saved-banner thumbnail may paint, in CSS pixels of the card. */
export const PREVIEW_ICON_MAX_HEIGHT = 128;

/**
 * CSS scale that turns the recommended OBS size into a small icon: never enlarge, and never taller
 * than PREVIEW_ICON_MAX_HEIGHT. The widget itself keeps its recommended width.
 */
export function previewIconScale(frame: PreviewFrame, cardWidth: number): number {
  const room = Math.max(0, cardWidth);
  if (!frame.width || !frame.height || !room) return 0;
  return Math.min(1, room / frame.width, PREVIEW_ICON_MAX_HEIGHT / frame.height);
}

/** The popup card inside a 1920 overlay, or null when the iframe is a normal banner. */
export function previewSubject(doc: Document): PreviewSubject | null {
  const card = doc.querySelector('.match-popup article');
  if (!card) return null;
  const box = card.getBoundingClientRect();
  if (box.width < 32 || box.height < 32) return null;
  return { x: box.left, y: box.top, width: box.width, height: box.height };
}

/** Scale, then pull the subject to the top-left of the icon (translate is in unscaled iframe pixels). */
export function previewIconTransform(scale: number, subject: PreviewSubject | null): string {
  if (!subject) return `scale(${scale})`;
  return `scale(${scale}) translate(${-subject.x}px, ${-subject.y}px)`;
}

/**
 * A thumbnail is the banner at its recommended OBS size. The card only applies a CSS scale —
 * the widget itself must not reflow to the card.
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
      widthMode: 'recommended',
      width: fallback.width,
      heightMode: 'recommended',
      height: fallback.height,
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

/** The iframe page must not fill the card with a white sheet around the banner. */
export function paintPreviewPage(doc: Document) {
  const html = doc.documentElement;
  if (!html) return;
  html.style.background = 'transparent';
  html.style.colorScheme = 'dark';
  if (doc.body) {
    doc.body.style.background = 'transparent';
    doc.body.style.margin = '0';
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
