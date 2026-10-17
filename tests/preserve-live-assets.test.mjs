import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assetPaths, preserveLiveAssets } from '../deploy/preserve-live-assets.mjs';

const liveMain = '<script type="module" src="/assets/main-old.js"></script>';
const liveWidget = '<script type="module" src="/assets/widget-old.js"></script>';
const newMain = '<script type="module" src="/assets/main-new.js"></script>';
const newWidget = '<script type="module" src="/assets/widget-new.js"></script>';

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'fb-preserve-'));
  const distDir = join(root, 'dist');
  const pendingDir = join(root, 'pending');
  mkdirSync(join(distDir, 'assets'), { recursive: true });
  mkdirSync(join(distDir, 'widget'), { recursive: true });
  writeFileSync(join(distDir, 'index.html'), newMain);
  writeFileSync(join(distDir, 'widget', 'index.html'), newWidget);
  writeFileSync(join(distDir, 'assets', 'main-new.js'), 'new-main');
  writeFileSync(join(distDir, 'assets', 'widget-new.js'), 'new-widget');
  return { distDir, pendingDir };
}

function files({ distDir, pendingDir }) {
  return {
    publicMain: readFileSync(join(distDir, 'index.html'), 'utf8'),
    publicWidget: readFileSync(join(distDir, 'widget', 'index.html'), 'utf8'),
    pendingMain: readFileSync(join(pendingDir, 'index.html'), 'utf8'),
    pendingWidget: readFileSync(join(pendingDir, 'widget', 'index.html'), 'utf8'),
    oldMain: existsSync(join(distDir, 'assets', 'main-old.js')) && readFileSync(join(distDir, 'assets', 'main-old.js'), 'utf8'),
    newMain: readFileSync(join(distDir, 'assets', 'main-new.js'), 'utf8'),
  };
}

test('reads hashed asset paths from html', () => {
  assert.deepEqual(assetPaths(liveMain + '<link href="/assets/client-old.css" rel="stylesheet">'), [
    '/assets/main-old.js',
    '/assets/client-old.css',
  ]);
  assert.deepEqual(assetPaths('<a href="/docs/">x</a>'), []);
});

test('serves live html until cutover and keeps this build of the scripts', async () => {
  const dirs = setup();
  const fetcher = async (url) => {
    const path = String(url).replace('https://faceitbanner.vxh.pl', '');
    const body = {
      '/': liveMain,
      '/widget/': liveWidget,
      '/assets/main-old.js': 'old-main',
      '/assets/widget-old.js': 'old-widget',
    }[path];
    const type = path.endsWith('.js') ? 'application/javascript' : 'text/html; charset=utf-8';
    return new Response(body, { status: body ? 200 : 404, headers: { 'content-type': type } });
  };
  const result = await preserveLiveAssets({ ...dirs, origin: 'https://faceitbanner.vxh.pl', fetcher });
  assert.equal(result.preserved, true);
  const out = files(dirs);
  assert.equal(out.publicMain, liveMain);
  assert.equal(out.publicWidget, liveWidget);
  assert.equal(out.pendingMain, newMain);
  assert.equal(out.pendingWidget, newWidget);
  assert.equal(out.oldMain, 'old-main');
  assert.equal(out.newMain, 'new-main');
});

test('leaves this build public when live html cannot be read', async () => {
  const dirs = setup();
  await assert.rejects(
    () => preserveLiveAssets({
      ...dirs,
      origin: 'https://faceitbanner.vxh.pl',
      fetcher: async () => new Response('nope', { status: 502, headers: { 'content-type': 'text/html' } }),
    }),
    /live_\/_502/
  );
  assert.equal(readFileSync(join(dirs.distDir, 'index.html'), 'utf8'), newMain);
  assert.equal(existsSync(join(dirs.pendingDir, 'index.html')), false);
});
