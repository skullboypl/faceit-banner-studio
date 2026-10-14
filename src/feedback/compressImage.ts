/** Longest side of an uploaded image after compression. */
export const MAX_SIDE = 1600;
/** Target size of a compressed image. */
export const MAX_BYTES = 1_500_000;

const BASE_QUALITY = 0.82;

export type ImagePlan = { width: number; height: number; quality: number };

/** Pure sizing rules: scale the longer side to MAX_SIDE (never up) and lower the quality for huge files. */
export function planImage(width: number, height: number, bytes: number): ImagePlan {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError('image size must be positive');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const quality = bytes > 8_000_000 ? 0.7 : bytes > 3_000_000 ? 0.76 : BASE_QUALITY;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    quality,
  };
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('compression failed'))), 'image/webp', quality)
  );

/**
 * Re-encodes an image as WebP in the browser before it is uploaded (prepared for attachments).
 * Needs a real canvas, so it is exercised in the browser, not in unit tests.
 */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const plan = planImage(bitmap.width, bitmap.height, file.size);
  const canvas = document.createElement('canvas');
  canvas.width = plan.width;
  canvas.height = plan.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, plan.width, plan.height);
  bitmap.close();

  let quality = plan.quality;
  let blob = await toBlob(canvas, quality);
  while (blob.size > MAX_BYTES && quality > 0.4) {
    quality -= 0.1;
    blob = await toBlob(canvas, quality);
  }
  return blob;
}
