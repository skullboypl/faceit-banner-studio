/**
 * Settings are stored as a delta: only keys whose value differs from the schema default.
 * Missing keys fall back to the current defaults, so old saves survive new settings.
 * Used by the Next.js server (validation) and by the Vite client (encoding).
 */
export const MAX_DELTA_BYTES = 16384;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const byteLength = (text) => new TextEncoder().encode(text).length;

/** JSON turns `undefined` into null, so a null default/option means "unset". */
const normalize = (value) => (value === undefined ? null : value);

export function encodeDelta(settings, schema) {
  const delta = {};
  for (const [key, definition] of Object.entries(schema)) {
    if (!(key in settings)) continue;
    if (normalize(settings[key]) !== normalize(definition.default)) {
      delta[key] = settings[key];
    }
  }
  return delta;
}

export function decodeDelta(delta, schema) {
  const settings = {};
  for (const [key, definition] of Object.entries(schema)) {
    settings[key] = Object.hasOwn(delta, key) ? delta[key] : definition.default;
  }
  return settings;
}

const typeMatches = (definition, value) => {
  switch (definition.type) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
    case 'ranking_state':
      return typeof value === 'number' && Number.isFinite(value);
    case 'string_undefined':
      return typeof value === 'string' || value === null || value === undefined;
    default:
      return typeof value === 'string';
  }
};

function validateValue(key, definition, value) {
  if (!typeMatches(definition, value)) return `${key}: wrong type`;
  if (typeof value === 'number') {
    if (definition.min !== undefined && value < definition.min) return `${key}: below ${definition.min}`;
    if (definition.max !== undefined && value > definition.max) return `${key}: above ${definition.max}`;
  }
  if (definition.options && !definition.options.some((option) => normalize(option) === normalize(value))) {
    return `${key}: not an allowed option`;
  }
  if (definition.regex && typeof value === 'string' && !new RegExp(definition.regex).test(value)) {
    return `${key}: does not match the required format`;
  }
  return null;
}

export function validateDelta(delta, schema) {
  if (!isPlainObject(delta)) return { ok: false, errors: ['delta must be an object'] };

  const errors = [];
  if (byteLength(JSON.stringify(delta)) > MAX_DELTA_BYTES) {
    errors.push(`delta is larger than ${MAX_DELTA_BYTES} bytes`);
  }
  for (const key of Object.keys(delta)) {
    if (FORBIDDEN_KEYS.has(key)) {
      errors.push(`${key}: forbidden key`);
    } else if (!Object.hasOwn(schema, key)) {
      errors.push(`${key}: unknown setting`);
    } else {
      const error = validateValue(key, schema[key], delta[key]);
      if (error) errors.push(error);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
