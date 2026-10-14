import schemaJson from '../../shared/settings-schema.json';
import { decodeDelta, encodeDelta, type SettingsSchema } from '../../shared/settings-delta.mjs';
import type { Settings } from '../settings/manager';

const schema = schemaJson as SettingsSchema;

/** Only the settings that differ from the defaults; this is what is stored in the account. */
export const toDelta = (settings: Settings): Record<string, unknown> =>
  encodeDelta(settings as unknown as Record<string, unknown>, schema);

/** Full settings for a stored delta (missing keys get the current defaults). */
export const fromDelta = (delta: Record<string, unknown>): Partial<Settings> =>
  decodeDelta(delta, schema) as Partial<Settings>;

/** Key order does not matter when comparing two deltas (jsonb reorders keys). */
export const canonical = (delta: Record<string, unknown>): string =>
  JSON.stringify(Object.fromEntries(Object.entries(delta).sort(([a], [b]) => (a < b ? -1 : 1))));
