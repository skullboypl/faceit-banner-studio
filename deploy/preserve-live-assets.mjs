/* global fetch, process */
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAGES = [
  { url: '/', dist: 'index.html', pending: 'index.html' },
  { url: '/widget/', dist: 'widget/index.html', pending: 'widget/index.html' },
];

const ASSET = /^\/assets\/[A-Za-z0-9._-]+$/;
const OK_TYPE = /javascript|css|wasm|font|octet-stream/i;

export function assetPaths(html) {
  const found = new Set();
  const re = /(?:src|href)="(\/assets\/[A-Za-z0-9._-]+)"/g;
  let match;
  while ((match = re.exec(html))) found.add(match[1]);
  return [...found];
}

function write(file, body) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
}

/**
 * Keep the live HTML (and its hashed files) as the public pages until the old
 * container is gone. New HTML stays in pendingDir and is swapped in later.
 * Live assets are copied only when the path is not already in this build.
 */
export async function preserveLiveAssets({
  distDir,
  pendingDir,
  origin,
  fetcher = fetch,
} = {}) {
  if (!origin || /localhost|127\.0\.0\.1/i.test(origin)) return { preserved: false, reason: 'local_origin' };
  const livePages = [];
  for (const page of PAGES) {
    const distFile = join(distDir, page.dist);
    if (!existsSync(distFile)) continue;
    const response = await fetcher(new URL(page.url, origin), { redirect: 'error', cache: 'no-store' });
    if (!response.ok) throw new Error(`live_${page.url}_${response.status}`);
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html')) throw new Error(`live_${page.url}_not_html`);
    const html = await response.text();
    if (!html.includes('/assets/')) throw new Error(`live_${page.url}_no_assets`);
    livePages.push({ page, html, distFile });
  }
  if (!livePages.length) return { preserved: false, reason: 'no_pages' };

  const wanted = [...new Set(livePages.flatMap(({ html }) => assetPaths(html)))];
  for (const path of wanted) {
    if (!ASSET.test(path)) throw new Error(`bad_asset_${path}`);
    const dest = join(distDir, path.slice(1));
    if (existsSync(dest)) continue;
    const response = await fetcher(new URL(path, origin), { redirect: 'error', cache: 'no-store' });
    const type = response.headers.get('content-type') || '';
    if (!response.ok || !OK_TYPE.test(type)) throw new Error(`asset_${path}_${response.status}`);
    write(dest, Buffer.from(await response.arrayBuffer()));
  }

  mkdirSync(pendingDir, { recursive: true });
  for (const { page, html, distFile } of livePages) {
    const pendingFile = join(pendingDir, page.pending);
    mkdirSync(dirname(pendingFile), { recursive: true });
    renameSync(distFile, pendingFile);
    write(distFile, html);
  }
  return { preserved: true, assets: wanted.length };
}

function seedPending(distDir, pendingDir) {
  mkdirSync(pendingDir, { recursive: true });
  write(join(pendingDir, '.keep'), '');
  for (const page of PAGES) {
    const distFile = join(distDir, page.dist);
    const pendingFile = join(pendingDir, page.pending);
    if (existsSync(distFile) && !existsSync(pendingFile)) write(pendingFile, readFileSync(distFile));
  }
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const distDir = join(root, 'dist');
  const pendingDir = join(root, 'pending');
  const origin = process.env.PUBLIC_URL || 'https://faceitbanner.vxh.pl';
  try {
    const result = await preserveLiveAssets({ distDir, pendingDir, origin });
    console.log(result.preserved ? `preserved live html and ${result.assets} assets` : `preserve skipped: ${result.reason}`);
  } catch (error) {
    console.warn(`preserve skipped: ${error.message || error}`);
  }
  seedPending(distDir, pendingDir);
}
