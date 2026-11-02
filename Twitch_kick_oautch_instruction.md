# Twitch i Kick OAuth — jak podpiąć klucze

Wpisany nick **nie jest** połączeniem. Bez OAuth ktokolwiek mógłby wpisać cudzy kanał. Studio zapisuje login **tylko** po tym, jak Twitch albo Kick potwierdzi konto tokenem. Klucze możesz dorobić później — do tego czasu przyciski „Połącz Twitch” / „Połącz Kick” są wyłączone i **nie przyjmują** wpisanego nicka.

Pełna instrukcja dla tej aplikacji: `Twitch_kick_oautch_instruction.md` (ten plik).

## Co już jest w kodzie

- Start: `GET /api/auth/twitch` i `GET /api/auth/kick` (wymaga zalogowanego FACEIT, sesja `fb_session` jak przy logowaniu FACEIT).
- Callback: `GET /api/auth/twitch/callback` i `GET /api/auth/kick/callback`.
- Odłączenie: `PUT /api/auth/twitch` albo `PUT /api/auth/kick` z `{ "twitch": null }` / `{ "kick": null }` i nagłówkiem `Origin`. Wpisany nick w body dostaje `400 oauth_required`.
- PKCE S256 + losowy `state` (CSRF), tak jak FACEIT w `server/auth.mjs`.
- Redirect URI liczy się tak samo jak callback FACEIT: `publicUrl(req)` → `PUBLIC_URL` (bez `/` na końcu) albo `http(s)://{Host}`.

## Redirect URI (wpisz je 1:1 w konsolach)

Lokalnie (`pnpm dev` albo `pnpm dev:admin`, Vite na porcie 5173):

```
http://localhost:5173/api/auth/twitch/callback
http://localhost:5173/api/auth/kick/callback
```

Produkcja (tak jak FACEIT: `{PUBLIC_URL}/api/auth/callback`):

```
https://faceitbanner.vxh.pl/api/auth/twitch/callback
https://faceitbanner.vxh.pl/api/auth/kick/callback
```

W `.env`:

```
PUBLIC_URL=https://faceitbanner.vxh.pl
```

Lokalnie, gdy testujesz OAuth na własnej maszynie:

```
PUBLIC_URL=http://localhost:5173
```

Używaj **`localhost`**, nie `127.0.0.1` — Kick ma bug, który podmienia pierwsze `127.0.0.1` w URL na `localhost` i wtedy redirect nie przechodzi. FACEIT OAuth w tej apce też wisi na `{PUBLIC_URL}/api/auth/callback`.

## Zmienne środowiska (dorobisz później)

```
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
KICK_CLIENT_ID=
KICK_CLIENT_SECRET=
```

Bez **obu** wartości danej platformy:

- `GET /api/auth/twitch` albo `/kick` → `503 oauth_not_configured`
- w profilu przycisk „Połącz …” jest nieaktywny
- **nie ma** pola, w które można wpisać nick i zapisać go jako zweryfikowany kanał

Po ustawieniu kluczy zrestartuj `pnpm dev` / `pnpm dev:admin` (czytają `.env` przy starcie).

---

## Twitch

1. Konsola deweloperska: [https://dev.twitch.tv/console](https://dev.twitch.tv/console)
2. **Register Your Application** (albo edycja istniejącej).
   - OAuth Redirect URLs: oba callbacki z sekcji wyżej (local + produkcja mogą być na jednej aplikacji albo na dwóch).
   - Category: Website Integration / Application Integration.
3. Skopiuj **Client ID** i wygeneruj **Client Secret** → `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET`.
4. Dokumentacja tokenów: [https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/)
5. Scope w kodzie: `user:read:email` — minimum, żeby Helix `GET /helix/users` oddał `login` zalogowanego kanału. PKCE S256 jest włączone.
6. Authorize: `https://id.twitch.tv/oauth2/authorize`  
   Token: `https://id.twitch.tv/oauth2/token`  
   Userinfo: `https://api.twitch.tv/helix/users`

## Kick

1. Konto Kick + **2FA** (wymagane do narzędzi deweloperskich).
2. Ustawienia → Developer: [https://kick.com/settings/developer](https://kick.com/settings/developer)
3. Setup aplikacji: [https://docs.kick.com/getting-started/kick-apps-setup](https://docs.kick.com/getting-started/kick-apps-setup)
4. OAuth 2.1 (PKCE obowiązkowe): [https://docs.kick.com/getting-started/generating-tokens-oauth2-flow](https://docs.kick.com/getting-started/generating-tokens-oauth2-flow)
5. Utwórz app: Client ID, Client Secret, **Redirect URL** = callback Kick z sekcji wyżej.
6. Scope w kodzie: `user:read channel:read`
   - `user:read` → `GET https://api.kick.com/public/v1/users` (zalogowany user)
   - `channel:read` → `GET https://api.kick.com/public/v1/channels` bez parametrów (slug kanału; to zapisujemy)
7. Authorize: `https://id.kick.com/oauth/authorize`  
   Token: `https://id.kick.com/oauth/token`  
   W tokenie idą `client_id`, `client_secret` i `code_verifier` (Kick OAuth 2.1).

Kick nie wymaga osobnego „Kick public key” do samego podpięcia nicka. Gdyby później doszły eventy / webhooki, dopiszesz je w tej samej aplikacji Kick.

---

## Jak przetestować lokalnie

1. `pnpm dev:admin` — Vite + fałszywy admin na localhost (`DEV_ADMIN=1`).  
   Albo zwykłe `pnpm dev` i zaloguj się FACEIT (guid UUID).
2. Wpisz klucze w `.env` i ustaw `PUBLIC_URL=http://localhost:5173`.
3. W konsolach Twitch/Kick dodaj dokładnie  
   `http://localhost:5173/api/auth/twitch/callback` i `…/kick/callback`.
4. Studio → konto → **Profil** (`/?panel=profile`) → **Połączenia** → **Połącz Twitch** / **Połącz Kick**.
5. Po zgodzie wracasz na `/?panel=profile&pair=twitch` albo `pair=kick`. Login z providera jest w `user_twitch` / `user_kick`.
6. **Dev Admin** (`guid: dev-admin`) nie jest kontem FACEIT — podpięcie wymaga prawdziwego logowania FACEIT (UUID). Bez kluczy i tak zobaczysz wyłączone przyciski.

Na liście `/live` i `/streamers` zapisany OAuth login **wygrywa** z `twitch_id` / `kick_id` z FACEIT. Po odłączeniu znowu liczy się link z FACEIT.

## Bezpieczeństwo (krótko)

- Nie commituj sekretów. `.env` jest poza gitem.
- Nie wracaj do formularza „wpisz nick i zapisz” — to nie jest weryfikacja.
- Ten sam kanał może wisieć tylko na jednym koncie FACEIT (`taken`).
- `PUT` bez `Origin` z dozwolonej domeny jest odrzucany (jak logout).
