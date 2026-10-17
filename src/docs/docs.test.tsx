import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { CHROME, navLabel } from './chrome';
import { USER_PAGE_IDS, buildDocsPages, docsPath, pageIdsFor } from './content';
import { DocsPage } from './DocsPage';
import { DOCS_LANGS, DocsLang, hasDevDocs, missingTranslations, startRecording, stopRecording } from './docs-i18n';

const translated = DOCS_LANGS.filter((lang) => !hasDevDocs(lang)) as Exclude<DocsLang, 'pl' | 'en'>[];

describe('documentation languages', () => {
  test('the docs come in the studio languages, developer pages only in Polish and English', () => {
    expect([...DOCS_LANGS]).toEqual(['pl', 'en', 'uk', 'ru', 'tr', 'pt', 'es', 'fr', 'cs']);
    expect(pageIdsFor('pl').length).toBeGreaterThan(USER_PAGE_IDS.length);
    expect(pageIdsFor('en').length).toBe(pageIdsFor('pl').length);
    for (const lang of translated) expect([...pageIdsFor(lang)]).toEqual([...USER_PAGE_IDS]);
  });

  test('addresses: Polish at /docs/, every other language under its own prefix with the English slugs', () => {
    expect(docsPath('pl', 'index')).toBe('/docs/');
    expect(docsPath('en', 'obs')).toBe('/en/docs/faceit-banner-for-obs/');
    expect(docsPath('uk', 'obs')).toBe('/uk/docs/faceit-banner-for-obs/');
    expect(docsPath('cs', 'index')).toBe('/cs/docs/');
  });

  test('every English sentence of the user guides has a translation in each new language', () => {
    startRecording();
    buildDocsPages('en');
    const keys = stopRecording();
    expect(keys.length).toBeGreaterThan(150);
    for (const lang of translated) expect(missingTranslations(lang, keys), lang).toEqual([]);
  });

  test.each(translated)('%s builds every user page, with no leftover tokens and its own words', (lang) => {
    const pages = buildDocsPages(lang);
    const english = buildDocsPages('en');
    expect(pages.map((page) => page.id).sort()).toEqual([...USER_PAGE_IDS].sort());
    for (const page of pages) {
      const original = english.find((entry) => entry.id === page.id)!;
      expect(page.title, `${lang}/${page.id}`).not.toBe(original.title);
      const text = JSON.stringify(page);
      expect(text).not.toMatch(/\{\{\w+\}\}/);
      expect(page.description.length).toBeGreaterThan(40);
    }
  });

  test.each([...DOCS_LANGS])('%s has all the words around the content', (lang) => {
    const chrome = CHROME[lang];
    for (const key of ['back', 'docs', 'index', 'contents', 'open', 'updated', 'footer', 'sidebar', 'terms', 'privacy', 'user', 'dev', 'ogLocale'] as const) {
      expect(chrome[key].trim().length, `${lang}.${key}`).toBeGreaterThan(0);
    }
    for (const id of USER_PAGE_IDS) expect(chrome.nav[id], `${lang}.nav.${id}`).toBeTruthy();
    expect(navLabel(lang, 'dev')).toBeTruthy();
  });
});

describe('a docs page in the search results', () => {
  const html = (lang: DocsLang, id: string) => {
    const pages = buildDocsPages(lang);
    return renderToStaticMarkup(<DocsPage lang={lang} page={pages.find((page) => page.id === id)!} pages={pages} />);
  };

  test('a user guide points at every language it exists in, and says which one it is', () => {
    const page = html('uk', 'obs');
    expect(page).toContain('<html lang="uk">');
    expect(page).toContain('og:locale" content="uk_UA"');
    for (const lang of DOCS_LANGS) expect(page).toContain(`hrefLang="${lang}" href="https://faceitbanner.vxh.pl${docsPath(lang, 'obs')}"`);
    expect(page).toContain('hrefLang="x-default"');
    expect(page).toContain(`rel="canonical" href="https://faceitbanner.vxh.pl${docsPath('uk', 'obs')}"`);
  });

  test('the developer pages exist in two languages only, and the others link to the English ones', () => {
    const dev = html('en', 'dev-setup');
    expect(dev).toContain('hrefLang="pl"');
    expect(dev).toContain('hrefLang="en"');
    expect(dev).not.toContain('hrefLang="uk"');
    const user = html('ru', 'quick-start');
    expect(user).toContain('href="/en/docs/dev/"');
  });

  test('the language switcher lists the languages of the page, the current one is not a link', () => {
    const page = html('tr', 'faq');
    expect(page).toContain('class="lang is-current"');
    expect(page).toContain('href="/uk/docs/faq/"');
    expect(page).toContain('href="/docs/faq/"');
  });
});
