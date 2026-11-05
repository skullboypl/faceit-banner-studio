import { describe, expect, test } from 'vitest';
import { broadcastPresets, presetMode, resolveBannerStyle, styles } from '../widget/src/styles/styles';
import { DISPLAY_LOOKS, DISPLAY_MULTI, DISPLAY_PANELS, MINI_LOOKS } from '../widget/src/widget/display-options';
import { SETTINGS_DEFINITIONS } from './settings/definition';
import { widgetQueryParams } from './settings/widget-query';
import type { SettingKey } from './settings/manager';
import english from './translations/english.json';

const link = (values: Record<string, unknown>) =>
  widgetQueryParams((key: SettingKey) => (key in values ? values[key] : SETTINGS_DEFINITIONS[key].defaultValue), 'pl');

describe('Display-Split and Mini-Display', () => {
  test('both are modern solo layouts with a size, a name and a description', () => {
    for (const id of ['displaysplit', 'minidisplay']) {
      expect(styles.find((entry) => entry.id === id)?.modernOnly).toBe(true);
      expect(broadcastPresets.find((entry) => entry.id === id)?.width).toBeGreaterThan(0);
      expect(presetMode(id)).toBe('solo');
      expect(resolveBannerStyle(id, '2026')).toBe(id);
      expect((english as Record<string, string>)[`style.${id}`]).toBeTruthy();
      expect((english as Record<string, string>)[`style.${id}.description`]).toBeTruthy();
    }
    expect((english as Record<string, string>)['style.displaysplit']).toBe('Display-Split');
    expect((english as Record<string, string>)['style.minidisplay']).toBe('Mini-Display');
  });

  test('Display-Split starts as separate panels with every row on; Mini-Display as a pill', () => {
    expect(SETTINGS_DEFINITIONS.displaysplitPanels.defaultValue).toBe('split');
    expect(SETTINGS_DEFINITIONS.displaysplitLook.defaultValue).toBe('glass');
    expect(SETTINGS_DEFINITIONS.displaysplitPanels.options).toEqual([...DISPLAY_PANELS]);
    expect(SETTINGS_DEFINITIONS.displaysplitLook.options).toEqual([...DISPLAY_LOOKS]);
    expect(SETTINGS_DEFINITIONS.minidisplayLook.options).toEqual([...MINI_LOOKS]);
    for (const key of ['displaysplitProgress', 'displaysplitMulti', 'displaysplitFooter', 'minidisplayRecord', 'minidisplayDiff'] as const) {
      expect(SETTINGS_DEFINITIONS[key].defaultValue).toBe(true);
    }
    expect(DISPLAY_MULTI).toEqual(['aces', 'quadros', 'triples', 'sniper', 'mvps']);
  });

  test('each link carries only its own options', () => {
    const split = link({ bannerDesign: '2026', style: 'displaysplit', displaysplitPanels: 'joined' });
    expect(split).toMatchObject({ style: 'displaysplit', display_split_panels: 'joined', display_split_look: 'glass' });
    expect(split).not.toHaveProperty('mini_display_look');
    const mini = link({ bannerDesign: '2026', style: 'minidisplay', minidisplayLook: 'flat' });
    expect(mini).toMatchObject({ style: 'minidisplay', mini_display_look: 'flat', mini_display_diff: true });
    expect(mini).not.toHaveProperty('display_split_panels');
  });
});
