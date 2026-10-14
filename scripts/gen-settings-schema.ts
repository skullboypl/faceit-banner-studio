import { writeFileSync } from 'node:fs';
import { SETTINGS_DEFINITIONS } from '../src/settings/definition';

type Definition = {
  type: string;
  defaultValue?: unknown;
  min?: number;
  max?: number;
  options?: unknown[];
  regex?: RegExp;
};

const schema = Object.fromEntries(
  Object.entries(SETTINGS_DEFINITIONS as Record<string, Definition>).map(
    ([key, definition]) => [
      key,
      {
        type: definition.type,
        default: definition.defaultValue,
        ...(definition.min !== undefined && { min: definition.min }),
        ...(definition.max !== undefined && { max: definition.max }),
        ...(definition.options && { options: definition.options }),
        ...(definition.regex && { regex: definition.regex.source }),
      },
    ]
  )
);

const json = `${JSON.stringify(schema, null, 2)}\n`;
if (process.argv.includes('--stdout')) {
  process.stdout.write(json);
} else {
  writeFileSync(new URL('../shared/settings-schema.json', import.meta.url), json);
}
