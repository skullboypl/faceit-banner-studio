import { describe, expect, test } from 'vitest';
import { appearanceFor, settingsFor } from './appearance';

describe('appearanceFor: which Look controls apply to a mode', () => {
  test('solo and versus banners use every control', () => {
    for (const mode of ['solo', 'versus']) {
      expect(appearanceFor(mode)).toEqual({
        radius: true,
        scheme: true,
        font: true,
        fontSizes: true,
        iconScale: true,
        surface: true,
      });
    }
  });

  test('popup only takes the font family: its card is transparent and has its own theme, radius and sizes', () => {
    expect(appearanceFor('popup')).toEqual({
      radius: false,
      scheme: false,
      font: true,
      fontSizes: false,
      iconScale: false,
      surface: false,
    });
  });

  test('team and split use their own markup, so per-element sizes and icon scales are hidden but the card controls stay', () => {
    for (const mode of ['team', 'split']) {
      const ui = appearanceFor(mode);
      expect(ui.fontSizes).toBe(false);
      expect(ui.iconScale).toBe(false);
      expect(ui.radius && ui.scheme && ui.font && ui.surface).toBe(true);
    }
  });

  test('an unknown mode behaves like solo', () => {
    expect(appearanceFor('whatever')).toEqual(appearanceFor('solo'));
  });
});

describe('settingsFor: which Settings-tab cards and options apply to a mode', () => {
  test('solo and versus show the widget elements, auto width and session saving', () => {
    for (const mode of ['solo', 'versus']) {
      expect(settingsFor(mode)).toEqual({ elements: true, autoWidth: true, session: true });
    }
  });

  test('popup, team and split render their own markup, so the solo element toggles and session saving are hidden', () => {
    for (const mode of ['popup', 'team', 'split']) {
      const ui = settingsFor(mode);
      expect(ui.elements, mode).toBe(false);
      expect(ui.session, mode).toBe(false);
    }
  });

  test('auto width is meaningless for the full-frame popup only', () => {
    expect(settingsFor('popup').autoWidth).toBe(false);
    expect(settingsFor('team').autoWidth).toBe(true);
  });

  test('an unknown mode behaves like solo', () => {
    expect(settingsFor('whatever')).toEqual(settingsFor('solo'));
  });
});
