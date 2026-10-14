import sharp from 'sharp';

/** Server refuses anything larger than this before decoding. The browser aims for 600 KB. */
export const MAX_UPLOAD_BYTES = 1024 * 1024;
export const MAX_EDGE = 4096;
export const MAX_ATTACHMENTS = 3;

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];

export class ImageReject extends Error {
  constructor(readonly code: 'bad_type' | 'too_big') {
    super(code);
  }
}

const starts = (bytes: Uint8Array, magic: number[]) => magic.every((value, index) => bytes[index] === value);

/** PNG, JPEG or WebP by file contents. Content-Type and the file name are ignored. */
export function sniffImage(bytes: Uint8Array): 'png' | 'jpeg' | 'webp' | null {
  if (starts(bytes, PNG)) return 'png';
  if (starts(bytes, JPEG)) return 'jpeg';
  if (
    bytes.length >= 12 &&
    starts(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

/**
 * Re-encodes to a single WebP frame. `rotate()` applies EXIF orientation and the WebP
 * writer does not copy the original metadata.
 */
export async function toWebp(bytes: Buffer): Promise<{ body: Buffer; width: number; height: number }> {
  if (bytes.length > MAX_UPLOAD_BYTES) throw new ImageReject('too_big');
  if (!sniffImage(bytes)) throw new ImageReject('bad_type');
  try {
    const source = sharp(bytes, { failOn: 'error', limitInputPixels: MAX_EDGE * MAX_EDGE, animated: false, pages: 1 });
    const meta = await source.metadata();
    if (!meta.width || !meta.height || (meta.pages ?? 1) > 1) throw new ImageReject('bad_type');
    if (Math.max(meta.width, meta.height) > MAX_EDGE) throw new ImageReject('too_big');
    const { data, info } = await source.rotate().webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    return { body: data, width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof ImageReject) throw error;
    throw new ImageReject('bad_type');
  }
}
