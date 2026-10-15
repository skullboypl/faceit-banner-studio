import { afterEach, describe, expect, test, vi } from 'vitest';
import { ApiError } from '../cloud/api';
import {
  fetchOwnProfileImages,
  fetchReviewQueue,
  profileCrop,
  removeProfileImage,
  reportProfileImage,
  reviewQueueImage,
  uploadProfileImage,
} from './images';

const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, statusText: 'x', json: async () => body }) as Response;
const stub = (response: Response) => {
  const fetcher = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
};
const call = (fetcher: ReturnType<typeof stub>, index = 0) => fetcher.mock.calls[index] as unknown as [string, RequestInit];

afterEach(() => vi.unstubAllGlobals());

describe('profileCrop', () => {
  test('an avatar is a square cut from the middle, at most 256 px', () => {
    expect(profileCrop(1200, 400, 'avatar')).toEqual({ sx: 400, sy: 0, sw: 400, sh: 400, dw: 256, dh: 256 });
    expect(profileCrop(500, 900, 'avatar')).toEqual({ sx: 0, sy: 200, sw: 500, sh: 500, dw: 256, dh: 256 });
  });

  test('a small avatar keeps its own size instead of being stretched', () => {
    expect(profileCrop(100, 100, 'avatar')).toMatchObject({ dw: 100, dh: 100 });
  });

  test('a cover keeps its shape and fits 1600 x 900, never enlarged', () => {
    expect(profileCrop(3200, 1000, 'cover')).toEqual({ sx: 0, sy: 0, sw: 3200, sh: 1000, dw: 1600, dh: 500 });
    expect(profileCrop(1000, 2000, 'cover')).toEqual({ sx: 0, sy: 0, sw: 1000, sh: 2000, dw: 450, dh: 900 });
    expect(profileCrop(800, 300, 'cover')).toMatchObject({ dw: 800, dh: 300 });
  });

  test('refuses an empty image', () => {
    expect(() => profileCrop(0, 10, 'avatar')).toThrow(RangeError);
    expect(() => profileCrop(10, Number.NaN, 'cover')).toThrow(RangeError);
  });
});

describe('own images', () => {
  test('are listed from the account endpoint', async () => {
    const fetcher = stub(reply({ images: [{ kind: 'avatar', status: 'pending', url: 'https://x/a.webp', width: 512, height: 512, rejectReason: null }] }));
    const images = await fetchOwnProfileImages();
    expect(images[0].status).toBe('pending');
    expect(call(fetcher)[0]).toBe('/api/me/profile-images');
  });

  test('upload sends the image as a multipart file to the kind\'s endpoint, with the session', async () => {
    const fetcher = stub(reply({ image: { kind: 'cover', status: 'pending', url: 'https://x/c.webp', width: 1600, height: 900, rejectReason: null } }, 201));
    const image = await uploadProfileImage('cover', new Blob(['x'], { type: 'image/webp' }));
    expect(image.kind).toBe('cover');
    const [url, init] = call(fetcher);
    expect(url).toBe('/api/me/profile-images/cover');
    expect(init.method).toBe('PUT');
    expect(init.credentials).toBe('same-origin');
    expect((init.body as FormData).get('file')).toBeInstanceOf(Blob);
  });

  test('a refused upload becomes an ApiError with the server\'s code', async () => {
    stub(reply({ error: 'too_big', message: 'Image is larger than 1 MB.' }, 413));
    await expect(uploadProfileImage('avatar', new Blob(['x']))).rejects.toMatchObject({ status: 413, code: 'too_big' });
    stub(reply({}, 500));
    await expect(uploadProfileImage('avatar', new Blob(['x']))).rejects.toBeInstanceOf(ApiError);
  });

  test('removal is a DELETE on the kind', async () => {
    const fetcher = stub(reply({ ok: true }));
    await removeProfileImage('avatar');
    expect(call(fetcher)[0]).toBe('/api/me/profile-images/avatar');
    expect(call(fetcher)[1].method).toBe('DELETE');
  });
});

describe('reporting', () => {
  test('posts the kind and reason to the player\'s report endpoint', async () => {
    const fetcher = stub(reply({ ok: true }, 201));
    await reportProfileImage('0a1b2c3d-1111-4222-8333-444455556666', 'avatar', 'not appropriate');
    const [url, init] = call(fetcher);
    expect(url).toBe('/api/profiles/0a1b2c3d-1111-4222-8333-444455556666/report');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ kind: 'avatar', reason: 'not appropriate' });
  });

  test('a second report from the same person is an ApiError 409', async () => {
    stub(reply({ error: 'already_reported', message: 'You already reported this image.' }, 409));
    await expect(reportProfileImage('guid-alice', 'cover', '')).rejects.toMatchObject({ status: 409, code: 'already_reported' });
  });
});

describe('the review queue', () => {
  test('is requested by status', async () => {
    const fetcher = stub(reply({ images: [] }));
    await fetchReviewQueue('reported');
    expect(call(fetcher)[0]).toBe('/api/admin/profile-images?status=reported');
  });

  test('a decision is a POST with the action and, for a refusal, the reason', async () => {
    const fetcher = stub(reply({ ok: true }));
    await reviewQueueImage('abc', 'reject', 'Not a photo of you');
    const [url, init] = call(fetcher);
    expect(url).toBe('/api/admin/profile-images/abc');
    expect(JSON.parse(String(init.body))).toEqual({ action: 'reject', reason: 'Not a photo of you' });
  });
});
