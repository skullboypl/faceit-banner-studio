import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { ImageReject, MAX_UPLOAD_BYTES } from './images';
import { PROFILE_KINDS, REPORT_HIDE_THRESHOLD, isProfileKind, isPlayerId, profileKey, toProfileWebp } from './profile-images';

const png = (width: number, height: number, withExif = false) => {
  let image = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 80, b: 20 } } });
  if (withExif) image = image.withMetadata({ exif: { IFD0: { Copyright: 'someone' } } });
  return image.png().toBuffer();
};

describe('profile image kinds and ids', () => {
  test('there are exactly an avatar and a cover', () => {
    expect([...PROFILE_KINDS]).toEqual(['avatar', 'cover']);
    expect(isProfileKind('avatar')).toBe(true);
    expect(isProfileKind('cover')).toBe(true);
    expect(isProfileKind('banner')).toBe(false);
    expect(isProfileKind(undefined)).toBe(false);
  });

  test('a player id is a FACEIT guid, nothing that could reach a query or a path', () => {
    expect(isPlayerId('0a1b2c3d-1111-4222-8333-444455556666')).toBe(true);
    expect(isPlayerId('guid-alice')).toBe(true);
    for (const bad of ['', '../etc/passwd', 'a b', "x'; DROP TABLE users;--", 'a'.repeat(80), '%00']) expect(isPlayerId(bad), bad).toBe(false);
  });

  test('keys are random, named by kind, and never contain the player id', () => {
    const a = profileKey('avatar');
    const b = profileKey('avatar');
    expect(a).toMatch(/^pf\/avatar\/[0-9a-f]{32}\.webp$/);
    expect(a).not.toBe(b);
    expect(profileKey('cover')).toMatch(/^pf\/cover\/[0-9a-f]{32}\.webp$/);
  });

  test('three different reports hide an image', () => {
    expect(REPORT_HIDE_THRESHOLD).toBe(3);
  });
});

describe('toProfileWebp', () => {
  test('an avatar is cropped to a 512 px square WebP, whatever the source shape', async () => {
    const out = await toProfileWebp(await png(1200, 400), 'avatar');
    expect([out.width, out.height]).toEqual([512, 512]);
    expect((await sharp(out.body).metadata()).format).toBe('webp');
  });

  test('a small avatar is not left tiny: it is brought to 512 px too', async () => {
    const out = await toProfileWebp(await png(64, 64), 'avatar');
    expect([out.width, out.height]).toEqual([512, 512]);
  });

  test('a cover keeps its shape, fits 1920 x 1080 and is never enlarged', async () => {
    const wide = await toProfileWebp(await png(3000, 1000), 'cover');
    expect(wide.width).toBe(1920);
    expect(Math.abs(wide.height - 640)).toBeLessThanOrEqual(1);
    const small = await toProfileWebp(await png(800, 300), 'cover');
    expect([small.width, small.height]).toEqual([800, 300]);
  });

  test('metadata such as EXIF does not survive', async () => {
    const out = await toProfileWebp(await png(300, 300, true), 'avatar');
    const meta = await sharp(out.body).metadata();
    expect(meta.exif).toBeUndefined();
  });

  test('rejects files that are not PNG, JPEG or WebP, whatever they claim to be', async () => {
    await expect(toProfileWebp(Buffer.from('GIF89a....'), 'avatar')).rejects.toMatchObject({ code: 'bad_type' });
    await expect(toProfileWebp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'cover')).rejects.toBeInstanceOf(ImageReject);
    await expect(toProfileWebp(Buffer.alloc(0), 'avatar')).rejects.toBeInstanceOf(ImageReject);
  });

  test('rejects files above 1 MB before decoding', async () => {
    await expect(toProfileWebp(Buffer.alloc(MAX_UPLOAD_BYTES + 1, 1), 'cover')).rejects.toMatchObject({ code: 'too_big' });
  });

  test('rejects a corrupt image that has a valid header', async () => {
    const good = await png(100, 100);
    await expect(toProfileWebp(good.subarray(0, 40), 'avatar')).rejects.toMatchObject({ code: 'bad_type' });
  });
});
