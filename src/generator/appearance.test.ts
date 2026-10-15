import { describe, expect, test } from 'vitest';
import { appearanceFor, settingsFor } from './appearance';

describe('appearanceFor: which Look controls apply to a mode', () => {
  test('solo uses every control', () => {
    expect(appearanceFor('solo')).toEqual({
      radius: true,
      scheme: true,
      font: true,
      fontSizes: true,
      iconScale: true,
      surface: true,
    });
  });

  test('versus draws its own markup, so per-element sizes and icon scales are hidden like in team and split', () => {
    const ui = appearanceFor('versus');
    expect(ui.fontSizes).toBe(false);
    expect(ui.iconScale).toBe(false);
    expect(ui.radius && ui.scheme && ui.font && ui.surface).toBe(true);
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

  test('split draws its own plates, so the generic card controls stay hidden and the font family remains', () => {
    expect(appearanceFor('split')).toEqual({
      radius: false,
      scheme: false,
      font: true,
      fontSizes: false,
      iconScale: false,
      surface: false,
    });
  });

  test('team draws its own panel with its own theme, radius and opacity, so only the font family is left in the Look tab', () => {
    expect(appearanceFor('team')).toEqual({
      radius: false,
      scheme: false,
      font: true,
      fontSizes: false,
      iconScale: false,
      surface: false,
    });
  });

  test('an unknown mode behaves like solo', () => {
    expect(appearanceFor('whatever')).toEqual(appearanceFor('solo'));
  });
});

describe('settingsFor: which Settings-tab cards and options apply to a mode', () => {
  test('only solo shows the widget elements and session saving', () => {
    expect(settingsFor('solo')).toEqual({ elements: true, autoWidth: true, session: true });
  });

  test('versus, popup, team and split render their own markup, so the solo element toggles and session saving are hidden', () => {
    for (const mode of ['versus', 'popup', 'team', 'split']) {
      const ui = settingsFor(mode);
      expect(ui.elements, mode).toBe(false);
      expect(ui.session, mode).toBe(false);
    }
  });

  test('auto width is meaningless for the full-frame popup only', () => {
    expect(settingsFor('popup').autoWidth).toBe(false);
    expect(settingsFor('team').autoWidth).toBe(true);
    expect(settingsFor('versus').autoWidth).toBe(true);
  });

  test('an unknown mode behaves like solo', () => {
    expect(settingsFor('whatever')).toEqual(settingsFor('solo'));
  });
});
