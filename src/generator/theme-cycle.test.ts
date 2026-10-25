import { describe, expect, test } from 'vitest';
import { cycleThemes, themeChoices } from './theme-cycle';

describe('themeChoices', () => {
  test('solo FACEIT 2026 steps through solo layouts, not VERSUS', () => {
    const choices = themeChoices('solo', '2026');
    expect(choices).toContain('halo');
    expect(choices).toContain('prime');
    expect(choices).not.toContain('duel');
    expect(choices).not.toContain('lineup');
  });

  test('VERSUS, roster, split and popup each keep their own layouts', () => {
    expect(themeChoices('versus', '2026')).toContain('duel');
    expect(themeChoices('versus', '2026')).not.toContain('halo');
    expect(themeChoices('team', '2026')).toEqual(['lineup', 'sheet']);
    expect(themeChoices('split', '2026')).toEqual(['splitset']);
    expect(themeChoices('popup', '2026')).toEqual(['livecard']);
  });

  test('the classic design steps through the styles the Look list shows', () => {
    const choices = themeChoices('solo', 'legacy');
    expect(choices).toContain('normal');
    expect(choices).toContain('rounded');
    expect(choices).not.toContain('halo');
    expect(choices).not.toContain('terminal');
    expect(choices).not.toContain('aurora');
  });
});

describe('cycleThemes', () => {
  test('wraps from the last theme to the first and back', () => {
    expect(cycleThemes(['prime', 'halo', 'pulse'], 'pulse', 1)).toBe('prime');
    expect(cycleThemes(['prime', 'halo', 'pulse'], 'prime', -1)).toBe('pulse');
    expect(cycleThemes(['prime', 'halo', 'pulse'], 'halo', 1)).toBe('pulse');
  });

  test('a theme outside the list stays reachable, then the arrows enter the list', () => {
    expect(cycleThemes(['prime', 'halo'], 'rounded', 1)).toBe('prime');
    expect(cycleThemes(['prime', 'halo'], 'rounded', -1)).toBe('halo');
  });
});
