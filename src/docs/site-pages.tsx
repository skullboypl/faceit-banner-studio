import { ReactElement, ReactNode } from 'react';
import { SITE_URL } from './content';

const LAYERS = 'm12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5';
const BACK = 'M19 12H5m6-6-6 6 6 6';

const Icon = ({ path }: { path: string }) => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={path} />
  </svg>
);

type LinkItem = { href: string; label: string };

const WIKI: LinkItem[] = [
  { href: '/wiki/', label: 'Przegląd' },
  { href: '/wiki/bannerfaceit/', label: 'Banner do OBS' },
  { href: '/wiki/jak-dodac-faceit-do-obs/', label: 'Dodanie do OBS' },
  { href: '/wiki/konfiguracja-widzetu-faceit/', label: 'Konfiguracja' },
  { href: '/wiki/sklad-split-popup/', label: 'Skład, split i popup' },
  { href: '/wiki/faq-faceit-widget/', label: 'FAQ' },
];

const SERVICE: LinkItem[] = [
  { href: '/docs/', label: 'Dokumentacja' },
  { href: '/terms/', label: 'Regulamin' },
  { href: '/privacy/', label: 'Prywatność' },
];

const groupsFor = (current: string) => [
  { title: 'Wiki', links: WIKI },
  { title: 'Serwis', links: SERVICE },
].map((group) => ({
  ...group,
  links: group.links.map((link) => ({ ...link, current: link.href === current })),
}));

const SitePage = ({
  path,
  title,
  description,
  eyebrow,
  h1,
  lead,
  crumbs,
  toc,
  languages = false,
  jsonLd,
  children,
}: {
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  lead: string;
  crumbs: { href?: string; label: string }[];
  toc?: { href: string; label: string }[];
  languages?: boolean;
  jsonLd?: string;
  children: ReactNode;
}) => {
  const url = `${SITE_URL}${path}`;
  const groups = groupsFor(path);
  return (
    <html lang="pl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${title} | FACEIT Banner`}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <meta name="theme-color" content="#0b0e14" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png" />
        <link rel="apple-touch-icon" href="/brand/logo-192.png" />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="FACEIT Banner" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:locale" content="pl_PL" />
        <link rel="stylesheet" href="/docs.css" />
        {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} /> : null}
      </head>
      <body>
        <div className="shell">
          <header className="sidebar">
            <a className="brand" href="/" aria-label="FACEIT Banner Studio">
              <span className="mark" aria-hidden="true">
                <Icon path={LAYERS} />
              </span>
              <span>
                Banner<span className="brand-subtitle">STUDIO / FACEIT</span>
              </span>
            </a>
            <a className="back" href="/">
              <Icon path={BACK} />
              <span>Wróć do generatora</span>
            </a>
            <nav className="docs-nav" aria-label="Menu">
              {groups.map((group) => (
                <div className="group" key={group.title}>
                  <p className="group-title">{group.title}</p>
                  {group.links.map((link) => (
                    <a key={link.href} href={link.href} aria-current={link.current ? 'page' : undefined}>
                      {link.label}
                    </a>
                  ))}
                </div>
              ))}
            </nav>
            <div className="sidebar-note">
              <span className="game-label">CS2</span>
              <p>Widżet statystyk FACEIT dla Twojej transmisji.</p>
            </div>
          </header>
          <div className="workspace">
            <div className="topbar">
              <span>
                {crumbs.map((crumb, index) => (
                  <span key={crumb.label}>
                    {index > 0 ? <span className="divider">/</span> : null}
                    {crumb.href ? <a href={crumb.href}>{crumb.label}</a> : <strong>{crumb.label}</strong>}
                  </span>
                ))}
              </span>
              <span className="topbar-actions">
                {languages ? (
                  <>
                    <a className="lang" href="#pl">PL</a>
                    <a className="lang" href="#en">EN</a>
                  </>
                ) : null}
                <a className="obs-tag" href="/">OBS STUDIO</a>
              </span>
            </div>
            <main>
              <article>
                <header className="heading">
                  <p className="eyebrow">{eyebrow}</p>
                  <h1>{h1}</h1>
                  <p className="lead">{lead}</p>
                </header>
                {toc && toc.length > 2 ? (
                  <nav className="toc" aria-label="Spis treści">
                    {toc.map((item) => (
                      <a key={item.href} href={item.href}>{item.label}</a>
                    ))}
                  </nav>
                ) : null}
                <div className="panel">{children}</div>
                <p className="cta-row">
                  <a className="cta" href="/">Otwórz generator</a>
                </p>
              </article>
            </main>
            <footer>
              <small>FACEIT Banner nie jest powiązany z FACEIT. Kod źródłowy na licencji MIT.</small>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
};

const termsToc = [
  { href: '#pl-czym', label: 'Czym jest serwis' },
  { href: '#pl-korzystanie', label: 'Korzystanie' },
  { href: '#pl-konto', label: 'Konto' },
  { href: '#pl-tresci', label: 'Treści użytkowników' },
  { href: '#pl-odpowiedzialnosc', label: 'Dostępność i odpowiedzialność' },
  { href: '#pl-wsparcie', label: 'Wsparcie projektu' },
  { href: '#pl-kod', label: 'Kod źródłowy i prawa' },
  { href: '#pl-zmiany', label: 'Zmiany i prawo' },
  { href: '#en-what', label: 'What the service is' },
  { href: '#en-use', label: 'Use' },
  { href: '#en-account', label: 'Account' },
  { href: '#en-content', label: 'User content' },
  { href: '#en-liability', label: 'Availability and liability' },
  { href: '#en-support', label: 'Supporting the project' },
  { href: '#en-source', label: 'Source code and rights' },
  { href: '#en-changes', label: 'Changes and law' },
];

const privacyToc = [
  { href: '#pl-admin', label: 'Kto jest administratorem' },
  { href: '#pl-serwis', label: 'Co robi serwis' },
  { href: '#pl-dane', label: 'Jakie dane przetwarzamy' },
  { href: '#pl-podstawa', label: 'Podstawa prawna' },
  { href: '#pl-ciasteczka', label: 'Ciasteczka i reklamy' },
  { href: '#pl-odbiorcy', label: 'Kto jeszcze widzi dane' },
  { href: '#pl-prawa', label: 'Twoje prawa' },
  { href: '#pl-zmiany', label: 'Zmiany' },
  { href: '#en-controller', label: 'Who is responsible' },
  { href: '#en-service', label: 'What the service does' },
  { href: '#en-data', label: 'What we process' },
  { href: '#en-basis', label: 'Legal basis' },
  { href: '#en-cookies', label: 'Cookies and ads' },
  { href: '#en-recipients', label: 'Who else sees data' },
  { href: '#en-rights', label: 'Your rights' },
  { href: '#en-changes', label: 'Changes' },
];

const faqJsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Dlaczego ranking nie wyświetla się od razu?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Ranking zależy od danych API. Sprawdź, czy gracz ma dostępną pozycję rankingową i czy tryb rankingu jest włączony w ustawieniach.',
      },
    },
    {
      '@type': 'Question',
      name: 'Jaką szerokość Browser Source ustawić w OBS?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Najczęściej sprawdza się okolica 500 px, ale docelowy rozmiar zależy od layoutu i rozdzielczości sceny.',
      },
    },
    {
      '@type': 'Question',
      name: 'Kiedy ikona poziomu FACEIT jest challengerem?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Gdy gracz ma poziom 10 i miejsce od 1 do 1000 w rankingu regionu. Na banerze VERSUS, składzie, splicie i popupie ta ikona zastępuje zwykłą dziesiątkę. Miejsca 1–3 mają kolor podium, miejsca 4–1000 czerwony znaczek. Gracz zdjęty z drabinki FACEIT zostaje przy ikonie poziomu 10.',
      },
    },
    {
      '@type': 'Question',
      name: 'Skąd biorą się wygrane i porażki na banerze składu?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'W nagłówku składu wygrane i porażki to aktualna sesja, tak jak na banerze solo. Kolumny K/D, WR, HS i kropki przy graczach liczą się z ostatnich 20 albo 30 meczów.',
      },
    },
    {
      '@type': 'Question',
      name: 'Czy strony wiki działają bez Node.js na hostingu?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Tak. Podstrony wiki są statycznym HTML i mogą być serwowane bez Node.js.',
      },
    },
  ],
});

export const sitePages: { path: string; element: ReactElement }[] = [
  {
    path: '/wiki/',
    element: (
      <SitePage
        path="/wiki/"
        title="Wiki FACEIT Banner"
        description="Wiki FACEIT Banner: poradniki OBS, skład, split, popup meczu, znaczek challengera i odpowiedzi na najczęstsze pytania."
        eyebrow="FACEIT BANNER / WIKI"
        h1="FACEIT Banner Wiki"
        lead="Centrum wiedzy o widżecie: od ustawienia generatora, przez dodanie do OBS, po konfigurację statystyk i rankingu."
        crumbs={[{ label: 'Wiki' }]}
      >
        <h2 id="artykuly">Artykuły</h2>
        <ul>
          <li><a href="/wiki/bannerfaceit/">Banner FACEIT do OBS</a> — co pokazuje widżet i po co jest na streamie.</li>
          <li><a href="/wiki/jak-dodac-faceit-do-obs/">Jak dodać banner do OBS</a> — Browser Source krok po kroku.</li>
          <li><a href="/wiki/konfiguracja-widzetu-faceit/">Konfiguracja widżetu</a> — statystyki, ranking i czytelność.</li>
          <li><a href="/wiki/sklad-split-popup/">Skład, split i popup</a> — lista graczy, dwa źródła OBS i karta meczu.</li>
          <li><a href="/wiki/faq-faceit-widget/">FAQ</a> — gdy coś się nie wyświetla.</li>
        </ul>
        <h2 id="start">Szybki start</h2>
        <ol>
          <li>Otwórz generator i ustaw gracza FACEIT.</li>
          <li>Wybierz statystyki, wygląd i ranking.</li>
          <li>Skopiuj link widżetu i dodaj go w OBS jako Browser Source.</li>
          <li>Sprawdź scenę i dopasuj rozmiar do layoutu transmisji.</li>
        </ol>
        <p>Pełny opis ustawień jest w <a href="/docs/">dokumentacji</a>.</p>
      </SitePage>
    ),
  },
  {
    path: '/wiki/bannerfaceit/',
    element: (
      <SitePage
        path="/wiki/bannerfaceit/"
        title="Banner FACEIT do OBS"
        description="Banner FACEIT do OBS: co pokazuje generator, jakie dane pobiera i jak wdrożyć widżet na streamie."
        eyebrow="FACEIT BANNER / WIKI"
        h1="Banner FACEIT do OBS"
        lead="Generator składa banner z publicznymi statystykami FACEIT: ELO, level, znaczek challengera, ranking regionu i kraju oraz średnie z wybranej liczby meczów."
        crumbs={[{ href: '/wiki/', label: 'Wiki' }, { label: 'Banner do OBS' }]}
      >
        <h2 id="po-co">Po co banner na streamie</h2>
        <p>Widzowie od razu widzą aktualny status FACEIT. Nie trzeba przełączać scen ani pokazywać profilu ręcznie.</p>
        <p>Widżet działa jako Browser Source. Wystarczy raz wkleić link i ustawić odświeżanie.</p>
        <h2 id="co-pokazuje">Co można pokazać</h2>
        <ul>
          <li>ELO oraz zmianę ELO w bieżącej sesji.</li>
          <li>Poziom konta. W top 1000 regionu ikona poziomu jest znaczkiem challengera.</li>
          <li>Ranking regionalny i krajowy.</li>
          <li>Skład do 10 graczy, split (radar i pasek pod kamerkę) oraz popup na mecz.</li>
          <li>Cztery sloty statystyk z wybranego zakresu meczów, na przykład K/D, ADR, K/R, MVP, asysty.</li>
          <li>Awatar albo banner gracza jako tło, z regulacją czytelności.</li>
        </ul>
        <h2 id="indeks">Indeksacja</h2>
        <p>Ta strona jest gotowym HTML-em z własnym tytułem, opisem i adresem kanonicznym. Roboty czytają ją bez uruchamiania aplikacji.</p>
      </SitePage>
    ),
  },
  {
    path: '/wiki/jak-dodac-faceit-do-obs/',
    element: (
      <SitePage
        path="/wiki/jak-dodac-faceit-do-obs/"
        title="Jak dodać banner FACEIT do OBS"
        description="Jak dodać banner FACEIT do OBS Studio jako Browser Source i ustawić rozmiar oraz odświeżanie."
        eyebrow="FACEIT BANNER / WIKI"
        h1="Jak dodać banner FACEIT do OBS"
        lead="Od linku w generatorze do stabilnego źródła przeglądarki na scenie."
        crumbs={[{ href: '/wiki/', label: 'Wiki' }, { label: 'Dodanie do OBS' }]}
      >
        <h2 id="link">Krok 1. Link widżetu</h2>
        <ol>
          <li>Otwórz generator i wpisz nick albo ID gracza FACEIT.</li>
          <li>Ustaw statystyki, które mają być na bannerze.</li>
          <li>Dopasuj styl i kolory do overlayu.</li>
          <li>Skopiuj adres widżetu.</li>
        </ol>
        <h2 id="browser">Krok 2. Browser Source</h2>
        <ol>
          <li>Na scenie wybierz Dodaj, a potem Przeglądarka (Browser Source).</li>
          <li>Wklej skopiowany adres.</li>
          <li>Ustaw szerokość, najczęściej około 500 px, albo taką, jaką podaje generator.</li>
          <li>Odświeżanie ustaw tak, żeby nie obciążać transmisji.</li>
        </ol>
        <h2 id="test">Krok 3. Test</h2>
        <p>Sprawdź tekst na jasnym i ciemnym tle. Gdy banner gryzie się z mapą, zmniejsz nasycenie tła albo zwiększ rozmycie. Przed live zrób próbę na osobnej scenie.</p>
      </SitePage>
    ),
  },
  {
    path: '/wiki/konfiguracja-widzetu-faceit/',
    element: (
      <SitePage
        path="/wiki/konfiguracja-widzetu-faceit/"
        title="Konfiguracja widżetu FACEIT"
        description="Konfiguracja widżetu FACEIT: sloty statystyk, ranking, znaczek challengera, sesja wygranych i czytelność banera."
        eyebrow="FACEIT BANNER / WIKI"
        h1="Jak skonfigurować widżet FACEIT"
        lead="Dobra konfiguracja to balans czytelności i ilości danych. Poniżej ustawienia, od których warto zacząć."
        crumbs={[{ href: '/wiki/', label: 'Wiki' }, { label: 'Konfiguracja' }]}
      >
        <h2 id="sloty">Statystyki, sloty 1–4</h2>
        <p>Sloty pokazują metryki z ostatnich meczów. Na start zwykle wystarczą K/D, ADR, K/R i procent wygranych.</p>
        <ul>
          <li>Kille, śmierci, K/D i procent strzałów w głowę, gdy liczy się forma.</li>
          <li>ADR i K/R, gdy liczy się wpływ na rundę.</li>
          <li>Asysty i MVP jako uzupełnienie stylu gry.</li>
        </ul>
        <h2 id="ranking">Ranking regionu i kraju</h2>
        <p>Można pokazać ranking europejski i krajowy. Przy grze o miejsce w tabeli to zwykle najbardziej czytelny element overlayu.</p>
        <h2 id="challenger">Znaczek challengera</h2>
        <p>Gracz z poziomem 10 i miejscem 1–1000 w regionie dostaje znaczek challengera. Na VERSUS, składzie, splicie i popupie ta ikona stoi w miejscu zwykłego poziomu: kolor podium dla miejsc 1–3, czerwień dla reszty top 1000. Poza drabinką zostaje ikona poziomu 10.</p>
        <h2 id="sesja">Sesja i ostatnie mecze</h2>
        <p>Wygrane i porażki na banerze solo oraz w nagłówku składu liczą się od startu sesji. Po restarcie OBS wracają, jeśli od zamknięcia widżetu minęły mniej niż dwie godziny. Kolumny statystyk składu i kropki przy graczach biorą się z ostatnich 20 albo 30 meczów.</p>
        <h2 id="czytelnosc">Styl i czytelność</h2>
        <ul>
          <li>Nie schodź z kontrastem między tłem a tekstem.</li>
          <li>Gdy tłem jest baner albo awatar, pilnuj rozmycia i przezroczystości.</li>
          <li>Przed transmisją sprawdź układ w 1080p i 1440p.</li>
        </ul>
      </SitePage>
    ),
  },
  {
    path: '/wiki/sklad-split-popup/',
    element: (
      <SitePage
        path="/wiki/sklad-split-popup/"
        title="Skład FACEIT, split i popup meczu do OBS"
        description="Skład FACEIT do 10 graczy, split na radar i pasek pod kamerkę oraz popup meczu w OBS. Sesja, statystyki z 20 lub 30 meczów i znaczek challengera."
        eyebrow="FACEIT BANNER / WIKI"
        h1="Skład, split i popup"
        lead="Trzy tryby obok banera solo i VERSUS: lista graczy, dwa źródła pod overlay i karta, która wskakuje na czas meczu."
        crumbs={[{ href: '/wiki/', label: 'Wiki' }, { label: 'Skład, split i popup' }]}
      >
        <h2 id="sklad">Skład</h2>
        <p>Na banerze mieści się do 10 nicków FACEIT. Po lewej w nagłówku jest tytuł i średnie ELO, po prawej właściciel banera z wygranymi, porażkami i podpisem „aktualna sesja”.</p>
        <p>Ten bilans liczy się od startu sesji, tak jak na banerze solo. Kolumny K/D, WR, HS, ADR, K/R, mecze, wygrane i seria biorą się z ostatnich 20 albo 30 meczów. Osobno można włączyć statystyki tej samej sesji przy każdym graczu oraz zmienić albo ukryć napis „Skład”.</p>
        <h2 id="split">Split</h2>
        <p>Split daje dwa linki. Radar to kwadrat 300 × 300, pasek pod kamerkę ma 360 × 128. Na każdym włączasz dowolny zestaw: statystyki, ELO, level, wygrane i porażki sesji, serię. Gotowy zestaw tylko wypełnia przełączniki.</p>
        <h2 id="popup">Popup meczu</h2>
        <p>Źródło obejmuje cały obraz. Karta pojawia się przed meczem, na starcie albo po meczu i pokazuje składy, mapę, wynik oraz statystyki. W generatorze podgląd ładuje ostatni mecz gracza, a przełącznik fazy zmienia tylko wygląd tej karty.</p>
        <h2 id="challenger">Ikona challengera</h2>
        <p>Gdy gracz ma poziom 10 i miejsce 1–1000 w regionie, ikona poziomu na VERSUS, składzie, splicie i popupie jest znaczkiem challengera. Miejsca 1–3 mają kolor podium, miejsca 4–1000 czerwień. Gracz zdjęty z drabinki FACEIT zostaje przy poziomie 10.</p>
        <p>Pełny opis jest w <a href="/docs/sklad-split-popup/">dokumentacji</a>.</p>
      </SitePage>
    ),
  },
  {
    path: '/wiki/faq-faceit-widget/',
    element: (
      <SitePage
        path="/wiki/faq-faceit-widget/"
        title="FAQ widżetu FACEIT"
        description="Najczęstsze pytania o widżet FACEIT: sesja składu, znaczek challengera, brakujące statystyki i szerokość źródła w OBS."
        eyebrow="FACEIT BANNER / WIKI"
        h1="Najczęstsze pytania"
        lead="Gdy banner milczy, statystyka jest pusta albo ranking nie wchodzi od razu."
        crumbs={[{ href: '/wiki/', label: 'Wiki' }, { label: 'FAQ' }]}
        jsonLd={faqJsonLd}
      >
        <h2 id="statystyki">Dlaczego nie widać wszystkich statystyk?</h2>
        <p>Część liczb liczy się z ostatnich meczów. Gdy API nie zwróci wybranej metryki, pole zostaje puste. Zwiększ liczbę meczów do obliczeń i sprawdź ponownie.</p>
        <h2 id="ranking">Dlaczego ranking nie wyświetla się od razu?</h2>
        <p>Ranking zależy od danych API. Sprawdź, czy gracz ma dostępną pozycję i czy ranking jest włączony w ustawieniach. Poziom 10 bez miejsca w top 1000 zostaje zwykłą ikoną, nawet przy wysokim ELO.</p>
        <h2 id="sesja">Dlaczego skład pokazuje 0 wygranych?</h2>
        <p>Nagłówek składu liczy aktualną sesję. Świeża sesja startuje od zera i rośnie, gdy mecz skończy się po jej rozpoczęciu. Kolumny obok biorą się z ostatnich 20 albo 30 meczów.</p>
        <h2 id="szerokosc">Jaką szerokość ustawić w OBS?</h2>
        <p>Najczęściej sprawdza się okolica 500 px. Docelowy rozmiar zależy od layoutu i rozdzielczości sceny. Generator podaje szerokość przy linku.</p>
        <h2 id="obciazenie">Czy widżet obciąża stream?</h2>
        <p>Browser Source jest lekki, ale częste odświeżanie ma znaczenie. Ustaw interwał pod potrzebę transmisji, nie pod najkrótszy możliwy czas.</p>
      </SitePage>
    ),
  },
  {
    path: '/terms/',
    element: (
      <SitePage
        path="/terms/"
        title="Regulamin"
        description="Zasady korzystania z FACEIT Banner Studio: generatora banerów, kont i tablicy zgłoszeń."
        eyebrow="FACEIT BANNER / REGULAMIN"
        h1="Regulamin"
        lead="Obowiązuje od 14 października 2026. Wersja polska jest rozstrzygająca; poniżej jest też wersja angielska."
        crumbs={[{ label: 'Regulamin' }]}
        toc={termsToc}
        languages
      >
        <section id="pl" lang="pl">
          <h2 id="pl-czym">1. Czym jest serwis</h2>
          <p>
            FACEIT Banner Studio (<a href="https://faceitbanner.vxh.pl">faceitbanner.vxh.pl</a>) to bezpłatny generator
            banerów ze statystykami FACEIT dla OBS i Streamlabs. Prowadzi go Skull (skullboypl), zwany dalej
            „administratorem”. Serwis <strong>nie jest powiązany z FACEIT</strong>, a FACEIT jest znakiem towarowym swojego właściciela.
          </p>
          <h2 id="pl-korzystanie">2. Korzystanie</h2>
          <ul>
            <li>Z generatora można korzystać bez konta, do własnych transmisji i projektów.</li>
            <li>Nie wolno nadużywać serwisu: obciążać go automatami, obchodzić limitów ani zakłócać jego działania.</li>
            <li>Nie wolno używać go do działań niezgodnych z prawem ani z zasadami FACEIT.</li>
          </ul>
          <h2 id="pl-konto">3. Konto</h2>
          <p>
            Konto powstaje przez logowanie kontem FACEIT i jest opcjonalne. Odpowiadasz za działania ze swojego konta.
            Administrator może zablokować konto lub usunąć jego treści w razie naruszenia regulaminu. Konto usuniemy na
            Twoją prośbę (<a href="https://discord.skullmedia.pl">Discord</a>).
          </p>
          <h2 id="pl-tresci">4. Treści użytkowników</h2>
          <ul>
            <li>Zgłoszenia, komentarze i zapisane banery tworzysz na własną odpowiedzialność.</li>
            <li>Zgłoszenia i komentarze są widoczne dla zalogowanych użytkowników. Udzielasz serwisowi bezpłatnej zgody na ich wyświetlanie w tym celu.</li>
            <li>Zabronione są treści obraźliwe, nielegalne, reklamy, spam i dane innych osób. Administrator może je usunąć bez uprzedzenia.</li>
            <li>Zgłoszenie błędu może zawierać kontekst techniczny i wybrane przez Ciebie ustawienia banera; nie dołączaj tam danych, których nie chcesz ujawniać.</li>
          </ul>
          <h2 id="pl-odpowiedzialnosc">5. Dostępność i odpowiedzialność</h2>
          <p>
            Serwis działa „tak jak jest”, bez gwarancji nieprzerwanego działania. Dane statystyk pochodzą z API FACEIT, więc
            ich dostępność i dokładność zależą od FACEIT. W granicach dozwolonych prawem administrator nie odpowiada za
            szkody wynikające z korzystania z serwisu ani z jego niedostępności.
          </p>
          <h2 id="pl-wsparcie">6. Wsparcie projektu</h2>
          <p>
            Dobrowolne wsparcie (<a href="https://donate.skullmedia.pl">donate.skullmedia.pl</a>) pokrywa koszty
            utrzymania. Nie jest zakupem, nie daje roszczeń do funkcji ani szczególnych praw, a zasady płatności określa tamta strona.
          </p>
          <h2 id="pl-kod">7. Kod źródłowy i prawa</h2>
          <p>
            Projekt jest pochodną otwartego projektu na licencji MIT; kod jest dostępny w{' '}
            <a href="https://github.com/skullboypl/faceit-banner-faceitbanner.vxh.pl">repozytorium na GitHubie</a>. Nazwy i
            logo FACEIT należą do ich właściciela.
          </p>
          <h2 id="pl-zmiany">8. Zmiany i prawo</h2>
          <p>
            Regulamin możemy zmieniać; nową wersję publikujemy tu z datą. Dalsze korzystanie oznacza jej akceptację. Prawem
            właściwym jest prawo polskie. Dane osobowe opisuje <a href="/privacy/">polityka prywatności</a>. Kontakt:{' '}
            <a href="https://discord.skullmedia.pl">Discord</a>.
          </p>
        </section>
        <section id="en" lang="en">
          <h2 id="en-what">1. What the service is</h2>
          <p>
            FACEIT Banner Studio (<a href="https://faceitbanner.vxh.pl">faceitbanner.vxh.pl</a>) is a free generator of
            banners with FACEIT statistics for OBS and Streamlabs, run by Skull (skullboypl), the “administrator”. The service
            is <strong>not affiliated with FACEIT</strong>; FACEIT is a trademark of its owner.
          </p>
          <h2 id="en-use">2. Use</h2>
          <ul>
            <li>You can use the generator without an account, for your own streams and projects.</li>
            <li>Do not abuse the service: no automated load, no bypassing limits, no disrupting it.</li>
            <li>Do not use it for anything unlawful or against FACEIT's rules.</li>
          </ul>
          <h2 id="en-account">3. Account</h2>
          <p>
            An account is created by logging in with FACEIT and is optional. You are responsible for activity on your
            account. The administrator may block an account or remove its content for violating these terms. We will delete
            your account on request (<a href="https://discord.skullmedia.pl">Discord</a>).
          </p>
          <h2 id="en-content">4. User content</h2>
          <ul>
            <li>You create requests, comments and saved banners at your own responsibility.</li>
            <li>Requests and comments are visible to logged-in users. You grant the service a free permission to display them for that purpose.</li>
            <li>Offensive or illegal content, ads, spam and other people's personal data are forbidden and may be removed without notice.</li>
            <li>A bug report may include technical context and banner settings you choose to attach; do not include data you do not want disclosed.</li>
          </ul>
          <h2 id="en-liability">5. Availability and liability</h2>
          <p>
            The service is provided “as is” with no guarantee of uninterrupted operation. Statistics come from the FACEIT API,
            so their availability and accuracy depend on FACEIT. To the extent permitted by law the administrator is not liable
            for damage from using the service or from its unavailability.
          </p>
          <h2 id="en-support">6. Supporting the project</h2>
          <p>
            Voluntary support (<a href="https://donate.skullmedia.pl">donate.skullmedia.pl</a>) covers running costs. It is not
            a purchase, gives no claim to features or special rights, and the payment terms are set by that site.
          </p>
          <h2 id="en-source">7. Source code and rights</h2>
          <p>
            The project is derived from an open-source project under the MIT licence; the code is in the{' '}
            <a href="https://github.com/skullboypl/faceit-banner-faceitbanner.vxh.pl">GitHub repository</a>. FACEIT names and
            logos belong to their owner.
          </p>
          <h2 id="en-changes">8. Changes and law</h2>
          <p>
            We may change these terms and will publish the new version here with its date; continued use means acceptance.
            Polish law applies. Personal data is described in the <a href="/privacy/">privacy policy</a>. Contact:{' '}
            <a href="https://discord.skullmedia.pl">Discord</a>.
          </p>
        </section>
      </SitePage>
    ),
  },
  {
    path: '/privacy/',
    element: (
      <SitePage
        path="/privacy/"
        title="Polityka prywatności"
        description="Jakie dane zbiera FACEIT Banner Studio, po co i jak możesz je usunąć."
        eyebrow="FACEIT BANNER / PRYWATNOŚĆ"
        h1="Polityka prywatności"
        lead="Obowiązuje od 14 października 2026. Wersja polska jest rozstrzygająca; poniżej jest też wersja angielska."
        crumbs={[{ label: 'Prywatność' }]}
        toc={privacyToc}
        languages
      >
        <section id="pl" lang="pl">
          <h2 id="pl-admin">Kto jest administratorem</h2>
          <p>
            Administratorem danych jest autor serwisu, <strong>Skull (skullboypl)</strong>, prowadzący FACEIT Banner Studio
            pod adresem <a href="https://faceitbanner.vxh.pl">faceitbanner.vxh.pl</a>. Kontakt w sprawach danych osobowych:{' '}
            <a href="https://discord.skullmedia.pl">Discord</a>.
          </p>
          <h2 id="pl-serwis">Co robi serwis</h2>
          <p>
            Generator tworzy banery ze statystykami FACEIT do OBS i Streamlabs. Z generatora możesz korzystać bez konta.
            Konto (logowanie przez FACEIT) jest opcjonalne i daje zapis banerów w chmurze oraz udział w tablicy zgłoszeń.
          </p>
          <h2 id="pl-dane">Jakie dane przetwarzamy</h2>
          <h3>Bez logowania</h3>
          <ul>
            <li><strong>Ustawienia generatora</strong> zapisują się wyłącznie w pamięci Twojej przeglądarki (localStorage). Nie trafiają na nasz serwer.</li>
            <li>
              <strong>Banery na żywo:</strong> widżet wysyła losowy identyfikator oraz publiczne dane z banera
              (nick, ELO, level, kraj, styl). Serwer trzyma je około godziny, żeby policzyć otwarte banery
              i pokazać ranking ELO na stronie „Na żywo”. Sam identyfikator gracza z adresu banera wystarczy:
              serwer dopytuje wtedy publiczny nick i ELO w FACEIT. Bez nicku i bez identyfikatora widać tylko liczbę.
              Ranking nie pokazuje adresu IP. Adres służy tylko do limitu, ile banerów może zgłosić jedna sieć, i znika razem z wpisem.
              Parametr <code>presence=off</code> w adresie widżetu wyłącza to całkowicie.
            </li>
            <li><strong>Statystyki FACEIT:</strong> dla wpisanego nicku lub ID gracza baner pobiera publiczne dane z API FACEIT. Te zapytania wysyła Twoja przeglądarka (lub OBS) do FACEIT.</li>
            <li><strong>Flagi krajów</strong> ładują się z flagcdn.com, więc ten dostawca widzi adres IP przeglądarki.</li>
          </ul>
          <h3>Po zalogowaniu przez FACEIT</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Dane</th><th>Po co</th><th>Jak długo</th></tr></thead>
              <tbody>
                <tr><td>Identyfikator konta FACEIT (guid), nick i adres awatara (od FACEIT)</td><td>Konto, podpisanie zgłoszeń i komentarzy</td><td>Do usunięcia konta</td></tr>
                <tr><td>Historia logowań: identyfikator, nick, awatar, adres IP, czas</td><td>Bezpieczeństwo i wykrywanie nadużyć</td><td>Dopóki jest potrzebna do bezpieczeństwa; usuwamy na Twoją prośbę</td></tr>
                <tr><td>Sesja logowania (ciasteczko <code>fb_session</code>)</td><td>Utrzymanie zalogowania</td><td>Do 7 dni</td></tr>
                <tr><td>Zapisane banery i bieżące ustawienia synchronizowane z kontem</td><td>Dostęp do banerów z każdego urządzenia</td><td>Do usunięcia przez Ciebie lub usunięcia konta</td></tr>
                <tr><td>Własny avatar i tło dla banerów (pliki obrazów), status moderacji i zgłoszenia nadużyć</td><td>Pokazanie ich w banerach każdemu, kto wpisze Twój nick; moderacja</td><td>Do usunięcia przez Ciebie lub administratora; po akceptacji obrazy są publiczne</td></tr>
                <tr><td>Zgłoszenia, komentarze, głosy, ewentualny kontekst błędu (przeglądarka, wersja, wybrane ustawienia banera)</td><td>Tablica próśb i błędów</td><td>Do usunięcia przez Ciebie lub administratora</td></tr>
              </tbody>
            </table>
          </div>
          <p>Nie prosimy o hasło ani adres e-mail. Nie otrzymujemy Twojego hasła do FACEIT: logowanie odbywa się na stronie FACEIT.</p>
          <h2 id="pl-podstawa">Podstawa prawna</h2>
          <p>
            Zapewnienie funkcji konta: art. 6 ust. 1 lit. b RODO. Bezpieczeństwo serwisu, ochrona przed nadużyciami i
            moderacja: prawnie uzasadniony interes administratora (art. 6 ust. 1 lit. f RODO).
          </p>
          <h2 id="pl-ciasteczka">Ciasteczka i reklamy</h2>
          <p>Używamy jednego technicznego ciasteczka sesji (<code>fb_session</code>, tylko po zalogowaniu). Nie ma reklam, śledzenia ani ciasteczek analitycznych.</p>
          <h2 id="pl-odbiorcy">Kto jeszcze widzi dane</h2>
          <ul>
            <li><strong>FACEIT</strong>: logowanie i publiczne statystyki, według własnych zasad FACEIT.</li>
            <li><strong>Inni zalogowani użytkownicy</strong> widzą Twój nick przy zgłoszeniach i komentarzach. Niezalogowani widzą tylko tytuły, status i liczniki.</li>
            <li><strong>Każdy odwiedzający:</strong> jeśli ustawisz własny avatar lub tło dla banerów i administrator je zatwierdzi, widzi je każdy, kto wpisze Twój nick w generatorze lub otworzy Twój baner. Obrazy są w publicznym magazynie plików; osoby zgłaszające obraz nie są ujawniane jego właścicielowi.</li>
            <li><strong>Hosting:</strong> dane są na serwerze VPS administratora; nie sprzedajemy ich ani nie udostępniamy reklamodawcom.</li>
            <li><strong>Wsparcie projektu</strong> (<a href="https://donate.skullmedia.pl">donate.skullmedia.pl</a>) to osobna strona z własnymi zasadami; nie przekazujemy jej danych z kont.</li>
          </ul>
          <h2 id="pl-prawa">Twoje prawa</h2>
          <p>
            Możesz żądać dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, sprzeciwu oraz
            przeniesienia danych. Możesz też złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych. Napisz przez{' '}
            <a href="https://discord.skullmedia.pl">Discord</a>, a usuniemy konto razem z zapisanymi banerami, zgłoszeniami i
            historią logowań, o ile prawo nie wymaga ich zachowania.
          </p>
          <h2 id="pl-zmiany">Zmiany</h2>
          <p>Zmiany tej polityki publikujemy na tej stronie z nową datą.</p>
        </section>
        <section id="en" lang="en">
          <h2 id="en-controller">Who is responsible</h2>
          <p>
            The controller is the author of the service, <strong>Skull (skullboypl)</strong>, who runs FACEIT Banner Studio at{' '}
            <a href="https://faceitbanner.vxh.pl">faceitbanner.vxh.pl</a>. For data protection matters contact us on{' '}
            <a href="https://discord.skullmedia.pl">Discord</a>.
          </p>
          <h2 id="en-service">What the service does</h2>
          <p>
            The generator creates banners with FACEIT statistics for OBS and Streamlabs. You can use it without an account.
            Logging in with FACEIT is optional and adds cloud-saved banners and the requests and bug board.
          </p>
          <h2 id="en-data">What we process</h2>
          <h3>Without logging in</h3>
          <ul>
            <li><strong>Generator settings</strong> are kept only in your browser (localStorage), not on our server.</li>
            <li>
              <strong>Live banners:</strong> the widget sends a random identifier plus the public banner fields
              (nickname, ELO, level, country, style). The server keeps them for about an hour to count open
              banners and to show the ELO ranking on the Live page. A player id from the banner address is enough:
              the server then asks FACEIT for the public nickname and ELO. Without a nickname and without a player id,
              only the count is visible. The ranking does not show the IP address. The address is used only to limit how many
              banners one network can report, and it is dropped with the row. <code>presence=off</code> on the widget URL turns this off.
            </li>
            <li><strong>FACEIT statistics:</strong> for the nickname or player ID you enter, the banner fetches public data from the FACEIT API. Your browser (or OBS) sends those requests to FACEIT.</li>
            <li><strong>Country flags</strong> load from flagcdn.com, so that provider sees the browser's IP address.</li>
          </ul>
          <h3>After logging in with FACEIT</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Purpose</th><th>Retention</th></tr></thead>
              <tbody>
                <tr><td>FACEIT account id (guid), nickname and avatar URL (from FACEIT)</td><td>Account, signing posts and comments</td><td>Until the account is deleted</td></tr>
                <tr><td>Login history: id, nickname, avatar, IP address, time</td><td>Security and abuse detection</td><td>As long as needed for security; deleted on request</td></tr>
                <tr><td>Login session (<code>fb_session</code> cookie)</td><td>Keeping you logged in</td><td>Up to 7 days</td></tr>
                <tr><td>Saved banners and working settings synced to the account</td><td>Access from every device</td><td>Until you or an account deletion remove them</td></tr>
                <tr><td>Your own avatar and background for banners (image files), moderation status and abuse reports</td><td>Showing them on banners to anyone who types your nickname; moderation</td><td>Until you or an administrator delete them; after approval the images are public</td></tr>
                <tr><td>Posts, comments, votes, optional bug context (browser, version, chosen banner settings)</td><td>Requests and bugs board</td><td>Until you or an administrator remove them</td></tr>
              </tbody>
            </table>
          </div>
          <p>We do not ask for a password or an email address. We never receive your FACEIT password: login happens on FACEIT's own page.</p>
          <h2 id="en-basis">Legal basis</h2>
          <p>Providing account features: Art. 6(1)(b) GDPR. Service security, abuse protection and moderation: the controller's legitimate interest (Art. 6(1)(f) GDPR).</p>
          <h2 id="en-cookies">Cookies and ads</h2>
          <p>We use one technical session cookie (<code>fb_session</code>, only after login). There are no ads, tracking or analytics cookies.</p>
          <h2 id="en-recipients">Who else sees data</h2>
          <ul>
            <li><strong>FACEIT</strong>: login and public statistics, under FACEIT's own terms.</li>
            <li><strong>Other logged-in users</strong> see your nickname next to posts and comments. Visitors who are not logged in see only titles, status and counters.</li>
            <li><strong>Any visitor:</strong> if you set your own avatar or background for banners and an administrator approves it, everyone who types your nickname in the generator or opens your banner sees it. The images sit in a public file store; people who report an image are not revealed to its owner.</li>
            <li><strong>Hosting:</strong> data lives on the controller's VPS; we do not sell it or share it with advertisers.</li>
            <li><strong>Supporting the project</strong> (<a href="https://donate.skullmedia.pl">donate.skullmedia.pl</a>) is a separate site with its own rules; we pass no account data to it.</li>
          </ul>
          <h2 id="en-rights">Your rights</h2>
          <p>
            You can request access, rectification, erasure, restriction, objection and data portability, and you can complain
            to your data protection authority (in Poland: the President of the Personal Data Protection Office). Write on{' '}
            <a href="https://discord.skullmedia.pl">Discord</a> and we will delete the account with its saved banners, posts
            and login history unless the law requires us to keep them.
          </p>
          <h2 id="en-changes">Changes</h2>
          <p>We publish changes to this policy on this page with a new date.</p>
        </section>
      </SitePage>
    ),
  },
];
