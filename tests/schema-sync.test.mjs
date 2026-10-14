import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const generated = () =>
  JSON.parse(
    execFileSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/gen-settings-schema.ts', '--stdout'],
      { encoding: 'utf8' }
    )
  );

test('schema file matches SETTINGS_DEFINITIONS', () => {
  const onDisk = JSON.parse(readFileSync('shared/settings-schema.json', 'utf8'));
  assert.deepEqual(onDisk, generated());
});

test('bannerWidthMode defaults to recommended with its three options', () => {
  const schema = JSON.parse(readFileSync('shared/settings-schema.json', 'utf8'));
  assert.equal(schema.bannerWidthMode.default, 'recommended');
  assert.deepEqual(schema.bannerWidthMode.options, ['auto', 'manual', 'recommended']);
});
