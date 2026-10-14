import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { MAX_UPLOAD_BYTES, sniffImage, toWebp } from './images';

const png = () =>
  sharp({ create: { width: 4, height: 2, channels: 3, background: { r: 231, g: 0, b: 44 } } })
    .png()
    .toBuffer();

describe('sniffImage', () => {
  test('recognises PNG, JPEG and WebP and rejects GIF and SVG', async () => {
    expect(sniffImage(await png())).toBe('png');
    expect(sniffImage(await sharp({ create: { width: 2, height: 2, channels: 3, background: 'white' } }).jpeg().toBuffer())).toBe('jpeg');
    expect(sniffImage(await sharp({ create: { width: 2, height: 2, channels: 3, background: 'white' } }).webp().toBuffer())).toBe('webp');
    expect(sniffImage(Buffer.from('GIF89a' + 'xxxx'))).toBeNull();
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e]))).toBeNull();
  });
});

describe('toWebp', () => {
  test('re-encodes a PNG to WebP and drops a text payload hidden past the pixels', async () => {
    const source = Buffer.concat([await png(), Buffer.from('GPS secret-place')]);
    const image = await toWebp(source);
    expect(sniffImage(image.body)).toBe('webp');
    expect(image).toMatchObject({ width: 4, height: 2 });
    expect(image.body.includes(Buffer.from('secret-place'))).toBe(false);
  });

  test('rejects a GIF that pretends to be a screenshot and a file over 1 MB', async () => {
    await expect(toWebp(Buffer.from('GIF89ahello'))).rejects.toMatchObject({ code: 'bad_type' });
    const huge = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(MAX_UPLOAD_BYTES)]);
    await expect(toWebp(huge)).rejects.toMatchObject({ code: 'too_big' });
  });
});
