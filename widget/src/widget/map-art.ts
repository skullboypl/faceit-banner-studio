/** Stable public stills — Vite must not hash these or first paint races `/assets/name-<stamp>-<hash>.png`. */
const still = (id: string) => `/previews/${id}.png`;

/** FACEIT CS2 maps we have a still for: the current pool plus recent optional maps. */
export const MAP_ART: Record<string, string> = {
  ancient: still('ancient'),
  anubis: still('anubis'),
  cache: still('cache'),
  dust2: still('dust2'),
  inferno: still('inferno'),
  mirage: still('mirage'),
  nuke: still('nuke'),
  overpass: still('overpass'),
  train: still('train'),
  vertigo: still('vertigo'),
};

/** Plate under a map still so a missing/slow PNG never leaves a hole. */
export const MAP_STILL_FALLBACK =
  'linear-gradient(180deg, #2a2a2e 0%, #1a1a1c 55%, #141416 100%)';

/** Order of the generator's preview-background picker. */
export const MAP_PREVIEW_IDS = [
  'nuke',
  'mirage',
  'ancient',
  'dust2',
  'overpass',
  'anubis',
  'inferno',
  'vertigo',
  'cache',
  'train',
] as const;

/** CSS background-image: photo on top of the plate. A 404 still leaves the plate. */
export function mapStillLayers(url?: string): string {
  return url ? `url("${url}"), ${MAP_STILL_FALLBACK}` : MAP_STILL_FALLBACK;
}

/** Artwork for a CS2 map name as FACEIT writes it ("mirage", "de_mirage"); undefined when there is none. */
export function mapArt(name?: string): string | undefined {
  if (!name) return undefined;
  return MAP_ART[name.toLowerCase().replace(/^de_/, '').replace(/[^a-z0-9]/g, '')];
}
