import { describe, expect, test } from 'vitest';
import { defaultSettings } from '../components/test-utils';
import type { SettingKey } from './manager';
import { toQueryString, widgetQueryParams } from './widget-query';

const getter = (overrides: Record<string, unknown> = {}) => {
  const settings = { ...defaultSettings(), ...overrides } as unknown as Record<string, unknown>;
  return (key: SettingKey) => settings[key];
};

describe('widgetQueryParams', () => {
  test('carries the style, the language and the four statistic slots', () => {
    const params = widgetQueryParams(getter({ style: 'prime', bannerDesign: '2026', statSlot1: 'KILLS', statSlot2: 'KD', statSlot3: 'ADR', statSlot4: 'WINRATIO' }), 'pl');
    expect(params.style).toBe('prime');
    expect(params.lang).toBe('pl');
    expect(params.stats).toBe('KILLS,KD,ADR,WINRATIO');
  });

  test('keeps a language the widget was given, and only adds the studio one when there is none', () => {
    expect(widgetQueryParams(getter({ widgetLanguage: 'de' }), 'pl').lang).toBe('de');
  });

  test('leaves out settings whose requirements do not hold', () => {
    const solo = widgetQueryParams(getter({ bannerDesign: '2026', style: 'prime' }), 'pl');
    expect(Object.keys(solo).some((key) => key.startsWith('ticker_'))).toBe(false);
    const ticker = widgetQueryParams(getter({ bannerDesign: '2026', style: 'ticker' }), 'pl');
    expect(ticker.ticker_today_kd).toBe(true);
  });

  test('a default popup URL keeps nationality flags off and has no per-phase timing yet', () => {
    const params = widgetQueryParams(getter({ widgetMode: 'popup' }), 'pl');
    expect(params.popup_country).toBe(false);
    expect(params.popup_timing).toBe('');
    expect(params.popup_sort_elo).toBe(false);
  });

  test('writes custom CSS as base64 and omits it when empty', () => {
    expect(widgetQueryParams(getter({ customInlineCSS: '  ' }), 'pl').inline_css_b64).toBeUndefined();
    const params = widgetQueryParams(getter({ customInlineCSS: '.a { color: red }' }), 'pl');
    expect(atob(String(params.inline_css_b64))).toBe('.a { color: red }');
  });
});

describe('toQueryString', () => {
  test('is a query string without the undefined values', () => {
    expect(toQueryString({ a: 1, b: undefined, c: 'x y', d: false })).toBe('?a=1&c=x+y&d=false');
  });
});
