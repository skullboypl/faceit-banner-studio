import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { SeasonalDecor } from '../widget/src/widget/SeasonalDecor';
import { XMAS_FLAKES, readXmasOptions, xmasActive } from '../widget/src/widget/seasonal';
import { SETTINGS_DEFINITIONS } from './settings/definition';
import { widgetQueryParams } from './settings/widget-query';
import type { SettingKey } from './settings/manager';

const read = (values: Record<string, unknown>) => readXmasOptions((key) => values[key]);

describe('Christmas extras', () => {
  test('everything is off by default, in the settings and in the reader', () => {
    for (const key of ['xmasLights', 'xmasSnow', 'xmasCap', 'xmasDrift', 'xmasFrost'] as const) {
      expect(SETTINGS_DEFINITIONS[key].defaultValue).toBe(false);
    }
    const options = read({});
    expect(options).toEqual({ lights: false, colors: 'classic', snow: false, amount: 'medium', cap: false, drift: false, frost: false, inset: 0 });
    expect(xmasActive(options)).toBe(false);
    expect(render(<SeasonalDecor options={options} />).container.innerHTML).toBe('');
  });

  test('each extra draws only when switched on, with the chosen colours and amount of snow', () => {
    const view = render(<SeasonalDecor options={read({ xmasLights: true, xmasLightColors: 'faceit', xmasSnow: true, xmasSnowAmount: 'heavy' })} scale={2.4} />).container;
    const decor = view.querySelector<HTMLElement>('.seasonal-decor');
    expect(decor?.className).toContain('colors-faceit');
    expect(decor?.style.getPropertyValue('--decor-scale')).toBe('2.4');
    expect(decor?.getAttribute('aria-hidden')).toBe('true');
    expect(view.querySelectorAll('.xmas-snow i')).toHaveLength(XMAS_FLAKES.heavy);
    expect(view.querySelectorAll('.xmas-bulbs i').length).toBeGreaterThan(0);
    expect(view.querySelector('.xmas-cap')).toBeNull();
    expect(view.querySelector('.xmas-frost')).toBeNull();
    const capOnly = render(<SeasonalDecor options={read({ xmasCap: true, xmasFrost: true, xmasLightColors: 'disco' })} />).container;
    expect(capOnly.querySelector('.seasonal-decor')?.className).toContain('colors-classic');
    expect(capOnly.querySelector('.xmas-cap')).not.toBeNull();
    expect(capOnly.querySelector('.xmas-frost')).not.toBeNull();
    expect(capOnly.querySelector('.xmas-snow')).toBeNull();
    expect(capOnly.querySelector('.xmas-drift')).toBeNull();
  });

  test('the inset slider pulls the overlay in, stays inside its range and only goes in the link when set', () => {
    expect(read({ xmasSnow: true, xmasInset: 12 }).inset).toBe(12);
    expect(read({ xmasInset: 400 }).inset).toBe(40);
    expect(read({ xmasInset: -5 }).inset).toBe(0);
    expect(read({ xmasInset: 'x' }).inset).toBe(0);
    const decor = render(<SeasonalDecor options={read({ xmasCap: true, xmasInset: 8 })} />).container.querySelector<HTMLElement>('.seasonal-decor');
    expect(decor?.style.getPropertyValue('--xmas-inset')).toBe('8px');
    const get = (values: Record<string, unknown>) => (key: SettingKey) => (key in values ? values[key] : SETTINGS_DEFINITIONS[key].defaultValue);
    expect(widgetQueryParams(get({ xmasCap: true, xmasInset: 8 }), 'pl')).toMatchObject({ xmas_inset: 8 });
    expect(widgetQueryParams(get({ xmasCap: true }), 'pl')).not.toHaveProperty('xmas_inset');
  });

  test('the snow drift on the bottom edge is an extra of its own', () => {
    const options = read({ xmasDrift: true });
    expect(xmasActive(options)).toBe(true);
    const view = render(<SeasonalDecor options={options} />).container;
    expect(view.querySelector('.xmas-drift')).not.toBeNull();
    expect(view.querySelector('.xmas-cap')).toBeNull();
    const values: Record<string, unknown> = { xmasDrift: true };
    const get = (key: SettingKey) => (key in values ? values[key] : SETTINGS_DEFINITIONS[key].defaultValue);
    expect(widgetQueryParams(get, 'pl')).toMatchObject({ xmas_drift: true });
  });

  test('the OBS link carries only the extras that are on', () => {
    const values: Record<string, unknown> = { xmasSnow: true, xmasSnowAmount: 'light' };
    const get = (key: SettingKey) => (key in values ? values[key] : SETTINGS_DEFINITIONS[key].defaultValue);
    const params = widgetQueryParams(get, 'pl');
    expect(params).toMatchObject({ xmas_snow: true, xmas_snow_amount: 'light' });
    expect(params).not.toHaveProperty('xmas_lights');
    expect(params).not.toHaveProperty('xmas_colors');
  });
});
