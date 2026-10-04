import type { DocsLang, DocsPageData } from './content';

/** Developer documentation: how the project is built and how to extend it. */
export function buildDevPages(
  lang: DocsLang,
  docsPath: (lang: DocsLang, id: string) => string,
  slugOf: (id: string) => string
): Omit<DocsPageData, 'audience' | 'category'>[] {
  const pl = lang === 'pl';
  const t = (polishText: string, englishText: string) => (pl ? polishText : englishText);

  return [
    {
      id: 'dev',
      slug: slugOf('dev'),
      title: t('Dokumentacja developerska FACEIT Banner', 'FACEIT Banner developer documentation'),
      description: t(
        'Architektura, uruchomienie lokalne, system ustawień, dodawanie nowych układów banerów, działanie widżetu i wdrożenie FACEIT Banner.',
        'Architecture, local setup, the settings system, adding new banner layouts, how the widget works and how FACEIT Banner is deployed.'
      ),
      h1: t('Dokumentacja developerska', 'Developer documentation'),
      intro: t(
        'Ta część opisuje, jak zbudowany jest FACEIT Banner i jak go rozwijać. Projekt to statyczna aplikacja React bez własnego backendu, a dane gracza pobiera bezpośrednio z API FACEIT.',
        'This part explains how FACEIT Banner is built and how to extend it. The project is a static React app with no backend of its own; it loads player data straight from the FACEIT API.'
      ),
      blocks: [
        {
          type: 'answer',
          label: t('W skrócie', 'In short'),
          text: t(
            'Vite + React 18 + TypeScript, style w LESS, dwa wejścia (generator i widżet), ustawienia w adresie URL, wdrożenie jako statyczne pliki w nginx.',
            'Vite + React 18 + TypeScript, LESS styles, two entry points (generator and widget), settings in the URL, deployed as static files in nginx.'
          ),
        },
        { type: 'h2', id: 'stack', text: t('Stos technologiczny', 'Tech stack') },
        {
          type: 'ul',
          items: [
            'Vite 7, React 18, TypeScript (strict), react-router-dom 6',
            t('style: LESS, motyw 2026 w plikach widget/src/styles/*.less', 'styles: LESS, the 2026 look in widget/src/styles/*.less'),
            t('dane: FACEIT Data API v4 wołane z przeglądarki, bez serwera pośredniego', 'data: FACEIT Data API v4 called from the browser, no intermediate server'),
            t('wdrożenie: Docker (node:22-alpine do builda, nginx:1.27-alpine do serwowania), CapRover', 'deployment: Docker (node:22-alpine to build, nginx:1.27-alpine to serve), CapRover'),
          ],
        },
        { type: 'h2', id: 'layout', text: t('Struktura repozytorium', 'Repository layout') },
        {
          type: 'table',
          head: [t('Ścieżka', 'Path'), t('Zawartość', 'Contents')],
          rows: [
            ['src/generator/', t('generator: zakładki Ustawienia, Wygląd, Statystyki', 'the generator: Settings, Appearance and Statistics tabs')],
            ['src/components/', t('wspólne komponenty UI generatora (karty układów, miniatury, panel rozmiaru)', 'shared generator UI (layout cards, thumbnails, size panel)')],
            ['src/settings/', t('definicje ustawień i menedżer (adres URL, localStorage)', 'setting definitions and the manager (URL, localStorage)')],
            ['src/translations/', t('teksty interfejsu: polski, angielski, niemiecki', 'interface texts: Polish, English, German')],
            ['src/docs/', t('ta dokumentacja, renderowana do HTML przy buildzie', 'this documentation, rendered to HTML at build time')],
            ['widget/src/widget/', t('komponent Widget, który działa w OBS', 'the Widget component that runs in OBS')],
            ['widget/src/styles/', t('style banerów i układów', 'banner and layout styles')],
            ['widget/src/utils/', t('klient API FACEIT i logika rozmiaru banera', 'the FACEIT API client and the banner size logic')],
            ['public/', t('pliki statyczne, wiki, robots.txt, sitemap.xml', 'static files, the wiki, robots.txt, sitemap.xml')],
            ['deploy/nginx.conf', t('konfiguracja nginx dla kontenera', 'nginx configuration for the container')],
          ],
        },
        {
          type: 'cards',
          items: [
            { title: t('Uruchomienie lokalne', 'Local setup'), text: t('Node, pnpm i klucz API.', 'Node, pnpm and an API key.'), meta: docsPath(lang, 'dev-setup') },
            { title: t('System ustawień', 'Settings system'), text: t('Jak działa i jak dodać ustawienie.', 'How it works and how to add a setting.'), meta: docsPath(lang, 'dev-settings') },
            { title: t('Nowy układ banera', 'New banner layout'), text: t('Lista kroków od presetu do miniatury.', 'A checklist from preset to thumbnail.'), meta: docsPath(lang, 'dev-layouts') },
            { title: t('Działanie widżetu', 'How the widget works'), text: t('Dane, rozmiar, sesja, animacje.', 'Data, size, session, animations.'), meta: docsPath(lang, 'dev-widget') },
            { title: t('Build i wdrożenie', 'Build and deployment'), text: t('Docker, nginx, SSR dokumentacji.', 'Docker, nginx, documentation SSR.'), meta: docsPath(lang, 'dev-build') },
            { title: t('Współtworzenie', 'Contributing'), text: t('Tłumaczenia, styl kodu, wersje.', 'Translations, code style, versions.'), meta: docsPath(lang, 'dev-contributing') },
          ],
        },
      ],
    },
    {
      id: 'dev-setup',
      slug: slugOf('dev-setup'),
      title: t('Uruchomienie lokalne FACEIT Banner – Node, pnpm, klucz API', 'Run FACEIT Banner locally – Node, pnpm, API key'),
      description: t(
        'Jak uruchomić FACEIT Banner lokalnie: wymagania, instalacja zależności, klucz API FACEIT, serwer deweloperski i skrypty.',
        'How to run FACEIT Banner locally: requirements, installing dependencies, the FACEIT API key, the dev server and scripts.'
      ),
      h1: t('Uruchomienie lokalne', 'Local setup'),
      intro: t(
        'Do pracy potrzebujesz Node.js, pnpm i własnego klucza FACEIT Data API.',
        'You need Node.js, pnpm and your own FACEIT Data API key.'
      ),
      blocks: [
        { type: 'h2', id: 'requirements', text: t('Wymagania', 'Requirements') },
        {
          type: 'ul',
          items: [
            t('Node.js 22 (taki sam jak w Dockerfile)', 'Node.js 22 (the same as in the Dockerfile)'),
            t('pnpm, najlepiej przez corepack', 'pnpm, preferably via corepack'),
            t('klucz FACEIT Data API z developers.faceit.com', 'a FACEIT Data API key from developers.faceit.com'),
          ],
        },
        { type: 'h2', id: 'install', text: t('Instalacja', 'Install') },
        {
          type: 'code',
          text: 'corepack enable\npnpm install\ncp .env.example .env',
        },
        {
          type: 'p',
          text: t(
            'W pliku .env ustaw VITE_FACEIT_API_KEY. Zmienna jest wstawiana do kodu podczas builda, więc po jej zmianie trzeba zrestartować serwer. Opcjonalnie VITE_IS_TESTING=true pokazuje na stronie baner „experimental".',
            'Set VITE_FACEIT_API_KEY in .env. The variable is baked into the code at build time, so restart the server after changing it. Optionally VITE_IS_TESTING=true shows an "experimental" banner on the page.'
          ),
        },
        { type: 'h2', id: 'run', text: t('Uruchomienie', 'Running') },
        { type: 'code', text: 'pnpm dev' },
        {
          type: 'p',
          text: t(
            'Generator działa pod http://localhost:5173/, a sam widżet pod /widget/index.html z parametrami, np. ?player_id=...&design=2026&style=showcase. Dokumentację w trybie deweloperskim trzeba najpierw wygenerować poleceniem pnpm docs.',
            'The generator runs at http://localhost:5173/ and the widget itself at /widget/index.html with parameters, e.g. ?player_id=...&design=2026&style=showcase. In development the documentation must be generated first with pnpm docs.'
          ),
        },
        { type: 'h2', id: 'scripts', text: t('Skrypty', 'Scripts') },
        {
          type: 'table',
          head: [t('Polecenie', 'Command'), t('Co robi', 'What it does')],
          rows: [
            ['pnpm dev', t('serwer deweloperski Vite (host 0.0.0.0)', 'Vite dev server (host 0.0.0.0)')],
            ['pnpm build', t('sprawdzenie typów, render dokumentacji, build produkcyjny', 'type check, documentation render, production build')],
            ['pnpm docs', t('renderuje dokumentację i sitemapę do public/', 'renders the documentation and the sitemap into public/')],
            ['pnpm lint', 'ESLint'],
            ['pnpm format', 'Prettier'],
            ['pnpm preview', t('podgląd zbudowanej wersji', 'preview of the built version')],
          ],
        },
      ],
    },
    {
      id: 'dev-settings',
      slug: slugOf('dev-settings'),
      title: t('System ustawień FACEIT Banner – jak dodać ustawienie', 'FACEIT Banner settings system – how to add a setting'),
      description: t(
        'Jak działają ustawienia: definicje w SETTINGS_DEFINITIONS, adres URL jako źródło prawdy, localStorage generatora i dodawanie nowego ustawienia.',
        'How settings work: definitions in SETTINGS_DEFINITIONS, the URL as the source of truth, the generator’s localStorage and adding a new setting.'
      ),
      h1: t('System ustawień', 'Settings system'),
      intro: t(
        'Każda opcja generatora jest jednym wpisem w jednym pliku. Ten wpis opisuje typ, wartość domyślną, parametr w adresie i dozwolone wartości.',
        'Every generator option is a single entry in a single file. That entry describes the type, the default, the URL parameter and the allowed values.'
      ),
      blocks: [
        { type: 'h2', id: 'definition', text: t('Definicja ustawienia', 'A setting definition') },
        {
          type: 'p',
          text: t(
            'Wszystkie ustawienia są w src/settings/definition.ts jako obiekt SETTINGS_DEFINITIONS. Typ Settings i klucz SettingKey wynikają z niego automatycznie.',
            'All settings live in src/settings/definition.ts as the SETTINGS_DEFINITIONS object. The Settings type and the SettingKey key follow from it automatically.'
          ),
        },
        {
          type: 'code',
          text: "bannerRadius: {\n  type: 'number',\n  defaultValue: 14,\n  min: 0,\n  max: 48,\n  query: ['banner_radius'],\n},",
        },
        {
          type: 'table',
          head: [t('Pole', 'Field'), t('Znaczenie', 'Meaning')],
          rows: [
            ['type', t('string, string_undefined, number, boolean, statistic_type, language, ranking_state', 'string, string_undefined, number, boolean, statistic_type, language, ranking_state')],
            ['defaultValue', t('wartość w generatorze; do linku trafiają tylko wartości inne niż domyślne', 'value in the generator; only values that differ from it go into the link')],
            ['defaultWidgetValue', t('opcjonalna inna wartość domyślna dla samego widżetu (starsze linki)', 'optional different default for the widget itself (older links)')],
            ['query', t('nazwy parametrów w adresie; pierwsza jest główna, reszta to aliasy', 'URL parameter names; the first is the main one, the rest are aliases')],
            ['options / min / max / regex', t('walidacja wartości przy wczytywaniu', 'value validation when loading')],
            ['requirements', t('ustawienie obowiązuje tylko, gdy inne ustawienia mają dane wartości', 'the setting applies only when other settings have given values')],
          ],
        },
        { type: 'h2', id: 'flow', text: t('Przepływ danych', 'Data flow') },
        {
          type: 'ul',
          items: [
            t('Generator trzyma ustawienia w stanie Reacta i zapisuje je w localStorage pod kluczem fcw_generator_settings.', 'The generator keeps settings in React state and stores them in localStorage under the key fcw_generator_settings.'),
            t('Przycisk „Generuj link OBS" zamienia ustawienia na parametry adresu widżetu.', 'The "Generate OBS link" button turns the settings into widget URL parameters.'),
            t('Widżet czyta parametry z adresu przez useSettings(true) i nie czyta localStorage generatora.', 'The widget reads the parameters from the address through useSettings(true) and does not read the generator’s localStorage.'),
            t('Wartości spoza dozwolonego zakresu są odrzucane i zastępowane domyślnymi.', 'Values outside the allowed range are rejected and replaced by the defaults.'),
          ],
        },
        { type: 'h2', id: 'add', text: t('Jak dodać ustawienie', 'How to add a setting') },
        {
          type: 'ol',
          items: [
            t('Dodaj wpis do SETTINGS_DEFINITIONS z typem, wartością domyślną i parametrem query.', 'Add an entry to SETTINGS_DEFINITIONS with a type, a default and a query parameter.'),
            t('Użyj go w widżecie przez SETTINGS.get(\'nazwa\') i w generatorze przez settings.get / settings.set.', 'Use it in the widget through SETTINGS.get(\'name\') and in the generator through settings.get / settings.set.'),
            t('Dla przełącznika użyj komponentu Checkbox z właściwością setting.', 'For a toggle use the Checkbox component with the setting prop.'),
            t('Dodaj teksty do trzech plików tłumaczeń.', 'Add the texts to the three translation files.'),
            t('Uruchom pnpm docs: tabela parametrów w dokumentacji uzupełni się sama.', 'Run pnpm docs: the parameter table in the documentation fills itself.'),
          ],
        },
      ],
    },
    {
      id: 'dev-layouts',
      slug: slugOf('dev-layouts'),
      title: t('Jak dodać nowy układ banera FACEIT Banner', 'How to add a new FACEIT Banner layout'),
      description: t(
        'Lista kroków dodania nowego układu banera: preset, ustawienia, render w widżecie, style LESS, tłumaczenia i miniatura.',
        'A checklist for adding a new banner layout: preset, settings, widget rendering, LESS styles, translations and the thumbnail.'
      ),
      h1: t('Nowy układ banera', 'New banner layout'),
      intro: t(
        'Układ to kombinacja presetu, renderu w widżecie i stylów. Poniższa lista pokrywa wszystko, co trzeba zmienić, żeby układ pojawił się w generatorze, widżecie i dokumentacji.',
        'A layout is a combination of a preset, rendering in the widget and styles. The list below covers everything to change so the layout shows up in the generator, the widget and the documentation.'
      ),
      blocks: [
        {
          type: 'answer',
          label: t('W skrócie', 'In short'),
          text: t(
            'Preset w styles.ts, ustawienia akcentu w definition.ts, gałąź renderu w Widget.tsx, style LESS, tłumaczenia i miniatura w PresetThumb.tsx.',
            'A preset in styles.ts, accent settings in definition.ts, a render branch in Widget.tsx, LESS styles, translations and a thumbnail in PresetThumb.tsx.'
          ),
        },
        { type: 'h2', id: 'steps', text: t('Kroki', 'Steps') },
        {
          type: 'ol',
          items: [
            t('widget/src/styles/styles.ts: dodaj identyfikator do listy styles (modernOnly: true) i preset do broadcastPresets z szerokością i wysokością. Flagi: animated (znaczek ANIM), versus (tryb VERSUS), square (zawsze 1:1).', 'widget/src/styles/styles.ts: add the id to the styles list (modernOnly: true) and a preset to broadcastPresets with width and height. Flags: animated (ANIM badge), versus (VERSUS mode), square (always 1:1).'),
            t('src/settings/definition.ts: dodaj <id>Accent oraz, jeśli układ ma poświatę levelu, <id>LevelGlow i <id>LevelGlowStrength. Dodatkowe opcje układu dodaj tak samo.', 'src/settings/definition.ts: add <id>Accent and, if the layout has a level glow, <id>LevelGlow and <id>LevelGlowStrength. Add any extra layout options the same way.'),
            t('widget/src/widget/Widget.tsx: dodaj gałąź renderu (renderSoloExtra, renderVersus lub własną) i dopisz identyfikator do list takich jak isSoloExtra.', 'widget/src/widget/Widget.tsx: add a render branch (renderSoloExtra, renderVersus or your own) and add the id to lists such as isSoloExtra.'),
            t('Style: nowy plik .less lub sekcja z selektorem .wrapper.banner-design-2026[data-layout=\'id\'], motyw .id-theme:extend(.normal-theme all) i import w Widget.tsx.', 'Styles: a new .less file or a section with the selector .wrapper.banner-design-2026[data-layout=\'id\'], the theme .id-theme:extend(.normal-theme all) and the import in Widget.tsx.'),
            t('src/translations/*.json: klucze style.<id> i style.<id>.description we wszystkich trzech językach.', 'src/translations/*.json: the keys style.<id> and style.<id>.description in all three languages.'),
            t('src/components/PresetThumb.tsx: dodaj rysunek miniatury do obiektu DRAWINGS.', 'src/components/PresetThumb.tsx: add the thumbnail drawing to the DRAWINGS object.'),
            t('src/components/PresetSettings.tsx: dopisz układ do listy wyjątków, jeśli nie ma opcji „Miejsce rankingu".', 'src/components/PresetSettings.tsx: add the layout to the exceptions list if it has no "Rank place" option.'),
            t('pnpm docs: dokumentacja wylicza układy, rozmiary i limity z presetów.', 'pnpm docs: the documentation derives layouts, sizes and limits from the presets.'),
          ],
        },
        { type: 'h2', id: 'rules', text: t('Zasady, które warto znać', 'Rules worth knowing') },
        {
          type: 'ul',
          items: [
            t('Tryb VERSUS działa tylko z wyglądem 2026, a układy VERSUS filtruje flaga versus.', 'VERSUS mode works only with the 2026 look and the versus flag filters the VERSUS layouts.'),
            t('Rozmiar z presetu jest rozmiarem Zalecanym, a limity wynikają z mnożników 0,4 i 2,5 (banner_size.ts).', 'The preset size is the Recommended size and the limits come from the 0.4 and 2.5 multipliers (banner_size.ts).'),
            t('Animacje powinny respektować prefers-reduced-motion.', 'Animations should respect prefers-reduced-motion.'),
            t('Elementy z poświatą potrzebują overflow: visible, inaczej poświata zostanie ucięta.', 'Elements with a glow need overflow: visible, otherwise the glow gets clipped.'),
          ],
        },
      ],
    },
    {
      id: 'dev-widget',
      slug: slugOf('dev-widget'),
      title: t('Jak działa widżet FACEIT Banner – dane, rozmiar, sesja', 'How the FACEIT Banner widget works – data, size, session'),
      description: t(
        'Działanie widżetu w OBS: pobieranie danych z API FACEIT, odświeżanie, sesja zapisana w przeglądarce, algorytm rozmiaru banera i animacje.',
        'How the widget works in OBS: loading data from the FACEIT API, refreshing, the session stored in the browser, the banner size algorithm and animations.'
      ),
      h1: t('Działanie widżetu', 'How the widget works'),
      intro: t(
        'Widżet to jeden komponent React (widget/src/widget/Widget.tsx). Ten sam komponent jest używany w OBS i w podglądzie generatora.',
        'The widget is a single React component (widget/src/widget/Widget.tsx). The same component is used in OBS and in the generator preview.'
      ),
      blocks: [
        { type: 'h2', id: 'data', text: t('Dane i odświeżanie', 'Data and refreshing') },
        {
          type: 'ul',
          items: [
            t('getPlayerStats w widget/src/utils/faceit_util.ts pobiera profil, statystyki meczów i ranking z FACEIT Data API v4.', 'getPlayerStats in widget/src/utils/faceit_util.ts loads the profile, match statistics and the ranking from the FACEIT Data API v4.'),
            t('Wyniki trafiają do stanu Reacta, a efekt odświeża je w interwale z ustawienia refreshInterval.', 'The results go into React state and an effect refreshes them at the interval from the refreshInterval setting.'),
            t('W podglądzie generatora widżet nie wywołuje API: dostaje dane przez właściwości preview*.', 'In the generator preview the widget does not call the API: it gets data through the preview* props.'),
            t('Tryb VERSUS pobiera drugiego gracza tą samą funkcją, po identyfikatorze z opponent_id.', 'VERSUS mode loads the second player with the same function, by the id from opponent_id.'),
          ],
        },
        { type: 'h2', id: 'session', text: t('Sesja w danych przeglądarki', 'Session in the browser data') },
        {
          type: 'p',
          text: t(
            'Przy włączonym saveSession widżet zapisuje w localStorage klucze fcw_session_start, fcw_session_end, fcw_session_player-id i fcw_session_starting-elo. Przy starcie sprawdza, czy sesja jeszcze trwa (koniec w przyszłości i ten sam gracz). Jeśli tak, wygrane i porażki liczą się od zapisanego początku. Jeśli nie, sesja zaczyna się od zera. Koniec sesji jest przesuwany o dwie godziny przy każdym odświeżeniu i przy zamknięciu strony.',
            'With saveSession on, the widget stores the keys fcw_session_start, fcw_session_end, fcw_session_player-id and fcw_session_starting-elo in localStorage. On start it checks whether the session is still alive (the end is in the future and the player is the same). If so, wins and losses are counted from the saved start. If not, the session starts from zero. The session end is pushed two hours ahead on every refresh and when the page closes.'
          ),
        },
        { type: 'h2', id: 'size', text: t('Algorytm rozmiaru', 'Size algorithm') },
        {
          type: 'p',
          text: t(
            'resolveBannerSize w widget/src/utils/banner_size.ts zamienia tryby AUTO, Zalecane i Ręcznie na rozmiar docelowy przyciśnięty do limitów układu. Z docelowego rozmiaru liczy skalę: przy zmniejszaniu skala dopasowuje treść do pola, a przy powiększaniu rośnie tylko w 60 procentach (GROWTH_SHARE), resztę miejsca dostaje układ. Widżet ustawia na wrapperze szerokość i wysokość układu oraz właściwość zoom. Wysokość w trybie Zalecane jest pusta, więc baner dopasowuje się do zawartości.',
            'resolveBannerSize in widget/src/utils/banner_size.ts turns the AUTO, Recommended and Manual modes into a target size clamped to the layout limits. From the target it computes a scale: when shrinking the scale fits the content to the box, when growing it rises only by 60 percent (GROWTH_SHARE) and the layout takes the rest. The widget sets the layout width and height and a zoom property on the wrapper. In Recommended mode the height is empty, so the banner fits its content.'
          ),
        },
        { type: 'h2', id: 'anim', text: t('Animacje', 'Animations') },
        {
          type: 'ul',
          items: [
            t('Showcase i Spotlight używają komponentu BroadcastDeck: zakładki, autoplay i pauza.', 'Showcase and Spotlight use the BroadcastDeck component: tabs, autoplay and pause.'),
            t('Ticker, Cycle i Reel zmieniają strony licznikiem w useEffect; Marquee i Surge animuje CSS.', 'Ticker, Cycle and Reel change pages with a counter in useEffect; Marquee and Surge are animated by CSS.'),
            t('Ramka banera (::after) ma pointer-events: none, żeby nie blokowała kliknięć w zakładki.', 'The banner border (::after) has pointer-events: none so it does not block clicks on the tabs.'),
          ],
        },
      ],
    },
    {
      id: 'dev-build',
      slug: slugOf('dev-build'),
      title: t('Build i wdrożenie FACEIT Banner – Docker, nginx, SSR dokumentacji', 'FACEIT Banner build and deployment – Docker, nginx, documentation SSR'),
      description: t(
        'Jak budowany i wdrażany jest FACEIT Banner: Dockerfile, CapRover, nginx, render dokumentacji do HTML, sitemapa i llms.txt.',
        'How FACEIT Banner is built and deployed: the Dockerfile, CapRover, nginx, rendering the documentation to HTML, the sitemap and llms.txt.'
      ),
      h1: t('Build i wdrożenie', 'Build and deployment'),
      intro: t(
        'Produkcyjna wersja to zestaw statycznych plików serwowanych przez nginx. Nie ma procesu Node w produkcji.',
        'The production version is a set of static files served by nginx. There is no Node process in production.'
      ),
      blocks: [
        { type: 'h2', id: 'build', text: t('Build', 'Build') },
        {
          type: 'code',
          text: 'pnpm build\n# = tsc && pnpm run docs && vite build',
        },
        {
          type: 'ul',
          items: [
            t('Vite buduje dwa wejścia: generator (index.html) i widżet (widget/index.html).', 'Vite builds two entries: the generator (index.html) and the widget (widget/index.html).'),
            t('Wywołania console i debugger są usuwane z kodu produkcyjnego.', 'console and debugger calls are dropped from the production code.'),
            t('VITE_FACEIT_API_KEY jest wstawiany w czasie builda, więc musi być dostępny w środowisku builda.', 'VITE_FACEIT_API_KEY is baked in at build time, so it must be available in the build environment.'),
          ],
        },
        { type: 'h2', id: 'docs', text: t('Render dokumentacji (SSR)', 'Documentation render (SSR)') },
        {
          type: 'p',
          text: t(
            'Polecenie pnpm docs buduje src/docs/render.tsx w trybie SSR (vite build --ssr) i uruchamia wynik w Node. Skrypt renderuje strony Reactem (renderToStaticMarkup) do public/docs i public/en/docs, generuje public/sitemap.xml oraz public/llms.txt, a Vite kopiuje je do dist. Treść bierze z src/docs/content.ts i src/docs/dev-content.ts, a listy układów i parametrów liczy z kodu aplikacji. Po zmianie dokumentacji podbij DOCS_UPDATED w content.ts.',
            'The pnpm docs command builds src/docs/render.tsx in SSR mode (vite build --ssr) and runs the result in Node. The script renders the pages with React (renderToStaticMarkup) into public/docs and public/en/docs, generates public/sitemap.xml and public/llms.txt, and Vite copies them into dist. Content comes from src/docs/content.ts and src/docs/dev-content.ts, while the layout and parameter lists are computed from the app code. After changing the documentation bump DOCS_UPDATED in content.ts.'
          ),
        },
        { type: 'h2', id: 'docker', text: t('Docker i nginx', 'Docker and nginx') },
        {
          type: 'ul',
          items: [
            t('Dockerfile ma dwa etapy: node:22-alpine buduje aplikację, nginx:1.27-alpine serwuje katalog dist.', 'The Dockerfile has two stages: node:22-alpine builds the app and nginx:1.27-alpine serves the dist directory.'),
            t('deploy/nginx.conf obsługuje /docs/, /en/docs/ i /wiki/ jako katalogi z index.html, a pozostałe ścieżki kieruje do aplikacji (fallback SPA).', 'deploy/nginx.conf serves /docs/, /en/docs/ and /wiki/ as directories with index.html and routes the other paths to the app (SPA fallback).'),
            t('Ścieżka /widget/ dostaje nagłówek X-Robots-Tag: noindex.', 'The /widget/ path gets an X-Robots-Tag: noindex header.'),
            t('captain-definition wskazuje Dockerfile dla CapRover; klucz API ustawia się w App Configs jako VITE_FACEIT_API_KEY.', 'captain-definition points CapRover at the Dockerfile; the API key is set in App Configs as VITE_FACEIT_API_KEY.'),
          ],
        },
      ],
    },
    {
      id: 'dev-contributing',
      slug: slugOf('dev-contributing'),
      title: t('Współtworzenie FACEIT Banner – tłumaczenia, styl kodu, wersje', 'Contributing to FACEIT Banner – translations, code style, versions'),
      description: t(
        'Jak współtworzyć FACEIT Banner: dodawanie tłumaczeń, styl kodu, konwencja commitów, wersjonowanie i licencja.',
        'How to contribute to FACEIT Banner: adding translations, code style, commit convention, versioning and the licence.'
      ),
      h1: t('Współtworzenie', 'Contributing'),
      intro: t(
        'Projekt jest otwarty na licencji MIT i pochodzi z projektu mxgic1337/faceit-stats-widget. Poniżej zasady, które pomagają utrzymać spójność.',
        'The project is open source under the MIT licence and derives from mxgic1337/faceit-stats-widget. Below are the rules that keep it consistent.'
      ),
      blocks: [
        { type: 'h2', id: 'translations', text: t('Tłumaczenia', 'Translations') },
        {
          type: 'ul',
          items: [
            t('Teksty są w src/translations/polish.json, english.json i german.json jako płaskie klucze.', 'Texts are in src/translations/polish.json, english.json and german.json as flat keys.'),
            t('Funkcja tl używa angielskiego jako zapasowego, gdy brakuje klucza w danym języku.', 'The tl function falls back to English when a key is missing in a language.'),
            t('Parametry podstawia się jako {{0}}, {{1}} i tak dalej.', 'Parameters are substituted as {{0}}, {{1}} and so on.'),
            t('Nowy język dodaje się w src/translations/translations.ts.', 'A new language is added in src/translations/translations.ts.'),
          ],
        },
        { type: 'h2', id: 'style', text: t('Styl kodu', 'Code style') },
        {
          type: 'ul',
          items: [
            t('TypeScript w trybie strict, formatowanie Prettierem, reguły ESLint z repozytorium.', 'TypeScript in strict mode, Prettier formatting, the repository’s ESLint rules.'),
            t('Przed commitem uruchom pnpm build: sprawdza typy i buduje dokumentację.', 'Run pnpm build before committing: it checks types and builds the documentation.'),
            t('Style banerów 2026 trzymaj w osobnych plikach LESS, nie w app.less.', 'Keep 2026 banner styles in separate LESS files, not in app.less.'),
          ],
        },
        { type: 'h2', id: 'commits', text: t('Commity i wersje', 'Commits and versions') },
        {
          type: 'ul',
          items: [
            t('Komunikaty w stylu feat:, fix:, chore: z krótkim opisem.', 'Messages in the feat:, fix:, chore: style with a short description.'),
            t('Wersja aplikacji jest w package.json (pole version).', 'The app version is in package.json (the version field).'),
            t('Tryb testowy (VITE_IS_TESTING) służy do wdrożenia wersji eksperymentalnej obok stabilnej.', 'The testing mode (VITE_IS_TESTING) is for deploying an experimental version next to the stable one.'),
          ],
        },
        { type: 'h2', id: 'licence', text: t('Licencja', 'Licence') },
        {
          type: 'p',
          text: t(
            'Kod jest na licencji MIT. Projekt nie jest powiązany z FACEIT i korzysta z publicznego API.',
            'The code is under the MIT licence. The project is not affiliated with FACEIT and uses the public API.'
          ),
        },
      ],
    },
  ];
}
