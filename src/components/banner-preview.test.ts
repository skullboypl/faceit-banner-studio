import { describe, expect, test } from 'vitest';
import { TEAM_DEFAULTS, teamRecommendedHeight, teamRecommendedWidth } from '../../widget/src/widget/team-options';
import { SETTINGS_DEFINITIONS } from '../settings/definition';
import type { SettingKey } from '../settings/manager';
import { previewFrame } from './banner-preview';

const get = (overrides: Record<string, unknown> = {}) => (key: SettingKey) =>
  Object.prototype.hasOwnProperty.call(overrides, key)
    ? overrides[key]
    : (SETTINGS_DEFINITIONS[key] as { defaultValue?: unknown }).defaultValue;

describe('previewFrame: the saved-banner picture matches the banner, not a leftover OBS slot', () => {
  test('a two-player roster is as wide as its columns and only as tall as two rows', () => {
    const frame = previewFrame(
      get({
        widgetMode: 'team',
        bannerDesign: '2026',
        style: 'lineup',
        teamRoster: 'SkullBoy,SweetGrandpa',
      })
    );
    expect(frame.width).toBe(teamRecommendedWidth(TEAM_DEFAULTS, 'lineup'));
    expect(frame.height).toBe(teamRecommendedHeight(TEAM_DEFAULTS, 'lineup', 2));
    expect(frame.height).toBeLessThan(280);
  });

  test('five players need more height than two, and the sheet is shorter than the lineup', () => {
    const two = previewFrame(get({ widgetMode: 'team', style: 'lineup', teamRoster: 'a,b' }));
    const five = previewFrame(get({ widgetMode: 'team', style: 'lineup', teamRoster: 'a,b,c,d,e' }));
    const sheet = previewFrame(get({ widgetMode: 'team', style: 'sheet', teamRoster: 'a,b,c,d,e' }));
    expect(five.height).toBeGreaterThan(two.height);
    expect(sheet.height).toBeLessThan(five.height);
  });
});
