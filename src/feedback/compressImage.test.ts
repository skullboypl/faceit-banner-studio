import { describe, expect, test } from 'vitest';
import { MAX_SIDE, planImage } from './compressImage';

describe('planImage', () => {
  test('keeps small images untouched', () => {
    expect(planImage(800, 600, 100_000)).toEqual({ width: 800, height: 600, quality: 0.82 });
  });

  test('scales the longer side down to 1600 and keeps the ratio', () => {
    expect(planImage(4000, 3000, 500_000)).toMatchObject({ width: 1600, height: 1200 });
  });

  test('handles portrait and square images', () => {
    expect(planImage(3000, 4000, 500_000)).toMatchObject({ width: 1200, height: 1600 });
    expect(planImage(3200, 3200, 500_000)).toMatchObject({ width: 1600, height: 1600 });
  });

  test('never upscales', () => {
    expect(planImage(1000, 1000, 50_000)).toMatchObject({ width: 1000, height: 1000 });
    expect(planImage(MAX_SIDE, 10, 1)).toMatchObject({ width: MAX_SIDE, height: 10 });
  });

  test('rounds to whole pixels and never produces a zero side', () => {
    expect(planImage(1601, 900, 1000)).toMatchObject({ width: 1600, height: 899 });
    expect(planImage(10_000, 1, 1000)).toMatchObject({ width: 1600, height: 1 });
  });

  test('lowers the quality for very large files', () => {
    expect(planImage(4000, 3000, 4_000_000).quality).toBeLessThan(0.82);
    expect(planImage(4000, 3000, 12_000_000).quality).toBeLessThan(planImage(4000, 3000, 4_000_000).quality);
  });

  test('rejects an empty or invalid image size', () => {
    expect(() => planImage(0, 0, 10)).toThrow(RangeError);
    expect(() => planImage(100, -5, 10)).toThrow(RangeError);
    expect(() => planImage(Number.NaN, 100, 10)).toThrow(RangeError);
  });
});
