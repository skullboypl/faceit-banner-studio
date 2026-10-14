export type SettingsSchema = Record<
  string,
  { type: string; default?: unknown; min?: number; max?: number; options?: unknown[]; regex?: string }
>;
export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

export const MAX_DELTA_BYTES: number;
export function encodeDelta(settings: Record<string, unknown>, schema: SettingsSchema): Record<string, unknown>;
export function decodeDelta(delta: Record<string, unknown>, schema: SettingsSchema): Record<string, unknown>;
export function validateDelta(delta: unknown, schema: SettingsSchema): ValidationResult;
