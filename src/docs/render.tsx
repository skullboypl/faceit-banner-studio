/**
 * Static server-side rendering of the documentation.
 * Built with `vite build --ssr` and run with node; writes finished HTML pages
 * and the sitemap into `public/`, which Vite copies into `dist/`.
 */
import { mkdirSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { DocsPage } from './DocsPage';
import {
  DOCS_UPDATED,
  DocsLang,
  PAGE_IDS,
  SITE_URL,
  buildDocsPages,
  docsPath,
} from './content';

const PUBLIC_DIR = join(process.cwd(), 'public');
const LANGS: DocsLang[] = ['pl', 'en'];

const writePage = (urlPath: string, html: string) => {
  const dir = join(PUBLIC_DIR, urlPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), `<!doctype html>${html}`);
};

const written: string[] = [];
for (const lang of LANGS) {
  const pages = buildDocsPages(lang);
  for (const page of pages) {
    const path = docsPath(lang, page.id);
    writePage(path, renderToStaticMarkup(<DocsPage lang={lang} page={page} pages={pages} />));
    written.push(path);
  }
}

/* Sitemap: home, docs in both languages (with hreflang alternates) and the wiki pages */
const wikiDir = join(PUBLIC_DIR, 'wiki');
const wikiPaths = existsSync(wikiDir)
  ? ['/wiki/', ...readdirSync(wikiDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(wikiDir, entry.name, 'index.html')))
      .map((entry) => `/wiki/${entry.name}/`)]
  : [];

const url = (loc: string, priority: string, changefreq: string, alternates = '') =>
  `  <url>\n    <loc>${SITE_URL}${loc}</loc>\n${alternates}    <lastmod>${DOCS_UPDATED}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

const entries: string[] = [url('/', '1.0', 'weekly')];
for (const lang of LANGS) {
  for (const id of PAGE_IDS) {
    const alternates = [...LANGS, 'x-default' as const]
      .map((alt) => {
        const target: DocsLang = alt === 'x-default' ? 'pl' : alt;
        return `    <xhtml:link rel="alternate" hreflang="${alt}" href="${SITE_URL}${docsPath(target, id)}" />\n`;
      })
      .join('');
    entries.push(url(docsPath(lang, id), id === 'index' ? '0.9' : '0.8', 'weekly', alternates));
  }
}
for (const path of wikiPaths) {
  entries.push(url(path, '0.7', 'monthly'));
}

/* llms.txt: a plain summary for AI assistants and search engines */
const llmsLines: string[] = [
  '# FACEIT Banner',
  '',
  '> Free, independent generator of FACEIT widgets (ELO, level, CS2 statistics) for OBS Studio and Streamlabs. Open source (MIT), by Skull.',
  '',
  `Home: ${SITE_URL}/`,
];
for (const lang of LANGS) {
  llmsLines.push('', lang === 'pl' ? '## Dokumentacja (PL)' : '## Documentation (EN)', '');
  for (const page of buildDocsPages(lang)) {
    llmsLines.push(`- [${page.h1}](${SITE_URL}${docsPath(lang, page.id)}): ${page.description}`);
  }
}
writeFileSync(join(PUBLIC_DIR, 'llms.txt'), `${llmsLines.join('\n')}\n`);

writeFileSync(
  join(PUBLIC_DIR, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`
);

process.stdout.write(`Docs rendered: ${written.length} pages, sitemap with ${entries.length} URLs
`);
