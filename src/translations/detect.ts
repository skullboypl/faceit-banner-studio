import type { Language } from './translations';

type Sources = {
  /** `?lang=` from the URL. */
  param?: string | null;
  /** Language the visitor chose earlier (localStorage). */
  saved?: string | null;
  /** `navigator.languages`, most preferred first. */
  browser?: readonly string[];
};

/** "pl-PL", "PL_pl" and "pl" all become "pl". */
const baseCode = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase().split(/[-_]/)[0] : '';

/**
 * Picks the interface language: ?lang= → saved choice → browser preference list → English → first available.
 * Regional variants match their base language, so a Polish browser (pl-PL) gets Polish.
 */
export function pickLanguage({ param, saved, browser = [] }: Sources, available: Language[]): Language {
  const find = (code: string) => (code ? available.find((language) => language.id === code) : undefined);

  return (
    find(baseCode(param)) ??
    find(baseCode(saved)) ??
    browser.map(baseCode).map(find).find(Boolean) ??
    find('en') ??
    available[0]
  );
}
