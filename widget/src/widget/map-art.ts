import ancient from '../../../src/assets/previews/ancient.png';
import anubis from '../../../src/assets/previews/anubis.png';
import cache from '../../../src/assets/previews/cache.png';
import dust2 from '../../../src/assets/previews/dust2.png';
import inferno from '../../../src/assets/previews/inferno.png';
import mirage from '../../../src/assets/previews/mirage.png';
import nuke from '../../../src/assets/previews/nuke.png';
import overpass from '../../../src/assets/previews/overpass.png';
import train from '../../../src/assets/previews/train.png';
import vertigo from '../../../src/assets/previews/vertigo.png';

/** FACEIT CS2 maps we have a still for: the current pool plus recent optional maps. */
export const MAP_ART: Record<string, string> = {
  ancient,
  anubis,
  cache,
  dust2,
  inferno,
  mirage,
  nuke,
  overpass,
  train,
  vertigo,
};

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

/** Artwork for a CS2 map name as FACEIT writes it ("mirage", "de_mirage"); undefined when there is none. */
export function mapArt(name?: string): string | undefined {
  if (!name) return undefined;
  return MAP_ART[name.toLowerCase().replace(/^de_/, '').replace(/[^a-z0-9]/g, '')];
}
