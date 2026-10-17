/**
 * Cloudflare keeps hashed CSS and HTML at the edge. After a deploy the studio can still show an old
 * stylesheet (white iframe, leftover checkerboard) until that copy dies. An admin can drop it here.
 */
export async function purgeFrontCache({
  zone = process.env.CF_ZONE_ID,
  token = process.env.CF_API_TOKEN,
  origin = process.env.PUBLIC_URL || 'https://faceitbanner.vxh.pl',
  fetchImpl = fetch,
} = {}) {
  if (!zone || !token) {
    const error = new Error('cdn_not_configured');
    error.code = 'cdn_not_configured';
    throw error;
  }
  const base = String(origin).replace(/\/$/, '');
  const url = `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone)}/purge_cache`;
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const request = (body) => fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body) });
  /* Prefix needs a paid plan; everything always works and is what actually drops hashed CSS. */
  let response = await request({ prefixes: [`${base}/assets/`] });
  if (!response.ok) response = await request({ purge_everything: true });
  if (!response.ok) {
    const error = new Error('cdn_purge_failed');
    error.code = 'cdn_purge_failed';
    throw error;
  }
  return ['css'];
}
