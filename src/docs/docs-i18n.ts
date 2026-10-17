import cs from './text/cs.json';
import es from './text/es.json';
import fr from './text/fr.json';
import pt from './text/pt.json';
import ru from './text/ru.json';
import tr from './text/tr.json';
import uk from './text/uk.json';

export const DOCS_LANGS = ['pl', 'en', 'uk', 'ru', 'tr', 'pt', 'es', 'fr', 'cs'] as const;
export type DocsLang = (typeof DOCS_LANGS)[number];

/** Pages for developers exist in these two languages only; the other languages document how to use the studio. */
export const DEV_DOCS_LANGS: readonly DocsLang[] = ['pl', 'en'];
export const hasDevDocs = (lang: DocsLang) => DEV_DOCS_LANGS.includes(lang);

/** The English text of a docs sentence is its key; a language that lacks it shows the English text. */
const TEXT: Record<Exclude<DocsLang, 'pl' | 'en'>, Record<string, string>> = { uk, ru, tr, pt, es, fr, cs };

/** Tests and the extraction script collect the English texts the docs ask for. */
let recorder: string[] | null = null;
export const startRecording = () => {
  recorder = [];
  return recorder;
};
export const stopRecording = () => {
  const result = recorder ?? [];
  recorder = null;
  return result;
};

export const missingTranslations = (lang: Exclude<DocsLang, 'pl' | 'en'>, keys: string[]) => keys.filter((key) => !(key in TEXT[lang]));

const fill = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));

/**
 * `t(polish, english)` for one page language. English texts may hold {{tokens}} for numbers and names that change
 * with the language (e.g. {{solo}} layouts); they are filled in after the lookup.
 */
export const makeT =
  (lang: DocsLang, vars: Record<string, string | number>) =>
  (polishText: string, englishText: string) => {
    if (lang === 'pl') return polishText;
    if (lang === 'en') {
      recorder?.includes(englishText) === false && recorder.push(englishText);
      return fill(englishText, vars);
    }
    return fill(TEXT[lang][englishText] ?? englishText, vars);
  };
