import { describe, expect, test } from 'vitest';
import { broadcastPresets, presetMode, resolveBannerStyle, styles } from '../widget/src/styles/styles';
import { TICKER_VARIANTS, isTickerFamily, tickerShowsBothPages } from '../widget/src/widget/ticker-family';
import { SETTINGS_DEFINITIONS } from './settings/definition';
import { widgetQueryParams } from './settings/widget-query';
import type { SettingKey } from './settings/manager';
import english from './translations/english.json';

const link = (values: Record<string, unknown>) => {
  const get = (key: SettingKey) => (key in values ? values[key] : SETTINGS_DEFINITIONS[key].defaultValue);
  return widgetQueryParams(get, 'pl');
};

describe('ticker layouts', () => {
  test('six new solo layouts, each modern, sized, named and described', () => {
    expect(TICKER_VARIANTS).toHaveLength(6);
    for (const id of TICKER_VARIANTS) {
      expect(styles.find((entry) => entry.id === id)?.modernOnly).toBe(true);
      expect(broadcastPresets.find((entry) => entry.id === id)?.width).toBeGreaterThan(0);
      expect(presetMode(id)).toBe('solo');
      expect(resolveBannerStyle(id, '2026')).toBe(id);
      expect(isTickerFamily(id)).toBe(true);
      expect((english as Record<string, string>)[`style.${id}`]).toBeTruthy();
      expect((english as Record<string, string>)[`style.${id}.description`]).toBeTruthy();
    }
    expect(isTickerFamily('ticker')).toBe(true);
    expect(isTickerFamily('reel')).toBe(false);
    expect(tickerShowsBothPages('tickerextended')).toBe(true);
    expect(tickerShowsBothPages('ticker')).toBe(false);
  });

  test('the original ticker keeps its own settings and size', () => {
    expect(broadcastPresets.find((entry) => entry.id === 'ticker')).toMatchObject({ width: 480, height: 140 });
    const params = link({ bannerDesign: '2026', style: 'ticker' });
    expect(params).toMatchObject({ style: 'ticker', ticker_accent: 'e7002c', ticker_autoplay: true });
    expect(params).not.toHaveProperty('ticker_v2_accent');
  });

  test('a new layout carries its own accent and the shared ticker pages', () => {
    const params = link({ bannerDesign: '2026', style: 'tickerform', tickerTodayHs: true });
    expect(params).toMatchObject({ style: 'tickerform', ticker_form_accent: '3ddc84', ticker_autoplay: true, ticker_today_hs: true });
    expect(params).not.toHaveProperty('ticker_accent');
    expect(params).not.toHaveProperty('ticker_v2_accent');
    expect(link({ bannerDesign: '2026', style: 'reel' })).not.toHaveProperty('ticker_autoplay');
  });
});
