import { parseRoster } from '../../shared/banner-modes.mjs';
import { broadcastPresets, resolveBannerStyle } from '../../widget/src/styles/styles';
import { readTeamOptions, teamRecommendedHeight, teamRecommendedWidth } from '../../widget/src/widget/team-options';
import type { SettingKey } from '../settings/manager';
import { toQueryString, widgetQueryParams } from '../settings/widget-query';

type Get = (key: SettingKey) => unknown;

/** The size, in pixels, the widget is laid out in before the preview shrinks it into its card. */
export type PreviewFrame = { width: number; height: number };

export function previewFrame(get: Get): PreviewFrame {
  const mode = get('widgetMode');
  if (mode === 'popup') return { width: 1920, height: 1080 };
  if (mode === 'split') return { width: 300, height: 300 };
  const style = resolveBannerStyle(String(get('style')), String(get('bannerDesign')));
  const preset = broadcastPresets.find((entry) => entry.id === style);
  if (mode === 'team') {
    const layout = style === 'sheet' ? 'sheet' : 'lineup';
    const options = readTeamOptions((key) => get(key as SettingKey));
    return {
      width: teamRecommendedWidth(options, layout),
      height: teamRecommendedHeight(options, layout, parseRoster(String(get('teamRoster') || '')).length),
    };
  }
  return { width: preset?.width ?? 500, height: preset?.height ?? 180 };
}

/**
 * The widget page for a saved banner, as OBS would load it, with what a preview must not do switched off:
 * it is not counted as an open banner, it shows no news intro and it does not touch the session of the studio.
 */
export function previewUrl(get: Get, languageId: string, origin: string): string {
  const params = {
    ...widgetQueryParams(get, languageId),
    presence: 'off',
    intro: false,
    save_session: false,
    ...(get('widgetMode') === 'split' ? { part: 'radar' } : {}),
  };
  return `${origin}/widget/${toQueryString(params)}`;
}
