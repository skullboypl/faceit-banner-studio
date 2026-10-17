import { fromDelta } from '../cloud/delta';
import { SETTINGS_DEFINITIONS } from '../settings/definition';
import type { SettingKey } from '../settings/manager';

/** Saved delta as the widget would read it, with the studio player filling a missing playerId. */
export const settingsGetter =
  (delta: Record<string, unknown>, studioPlayer?: unknown) =>
  (key: SettingKey) => {
    const saved = fromDelta(delta) as Record<string, unknown>;
    const value = saved[key];
    if (value !== undefined) return value;
    if (key === 'playerId') return studioPlayer;
    return (SETTINGS_DEFINITIONS[key] as { defaultValue?: unknown }).defaultValue;
  };
