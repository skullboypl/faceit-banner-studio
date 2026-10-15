import { SETTINGS_DEFINITIONS } from './definition';

type Definition = { type?: string; query?: string[] };

const BY_QUERY = new Map<string, [string, Definition]>();
for (const [key, definition] of Object.entries(SETTINGS_DEFINITIONS as Record<string, Definition>)) {
  for (const name of definition.query ?? []) BY_QUERY.set(name, [key, definition]);
}

/**
 * The settings a generated link carries, read back as typed values: the same query names the widget reads,
 * so a dialog or a size hint can work out what the link will draw without loading the widget.
 * Unknown parameters and values of the wrong type are ignored.
 */
export function settingsFromQuery(params: URLSearchParams): (key: string) => unknown {
  const values = new Map<string, unknown>();
  for (const [name, raw] of params) {
    const found = BY_QUERY.get(name);
    if (!found) continue;
    const [key, definition] = found;
    if (definition.type === 'boolean') {
      if (raw === 'true' || raw === 'false') values.set(key, raw === 'true');
    } else if (definition.type === 'number') {
      const number = Number(raw);
      if (raw !== '' && Number.isFinite(number)) values.set(key, number);
    } else {
      values.set(key, raw);
    }
  }
  return (key) => values.get(key);
}
