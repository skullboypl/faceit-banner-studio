import { broadcastPresets, styles } from '../../widget/src/styles/styles';

/** Legacy styles the Look dropdown hides until asked. Kept in step with StyleTab. */
const LEGACY_FOLDED = new Set([
  'terminal',
  'stack',
  'justelo',
  'justelomatches',
  'justelomatchesname',
  'justeloname',
  'horizon',
  'glass',
  'circle',
  'banner',
  'amoled',
]);

/** Themes the arrows can step through for this mode and design. */
export function themeChoices(mode: string, design: string): string[] {
  if (design === '2026') {
    return broadcastPresets
      .filter((preset) => (preset.group ?? (preset.versus ? 'versus' : 'solo')) === mode)
      .map((preset) => preset.id);
  }
  const seen = new Set<string>();
  return styles.flatMap((style) => {
    if (style.hidden || style.modernOnly || LEGACY_FOLDED.has(style.id) || seen.has(style.id)) return [];
    seen.add(style.id);
    return [style.id];
  });
}

/** Next or previous theme, wrapping around. A theme outside the list is kept as the start. */
export function cycleThemes(choices: readonly string[], current: string, delta: number): string {
  const list = choices.length === 0 ? [current] : choices.includes(current) ? [...choices] : [current, ...choices];
  if (list.length === 0) return current;
  const index = Math.max(0, list.indexOf(current));
  return list[((index + delta) % list.length + list.length) % list.length];
}
