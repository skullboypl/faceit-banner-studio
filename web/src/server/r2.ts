import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const CACHE = 'public, max-age=31536000, immutable';

export function isR2Configured(): boolean {
  return ['R2_BUCKET', 'R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_URL'].every(
    (name) => Boolean(process.env[name])
  );
}

/** Public CDN address of an object. The key is the unguessable path, never a nickname or post id. */
export function publicUrl(key: string): string {
  const base = String(process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');
  if (!base) throw new Error('r2_not_configured');
  return `${base}/${key.replace(/^\//, '')}`;
}

let injected: S3Client | null = null;
let cached: { endpoint: string; client: S3Client } | null = null;

/** Tests pass a stand-in client. Production uses one client per endpoint. */
export function useObjectClient(client: S3Client | null) {
  injected = client;
}

function client(): S3Client {
  if (injected) return injected;
  if (!isR2Configured()) throw new Error('r2_not_configured');
  const endpoint = process.env.R2_ENDPOINT as string;
  if (cached?.endpoint === endpoint) return cached.client;
  const created = new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
  });
  cached = { endpoint, client: created };
  return created;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: CACHE,
    })
  );
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
}
