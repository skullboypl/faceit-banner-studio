/** Display-Split: separate panels with gaps (the default) or one card with dividers between the parts. */
export const DISPLAY_PANELS = ['split', 'joined'] as const;
/** How the panels are filled. */
export const DISPLAY_LOOKS = ['glass', 'solid', 'outline'] as const;
/** Mini-Display: a rounded pill or a flat strip. */
export const MINI_LOOKS = ['pill', 'flat'] as const;

/** Display-Split's multi-kill row, in its order. Knife kills are not in the FACEIT data, so MVPs take that place. */
export const DISPLAY_MULTI = ['aces', 'quadros', 'triples', 'sniper', 'mvps'] as const;
export type DisplayMulti = (typeof DISPLAY_MULTI)[number];
