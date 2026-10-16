import { describe, expect, test } from 'vitest';
import { TICKER_LAST, TICKER_TODAY, readTickerCells, tickerSettingKey } from '../widget/src/widget/ticker-options';
import { SETTINGS_DEFINITIONS as settingDefinitions } from './settings/definition';

describe('ticker cells', () => {
  test('by default today shows wins, losses, kills/ADR and K/D of the session; the last matches show win rate, kills/ADR, K/D and K/R', () => {
    const cells = readTickerCells(() => undefined);
    expect(cells.today).toEqual(['wins', 'losses', 'killsAdr', 'kd']);
    expect(cells.last).toEqual(['winrate', 'killsAdr', 'kd', 'kr']);
  });

  test('each cell can be switched on or off, and the order stays fixed', () => {
    const settings: Record<string, unknown> = {
      [tickerSettingKey('today', 'wins')]: false,
      [tickerSettingKey('today', 'hs')]: true,
      [tickerSettingKey('today', 'kr')]: true,
      [tickerSettingKey('last', 'kr')]: false,
      [tickerSettingKey('last', 'hs')]: true,
    };
    const cells = readTickerCells((key) => settings[key]);
    expect(cells.today).toEqual(['losses', 'killsAdr', 'kd', 'kr', 'hs']);
    expect(cells.last).toEqual(['winrate', 'killsAdr', 'kd', 'hs']);
  });

  test('a value that is not a boolean falls back to the default', () => {
    const cells = readTickerCells(() => 'yes');
    expect(cells.today).toEqual(['wins', 'losses', 'killsAdr', 'kd']);
  });

  test('every cell has a setting with the same default and a ticker_ query name', () => {
    const defaults = readTickerCells(() => undefined);
    for (const [page, keys] of [['today', TICKER_TODAY], ['last', TICKER_LAST]] as const) {
      for (const cell of keys) {
        const definition = (settingDefinitions as Record<string, { defaultValue?: unknown; query?: string[] }>)[tickerSettingKey(page, cell)];
        expect(definition, `${page}.${cell}`).toBeDefined();
        expect(definition.defaultValue).toBe(defaults[page].includes(cell as never));
        expect(definition.query?.[0]).toMatch(/^ticker_(today|last)_/);
      }
    }
  });
});
