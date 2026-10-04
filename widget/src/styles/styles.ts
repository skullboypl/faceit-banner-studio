export const styles: {
  id: string;
  hidden?: boolean;
  experimental?: boolean;
  modernOnly?: boolean;
}[] = [
  { id: 'prime', modernOnly: true },
  { id: 'showcase', modernOnly: true },
  { id: 'spotlight', modernOnly: true },
  { id: 'broadcast', modernOnly: true },
  { id: 'rail', modernOnly: true },
  { id: 'focus', modernOnly: true },
  { id: 'orbit', modernOnly: true },
  { id: 'halo', modernOnly: true },
  { id: 'pulse', modernOnly: true },
  { id: 'ticker', modernOnly: true },
  { id: 'slab', modernOnly: true },
  { id: 'gauge', modernOnly: true },
  { id: 'card', modernOnly: true },
  { id: 'reel', modernOnly: true },
  { id: 'ribbon', modernOnly: true },
  { id: 'tower', modernOnly: true },
  { id: 'dials', modernOnly: true },
  { id: 'marquee', modernOnly: true },
  { id: 'tally', modernOnly: true },
  { id: 'overlay', modernOnly: true },
  { id: 'ladder', modernOnly: true },
  { id: 'duel', modernOnly: true },
  { id: 'edge', modernOnly: true },
  { id: 'faceoff', modernOnly: true },
  { id: 'clash', modernOnly: true },
  { id: 'tug', modernOnly: true },
  { id: 'rivals', modernOnly: true },
  { id: 'matchup', modernOnly: true },
  { id: 'scoreboard', modernOnly: true },
  { id: 'cycle', modernOnly: true },
  { id: 'surge', modernOnly: true },
  // dotychczasowe
  { id: 'normal' },
  { id: 'animated' },
  { id: 'compact' },
  { id: 'rounded' },
  { id: 'rounded-compact' },
  { id: 'radar' },
  { id: 'classic' },

  // nowe layouty/efekty
  { id: 'amoled' },
  { id: 'aurora', hidden: true },
  { id: 'auroraflow', hidden: true },
  { id: 'banner' },
  { id: 'card', hidden: true },
  { id: 'circle' },
  { id: 'circuit', hidden: true },
  { id: 'glass' },
  { id: 'horizon' },
  { id: 'justelo' },
  { id: 'justelomatches' },
  { id: 'justelomatchesname' },
  { id: 'justeloname' },
  { id: 'neon', hidden: true },
  { id: 'photon', hidden: true },
  { id: 'pulsegrid', hidden: true },
  { id: 'ripple', hidden: true },
  { id: 'sidebar', hidden: true },
  { id: 'split', hidden: true },
  { id: 'stack' },
  { id: 'terminal' },

  // własny
  { id: 'custom', experimental: true, hidden: true },
];

export const broadcastPresets: readonly {
  id: string;
  width: number;
  height: number;
  /** Banner that animates on its own, e.g. rotating tabs (shown as ANIM in the list). */
  animated?: boolean;
  /** Always 1:1, e.g. a circle. */
  square?: boolean;
  /** Two-player banner, offered only in VERSUS mode. */
  versus?: boolean;
}[] = [
  { id: 'prime', width: 540, height: 250 },
  { id: 'showcase', width: 500, height: 180, animated: true },
  { id: 'spotlight', width: 500, height: 200, animated: true },
  { id: 'broadcast', width: 500, height: 188 },
  { id: 'rail', width: 620, height: 116 },
  { id: 'focus', width: 340, height: 352 },
  { id: 'orbit', width: 280, height: 360 },
  { id: 'halo', width: 620, height: 150 },
  { id: 'pulse', width: 320, height: 320, square: true },
  { id: 'ticker', width: 480, height: 140, animated: true },
  { id: 'slab', width: 480, height: 100 },
  { id: 'gauge', width: 340, height: 290 },
  { id: 'card', width: 340, height: 240 },
  { id: 'reel', width: 480, height: 130, animated: true },
  { id: 'ribbon', width: 640, height: 100 },
  { id: 'tower', width: 220, height: 380 },
  { id: 'dials', width: 440, height: 150 },
  { id: 'marquee', width: 520, height: 120, animated: true },
  { id: 'duel', width: 500, height: 150, versus: true },
  { id: 'edge', width: 480, height: 96, versus: true },
  { id: 'faceoff', width: 420, height: 250, versus: true },
  { id: 'clash', width: 580, height: 120, versus: true },
  { id: 'tug', width: 480, height: 130, versus: true },
  { id: 'rivals', width: 380, height: 190, versus: true },
  { id: 'tally', width: 500, height: 210, versus: true },
  { id: 'overlay', width: 420, height: 400, versus: true },
  { id: 'ladder', width: 580, height: 170, versus: true },
  { id: 'matchup', width: 460, height: 250, versus: true },
  { id: 'scoreboard', width: 760, height: 124, versus: true },
  { id: 'cycle', width: 520, height: 150, versus: true, animated: true },
  { id: 'surge', width: 480, height: 130, versus: true, animated: true },
];

export const isVersusStyle = (style: string) =>
  broadcastPresets.some((preset) => preset.id === style && preset.versus);

export function resolveBannerStyle(style: string, design: string) {
  const modern = styles.some((entry) => entry.id === style && entry.modernOnly);
  if (design === '2026') return modern ? style : 'prime';
  return modern ? 'rounded' : style;
}

export const colorSchemes: string[] = [
  'dark',
  'faceit',
  'ctp-latte',
  'ctp-frappe',
  'ctp-macchiato',
  'ctp-mocha',
  'custom',
];
