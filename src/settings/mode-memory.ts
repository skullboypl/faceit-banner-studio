import { BANNER_MODES } from '../../shared/banner-catalog.mjs';
import { SETTINGS_DEFINITIONS } from './definition';
import type { SettingKey, SettingValue, Settings } from './manager';

export type BannerMode = (typeof BANNER_MODES)[number];

/** These follow the account, not the banner mode that happens to be open. */
const GLOBAL_KEYS = new Set<SettingKey>(['widgetMode', 'playerId', 'widgetLanguage', 'modeMemory']);

const FALLBACK_STYLE: Record<BannerMode, string> = {
  solo: 'prime',
  versus: 'duel',
  team: 'lineup',
  split: 'splitset',
  popup: 'livecard',
};

const scopedKeys = () =>
  (Object.keys(SETTINGS_DEFINITIONS) as SettingKey[]).filter((key) => !GLOBAL_KEYS.has(key));

const isMode = (value: unknown): value is BannerMode =>
  typeof value === 'string' && (BANNER_MODES as readonly string[]).includes(value);

const same = (left: unknown, right: unknown) => left === right || (left == null && right == null);

function snapshot(settings: Settings): Partial<Settings> {
  const saved: Partial<Settings> = {};
  for (const key of scopedKeys()) {
    const value = settings[key];
    if (!same(value, SETTINGS_DEFINITIONS[key].defaultValue)) {
      saved[key] = value;
    }
  }
  return saved;
}

export function readModeMemory(raw: unknown): Partial<Record<BannerMode, Partial<Settings>>> {
  if (typeof raw !== 'string' || raw === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const memory: Partial<Record<BannerMode, Partial<Settings>>> = {};
  for (const mode of BANNER_MODES) {
    const snap = (parsed as Record<string, unknown>)[mode];
    if (!snap || typeof snap !== 'object' || Array.isArray(snap)) continue;
    const clean: Partial<Settings> = {};
    for (const key of scopedKeys()) {
      if (!Object.prototype.hasOwnProperty.call(snap, key)) continue;
      clean[key] = (snap as Partial<Settings>)[key];
    }
    memory[mode] = clean;
  }
  return memory;
}

function encode(memory: Partial<Record<BannerMode, Partial<Settings>>>): string {
  const kept = Object.fromEntries(
    BANNER_MODES.filter((mode) => memory[mode] && Object.keys(memory[mode] as object).length > 0).map(
      (mode) => [mode, memory[mode]]
    )
  );
  return Object.keys(kept).length > 0 ? JSON.stringify(kept) : '';
}

/**
 * Leaves the current mode's options in `modeMemory` and brings the next mode's options back.
 * A mode opened for the first time starts from its own defaults, not from the mode you just left.
 */
export function switchBannerMode(settings: Settings, next: BannerMode): Partial<Settings> {
  const current: BannerMode = isMode(settings.widgetMode) ? settings.widgetMode : 'solo';
  if (current === next) return {};

  const memory = readModeMemory(settings.modeMemory);
  memory[current] = snapshot(settings);
  const patch: Partial<Settings> = {
    widgetMode: next,
    modeMemory: encode(memory),
  };
  const saved = memory[next];
  for (const key of scopedKeys()) {
    const remembered = saved?.[key];
    patch[key] = (remembered === undefined ? SETTINGS_DEFINITIONS[key].defaultValue : remembered) as SettingValue;
  }
  if (!saved) {
    patch.style = FALLBACK_STYLE[next];
    if (next !== 'solo') patch.bannerDesign = '2026';
  }
  return patch;
}
