import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeDelta, encodeDelta, validateDelta } from '../shared/settings-delta.mjs';

const schema = JSON.parse(readFileSync('shared/settings-schema.json', 'utf8'));
const defaults = () =>
  Object.fromEntries(Object.entries(schema).map(([key, def]) => [key, def.default]));

test('round-trip restores every default', () => {
  assert.deepEqual(decodeDelta(encodeDelta(defaults(), schema), schema), defaults());
});

test('delta contains only changed keys', () => {
  const settings = { ...defaults(), bannerRadius: 20, bannerRadiusCustom: true };
  assert.deepEqual(encodeDelta(settings, schema), { bannerRadius: 20, bannerRadiusCustom: true });
});

test('a key added to the schema later gets its default when decoding an old delta', () => {
  const smaller = { ...schema };
  delete smaller.bannerRadius;
  const old = encodeDelta({ ...defaults(), bannerRadiusCustom: true }, smaller);
  assert.equal(decodeDelta(old, schema).bannerRadius, schema.bannerRadius.default);
  assert.equal(decodeDelta(old, schema).bannerRadiusCustom, true);
});

test('rejects unknown key', () => {
  const result = validateDelta({ notASetting: 1 }, schema);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /notASetting/);
});

test('rejects out-of-range number', () => {
  const result = validateDelta({ bannerRadius: 999 }, schema);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /bannerRadius/);
});

test('rejects value not in options', () => {
  assert.equal(validateDelta({ bannerWidthMode: 'huge' }, schema).ok, false);
});

test('rejects wrong type', () => {
  assert.equal(validateDelta({ bannerRadiusCustom: 'yes' }, schema).ok, false);
});

test('rejects __proto__, constructor and prototype keys', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const delta = JSON.parse(`{"${key}": {"polluted": true}}`);
    assert.equal(validateDelta(delta, schema).ok, false, key);
  }
  assert.equal({}.polluted, undefined);
});

test('rejects delta over 16384 bytes', () => {
  const result = validateDelta({ customInlineCSS: 'a'.repeat(17000) }, schema);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /16384/);
});

test('rejects non-object input', () => {
  for (const value of [null, [], 'x', 4]) assert.equal(validateDelta(value, schema).ok, false);
});

test('accepts a valid delta', () => {
  assert.deepEqual(validateDelta({ bannerRadius: 20, bannerWidthMode: 'auto' }, schema), { ok: true });
});
