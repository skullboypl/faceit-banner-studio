import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { TEST_DATABASE_URL } from './test-env';
import { escapeIlike } from './sql';

process.env.DATABASE_URL = TEST_DATABASE_URL;

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../..');

/** Interpolations that build SQL structure, never user text. */
const ALLOWED = [
  /^params\.length(?:\s*-\s*[12])?$/,
  /^POST_SELECT\.replace\('\$VIEWER', '\$[12]'\)$/,
  /^where\.join\(' AND '\)$/,
  /^order$/,
  /^COLUMNS$/,
];

function sourceFiles(dir: string, extension: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(extension) && !name.endsWith('.test.ts'))
    .map((name) => join(dir, name));
}

function queryTemplates(source: string): string[] {
  const found: string[] = [];
  const pattern = /\.query\(\s*`([\s\S]*?)`/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) found.push(match[1]);
  return found;
}

describe('escapeIlike', () => {
  test('escapes percent, underscore and the escape character itself', () => {
    expect(escapeIlike('100%_done\\x')).toBe('100\\%\\_done\\\\x');
    expect(escapeIlike('plain')).toBe('plain');
  });
});

describe('query scan', () => {
  const files = [...sourceFiles(here, '.ts'), ...sourceFiles(join(repoRoot, 'server'), '.mjs')];

  test('every SQL template only interpolates placeholders, column lists or a fixed ORDER BY', () => {
    const problems: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const template of queryTemplates(source)) {
        for (const hole of template.matchAll(/\$\{([^}]+)\}/g)) {
          const expression = hole[1].trim();
          if (!ALLOWED.some((allowed) => allowed.test(expression))) problems.push(`${file}: \${${expression}}`);
        }
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('the list query picks ORDER BY from two literal strings', () => {
    const source = readFileSync(join(here, 'repo-posts.ts'), 'utf8');
    expect(source).toContain(
      "options.sort === 'top' ? 'p.votes DESC, p.created_at DESC, p.id DESC' : 'p.created_at DESC, p.id DESC'"
    );
  });
});

describe('ILIKE against postgres', () => {
  let db: typeof import('./db');

  beforeAll(async () => {
    db = await import('./db');
    await db.migrate((await db.getPool())!);
  });

  afterAll(async () => {
    await (await db.getPool())?.end();
  });

  test('an escaped pattern matches the literal and not a wildcard lookalike', async () => {
    const pool = (await db.getPool())!;
    const pattern = escapeIlike('100%_done');
    const match = await pool.query<{ ok: boolean }>(`SELECT '100%_done' ILIKE $1 ESCAPE '\\' AS ok`, [pattern]);
    const lookalike = await pool.query<{ ok: boolean }>(`SELECT '100XYdone' ILIKE $1 ESCAPE '\\' AS ok`, [pattern]);
    expect(match.rows[0].ok).toBe(true);
    expect(lookalike.rows[0].ok).toBe(false);
  });
});
