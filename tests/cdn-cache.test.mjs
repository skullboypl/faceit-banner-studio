import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purgeFrontCache } from '../server/cdn-cache.mjs';

test('without a Cloudflare zone and token the CSS purge is refused, not faked', async () => {
  await assert.rejects(() => purgeFrontCache({ zone: '', token: '', fetchImpl: async () => { throw new Error('should not call'); } }), {
    message: 'cdn_not_configured',
  });
});

test('a paid plan purges /assets; a free plan falls back to emptying the zone', async () => {
  const bodies = [];
  const fetchImpl = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    if (bodies.length === 1) return { ok: false, status: 403 };
    return { ok: true, status: 200 };
  };
  assert.deepEqual(await purgeFrontCache({ zone: 'zone', token: 'tok', origin: 'https://faceitbanner.vxh.pl/', fetchImpl }), ['css']);
  assert.deepEqual(bodies[0].prefixes, ['https://faceitbanner.vxh.pl/assets/']);
  assert.equal(bodies[1].purge_everything, true);
});

test('a failed Cloudflare answer is a purge error', async () => {
  await assert.rejects(
    () => purgeFrontCache({ zone: 'z', token: 't', fetchImpl: async () => ({ ok: false, status: 500 }) }),
    { message: 'cdn_purge_failed' }
  );
});
