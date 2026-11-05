/**
 * Solo layouts built on the ticker: they share its pages (today and the last matches), its autoplay and its cell
 * choices, and each keeps its own accent and level glow. The original `ticker` stays as it was.
 */
export const TICKER_VARIANTS = ['tickerv2', 'tickerprofile', 'tickerextended', 'tickerslim', 'tickerform', 'tickerstack'] as const;
export type TickerVariant = (typeof TICKER_VARIANTS)[number];

export const TICKER_FAMILY = ['ticker', ...TICKER_VARIANTS] as const;

export const isTickerFamily = (style: string) => (TICKER_FAMILY as readonly string[]).includes(style);

/** Shows both pages at once, so it never rotates. */
export const tickerShowsBothPages = (style: string) => style === 'tickerextended';
