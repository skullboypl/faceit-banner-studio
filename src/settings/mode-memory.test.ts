import { describe, expect, test } from 'vitest';
import { toDelta } from '../cloud/delta';
import { SETTINGS_DEFINITIONS } from './definition';
import type { Settings } from './manager';
import { readModeMemory, switchBannerMode } from './mode-memory';

const base = () =>
  Object.fromEntries(
    Object.entries(SETTINGS_DEFINITIONS).map(([key, definition]) => [key, definition.defaultValue])
  ) as Settings;

describe('switchBannerMode', () => {
  test('keeps the mode you leave and restores it when you come back', () => {
    const solo = {
      ...base(),
      widgetMode: 'solo',
      style: 'orbit',
      bannerDesign: 'legacy',
      playerId: 'player-1',
      colorScheme: 'custom',
    } as Settings;

    const toVersus = switchBannerMode(solo, 'versus');
    expect(toVersus.widgetMode).toBe('versus');
    expect(toVersus.style).toBe('duel');
    expect(toVersus.bannerDesign).toBe('2026');
    expect(toVersus.playerId).toBeUndefined();
    expect(readModeMemory(toVersus.modeMemory).solo).toMatchObject({
      style: 'orbit',
      bannerDesign: 'legacy',
      colorScheme: 'custom',
    });

    const versus = { ...solo, ...toVersus, style: 'clash', versusOpponentAccent: '112233' } as Settings;
    const back = switchBannerMode(versus, 'solo');
    expect(back.style).toBe('orbit');
    expect(back.bannerDesign).toBe('legacy');
    expect(back.colorScheme).toBe('custom');
    expect(readModeMemory(back.modeMemory).versus).toMatchObject({
      style: 'clash',
      versusOpponentAccent: '112233',
    });
  });

  test('a second visit uses the saved options instead of the other mode', () => {
    const first = switchBannerMode({ ...base(), widgetMode: 'solo', style: 'prime' } as Settings, 'team');
    const team = { ...base(), ...first, teamTitle: 'Drużyna', style: 'sheet' } as Settings;
    const away = switchBannerMode(team, 'popup');
    const returned = switchBannerMode({ ...base(), ...away } as Settings, 'team');
    expect(returned.teamTitle).toBe('Drużyna');
    expect(returned.style).toBe('sheet');
    expect(returned.popupShowMap).toBe(SETTINGS_DEFINITIONS.popupShowMap.defaultValue);
  });

  test('the account copy keeps the mode you left and the mode that is open', () => {
    const patch = switchBannerMode({ ...base(), widgetMode: 'solo', style: 'orbit' } as Settings, 'versus');
    const stored = toDelta({ ...base(), ...patch } as Settings);
    expect(stored.style).toBe('duel');
    expect(String(stored.modeMemory)).toContain('orbit');
  });

  test('ignores a broken memory blob', () => {
    expect(readModeMemory('{')).toEqual({});
    expect(readModeMemory(null)).toEqual({});
  });
});
