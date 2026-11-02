const STREAMER_SLUG = /^[A-Za-z0-9_-]{3,25}$/;

/** Twitch login when present, otherwise Kick. Empty when neither is a channel name. */
export function streamerSlugOf(player: { twitch?: string; kick?: string }) {
  const twitch = String(player.twitch || '').toLowerCase();
  const kick = String(player.kick || '').toLowerCase();
  if (STREAMER_SLUG.test(twitch)) return twitch;
  if (STREAMER_SLUG.test(kick)) return kick;
  return '';
}

export function streamerPath(slug: string) {
  return STREAMER_SLUG.test(slug) ? `/streamers/${slug.toLowerCase()}` : '/streamers';
}

export function parseStreamerPath(pathname: string) {
  const match = String(pathname || '').match(/^\/streamers\/([A-Za-z0-9_-]{3,25})$/i);
  return match ? match[1].toLowerCase() : '';
}

export function streamerIndexTitle(analyticsTitle: string) {
  return analyticsTitle;
}

export function streamerIndexDescription(text: string) {
  return text;
}

export function streamerPageTitle(name: string, board: string) {
  return `${name} · ${board}`;
}

export function streamerPageDescription(name: string, template: string) {
  return template.replace('{{0}}', name);
}

function upsertMeta(attr: 'name' | 'property', key: string, value: string) {
  let node = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute(attr, key);
    document.head.appendChild(node);
  }
  node.setAttribute('content', value);
}

export function applyStreamerMeta(title: string, description: string, path = '/streamers') {
  document.title = title;
  upsertMeta('name', 'description', description);
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:url', `${window.location.origin}${path}`);
}
