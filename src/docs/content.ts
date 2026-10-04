import polish from '../translations/polish.json';
import english from '../translations/english.json';
import { broadcastPresets } from '../../widget/src/styles/styles';
import { getBannerSizeLimits } from '../../widget/src/utils/banner_size';
import { SETTINGS_DEFINITIONS } from '../settings/definition';
import { buildDevPages } from './dev-content';

export type DocsLang = 'pl' | 'en';

export type DocsBlock =
  | { type: 'h2'; id: string; text: string }
  | { type: 'p'; text: string }
  | { type: 'code'; text: string }
  | { type: 'answer'; label: string; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'cards'; items: { title: string; text: string; meta: string; badge?: string }[] }
  | { type: 'faq'; items: { q: string; a: string }[] };

export type DocsAudience = 'user' | 'dev';

export type DocsPageData = {
  id: string;
  audience: DocsAudience;
  category: string;
  slug: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  blocks: DocsBlock[];
};

export const SITE_URL = 'https://faceitbanner.vxh.pl';
/** Bump when the documentation changes; used for lastmod and dateModified. */
export const DOCS_UPDATED = '2026-10-04';

const TRANSLATIONS: Record<DocsLang, Record<string, string>> = {
  pl: polish as Record<string, string>,
  en: english as Record<string, string>,
};

const SLUGS: Record<DocsLang, Record<string, string>> = {
  pl: {
    index: '',
    obs: 'baner-faceit-do-obs',
    'quick-start': 'szybki-start',
    solo: 'banery-solo',
    versus: 'banery-versus',
    size: 'rozmiar-banera',
    stream: 'elo-faceit-na-streamie',
    params: 'parametry-url',
    faq: 'faq',
    about: 'o-projekcie',
    dev: 'dev',
    'dev-setup': 'dev/uruchomienie',
    'dev-settings': 'dev/ustawienia',
    'dev-layouts': 'dev/nowy-uklad',
    'dev-widget': 'dev/widzet',
    'dev-build': 'dev/build-i-wdrozenie',
    'dev-contributing': 'dev/wspoltworzenie',
  },
  en: {
    index: '',
    obs: 'faceit-banner-for-obs',
    'quick-start': 'quick-start',
    solo: 'solo-banners',
    versus: 'versus-banners',
    size: 'banner-size',
    stream: 'faceit-elo-on-stream',
    params: 'url-parameters',
    faq: 'faq',
    about: 'about',
    dev: 'dev',
    'dev-setup': 'dev/setup',
    'dev-settings': 'dev/settings',
    'dev-layouts': 'dev/new-layout',
    'dev-widget': 'dev/widget',
    'dev-build': 'dev/build-and-deploy',
    'dev-contributing': 'dev/contributing',
  },
};

export const USER_PAGE_IDS = ['index', 'obs', 'quick-start', 'solo', 'versus', 'size', 'stream', 'params', 'faq', 'about'] as const;
export const DEV_PAGE_IDS = ['dev', 'dev-setup', 'dev-settings', 'dev-layouts', 'dev-widget', 'dev-build', 'dev-contributing'] as const;
export const PAGE_IDS = [...USER_PAGE_IDS, ...DEV_PAGE_IDS] as const;

/** Sidebar groups: every page belongs to one category of one audience. */
export const CATEGORIES: {
  audience: DocsAudience;
  id: string;
  label: Record<DocsLang, string>;
  pages: readonly string[];
}[] = [
  { audience: 'user', id: 'start', label: { pl: 'Start', en: 'Start' }, pages: ['index', 'obs', 'quick-start'] },
  { audience: 'user', id: 'banners', label: { pl: 'Banery', en: 'Banners' }, pages: ['solo', 'versus', 'size'] },
  { audience: 'user', id: 'reference', label: { pl: 'Informacje', en: 'Reference' }, pages: ['stream', 'params', 'faq', 'about'] },
  { audience: 'dev', id: 'dev-intro', label: { pl: 'Wprowadzenie', en: 'Introduction' }, pages: ['dev', 'dev-setup'] },
  { audience: 'dev', id: 'dev-develop', label: { pl: 'Rozwój', en: 'Development' }, pages: ['dev-settings', 'dev-layouts', 'dev-widget'] },
  { audience: 'dev', id: 'dev-ship', label: { pl: 'Wdrożenie i współpraca', en: 'Shipping and contributing' }, pages: ['dev-build', 'dev-contributing'] },
];

export const audienceOf = (id: string): DocsAudience =>
  (DEV_PAGE_IDS as readonly string[]).includes(id) ? 'dev' : 'user';

/** Public URL path of a docs page, e.g. /docs/banery-solo/ or /en/docs/. */
export const docsPath = (lang: DocsLang, id: string) => {
  const base = lang === 'pl' ? '/docs/' : '/en/docs/';
  const slug = SLUGS[lang][id];
  return slug ? `${base}${slug}/` : base;
};

const styleName = (lang: DocsLang, id: string) =>
  TRANSLATIONS[lang][`style.${id}`] || id;
const styleDescription = (lang: DocsLang, id: string) =>
  TRANSLATIONS[lang][`style.${id}.description`] || '';

const layoutCards = (lang: DocsLang, versus: boolean) =>
  broadcastPresets
    .filter((preset) => Boolean(preset.versus) === versus)
    .map((preset) => ({
      title: styleName(lang, preset.id),
      text: styleDescription(lang, preset.id),
      meta: `OBS · ${preset.width} × ${preset.height} px`,
      badge: preset.animated ? 'ANIM' : undefined,
    }));

const sizeTable = (lang: DocsLang) =>
  broadcastPresets.map((preset) => {
    const limits = getBannerSizeLimits(preset.id)!;
    return [
      styleName(lang, preset.id),
      `${limits.width} × ${limits.height}`,
      `${limits.minWidth}–${limits.maxWidth}`,
      limits.square ? '= width' : `${limits.minHeight}–${limits.maxHeight}`,
    ];
  });

const paramRows = () => {
  const rows: string[][] = [];
  for (const [key, definition] of Object.entries(SETTINGS_DEFINITIONS)) {
    const def = definition as {
      query?: string[];
      type: string;
      defaultValue?: unknown;
      options?: unknown[];
      min?: number;
      max?: number;
    };
    if (!def.query || def.query.length === 0) continue;
    const allowed = def.options
      ? def.options.filter((option) => option !== undefined).join(' | ')
      : def.type === 'boolean'
        ? 'true | false'
        : def.min !== undefined && def.max !== undefined
          ? `${def.min}–${def.max}`
          : def.type === 'number'
            ? 'number'
            : 'text';
    rows.push([
      def.query[0],
      key,
      allowed,
      def.defaultValue === undefined || def.defaultValue === ''
        ? '—'
        : String(def.defaultValue),
    ]);
  }
  return rows.sort((a, b) => a[0].localeCompare(b[0]));
};

const COUNTS = {
  solo: broadcastPresets.filter((preset) => !preset.versus).length,
  versus: broadcastPresets.filter((preset) => preset.versus).length,
};

export function buildDocsPages(lang: DocsLang): DocsPageData[] {
  const withMeta = (pages: Omit<DocsPageData, 'audience' | 'category'>[]): DocsPageData[] =>
    pages.map((page) => ({
      ...page,
      audience: audienceOf(page.id),
      category: CATEGORIES.find((category) => category.pages.includes(page.id))?.id ?? 'start',
    }));
  const userPages = buildUserPages(lang);
  return [
    ...withMeta(userPages),
    ...withMeta(buildDevPages(lang, docsPath, (id) => SLUGS[lang][id])),
  ];
}

function buildUserPages(lang: DocsLang): Omit<DocsPageData, 'audience' | 'category'>[] {
  const pl = lang === 'pl';
  const t = (polishText: string, englishText: string) => (pl ? polishText : englishText);
  const soloNames = layoutCards(lang, false).map((card) => card.title).join(', ');
  const versusNames = layoutCards(lang, true).map((card) => card.title).join(', ');

  return [
    {
      id: 'index',
      slug: '',
      title: t(
        'Dokumentacja FACEIT Banner – widżet ELO i statystyk do OBS',
        'FACEIT Banner documentation – ELO and stats widget for OBS'
      ),
      description: t(
        `Dokumentacja generatora banerów FACEIT do OBS: ${COUNTS.solo} układów solo, ${COUNTS.versus} układów VERSUS, rozmiar, parametry linku i FAQ.`,
        `Documentation for the FACEIT banner generator for OBS: ${COUNTS.solo} solo layouts, ${COUNTS.versus} VERSUS layouts, size options, URL parameters and FAQ.`
      ),
      h1: t('Dokumentacja FACEIT Banner', 'FACEIT Banner documentation'),
      intro: t(
        'FACEIT Banner to darmowy generator widżetów FACEIT dla OBS Studio i Streamlabs. Pokazuje Twój poziom, ELO, statystyki meczowe i pojedynki z rywalem prosto na streamie.',
        'FACEIT Banner is a free FACEIT widget generator for OBS Studio and Streamlabs. It shows your level, ELO, match statistics and head-to-head duels right on your stream.'
      ),
      blocks: [
        { type: 'h2', id: 'what', text: t('Co potrafi generator', 'What the generator does') },
        {
          type: 'ul',
          items: [
            t(`${COUNTS.solo} układów solo w wyglądzie FACEIT 2026 (${soloNames})`, `${COUNTS.solo} solo layouts in the FACEIT 2026 look (${soloNames})`),
            t(`tryb VERSUS: ty kontra rywal, ${COUNTS.versus} układów (${versusNames})`, `VERSUS mode: you against a rival, ${COUNTS.versus} layouts (${versusNames})`),
            t('rozmiar banera AUTO, Zalecane lub Ręcznie z limitami per baner', 'banner size AUTO, Recommended or Manual with limits per banner'),
            t('animowane banery, poświata levelu, kolory akcentu i zaokrąglenie rogów', 'animated banners, level glow, accent colours and corner radius'),
            t('wygląd klasyczny dla starszych linków', 'the classic look for older links'),
          ],
        },
        { type: 'h2', id: 'start', text: t('Od czego zacząć', 'Where to start') },
        {
          type: 'p',
          text: t(
            'Najszybciej zacząć od krótkiego poradnika, a potem wybrać układ banera i dopasować rozmiar.',
            'The quickest way is the short guide, then pick a banner layout and adjust the size.'
          ),
        },
        {
          type: 'cards',
          items: [
            { title: t('Baner FACEIT do OBS', 'FACEIT banner for OBS'), text: t('Pełny przewodnik krok po kroku.', 'The full step-by-step guide.'), meta: docsPath(lang, 'obs') },
            { title: t('Szybki start', 'Quick start'), text: t('Link do OBS w kilku krokach.', 'An OBS link in a few steps.'), meta: docsPath(lang, 'quick-start') },
            { title: t('Banery solo', 'Solo banners'), text: t('Wszystkie układy z rozmiarami.', 'Every layout with its sizes.'), meta: docsPath(lang, 'solo') },
            { title: t('Banery VERSUS', 'VERSUS banners'), text: t('Rywal, różnica ELO i porównanie statystyk.', 'Rival, ELO gap and statistics comparison.'), meta: docsPath(lang, 'versus') },
            { title: t('Rozmiar banera', 'Banner size'), text: t('AUTO, Zalecane, Ręcznie i limity.', 'AUTO, Recommended, Manual and limits.'), meta: docsPath(lang, 'size') },
            { title: t('Parametry linku', 'URL parameters'), text: t('Pełna lista ustawień w adresie.', 'The full list of settings in the address.'), meta: docsPath(lang, 'params') },
            { title: t('ELO na streamie', 'ELO on stream'), text: t('OBS, Streamlabs, Twitch, Kick.', 'OBS, Streamlabs, Twitch, Kick.'), meta: docsPath(lang, 'stream') },
            { title: t('O projekcie', 'About'), text: t('Fakty, licencja i ograniczenia.', 'Facts, licence and limitations.'), meta: docsPath(lang, 'about') },
            { title: 'FAQ', text: t('Odpowiedzi na najczęstsze pytania.', 'Answers to the most common questions.'), meta: docsPath(lang, 'faq') },
          ],
        },
      ],
    },
    {
      id: 'quick-start',
      slug: SLUGS[lang]['quick-start'],
      title: t('Jak dodać baner FACEIT do OBS – szybki start', 'How to add a FACEIT banner to OBS – quick start'),
      description: t(
        'Krok po kroku: wygeneruj link w generatorze FACEIT Banner i dodaj go do OBS jako Browser Source. Zajmuje około dwóch minut.',
        'Step by step: generate a link in the FACEIT Banner generator and add it to OBS as a Browser Source. Takes about two minutes.'
      ),
      h1: t('Jak dodać baner FACEIT do OBS', 'How to add a FACEIT banner to OBS'),
      intro: t(
        'Cały proces to trzy kroki: ustaw nick, wybierz wygląd i wklej wygenerowany link jako źródło przeglądarki w OBS.',
        'The whole process is three steps: set your nickname, pick a look and paste the generated link as a browser source in OBS.'
      ),
      blocks: [
        { type: 'h2', id: 'steps', text: t('Kroki', 'Steps') },
        {
          type: 'ol',
          items: [
            t('Otwórz generator i wpisz swój nick FACEIT w zakładce Ustawienia.', 'Open the generator and enter your FACEIT nickname in the Settings tab.'),
            t('W zakładce Wygląd wybierz układ banera (solo albo, po włączeniu trybu VERSUS, pojedynek).', 'In the Appearance tab choose a banner layout (solo or, with VERSUS mode on, a duel).'),
            t('Zostaw rozmiar na Zalecane albo ustaw własny w panelu Rozmiar banera.', 'Keep the size on Recommended or set your own in the Banner size panel.'),
            t('Kliknij „Generuj link OBS" i skopiuj adres widżetu.', 'Click "Generate OBS link" and copy the widget address.'),
            t('W OBS dodaj źródło Przeglądarka (Browser Source), wklej adres i ustaw szerokość oraz wysokość według rozmiaru banera.', 'In OBS add a Browser Source, paste the address and set the width and height to the banner size.'),
          ],
        },
        { type: 'h2', id: 'tips', text: t('Wskazówki', 'Tips') },
        {
          type: 'ul',
          items: [
            t('Rozmiar źródła w OBS ustaw na tyle, ile pokazuje karta układu (np. 500 × 180), a baner dopasuje się sam.', 'Set the OBS source size to what the layout card shows (e.g. 500 × 180) and the banner fits itself.'),
            t('Tryb AUTO dopasuje baner do dowolnego okna przeglądarki OBS, ale nie przekroczy maksimum danego banera.', 'AUTO mode fits the banner to any OBS browser window but never exceeds the banner’s maximum.'),
            t('Statystyki odświeżają się same co kilkadziesiąt sekund, nie trzeba przeładowywać źródła.', 'Statistics refresh on their own every few dozen seconds, no need to reload the source.'),
          ],
        },
      ],
    },
    {
      id: 'solo',
      slug: SLUGS[lang].solo,
      title: t('Banery solo FACEIT do OBS – wszystkie układy', 'FACEIT solo banners for OBS – every layout'),
      description: t(
        `Przegląd ${COUNTS.solo} układów banerów solo FACEIT 2026 z rozmiarami OBS: ${soloNames}.`,
        `Overview of ${COUNTS.solo} FACEIT 2026 solo banner layouts with OBS sizes: ${soloNames}.`
      ),
      h1: t('Banery solo', 'Solo banners'),
      intro: t(
        'Banery solo pokazują wyłącznie Twoje dane: level, ELO, różnicę ELO, wygrane i porażki oraz wybrane statystyki. Poniżej lista wszystkich układów z zalecanym rozmiarem źródła w OBS.',
        'Solo banners show only your data: level, ELO, ELO change, wins and losses and your chosen statistics. Below is every layout with the recommended OBS source size.'
      ),
      blocks: [
        { type: 'h2', id: 'layouts', text: t('Dostępne układy', 'Available layouts') },
        { type: 'cards', items: layoutCards(lang, false) },
        { type: 'h2', id: 'animated', text: t('Animowane układy', 'Animated layouts') },
        {
          type: 'p',
          text: t(
            'Układy oznaczone ANIM zmieniają się same: Showcase i Spotlight przełączają zakładki, Ticker zmienia strony statystyk, Reel przewija statystyki, a Marquee przesuwa taśmę. Animacje wyłączają się, gdy system ma włączone ograniczanie ruchu.',
            'Layouts marked ANIM change on their own: Showcase and Spotlight switch tabs, Ticker flips statistic pages, Reel rolls statistics and Marquee scrolls a belt. Animations turn off when the system prefers reduced motion.'
          ),
        },
      ],
    },
    {
      id: 'versus',
      slug: SLUGS[lang].versus,
      title: t('Banery VERSUS FACEIT – ty kontra rywal w OBS', 'FACEIT VERSUS banners – you against a rival in OBS'),
      description: t(
        `Tryb VERSUS: porównaj swoje ELO i statystyki z rywalem na streamie. ${COUNTS.versus} układów: ${versusNames}.`,
        `VERSUS mode: compare your ELO and statistics with a rival on stream. ${COUNTS.versus} layouts: ${versusNames}.`
      ),
      h1: t('Banery VERSUS', 'VERSUS banners'),
      intro: t(
        'Tryb VERSUS zestawia Ciebie z wybranym rywalem: kto ma wyższe ELO, jak duża jest przewaga i kto wygrywa w poszczególnych statystykach.',
        'VERSUS mode sets you against a chosen rival: who has the higher ELO, how big the advantage is and who wins each statistic.'
      ),
      blocks: [
        { type: 'h2', id: 'setup', text: t('Jak włączyć tryb VERSUS', 'How to turn on VERSUS mode') },
        {
          type: 'ol',
          items: [
            t('W zakładce Ustawienia, na samej górze, wybierz VERSUS.', 'In the Settings tab, at the very top, pick VERSUS.'),
            t('Wpisz nick FACEIT rywala. Generator pobierze jego profil i pokaże avatar, ELO i level.', 'Enter the rival’s FACEIT nickname. The generator loads the profile and shows the avatar, ELO and level.'),
            t('Przejdź do zakładki Wygląd i wybierz układ VERSUS.', 'Go to the Appearance tab and choose a VERSUS layout.'),
          ],
        },
        {
          type: 'p',
          text: t(
            'Tryb VERSUS działa tylko z wyglądem FACEIT 2026. Statystyki rywala (K/D, ADR, wygrane, HS) pochodzą z jego ostatnich meczów i odświeżają się razem z Twoimi.',
            'VERSUS mode works only with the FACEIT 2026 look. The rival’s statistics (K/D, ADR, win rate, HS) come from his or her recent matches and refresh together with yours.'
          ),
        },
        { type: 'h2', id: 'layouts', text: t('Układy VERSUS', 'VERSUS layouts') },
        { type: 'cards', items: layoutCards(lang, true) },
      ],
    },
    {
      id: 'size',
      slug: SLUGS[lang].size,
      title: t('Rozmiar i responsywność banera FACEIT', 'FACEIT banner size and responsiveness'),
      description: t(
        'Tryby rozmiaru AUTO, Zalecane i Ręcznie, limity szerokości i wysokości dla każdego banera oraz zalecane rozmiary źródła w OBS.',
        'AUTO, Recommended and Manual size modes, width and height limits for every banner and the recommended OBS source sizes.'
      ),
      h1: t('Rozmiar i responsywność banera', 'Banner size and responsiveness'),
      intro: t(
        'Szerokość i wysokość ustawiasz osobno. Każda z nich ma trzy tryby, a każdy baner ma własne limity, żeby AUTO nigdy nie rozciągnęło go bez sensu.',
        'Width and height are set separately. Each has three modes, and every banner has its own limits so AUTO never stretches it senselessly.'
      ),
      blocks: [
        { type: 'h2', id: 'modes', text: t('Tryby rozmiaru', 'Size modes') },
        {
          type: 'ul',
          items: [
            t('AUTO: baner dopasowuje się do okna przeglądarki OBS, do limitu danego banera.', 'AUTO: the banner fits the OBS browser window, up to the banner’s limit.'),
            t('Zalecane: projektowy rozmiar banera. Wysokość dopasowuje się do tego, co pokazujesz, więc ukrycie elementów skraca baner.', 'Recommended: the designed size of the banner. The height follows what you show, so hiding elements makes the banner shorter.'),
            t('Ręcznie: własna wartość w pikselach, w granicach limitów.', 'Manual: your own value in pixels, within the limits.'),
          ],
        },
        {
          type: 'p',
          text: t(
            'Układ banera dostosowuje się do wybranego pola: zawartość rozkłada się w całej szerokości i wysokości, a tekst i ikony skalują się częściowo. Baner Pulse jest zawsze kołem 1:1.',
            'The banner layout adapts to the chosen box: content spreads over the full width and height while text and icons scale partially. The Pulse banner is always a 1:1 circle.'
          ),
        },
        { type: 'h2', id: 'limits', text: t('Rozmiary i limity per baner', 'Sizes and limits per banner') },
        {
          type: 'table',
          head: [t('Baner', 'Banner'), t('Zalecany (px)', 'Recommended (px)'), t('Szerokość min–max', 'Width min–max'), t('Wysokość min–max', 'Height min–max')],
          rows: sizeTable(lang),
        },
      ],
    },
    {
      id: 'params',
      slug: SLUGS[lang].params,
      title: t('Parametry linku widżetu FACEIT – pełna lista', 'FACEIT widget URL parameters – full list'),
      description: t(
        'Wszystkie parametry adresu widżetu FACEIT Banner: nazwy, dozwolone wartości i wartości domyślne. Przydatne do ręcznej edycji linku.',
        'Every FACEIT Banner widget URL parameter: names, allowed values and defaults. Handy for editing a link by hand.'
      ),
      h1: t('Parametry linku widżetu', 'Widget URL parameters'),
      intro: t(
        'Generator zapisuje ustawienia w adresie widżetu. W linku trafiają tylko wartości inne niż domyślne, więc krótki adres oznacza ustawienia domyślne. Poniżej pełna lista parametrów.',
        'The generator stores settings in the widget address. Only values that differ from the defaults end up in the link, so a short address means default settings. Below is the full parameter list.'
      ),
      blocks: [
        { type: 'h2', id: 'table', text: t('Tabela parametrów', 'Parameter table') },
        {
          type: 'table',
          head: [t('Parametr', 'Parameter'), t('Ustawienie', 'Setting'), t('Wartości', 'Values'), t('Domyślnie', 'Default')],
          rows: paramRows(),
        },
      ],
    },
    {
      id: 'obs',
      slug: SLUGS[lang].obs,
      title: t(
        'Baner FACEIT do OBS – darmowy generator ELO i statystyk',
        'FACEIT banner for OBS – free ELO and stats generator'
      ),
      description: t(
        'Jak zrobić baner FACEIT do OBS: darmowy generator pokazuje level, ELO, wygrane i statystyki CS2. Link do źródła Przeglądarka w dwie minuty, bez instalowania wtyczek.',
        'How to make a FACEIT banner for OBS: a free generator shows level, ELO, wins and CS2 statistics. A Browser Source link in two minutes, no plugins to install.'
      ),
      h1: t('Baner FACEIT do OBS', 'FACEIT banner for OBS'),
      intro: t(
        'Baner FACEIT do OBS to widżet, który na streamie pokazuje Twój level, ELO, różnicę ELO, wygrane i porażki oraz statystyki z ostatnich meczów CS2.',
        'A FACEIT banner for OBS is a widget that shows your level, ELO, ELO change, wins and losses and statistics from your recent CS2 matches on stream.'
      ),
      blocks: [
        {
          type: 'answer',
          label: t('Krótka odpowiedź', 'Short answer'),
          text: t(
            'Aby dodać baner FACEIT do OBS: otwórz generator FACEIT Banner, wpisz swój nick, wybierz układ, kliknij „Generuj link OBS" i wklej adres jako źródło Przeglądarka (Browser Source) w OBS. Działa za darmo, bez kont i bez wtyczek.',
            'To add a FACEIT banner to OBS: open the FACEIT Banner generator, enter your nickname, pick a layout, click "Generate OBS link" and paste the address as a Browser Source in OBS. It is free, needs no account and no plugins.'
          ),
        },
        { type: 'h2', id: 'how', text: t('Jak dodać baner FACEIT do OBS', 'How to add a FACEIT banner to OBS') },
        {
          type: 'ol',
          items: [
            t('Otwórz generator FACEIT Banner i wpisz swój nick FACEIT.', 'Open the FACEIT Banner generator and enter your FACEIT nickname.'),
            t('W zakładce Wygląd wybierz układ banera i, jeśli chcesz, kolory oraz rozmiar.', 'In the Appearance tab pick a banner layout and, if you want, colours and size.'),
            t('Kliknij „Generuj link OBS" i skopiuj adres.', 'Click "Generate OBS link" and copy the address.'),
            t('W OBS wybierz Źródła, plus, Przeglądarka i wklej adres w polu URL.', 'In OBS choose Sources, plus, Browser and paste the address into the URL field.'),
            t('Ustaw szerokość i wysokość źródła według rozmiaru banera i potwierdź.', 'Set the source width and height to the banner size and confirm.'),
          ],
        },
        { type: 'h2', id: 'shows', text: t('Co może pokazywać baner', 'What the banner can show') },
        {
          type: 'ul',
          items: [
            t('level FACEIT 1–10 oraz pozycję w rankingu challengerów', 'FACEIT level 1–10 and the challenger ranking position'),
            t('aktualne ELO i jego zmianę w bieżącej sesji', 'current ELO and its change in the current session'),
            t('wygrane i porażki z sesji streamu', 'wins and losses from the stream session'),
            t('K/D, ADR, HS %, wygrane % i inne statystyki z ostatnich meczów', 'K/D, ADR, HS %, win rate and other statistics from recent matches'),
            t('pojedynek z rywalem w trybie VERSUS', 'a duel with a rival in VERSUS mode'),
          ],
        },
        { type: 'h2', id: 'why', text: t('Generator czy własny overlay', 'Generator or a custom overlay') },
        {
          type: 'table',
          head: [t('Cecha', 'Feature'), 'FACEIT Banner', t('Własny overlay', 'Custom overlay')],
          rows: [
            [t('Koszt', 'Cost'), t('darmowy', 'free'), t('twój czas lub grafik', 'your time or a designer')],
            [t('Dane na żywo z FACEIT', 'Live FACEIT data'), t('tak, automatycznie', 'yes, automatic'), t('wymaga własnego kodu', 'needs your own code')],
            [t('Gotowe układy', 'Ready layouts'), `${COUNTS.solo + COUNTS.versus}`, t('zależnie od projektu', 'depends on the design')],
            [t('Zmiana rozmiaru', 'Resizing'), t('AUTO, Zalecane, Ręcznie', 'AUTO, Recommended, Manual'), t('ręcznie', 'by hand')],
          ],
        },
        {
          type: 'cards',
          items: [
            { title: t('Wszystkie banery solo', 'All solo banners'), text: t('Układy z rozmiarami do OBS.', 'Layouts with OBS sizes.'), meta: docsPath(lang, 'solo') },
            { title: t('Tryb VERSUS', 'VERSUS mode'), text: t('Ty kontra rywal.', 'You against a rival.'), meta: docsPath(lang, 'versus') },
            { title: t('Rozmiar banera', 'Banner size'), text: t('Limity i tryby rozmiaru.', 'Limits and size modes.'), meta: docsPath(lang, 'size') },
          ],
        },
        {
          type: 'faq',
          items: [
            {
              q: t('Czy baner FACEIT do OBS jest darmowy?', 'Is the FACEIT banner for OBS free?'),
              a: t('Tak, generator i widżet są darmowe, a kod źródłowy jest otwarty na licencji MIT.', 'Yes, the generator and widget are free and the source code is open under the MIT licence.'),
            },
            {
              q: t('Czy muszę instalować wtyczkę do OBS?', 'Do I need to install an OBS plugin?'),
              a: t('Nie. Widżet działa jako zwykłe źródło Przeglądarka, które OBS ma wbudowane.', 'No. The widget works as a regular Browser Source, which OBS has built in.'),
            },
            {
              q: t('Czy baner działa ze Streamlabs?', 'Does the banner work with Streamlabs?'),
              a: t('Tak, Streamlabs Desktop również obsługuje źródło przeglądarki, więc ten sam link zadziała.', 'Yes, Streamlabs Desktop also supports a browser source, so the same link works.'),
            },
          ],
        },
      ],
    },
    {
      id: 'stream',
      slug: SLUGS[lang].stream,
      title: t(
        'ELO FACEIT na streamie – OBS, Streamlabs, Twitch, Kick',
        'FACEIT ELO on stream – OBS, Streamlabs, Twitch, Kick'
      ),
      description: t(
        'Jak pokazać ELO FACEIT na streamie na Twitchu, YouTube i Kicku: widżet w źródle przeglądarki OBS lub Streamlabs, sesja z wygranymi i porażkami, ranking challengera.',
        'How to show FACEIT ELO on a Twitch, YouTube or Kick stream: a widget in an OBS or Streamlabs browser source, a session with wins and losses, challenger ranking.'
      ),
      h1: t('ELO FACEIT na streamie', 'FACEIT ELO on stream'),
      intro: t(
        'Widżet FACEIT działa wszędzie tam, gdzie program do streamowania ma źródło przeglądarki, więc niezależnie od platformy pokażesz widzom swoje ELO i statystyki.',
        'The FACEIT widget works anywhere the streaming software has a browser source, so whichever platform you use you can show viewers your ELO and statistics.'
      ),
      blocks: [
        {
          type: 'answer',
          label: t('Krótka odpowiedź', 'Short answer'),
          text: t(
            'ELO FACEIT na streamie pokażesz widżetem w źródle przeglądarki. Działa w OBS Studio i Streamlabs Desktop, a więc na Twitchu, YouTube i Kicku, bo platforma nie ma znaczenia.',
            'You show FACEIT ELO on stream with a widget in a browser source. It works in OBS Studio and Streamlabs Desktop, so on Twitch, YouTube and Kick alike, because the platform does not matter.'
          ),
        },
        { type: 'h2', id: 'software', text: t('Gdzie dodać widżet', 'Where to add the widget') },
        {
          type: 'table',
          head: [t('Program', 'Software'), t('Jak dodać', 'How to add')],
          rows: [
            ['OBS Studio', t('Źródła, plus, Przeglądarka, wklej link', 'Sources, plus, Browser, paste the link')],
            ['Streamlabs Desktop', t('Źródła, plus, Browser Source, wklej link', 'Sources, plus, Browser Source, paste the link')],
          ],
        },
        { type: 'h2', id: 'session', text: t('Wygrane i porażki z sesji', 'Wins and losses from the session') },
        {
          type: 'p',
          text: t(
            'Baner liczy wygrane, porażki i zmianę ELO od początku sesji. Po włączeniu opcji zapisu sesji dane są trzymane w danych przeglądarki w OBS: po restarcie OBS wracają, jeśli od zamknięcia widżetu minęły mniej niż dwie godziny. Po dwóch godzinach licznik startuje od zera.',
            'The banner counts wins, losses and the ELO change from the start of the session. With session saving on, the data is kept in the browser data inside OBS: after an OBS restart it comes back if less than two hours have passed since the widget was closed. After two hours the counter starts from zero.'
          ),
        },
        { type: 'h2', id: 'rank', text: t('Ranking challengera', 'Challenger ranking') },
        {
          type: 'p',
          text: t(
            'Gracze z pozycją 1–1000 w rankingu regionu mogą pokazać swoje miejsce obok ikony Challenger. Układy Ticker i Duel pokazują pozycję w regionie i w kraju.',
            'Players ranked 1–1000 in their region can show their place next to the Challenger icon. The Ticker and Duel layouts show the regional and the national position.'
          ),
        },
      ],
    },
    {
      id: 'about',
      slug: SLUGS[lang].about,
      title: t('Czym jest FACEIT Banner – fakty o projekcie', 'What is FACEIT Banner – key facts'),
      description: t(
        'FACEIT Banner: darmowy, niezależny generator widżetów FACEIT dla streamerów CS2. Autor, licencja, obsługiwane programy, źródło danych i ograniczenia.',
        'FACEIT Banner: a free, independent FACEIT widget generator for CS2 streamers. Author, licence, supported software, data source and limitations.'
      ),
      h1: t('Czym jest FACEIT Banner', 'What is FACEIT Banner'),
      intro: t(
        'FACEIT Banner to darmowy generator widżetów FACEIT, który pokazuje ELO i statystyki CS2 na streamie. Poniżej najważniejsze fakty w jednym miejscu.',
        'FACEIT Banner is a free FACEIT widget generator that shows ELO and CS2 statistics on stream. Below are the key facts in one place.'
      ),
      blocks: [
        {
          type: 'answer',
          label: t('Krótka odpowiedź', 'Short answer'),
          text: t(
            'FACEIT Banner to darmowa, niezależna aplikacja webowa autorstwa Skull. Generuje link do widżetu z ELO i statystykami FACEIT dla CS2, który wkleja się do OBS Studio lub Streamlabs jako źródło przeglądarki.',
            'FACEIT Banner is a free, independent web app by Skull. It generates a link to a widget with FACEIT ELO and CS2 statistics that you paste into OBS Studio or Streamlabs as a browser source.'
          ),
        },
        { type: 'h2', id: 'facts', text: t('Najważniejsze fakty', 'Key facts') },
        {
          type: 'table',
          head: [t('Cecha', 'Attribute'), t('Wartość', 'Value')],
          rows: [
            [t('Nazwa', 'Name'), 'FACEIT Banner (FACEIT Stats Widget)'],
            [t('Rodzaj', 'Type'), t('aplikacja webowa i widżet do źródła przeglądarki', 'web app and browser-source widget')],
            [t('Cena', 'Price'), t('darmowy', 'free')],
            [t('Autor', 'Author'), 'Skull (skullboypl)'],
            [t('Licencja', 'Licence'), t('MIT, kod otwarty na GitHubie', 'MIT, open source on GitHub')],
            [t('Gra', 'Game'), 'Counter-Strike 2 (FACEIT)'],
            [t('Programy', 'Software'), 'OBS Studio, Streamlabs Desktop'],
            [t('Źródło danych', 'Data source'), 'FACEIT Data API v4'],
            [t('Języki interfejsu', 'Interface languages'), t('polski, angielski, niemiecki', 'Polish, English, German')],
            [t('Liczba układów', 'Number of layouts'), t(`${COUNTS.solo} solo i ${COUNTS.versus} VERSUS`, `${COUNTS.solo} solo and ${COUNTS.versus} VERSUS`)],
            [t('Adres', 'Address'), SITE_URL],
            [t('Powiązanie z FACEIT', 'Affiliation with FACEIT'), t('brak, projekt niezależny', 'none, independent project')],
          ],
        },
        { type: 'h2', id: 'how', text: t('Jak to działa', 'How it works') },
        {
          type: 'p',
          text: t(
            'Generator zapisuje ustawienia w adresie widżetu. Widżet pobiera aktualne dane gracza z publicznego API FACEIT i odświeża je co kilkadziesiąt sekund. Nie ma kont ani bazy danych użytkowników: ustawienia są w linku i w pamięci przeglądarki.',
            'The generator stores settings in the widget address. The widget loads the current player data from the public FACEIT API and refreshes it every few dozen seconds. There are no accounts or user database: settings live in the link and in the browser storage.'
          ),
        },
        { type: 'h2', id: 'limits', text: t('Ograniczenia', 'Limitations') },
        {
          type: 'ul',
          items: [
            t('Dane są tak aktualne, jak API FACEIT, więc ELO po meczu może pojawić się z kilkuminutowym opóźnieniem.', 'Data is only as fresh as the FACEIT API, so ELO after a match can appear with a delay of a few minutes.'),
            t('Obsługiwane jest wyłącznie CS2 na FACEIT.', 'Only CS2 on FACEIT is supported.'),
            t('Tryb VERSUS wymaga wyglądu FACEIT 2026.', 'VERSUS mode requires the FACEIT 2026 look.'),
          ],
        },
      ],
    },
    {
      id: 'faq',
      slug: SLUGS[lang].faq,
      title: t('FAQ – baner FACEIT do OBS', 'FAQ – FACEIT banner for OBS'),
      description: t(
        'Najczęstsze pytania o baner FACEIT do OBS: aktualizacja ELO, rozmiar źródła, tryb VERSUS, animacje i bezpieczeństwo.',
        'The most common questions about the FACEIT banner for OBS: ELO updates, source size, VERSUS mode, animations and safety.'
      ),
      h1: 'FAQ',
      intro: t('Krótkie odpowiedzi na pytania, które padają najczęściej.', 'Short answers to the questions asked most often.'),
      blocks: [
        {
          type: 'faq',
          items: [
            {
              q: t('Czy widżet jest darmowy?', 'Is the widget free?'),
              a: t('Tak. Generator i widżet są darmowe, a kod źródłowy jest dostępny na GitHubie na licencji MIT.', 'Yes. The generator and widget are free and the source code is on GitHub under the MIT licence.'),
            },
            {
              q: t('Jak często odświeża się ELO?', 'How often does the ELO refresh?'),
              a: t('Widżet pobiera dane z API FACEIT co kilkadziesiąt sekund. Odświeżanie można zmienić w ustawieniach.', 'The widget loads data from the FACEIT API every few dozen seconds. The refresh time can be changed in the settings.'),
            },
            {
              q: t('Jaki rozmiar źródła ustawić w OBS?', 'What source size should I set in OBS?'),
              a: t('Taki, jaki pokazuje karta układu w zakładce Wygląd, np. 500 × 180 dla Showcase. W trybie AUTO baner dopasuje się do dowolnego okna.', 'The one shown on the layout card in the Appearance tab, e.g. 500 × 180 for Showcase. In AUTO mode the banner fits any window.'),
            },
            {
              q: t('Jak pokazać pojedynek z innym graczem?', 'How do I show a duel with another player?'),
              a: t('Włącz tryb VERSUS w Ustawieniach, wpisz nick rywala i wybierz układ VERSUS w zakładce Wygląd.', 'Turn on VERSUS mode in Settings, enter the rival’s nickname and choose a VERSUS layout in the Appearance tab.'),
            },
            {
              q: t('Dlaczego baner nie pokazuje danych?', 'Why does the banner show no data?'),
              a: t('Sprawdź, czy nick jest poprawny i czy konto ma rozegrane mecze CS2 na FACEIT. Przy nowym koncie dane mogą pojawić się z opóźnieniem.', 'Check that the nickname is correct and the account has CS2 matches on FACEIT. A new account may take a while to show data.'),
            },
            {
              q: t('Czy projekt jest powiązany z FACEIT?', 'Is the project affiliated with FACEIT?'),
              a: t('Nie. To niezależny projekt, który korzysta z publicznego API FACEIT.', 'No. It is an independent project that uses the public FACEIT API.'),
            },
          ],
        },
      ],
    },
  ];
}
