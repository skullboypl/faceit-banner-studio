import { ApiError, request } from '../cloud/api';

export type ProfileImageKind = 'avatar' | 'cover';
export type ProfileImageStatus = 'pending' | 'approved' | 'rejected' | 'hidden';

export type OwnProfileImage = {
  kind: ProfileImageKind;
  status: ProfileImageStatus;
  url: string | null;
  width: number;
  height: number;
  rejectReason: string | null;
};

export type ReviewImage = OwnProfileImage & {
  id: string;
  ownerGuid: string;
  nickname: string;
  reports: number;
  createdAt: string;
};

export type ReviewFilter = 'pending' | 'reported' | 'hidden' | 'all';
export type ReviewAction = 'approve' | 'reject' | 'remove';

const AVATAR_SIDE = 256;
const COVER_WIDTH = 1600;
const COVER_HEIGHT = 900;
const AVATAR_BYTES = 150 * 1024;
const COVER_BYTES = 500 * 1024;

export type Crop = { sx: number; sy: number; sw: number; sh: number; dw: number; dh: number };

/**
 * What to cut from the source and how big to draw it. The avatar is a square from the middle, at most
 * 256 px; the cover keeps its shape within 1600 x 900. Neither is ever enlarged.
 */
export function profileCrop(width: number, height: number, kind: ProfileImageKind): Crop {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError('image size must be positive');
  }
  if (kind === 'avatar') {
    const side = Math.min(width, height);
    const out = Math.min(AVATAR_SIDE, side);
    return { sx: Math.round((width - side) / 2), sy: Math.round((height - side) / 2), sw: side, sh: side, dw: out, dh: out };
  }
  const scale = Math.min(1, COVER_WIDTH / width, COVER_HEIGHT / height);
  return { sx: 0, sy: 0, sw: width, sh: height, dw: Math.max(1, Math.round(width * scale)), dh: Math.max(1, Math.round(height * scale)) };
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('compression failed'))), 'image/webp', quality)
  );

/**
 * Crops and re-encodes a picture as WebP in the browser before it is uploaded, so the upload is small and
 * carries no camera metadata. The server checks and re-encodes again; it never trusts this step.
 * Needs a real canvas, so it is exercised in the browser, not in unit tests.
 */
export async function prepareProfileImage(file: File, kind: ProfileImageKind): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const crop = profileCrop(bitmap.width, bitmap.height, kind);
  const canvas = document.createElement('canvas');
  canvas.width = crop.dw;
  canvas.height = crop.dh;
  canvas.getContext('2d')?.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.dw, crop.dh);
  bitmap.close();
  const limit = kind === 'avatar' ? AVATAR_BYTES : COVER_BYTES;
  let quality = 0.86;
  let blob = await toBlob(canvas, quality);
  while (blob.size > limit && quality > 0.4) {
    quality -= 0.1;
    blob = await toBlob(canvas, quality);
  }
  return blob;
}

export async function fetchOwnProfileImages(): Promise<OwnProfileImage[]> {
  return (await request<{ images: OwnProfileImage[] }>('GET', '/api/me/profile-images')).images;
}

export async function uploadProfileImage(kind: ProfileImageKind, file: Blob): Promise<OwnProfileImage> {
  const body = new FormData();
  body.append('file', file, 'image.webp');
  const response = await fetch(`/api/me/profile-images/${kind}`, { method: 'PUT', body, credentials: 'same-origin', cache: 'no-store' });
  const data = (await response.json().catch(() => ({}))) as { image?: OwnProfileImage; error?: string; message?: string };
  if (!response.ok || !data.image) {
    throw new ApiError(response.status, String(data.error ?? 'error'), String(data.message ?? response.statusText));
  }
  return data.image;
}

export const removeProfileImage = (kind: ProfileImageKind) => request<{ ok: true }>('DELETE', `/api/me/profile-images/${kind}`);

export const reportProfileImage = (playerId: string, kind: ProfileImageKind, reason: string) =>
  request<{ ok: true }>('POST', `/api/profiles/${playerId}/report`, { kind, reason });

export async function fetchReviewQueue(status: ReviewFilter): Promise<ReviewImage[]> {
  return (await request<{ images: ReviewImage[] }>('GET', `/api/admin/profile-images?status=${status}`)).images;
}

export const reviewQueueImage = (id: string, action: ReviewAction, reason?: string) =>
  request<{ ok: true }>('POST', `/api/admin/profile-images/${id}`, reason === undefined ? { action } : { action, reason });
