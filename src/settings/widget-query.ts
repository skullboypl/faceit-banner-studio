import { SETTINGS_DEFINITIONS } from './definition';
import type { SettingDefinition, SettingKey } from './manager';

export type WidgetQueryParams = Record<string, string | number | boolean | undefined>;

const encodeBase64Utf8 = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

/**
 * The address parameters of a widget for these settings: every setting that has a query name and whose requirements
 * hold, the language and the four statistic slots. The generator links and the previews of saved banners share it.
 */
export function widgetQueryParams(get: (key: SettingKey) => unknown, languageId: string): WidgetQueryParams {
  const params: WidgetQueryParams = {};

  Object.entries(SETTINGS_DEFINITIONS).forEach(([setting, definition]: [string, SettingDefinition]) => {
    if (!definition.query || definition.query.length === 0) return;
    if (definition.requirements && definition.requirements.length !== 0) {
      for (const requirement of definition.requirements) {
        if (get(requirement.setting as SettingKey) !== requirement.value) return;
      }
    }
    const value = get(setting as SettingKey);
    if (value === undefined) return;

    if (setting === 'customInlineCSS') {
      const inlineCss = String(value || '').trim();
      if (!inlineCss) return;
      params[definition.query[0]] = encodeBase64Utf8(inlineCss);
      return;
    }

    params[definition.query[0]] = value as string | number | boolean;
  });

  if (!params.lang) params.lang = languageId;
  params.stats = [get('statSlot1'), get('statSlot2'), get('statSlot3'), get('statSlot4')].toString();
  return params;
}

/** `?a=1&b=2`, skipping what is undefined. */
export function toQueryString(params: WidgetQueryParams): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) return;
    query.set(key, String(value));
  });
  return `?${query.toString()}`;
}
