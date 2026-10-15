import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { ImageReject, MAX_EDGE, MAX_UPLOAD_BYTES, sniffImage } from './images';

export const PROFILE_KINDS = ['avatar', 'cover'] as const;
export type ProfileKind = (typeof PROFILE_KINDS)[number];

/** Different people who must report an approved image before it is hidden until an admin looks at it. */
export const REPORT_HIDE_THRESHOLD = 3;

const AVATAR_EDGE = 512;
const COVER_WIDTH = 1920;
const COVER_HEIGHT = 1080;

export const isProfileKind = (value: unknown): value is ProfileKind =>
  typeof value === 'string' && (PROFILE_KINDS as readonly string[]).includes(value);

/** FACEIT player ids are UUIDs; the looser pattern also admits the ids the tests and the dev admin use. */
export const isPlayerId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9-]{3,63}$/.test(value);

/** Unguessable object key. It names the kind only: no nickname, no player id. */
export const profileKey = (kind: ProfileKind): string => `pf/${kind}/${randomBytes(16).toString('hex')}.webp`;

/**
 * Re-encodes an upload to a single WebP frame without metadata. The avatar is always a 512 px
 * square (cropped to the middle); the cover keeps its shape within 1920 x 1080 and is not enlarged.
 */
export async function toProfileWebp(
  bytes: Buffer,
  kind: ProfileKind
): Promise<{ body: Buffer; width: number; height: number }> {
  if (bytes.length > MAX_UPLOAD_BYTES) throw new ImageReject('too_big');
  if (!sniffImage(bytes)) throw new ImageReject('bad_type');
  try {
    const source = sharp(bytes, { failOn: 'error', limitInputPixels: MAX_EDGE * MAX_EDGE, animated: false, pages: 1 });
    const meta = await source.metadata();
    if (!meta.width || !meta.height || (meta.pages ?? 1) > 1) throw new ImageReject('bad_type');
    if (Math.max(meta.width, meta.height) > MAX_EDGE) throw new ImageReject('too_big');
    const oriented = source.rotate();
    const resized =
      kind === 'avatar'
        ? oriented.resize({ width: AVATAR_EDGE, height: AVATAR_EDGE, fit: 'cover', position: 'centre' })
        : oriented.resize({ width: COVER_WIDTH, height: COVER_HEIGHT, fit: 'inside', withoutEnlargement: true });
    const { data, info } = await resized.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    return { body: data, width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof ImageReject) throw error;
    throw new ImageReject('bad_type');
  }
}
