import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  // Shared code (shared/settings-delta.mjs) lives outside web/ and is used by the Vite client too.
  experimental: { externalDir: true },
  output: 'standalone',
  // The repo root has its own lockfile, so trace from there. The server file lands at .next/standalone/web/server.js.
  outputFileTracingRoot: path.join(webDir, '..'),
  serverExternalPackages: ['ioredis', 'pg'],
  poweredByHeader: false,
};

export default config;
