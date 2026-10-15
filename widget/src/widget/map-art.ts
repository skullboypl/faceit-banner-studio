import ancient from '../../../src/assets/previews/ancient.png';
import dust2 from '../../../src/assets/previews/dust2.png';
import mirage from '../../../src/assets/previews/mirage.png';
import nuke from '../../../src/assets/previews/nuke.png';
import overpass from '../../../src/assets/previews/overpass.png';

const ART: Record<string, string> = { ancient, dust2, mirage, nuke, overpass };

/** Artwork for a CS2 map name as FACEIT writes it ("mirage", "de_mirage"); undefined when there is none. */
export function mapArt(name?: string): string | undefined {
  if (!name) return undefined;
  return ART[name.toLowerCase().replace(/^de_/, '').replace(/[^a-z0-9]/g, '')];
}
