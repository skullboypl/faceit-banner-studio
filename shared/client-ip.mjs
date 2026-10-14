import { isIP } from 'node:net';

/** "::ffff:1.2.3.4" → "1.2.3.4", "1.2.3.4:5555" → "1.2.3.4", "[::1]:80" → "::1". */
function normalize(value) {
  if (typeof value !== 'string') return null;
  let ip = value.trim();
  if (ip.startsWith('[')) ip = ip.slice(1, ip.indexOf(']') === -1 ? undefined : ip.indexOf(']'));
  else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(':'));
  if (ip.toLowerCase().startsWith('::ffff:') && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  return isIP(ip) ? ip : null;
}

const header = (headers, name) => (typeof headers?.get === 'function' ? headers.get(name) : headers?.[name]);

/**
 * The caller's address. `X-Forwarded-For` is only trusted for the `hops` entries our own proxies appended
 * (counted from the right), because everything to the left of them was written by the client.
 */
export function clientIp(headers, remoteAddress, hops = 1) {
  const forwarded = String(header(headers, 'x-forwarded-for') ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (forwarded.length > 0) {
    const index = Math.max(0, forwarded.length - Math.max(1, hops));
    const candidate = normalize(forwarded[index]);
    if (candidate) return candidate;
  }
  return normalize(remoteAddress) ?? 'unknown';
}
