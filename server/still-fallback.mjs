import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';

const STILL = /\/assets\/(ancient|anubis|cache|dust2|inferno|mirage|nuke|overpass|train|vertigo)-[^/]+\.png$/;
const LOGO = /\/assets\/smoothwizard-logo-[^/]+\.png$/;

/** Stale Vite hashes (`name-<stamp>-<hash>.png`) map back to the public still. */
export function rewriteHashedStillUrl(url = '') {
  const pathname = url.split('?')[0];
  const still = pathname.match(STILL);
  if (still) return `/previews/${still[1]}.png`;
  if (LOGO.test(pathname)) return '/brand/smoothwizard-logo.png';
  return undefined;
}

/** Serve the public PNG when a tab still asks for a hashed Vite asset name. */
export function createStillFallbackMiddleware(root) {
  return (req, res, next) => {
    const mapped = rewriteHashedStillUrl(req.url);
    if (!mapped) return next();
    const file = path.join(root, 'public', mapped.slice(1));
    if (!existsSync(file)) return next();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    createReadStream(file).pipe(res);
  };
}
