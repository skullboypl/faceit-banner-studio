import {
  CATEGORIES,
  DOCS_UPDATED,
  DocsBlock,
  DocsLang,
  DocsPageData,
  SITE_URL,
  docsPath,
} from './content';

const SITE_NAME = 'FACEIT Banner';

const NAV_LABELS: Record<DocsLang, Record<string, string>> = {
  pl: {
    dev: 'Przegląd dla developerów',
    'dev-setup': 'Uruchomienie lokalne',
    'dev-settings': 'System ustawień',
    'dev-layouts': 'Nowy układ banera',
    'dev-widget': 'Działanie widżetu',
    'dev-build': 'Build i wdrożenie',
    'dev-contributing': 'Współtworzenie',
    index: 'Przegląd',
    obs: 'Baner FACEIT do OBS',
    'quick-start': 'Szybki start',
    solo: 'Banery solo',
    versus: 'Banery VERSUS',
    size: 'Rozmiar banera',
    stream: 'ELO na streamie',
    params: 'Parametry linku',
    faq: 'FAQ',
    about: 'O projekcie',
  },
  en: {
    dev: 'Developer overview',
    'dev-setup': 'Local setup',
    'dev-settings': 'Settings system',
    'dev-layouts': 'New banner layout',
    'dev-widget': 'How the widget works',
    'dev-build': 'Build and deployment',
    'dev-contributing': 'Contributing',
    index: 'Overview',
    obs: 'FACEIT banner for OBS',
    'quick-start': 'Quick start',
    solo: 'Solo banners',
    versus: 'VERSUS banners',
    size: 'Banner size',
    stream: 'ELO on stream',
    params: 'URL parameters',
    faq: 'FAQ',
    about: 'About',
  },
};

const AUDIENCE_LABELS: Record<DocsLang, Record<'user' | 'dev', string>> = {
  pl: { user: 'Użytkownik', dev: 'Developer' },
  en: { user: 'User', dev: 'Developer' },
};

const ICONS = {
  layers: 'm12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5',
  back: 'M19 12H5m6-6-6 6 6 6',
  book: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15ZM5 19.5A1.5 1.5 0 0 0 6.5 21H19M9 7.5h6M9 11h4',
  palette: 'M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H13a1.5 1.5 0 0 1 0-3h3a5 5 0 0 0 5-5c0-3.5-4-6-9-6Z',
  stats: 'M4 20h16M6 16v-5m6 5V4m6 12V8',
  settings: 'M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6',
  monitor: 'M4 4h16v13H4zM8 21h8m-4-4v4',
};

const CATEGORY_ICONS: Record<string, string> = {
  start: ICONS.book,
  banners: ICONS.palette,
  reference: ICONS.stats,
  'dev-intro': ICONS.layers,
  'dev-develop': ICONS.settings,
  'dev-ship': ICONS.monitor,
};

const Icon = ({ path }: { path: string }) => (
  <svg
    className="icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={path} />
  </svg>
);

const absolute = (path: string) => `${SITE_URL}${path}`;

const Block = ({ block }: { block: DocsBlock }) => {
  switch (block.type) {
    case 'h2':
      return <h2 id={block.id}>{block.text}</h2>;
    case 'p':
      return <p>{block.text}</p>;
    case 'code':
      return (
        <pre>
          <code>{block.text}</code>
        </pre>
      );
    case 'answer':
      return (
        <aside className="answer">
          <strong>{block.label}</strong>
          <p>{block.text}</p>
        </aside>
      );
    case 'ul':
      return (
        <ul>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );
    case 'table':
      return (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {block.head.map((cell) => (
                  <th key={cell}>{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join('|')}>
                  {row.map((cell, index) => (
                    <td key={`${cell}-${index}`}>{index === 0 ? <code>{cell}</code> : cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'cards':
      return (
        <div className="cards">
          {block.items.map((card) => {
            const body = (
              <>
                <strong>
                  {card.title}
                  {card.badge && <em className="badge">{card.badge}</em>}
                </strong>
                <span>{card.text}</span>
                {!card.meta.startsWith('/') && <small>{card.meta}</small>}
              </>
            );
            return card.meta.startsWith('/') ? (
              <a className="card" href={card.meta} key={card.title}>
                {body}
              </a>
            ) : (
              <div className="card" key={card.title}>
                {body}
              </div>
            );
          })}
        </div>
      );
    case 'faq':
      return (
        <div className="faq">
          {block.items.map((item) => (
            <details key={item.q} open>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      );
  }
};

/** JSON-LD for the page: article, breadcrumbs and, on the FAQ page, the questions. */
const structuredData = (lang: DocsLang, page: DocsPageData, pages: DocsPageData[]) => {
  const url = absolute(docsPath(lang, page.id));
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'TechArticle',
      headline: page.h1,
      description: page.description,
      inLanguage: lang,
      dateModified: DOCS_UPDATED,
      mainEntityOfPage: url,
      author: { '@type': 'Person', name: 'Skull' },
      publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      about: { '@id': `${SITE_URL}/#app` },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: AUDIENCE_LABELS[lang][page.audience], item: absolute(docsPath(lang, page.audience === 'dev' ? 'dev' : 'index')) },
        ...(page.id === 'index' || page.id === 'dev'
          ? []
          : [{ '@type': 'ListItem', position: 3, name: page.h1, item: url }]),
      ],
    },
  ];
  /* HowTo for the guides: answer engines can lift the steps as they are */
  const steps = page.blocks.find((block) => block.type === 'ol');
  if (steps && steps.type === 'ol' && ['obs', 'quick-start', 'versus'].includes(page.id)) {
    graph.push({
      '@type': 'HowTo',
      name: page.h1,
      description: page.description,
      inLanguage: lang,
      step: steps.items.map((text, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        text,
      })),
    });
  }
  /* The product as an entity, so generative engines know who and what it is */
  graph.push({
    '@type': 'SoftwareApplication',
    '@id': `${SITE_URL}/#app`,
    name: SITE_NAME,
    alternateName: 'FACEIT Stats Widget',
    url: `${SITE_URL}/`,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web, OBS Studio, Streamlabs Desktop',
    isAccessibleForFree: true,
    license: 'https://opensource.org/licenses/MIT',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'PLN' },
    author: {
      '@type': 'Person',
      name: 'Skull',
      sameAs: [
        'https://github.com/skullboypl',
        'https://www.twitch.tv/skullboypl',
        'https://www.tiktok.com/@skullboypl',
      ],
    },
  });
  const faq = page.blocks.find((block) => block.type === 'faq');
  if (faq && faq.type === 'faq') {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faq.items.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    });
  }
  void pages;
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
};

export const DocsPage = ({
  lang,
  page,
  pages,
}: {
  lang: DocsLang;
  page: DocsPageData;
  pages: DocsPageData[];
}) => {
  const url = absolute(docsPath(lang, page.id));
  const other: DocsLang = lang === 'pl' ? 'en' : 'pl';
  const headings = page.blocks.filter(
    (block): block is Extract<DocsBlock, { type: 'h2' }> => block.type === 'h2'
  );
  const title = `${page.title} | ${SITE_NAME}`;

  return (
    <html lang={lang}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={page.description} />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <meta name="theme-color" content="#0b0e14" />
        <meta name="author" content="Skull" />
        <link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt" />
        <link rel="canonical" href={url} />
        <link rel="alternate" hrefLang={lang} href={url} />
        <link rel="alternate" hrefLang={other} href={absolute(docsPath(other, page.id))} />
        <link rel="alternate" hrefLang="x-default" href={absolute(docsPath('pl', page.id))} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={page.description} />
        <meta property="og:url" content={url} />
        <meta property="og:locale" content={lang === 'pl' ? 'pl_PL' : 'en_US'} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={page.description} />
        <link rel="stylesheet" href="/docs.css" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: structuredData(lang, page, pages) }}
        />
      </head>
      <body>
        <div className="shell">
          <header className="sidebar">
            <a className="brand" href="/" aria-label="FACEIT Banner Studio">
              <span className="mark" aria-hidden="true">
                <Icon path={ICONS.layers} />
              </span>
              <span>
                Banner<span className="brand-subtitle">STUDIO / FACEIT</span>
              </span>
            </a>
            <a className="back" href="/">
              <Icon path={ICONS.back} />
              <span>{lang === 'pl' ? 'Wróć do generatora' : 'Back to the generator'}</span>
            </a>
            <p className="nav-caption">{lang === 'pl' ? 'Dokumentacja' : 'Documentation'}</p>
            <div className="audience" role="tablist" aria-label="Docs">
              {(['user', 'dev'] as const).map((audience) => (
                <a
                  key={audience}
                  role="tab"
                  href={docsPath(lang, audience === 'dev' ? 'dev' : 'index')}
                  aria-selected={audience === page.audience}
                >
                  {AUDIENCE_LABELS[lang][audience]}
                </a>
              ))}
            </div>
            <nav className="docs-nav" aria-label={lang === 'pl' ? 'Spis dokumentacji' : 'Documentation index'}>
              {CATEGORIES.filter((category) => category.audience === page.audience).map(
                (category) => (
                  <div className="group" key={category.id}>
                    <p className="group-title">
                      <Icon path={CATEGORY_ICONS[category.id] ?? ICONS.book} />
                      {category.label[lang]}
                    </p>
                    {category.pages.map((id) => (
                      <a
                        key={id}
                        href={docsPath(lang, id)}
                        aria-current={id === page.id ? 'page' : undefined}
                      >
                        {NAV_LABELS[lang][id]}
                      </a>
                    ))}
                  </div>
                )
              )}
            </nav>
            <div className="sidebar-note">
              <span className="game-label">CS2</span>
              <p>
                {lang === 'pl'
                  ? 'Widżet statystyk FACEIT dla Twojej transmisji.'
                  : 'A FACEIT statistics widget for your stream.'}
              </p>
              <small>
                <a href="/wiki/">Wiki</a> ·{' '}
                <a href="https://github.com/skullboypl/faceit-banner-faceitbanner.vxh.pl">GitHub</a>
              </small>
            </div>
          </header>
          <div className="workspace">
            <div className="topbar">
              <span>
                <a href={docsPath(lang, 'index')}>Docs</a>
                <span className="divider">/</span>
                <a href={docsPath(lang, page.audience === 'dev' ? 'dev' : 'index')}>
                  {AUDIENCE_LABELS[lang][page.audience]}
                </a>
                {page.id !== 'index' && page.id !== 'dev' && (
                  <>
                    <span className="divider">/</span>
                    <strong>{NAV_LABELS[lang][page.id]}</strong>
                  </>
                )}
              </span>
              <span className="topbar-actions">
                <a href={docsPath(other, page.id)} hrefLang={other} lang={other} className="lang">
                  {other.toUpperCase()}
                </a>
                <a className="obs-tag" href="/">
                  OBS STUDIO
                </a>
              </span>
            </div>
            <main>
              <article>
                <header className="heading">
                  <p className="eyebrow">FACEIT BANNER / DOCS</p>
                  <h1>{page.h1}</h1>
                  <p className="lead">{page.intro}</p>
                </header>
                {headings.length > 2 && (
                  <nav className="toc" aria-label={lang === 'pl' ? 'Spis treści' : 'Contents'}>
                    {headings.map((heading) => (
                      <a key={heading.id} href={`#${heading.id}`}>
                        {heading.text}
                      </a>
                    ))}
                  </nav>
                )}
                <div className="panel">
                  {page.blocks.map((block, index) => (
                    <Block block={block} key={index} />
                  ))}
                </div>
                <p className="cta-row">
                  <a className="cta" href="/">
                    {lang === 'pl' ? 'Otwórz generator' : 'Open the generator'}
                  </a>
                </p>
                <p className="updated">
                  {lang === 'pl' ? 'Zaktualizowano' : 'Updated'}: <time dateTime={DOCS_UPDATED}>{DOCS_UPDATED}</time>
                </p>
              </article>
            </main>
            <footer>
              <small>
                {lang === 'pl'
                  ? 'FACEIT Banner nie jest powiązany z FACEIT. Kod źródłowy na licencji MIT.'
                  : 'FACEIT Banner is not affiliated with FACEIT. Source code under the MIT licence.'}
              </small>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
};
