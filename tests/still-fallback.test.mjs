import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteHashedStillUrl } from '../server/still-fallback.mjs';

test('hashed Vite still names map back to public PNGs', () => {
  assert.equal(
    rewriteHashedStillUrl('/assets/ancient-1792950697-Cgf0AbSc.png'),
    '/previews/ancient.png'
  );
  assert.equal(
    rewriteHashedStillUrl('/assets/smoothwizard-logo-1792950697-CpWZYShg.png'),
    '/brand/smoothwizard-logo.png'
  );
  assert.equal(rewriteHashedStillUrl('/assets/mirage-D33rTmIJ.png'), '/previews/mirage.png');
  assert.equal(rewriteHashedStillUrl('/assets/other-1792950697-Cgf0AbSc.png'), undefined);
  assert.equal(rewriteHashedStillUrl('/previews/ancient.png'), undefined);
});
