import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { CHROME, navLabel } from './chrome';
import { USER_PAGE_IDS, buildDocsPages, docsPath, pageIdsFor } from './content';
import { DocsPage } from './DocsPage';
import { sitePages } from './site-pages';
import { docsCssHref, useCssVersion } from './docs-assets';
import { DOCS_LANGS, DocsLang, hasDevDocs, missingTranslations, startRecording, stopRecording } from './docs-i18n';

const translated = DOCS_LANGS.filter((lang) => !hasDevDocs(lang)) as Exclude<DocsLang, 'pl' | 'en'>[];

describe('documentation languages', () => {
  test('the docs come in the studio languages, developer pages only in Polish and English', () => {
    expect([...DOCS_LANGS]).toEqual(['pl', 'en', 'de', 'uk', 'ru', 'tr', 'pt', 'es', 'fr', 'cs']);
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

  test('the language menu looks like the studio one: a flag and the language name, a list of every language of the page', () => {
    const page = html('tr', 'faq');
    expect(page).toContain('<details class="lang-select">');
    expect(page).toContain('class="lang-trigger"');
    expect(page).toContain('Türkçe');
    for (const [code, name] of [['pl', 'Polski'], ['uk', 'Українська'], ['de', 'Deutsch'], ['cs', 'Čeština']]) {
      expect(page).toContain(`href="${docsPath(code as DocsLang, 'faq')}"`);
      expect(page).toContain(name);
    }
    expect(page).toContain('https://flagcdn.com/ua.svg');
    expect(page).toContain('https://flagcdn.com/br.svg');
    expect(page).toContain('aria-current="true"');
  });

  test('a developer page offers only the two languages it exists in', () => {
    const page = html('pl', 'dev-setup');
    expect(page).toContain('href="/en/docs/dev/setup/"');
    expect(page).not.toContain('href="/uk/docs/');
  });
});

describe('the language menu on the wiki and the legal pages', () => {
  const render = (path: string) => renderToStaticMarkup(sitePages.find((page) => page.path === path)!.element);

  test('a wiki page is Polish, and every other language leads to the matching documentation page', () => {
    const page = render('/wiki/bannerfaceit/');
    expect(page).toContain('<details class="lang-select">');
    expect(page).toContain('Polski');
    expect(page).toContain(`href="${docsPath('uk', 'obs')}"`);
    expect(page).toContain(`href="${docsPath('de', 'obs')}"`);
    expect(page).toContain(`href="${docsPath('en', 'obs')}"`);
    const faq = render('/wiki/faq-faceit-widget/');
    expect(faq).toContain(`href="${docsPath('fr', 'faq')}"`);
    const modes = render('/wiki/sklad-split-popup/');
    expect(modes).toContain(`href="${docsPath('es', 'modes')}"`);
    const catalog = render('/wiki/publiczne-banery/');
    expect(catalog).toContain(`href="${docsPath('de', 'catalog')}"`);
  });

  test('the wiki index leads to the documentation overview in each language', () => {
    const page = render('/wiki/');
    expect(page).toContain(`href="${docsPath('cs', 'index')}"`);
  });

  test('the terms and the privacy policy offer the two languages they are written in', () => {
    for (const path of ['/terms/', '/privacy/']) {
      const page = render(path);
      expect(page).toContain('<details class="lang-select">');
      expect(page).toContain('href="#pl"');
      expect(page).toContain('href="#en"');
      expect(page).not.toContain('href="/uk/docs/');
    }
  });
});

describe('the stylesheet of the static pages', () => {
  const page = () => {
    const pages = buildDocsPages('pl');
    return renderToStaticMarkup(<DocsPage lang="pl" page={pages[0]} pages={pages} />);
  };

  test('its address changes with its content, so a CDN or a browser never serves an old copy next to new pages', () => {
    useCssVersion('.a { color: red }');
    const first = docsCssHref();
    expect(first).toMatch(/^\/docs\.css\?v=[0-9a-f]{10}$/);
    expect(page()).toContain(`href="${first}"`);
    expect(renderToStaticMarkup(sitePages[0].element)).toContain(`href="${first}"`);
    useCssVersion('.a { color: red }');
    expect(docsCssHref()).toBe(first);
    useCssVersion('.a { color: blue }');
    expect(docsCssHref()).not.toBe(first);
    useCssVersion('');
  });

  test('without a version it is the plain address', () => {
    useCssVersion('');
    expect(docsCssHref()).toBe('/docs.css');
  });
});
