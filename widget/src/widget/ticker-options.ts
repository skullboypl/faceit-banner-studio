export const TICKER_TODAY = ['wins', 'losses', 'killsAdr', 'kd', 'kr', 'hs'] as const;
export const TICKER_LAST = ['winrate', 'killsAdr', 'kd', 'kr', 'hs'] as const;

export type TickerTodayCell = (typeof TICKER_TODAY)[number];
export type TickerLastCell = (typeof TICKER_LAST)[number];

/** What each page shows when nothing is chosen: the session results, and the recent-match averages. */
const TODAY_DEFAULT: readonly TickerTodayCell[] = ['wins', 'losses', 'killsAdr', 'kd'];
const LAST_DEFAULT: readonly TickerLastCell[] = ['winrate', 'killsAdr', 'kd', 'kr'];

const capital = (cell: string) => cell.charAt(0).toUpperCase() + cell.slice(1);

/** Settings key of one cell, e.g. tickerTodayKillsAdr. */
export const tickerSettingKey = (page: 'today' | 'last', cell: string) => `ticker${capital(page)}${capital(cell)}`;

/** Which cells each ticker page draws, in a fixed order; a setting that is not a boolean takes its default. */
export function readTickerCells(get: (key: string) => unknown) {
  const pick = <T extends string>(page: 'today' | 'last', cells: readonly T[], fallback: readonly T[]) =>
    cells.filter((cell) => {
      const value = get(tickerSettingKey(page, cell));
      return typeof value === 'boolean' ? value : fallback.includes(cell);
    });
  return {
    today: pick('today', TICKER_TODAY, TODAY_DEFAULT),
    last: pick('last', TICKER_LAST, LAST_DEFAULT),
  };
}
