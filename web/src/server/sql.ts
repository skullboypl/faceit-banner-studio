/**
 * Turns a user string into a literal ILIKE pattern.
 * The query must use `ESCAPE '\'` (in SQL: `ESCAPE '\\'`), otherwise `%` and `_` stay wildcards.
 */
export function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
