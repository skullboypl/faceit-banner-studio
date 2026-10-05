# FACEIT — styl panelu Banner Studio

Wzorzec wizualny dla panelu konfiguracji banerów FACEIT. Dokument opisuje obecną implementację i zasady rozwijania jej w spójny sposób. Punktem odniesienia są dostarczone zrzuty strony głównej i profilu gracza na FACEIT: ciemne powierzchnie, zwarte sekcje, dyskretne obramowania, czytelne dane oraz pomarańczowy akcent.

## Charakter interfejsu

Panel ma przypominać narzędzie dla gracza i streamera. Najważniejsze są konfiguracja, podgląd efektu oraz eksport do OBS. Charakter nadają neutralne, niemal czarne powierzchnie i oszczędny pomarańcz. Hierarchię budujemy odstępami, kontrastem i typografią.

Nie kopiujemy całego portalu FACEIT. Przenosimy jego język wizualny na konkretny proces: profil → wygląd → statystyki → link do transmisji. Nie dodajemy fikcyjnych danych ani dekoracyjnych funkcji niezwiązanych z generatorem.

## Paleta

Źródłem tokenów jest `src/styles/faceit-refresh.less`.

| Rola | Wartość | Zastosowanie |
| --- | --- | --- |
| Tło aplikacji | `#0b0b0c` | Główna przestrzeń robocza |
| Nawigacja | `#111112` | Boczny panel i dyskretne powierzchnie pomocnicze |
| Karty | `#151516` | Sekcje ustawień i podglądu |
| Pola formularzy | `#1d1d1f` | Inputy, selecty, textarea |
| Obramowania | `#2b2b2e` | Podział kart i sekcji |
| Główny tekst | `#f0f0f2` | Nagłówki i treść o najwyższym priorytecie |
| Tekst pomocniczy | `#9c9ca3` | Opisy, instrukcje i kontekst |
| Akcent | `#ff5900` | Główna akcja, aktywne przełączniki, wybrany element |
| Akcent przy najechaniu | `#ff701f` | Główny przycisk |
| Focus klawiatury | `#ff813e` | Obrys aktywnej kontrolki |

Pomarańczowy sygnalizuje akcję lub wybór. Nie wypełnia dużych powierzchni strony. Aktywna pozycja menu ma przygaszone pomarańczowo-brązowe tło `#24201d`, obramowanie `#3b2d23` i pomarańczową ikonę. Zielona kropka w podglądzie (`#8bce76`) oznacza podgląd reagujący na zmiany; nie zastępuje informacji o przykładowych statystykach.

Unikamy niebieskiego zafarbu kart, mocnych poświat i kolorowych gradientów w panelu. Przyciemnienie zdjęcia w podglądzie jest funkcjonalne: poprawia widoczność banera i podpisu mapy.

## Typografia i treść

- **Inter**: główny tytuł strony, grubość 700, rozmiar 26–36 px, lekko zmniejszony odstęp między literami.
- **DM Sans**: pozostały interfejs. Nagłówki sekcji 13–14 px, kontrolki i opisy zwykle 12–13 px.
- Metadane, podpisy miniatur i krótkie etykiety techniczne mają 9–11 px. Tak małego tekstu nie używamy dla głównej instrukcji lub istotnego błędu.
- Krótkie etykiety kontekstowe mogą być zapisane wersalikami z większym odstępem między literami. Dłuższe opisy i nazwy kontrolek zapisujemy normalnie.
- Nazwy działań są konkretne: „Generuj link OBS”, „Udostępnij opcje”, „Importuj ustawienia”. Ta sama akcja zachowuje tę samą nazwę w całym interfejsie.
- Teksty dodajemy do tłumaczeń polskich, angielskich i niemieckich. Nie umieszczamy istotnych etykiet w CSS przez `content`.

## Układ

Na komputerze boczna nawigacja prowadzi do trzech obszarów: Ustawienia, Wygląd i Statystyki. W górnej części przestrzeni roboczej znajdują się krótka ścieżka nawigacyjna oraz kompaktowy nagłówek.

Główna zawartość ma dwie kolumny:

```text
Nawigacja │ Nagłówek i kontekst
          │
          │ Ustawienia          Podgląd banera
          │ Profil             Scena CS2
          │ Elementy           Miniatury map
          │ Zachowanie         Eksport i import
          │                    Pomoc OBS
```

- Boczny panel ma 210 px szerokości na dużym ekranie.
- Maksymalna szerokość przestrzeni z treścią wynosi 1420 px.
- Standardowe marginesy przestrzeni roboczej: 36 px; odstęp między kolumnami: 26 px.
- Siatka główna: `minmax(340px, .9fr) minmax(0, 1.25fr)`. Podgląd dostaje więcej przestrzeni niż formularz.
- Karty mają zwykle 20 px wewnętrznego odstępu i 16 px przerwy między sobą.
- Podgląd na komputerze używa `position: sticky` z odstępem 22 px od góry, w granicach głównej zawartości.
- Stopka, informacje o projekcie i materiały promocyjne mają niższy kontrast i priorytet niż narzędzia edycji.

Nie rozciągamy formularza na całą szerokość ekranu. Każda karta grupuje powiązane ustawienia. Dodatkowe obramowania, nagłówki i ikony powinny wyjaśniać podział treści, a nie tylko dekorować.

## Komponenty

### Nawigacja

Przyciski z cienką ikoną SVG i etykietą. Stan aktywny ma pomarańczowy akcent, delikatne tło oraz boczny wskaźnik. Zmiana zakładki aktualizuje nagłówek i zawartość ustawień. Widoczny stan aktywny jest również oznaczony przez `aria-current`.

### Karty i pola

Karty mają subtelne obramowanie 1 px, promień 8 px i bardzo lekki cień. Pola są nieco jaśniejsze od karty, mają promień 5 px, obramowanie `#353539` i wysokość około 39 px. Etykieta znajduje się nad polem; placeholder nie jest jej zamiennikiem.

### Przełączniki

Wiersz składa się z tekstu po lewej i przełącznika po prawej. Wiersze rozdzielają cienkie linie. Tor przełącznika ma 30 × 17 px, a uchwyt 11 px. Włączony tor jest pomarańczowy, wyłączony — szary. Klikalny jest cały wiersz.

Przełącznik jest przyciskiem `type="button"`, z `role="switch"` i `aria-checked`. Powinien działać przez kliknięcie, Enter i spację. Stan widoczny musi odpowiadać stanowi dostępnemu dla czytników ekranu.

### Podgląd

Podgląd stanowi główny element wizualny. Baner znajduje się na zdjęciu mapy CS2 z delikatnym przyciemnieniem. Scena ma co najmniej 310 px wysokości na standardowym komputerze; na szerokim ekranie 355 px, na telefonie 220 px.

Pod sceną znajduje się pięć miniatur: Nuke, Mirage, Ancient, Dust 2 i Overpass. Kliknięcie zmienia tło. Aktywną miniaturę wyróżnia pomarańczowe obramowanie i `aria-pressed`. Tło jest wyłącznie elementem podglądu, co wyjaśnia podpis. Osobna informacja mówi o przykładowych statystykach meczowych.

Motyw i ustawienia samego banera należą do widżetu. Kolory panelu nie mogą zmieniać wygenerowanego wyglądu banera.

### Akcje i import

„Generuj link OBS” jest główną akcją: pełne pomarańczowe tło, jasny tekst, wyraźna ikona kierunku. „Udostępnij opcje” jest neutralnym przyciskiem pomocniczym. Import ustawień jest schowany w rozwijanej sekcji pod przyciskami.

Nie nadajemy każdemu przyciskowi pomarańczowego tła. Akcje pomocnicze powinny pozostać łatwe do odnalezienia, ale nie konkurować z eksportem.

### Okno eksportu

Ciemne okno z cienkim obramowaniem, promieniem 10 px i czytelną instrukcją. Tło strony jest przyciemnione i lekko rozmyte. Okno ma nazwę dostępną przez `aria-labelledby`, obsługuje Escape i pozwala skopiować lub otworzyć wygenerowany link. Na telefonie przyciski układają się pionowo.

## Animacje

Ruch ma pokazywać zmianę stanu i ułatwiać orientację. Nie stosujemy ciągłego unoszenia kart ani automatycznej karuzeli tła.

| Element | Zachowanie | Czas |
| --- | --- | --- |
| Nagłówek | Pojawienie się i przesunięcie z 12 px poniżej | 450 ms |
| Kolumna podglądu | Ten sam efekt, z krótkim opóźnieniem | 550 ms, opóźnienie 80 ms |
| Karty nowej zakładki | Pojawienie się i przesunięcie z dołu | 320 ms; kolejne karty +45 ms i +90 ms |
| Zmiana mapy | Pojawienie się zdjęcia i skala od 1.035 do 1 | 500 ms |
| Uchwyt przełącznika | Przesunięcie o 13 px i zmiana koloru | 220 ms / 200 ms |
| Przycisk | Zmiana tła i obramowania; przy najechaniu ruch o 1 px w górę | 180 ms |
| Miniatura | Ruch o 2 px w górę i delikatne powiększenie zdjęcia | 200–350 ms |
| Okno eksportu | Pojawienie się, przesunięcie o 12 px i skala od .98 do 1 | 240 ms |

Preferujemy animowanie `opacity` i `transform`. Animacje nie mogą opóźniać działania kontrolek. Respektujemy `prefers-reduced-motion: reduce`: wyłączamy animacje wejścia i przejścia elementów interfejsu.

## Responsywność

| Szerokość okna | Układ |
| --- | --- |
| Od 1700 px | Większe marginesy boczne 54 px, wyższa scena podglądu |
| 1281–1699 px | Pełna nawigacja 210 px i dwie kolumny |
| 1001–1280 px | Wąska nawigacja 76 px z ikonami; dostępne nazwy pozostają w `aria-label` i `title` |
| Do 1100 px | Mniejszy odstęp między kolumnami i pionowy układ akcji eksportu w wariancie desktopowym |
| Do 1000 px | Nawigacja u góry, jedna kolumna, podgląd przed formularzem; szerokość głównej treści do 680 px |
| Do 600 px | Marginesy 16 px, mniejsze karty, pola formularza oraz akcje eksportu układane pionowo |

Na mniejszych ekranach nawigacja pozostaje przy górnej krawędzi. Kliknięcie zakładki przewija do nagłówka ustawień z zapasem na przyklejone menu. Podgląd nie może powodować przewijania całej strony w poziomie.

## Dostępność i kontrola jakości

- Zachowujemy wyraźny focus klawiatury: obrys 2 px w kolorze `#ff813e`, odsunięty o 3 px.
- Kontrolki mają dostępne nazwy, a dekoracyjne ikony — `aria-hidden="true"`.
- Stan wybranej mapy lub przełącznika nie jest przekazywany wyłącznie kolorem.
- Weryfikujemy długie etykiety i wszystkie języki interfejsu, szczególnie na wąskich ekranach.
- Po zmianie układu sprawdzamy trzy zakładki, aktualizację podglądu, obsługę klawiatury i okno eksportu.
- Sprawdzamy brak poziomego przepełnienia oraz działanie nawigacji na telefonie i mniejszym laptopie.

## Miejsca implementacji

- `src/styles/faceit-refresh.less` — tokeny, układ, komponenty, animacje i breakpointy; importowany na końcu `src/styles/app.less`.
- `src/generator/Generator.tsx` — nawigacja, kolumny, podgląd, akcje eksportu.
- `src/generator/tabs/` — grupy ustawień profilu, wyglądu i statystyk.
- `src/components/StudioIcon.tsx` — spójne ikony liniowe SVG, siatka 24 × 24, obrys 1.6.
- `src/components/Checkbox.tsx` — dostępne przełączniki.
- `src/components/PreviewCarousel.tsx` — wybór tła przez miniatury; nazwa pliku pozostała po wcześniejszej karuzeli.
- `src/components/GeneratedWidgetModal.tsx` — okno eksportu.
- `src/translations/{polish,english,german}.json` — treści, w tym klucze `studio.*`.

Style panelu ograniczamy do `html.generator`. Nie nadpisujemy globalnie klas widżetu, takich jak `.wrapper`, `.widget`, `.elo` i `.stat`. Nowe style rozwijamy w istniejącej warstwie projektu, zamiast dokładać kolejne konkurujące pliki z nadpisaniami.

## Banery FACEIT 2026 — wersja 3.6.0, 4.10.2026

Warstwa wyglądu banerów jest niezależna od stylów panelu. Nowy generator domyślnie eksportuje `design=2026`. Widget bez tego parametru używa wersji klasycznej. Nie zmieniamy domyślnych wartości istniejących ustawień widgetu w ramach tej migracji.

| Parametr linku | Zachowanie |
| --- | --- |
| `design=2026` | Odświeżony wygląd wybranego stylu |
| brak `design`, `design=legacy` lub nieznana wersja | Dotychczasowy wygląd |
| brak `intro` lub `intro=true` | Powitanie z nowościami przy każdym załadowaniu źródła |
| `intro=false` | Bez komunikatu o aktualizacji; krótkie wejście banera pozostaje |
| `lang=pl`, `lang=en`, `lang=de` | Język banera i komunikatu; domyślnie angielski w samodzielnym widżecie |

Do istniejącego linku dopisujemy `&design=2026`; `?design=2026` stosujemy tylko wtedy, gdy adres nie ma jeszcze parametrów. Import starego linku zachowuje klasyczny wygląd. Generator pozwala świadomie przełączyć obie wersje i zapisuje ten wybór w eksportowanym adresie. Własny CSS pozostaje nadrzędny wobec standardowych reguł zgodnie z dotychczasową specyficznością; styl `custom` nie otrzymuje warstwy 2026.

Nowy wygląd używa mocniejszej hierarchii: nazwa gracza, wyróżniona wartość ELO, mniejsze etykiety i osobny pas statystyk. Liczby mają stałą szerokość cyfr. Wyniki sesji dostają spokojne obramowania, a ich wartości zachowują zielony i czerwony kolor. Główne układy (`normal`, `rounded`, `banner`, `amoled`, `animated`) mają wspólny system odstępów. Kompaktowe warianty zachowują zagęszczony układ. Pozostałe motywy otrzymują wspólne poprawki typografii bez przebudowy swoich charakterystycznych układów.

Powitanie mieści się w aktualnym obszarze banera i nie zwiększa jego wymiarów. Pojawia się z przesunięciem 8 px i wygasza po 6,2 s; cienka pomarańczowa linia pokazuje czas do końca. Zawiera wersję, datę ostatniej aktualizacji oraz tekst z tłumaczeń. W małych banerach skraca treść, zachowując datę i wersję. Odświeżenie danych nie uruchamia go ponownie. Przycisk „Odtwórz powitanie” uruchamia je w podglądzie. Przy ograniczonym ruchu komunikat jest statyczny i znika po tym samym czasie.

- `widget/src/styles/banner-2026.less` — reguły ograniczone do `.wrapper.banner-design-2026`.
- `widget/src/components/UpdateIntro.tsx` i `widget/src/styles/update-intro.less` — jednorazowy komunikat i animacja wejścia.
- `widget/src/release.ts` — data wydania i czas komunikatu; numer wersji pochodzi z `package.json`.
- `widget.update.*` — treść komunikatu we wszystkich trzech plikach językowych. Przy kolejnym wydaniu aktualizujemy datę, wersję i treść razem.

### Presety transmisyjne

Nowe układy są dostępne wyłącznie z `design=2026`, jako karty wyboru z miniaturą w zakładce Wygląd. Ustawienie `style` nadal obsługuje wcześniejsze motywy. Nowy generator domyślnie wybiera `showcase`; domyślny styl samodzielnego widgetu pozostaje `rounded`. Istniejące zapisane preferencje użytkownika nie są automatycznie zastępowane. Wybór wersji klasycznej przy nowym presecie przełącza na `rounded`.

| Preset | Parametry | Sugerowane źródło OBS | Zastosowanie |
| --- | --- | --- | --- |
| Showcase | `design=2026&style=showcase` | 500 × 300 px | Domyślny układ generatora. Zakładki Profil, Forma, Taktyka i Sesja zmieniają się automatycznie |
| Spotlight | `design=2026&style=spotlight` | 500 × 260 px | Te same zakładki, większa typografia i krótszy kadr |
| Broadcast | `design=2026&style=broadcast` | 500 × 240 px | Statyczna karta pod kamerą: mocne ELO, wyniki sesji, cztery pola danych |
| Rail | `design=2026&style=rail` | 620 × 132 px | Niski pasek wzdłuż krawędzi sceny, profil i statystyki obok siebie |
| Focus | `design=2026&style=focus` | 340 × 360 px | Węższa karta do pionowych scen i paneli bocznych, statystyki 2 × 2 |

W wersji 2026 generator pokazuje wyłącznie te pięć układów, jako karty. Dotychczasowe motywy zostają przy wersji klasycznej. Każdy układ ma własny kolor akcentu i własne opcje, zapisywane osobno w linku. Showcase i Spotlight dodatkowo mają czas zakładki, rodzaj ruchu, poświatę, włączane strony oraz cztery statystyki strony Taktyka.

Wymiary są punktem wyjścia; długie nazwy, zmieniona czcionka lub dodatkowe rankingi mogą wymagać większego źródła. Eksport pokazuje rozmiar dopasowany do wybranego presetu. Układy wykorzystują istniejące kontrolki danych, języków, kolorów i przezroczystości tła. Implementacja: `widget/src/styles/broadcast-presets.less`; metadane i zgodność: `widget/src/styles/styles.ts`.

Komunikat aktualizacji zawiera widoczny adres `faceitbanner.vxh.pl` prowadzący do `https://faceitbanner.vxh.pl/`, także w wariancie kompaktowym. Inspiracje funkcjonalne: [FACEIT Widget](https://faceitwidget.com/builder/) (różne gęstości informacji) i [Hudify](https://hudify.app/) (mała powierzchnia nakładki OBS). Układy i miniatury są własną implementacją.
