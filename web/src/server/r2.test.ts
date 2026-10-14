import { DeleteObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { afterEach, describe, expect, test } from 'vitest';
import { deleteObject, isR2Configured, publicUrl, putObject, useObjectClient } from './r2';

const names = ['R2_BUCKET', 'R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_URL'] as const;
const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));

afterEach(() => {
  useObjectClient(null);
  for (const name of names) {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  }
});

describe('R2', () => {
  test('is off until every variable is set, and publicUrl joins the CDN host', () => {
    for (const name of names) delete process.env[name];
    expect(isR2Configured()).toBe(false);
    expect(() => publicUrl('att/abc.webp')).toThrow('r2_not_configured');
    process.env.R2_BUCKET = 'banners-vxh';
    process.env.R2_ENDPOINT = 'https://example.r2.cloudflarestorage.com';
    process.env.R2_ACCESS_KEY_ID = 'key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_PUBLIC_URL = 'https://fbstorage.vxh.pl/';
    expect(isR2Configured()).toBe(true);
    expect(publicUrl('att/abc.webp')).toBe('https://fbstorage.vxh.pl/att/abc.webp');
  });

  test('putObject stores a webp with a year-long immutable cache, deleteObject removes that key', async () => {
    process.env.R2_BUCKET = 'banners-vxh';
    const sent: { name: string; input: Record<string, unknown> }[] = [];
    useObjectClient({
      send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
        sent.push({ name: command.constructor.name, input: command.input });
      },
    } as unknown as S3Client);
    await putObject('att/abc.webp', Buffer.from('webp'), 'image/webp');
    await deleteObject('att/abc.webp');
    expect(sent[0].name).toBe(PutObjectCommand.name);
    expect(sent[0].input).toMatchObject({
      Bucket: 'banners-vxh',
      Key: 'att/abc.webp',
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    });
    expect(sent[1].name).toBe(DeleteObjectCommand.name);
    expect(sent[1].input.Key).toBe('att/abc.webp');
  });

  test('a missing configuration refuses to upload instead of crashing the process', async () => {
    for (const name of names) delete process.env[name];
    await expect(putObject('att/x.webp', Buffer.from('x'), 'image/webp')).rejects.toThrow('r2_not_configured');
  });
});
