/** @type {import('next').NextConfig} */
const config = {
  // Shared code (shared/settings-delta.mjs) lives outside web/ and is used by the Vite client too.
  experimental: { externalDir: true },
  poweredByHeader: false,
};

export default config;
