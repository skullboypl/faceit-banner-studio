import { describe, expect, test } from 'vitest';
import {
  CAMERA_PRESETS,
  RADAR_PRESETS,
  readSplitOptions,
  sameChoice,
  writeChoice,
  SPLIT_AXES,
  SPLIT_BITS,
} from '../widget/src/widget/split-options';

const get = (values: Record<string, unknown>) => (key: string) => values[key];

describe('readSplitOptions', () => {
  test('an empty list keeps the legacy radar and camera presets', () => {
    const options = readSplitOptions(get({ splitRadar: 'aim', splitMini: 'session' }));
    expect(options.axes).toEqual(RADAR_PRESETS.aim);
    expect(options.bits).toEqual(CAMERA_PRESETS.session);
  });

  test('an explicit list is the source of truth and drops unknown tokens', () => {
    const options = readSplitOptions(get({ splitAxes: 'elo,wins,hs', splitCamera: 'rank,nope,elo', splitRadar: 'combat' }));
    expect(options.axes).toEqual(['hs', 'wins']);
    expect(options.bits).toEqual(['elo', 'rank']);
  });

  test('none clears the plate even when a legacy preset is still stored', () => {
    const options = readSplitOptions(get({ splitAxes: 'none', splitCamera: 'none', splitRadar: 'results', splitMini: 'form' }));
    expect(options.axes).toEqual([]);
    expect(options.bits).toEqual([]);
  });

  test('a list of only unknown tokens falls back to the legacy preset', () => {
    const options = readSplitOptions(get({ splitAxes: 'nope', splitRadar: 'results' }));
    expect(options.axes).toEqual(RADAR_PRESETS.results);
  });

  test('look values stay inside their ranges and a bad theme falls back to dark', () => {
    const options = readSplitOptions(get({ splitTheme: 'neon', splitRadius: 99, splitOpacity: 1, splitFont: 10, splitAccent: 'zz' }));
    expect(options.theme).toBe('dark');
    expect(options.radius).toBe(48);
    expect(options.opacity).toBe(40);
    expect(options.font).toBe(70);
    expect(options.accent).toBe('');
  });
});

describe('writeChoice', () => {
  test('keeps catalogue order and uses none when the last piece is turned off', () => {
    expect(writeChoice(SPLIT_AXES, RADAR_PRESETS.combat, 'kd', false)).toBe('adr,hs,wr,kills');
    expect(writeChoice(SPLIT_BITS, ['elo'], 'elo', false)).toBe('none');
    expect(sameChoice(['session', 'elo'], CAMERA_PRESETS.bar)).toBe(true);
  });
});
