import { useState, type FormEvent } from 'react';
import { StudioIcon } from '../components/StudioIcon';

export type CacheScope = 'all' | 'faceit' | 'profiles' | 'avatars' | 'rankings' | 'live' | 'css';

const PLAYER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SCOPES: { scope: CacheScope; label: string; text: string }[] = [
  { scope: 'all', label: 'Wszystko', text: 'Wszystkie dane FACEIT i lista na żywo naraz. CSS na CDN czyścisz osobno.' },
  { scope: 'faceit', label: 'Odpowiedzi FACEIT', text: 'Statystyki, profile i mecze, które banery pobierają przez nasz serwer (zwykle 15 s).' },
  { scope: 'profiles', label: 'Profile graczy', text: 'Nick, ELO, level, plan i Twitch na liście na żywo (6 godzin). Bez podpiętego Twitcha sprawdzamy ponownie co 15 min, razem z listą. Zdejmuje też pauzę po limicie FACEIT.' },
  { scope: 'avatars', label: 'Avatary', text: 'Zdjęcia i okładki graczy trzymane na serwerze (6 godzin).' },
  { scope: 'rankings', label: 'Miejsca w rankingu', text: 'Znaczek Challengera na liście na żywo (6 godzin).' },
  { scope: 'live', label: 'Lista na żywo', text: 'Gotowa lista (15 min) i licznik banerów online (30 s).' },
  { scope: 'css', label: 'CSS i HTML na CDN', text: 'Zrzuca kopię stylów i stron z Cloudflare, gdy po wgraniu dalej widać stary wygląd (białe tło, stary układ).' },
];

export async function requestClear(scope: string, playerId?: string): Promise<string[]> {
  const response = await fetch('/api/admin/cache', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(playerId ? { scope: 'player', playerId } : { scope }),
  });
  const body = (await response.json().catch(() => ({}))) as { cleared?: string[]; error?: string };
  if (!response.ok) throw new Error(body.error || 'cache');
  return body.cleared ?? [scope];
}

export function AdminCache({ clear = requestClear }: { clear?: (scope: string, playerId?: string) => Promise<string[]> }) {
  const [pending, setPending] = useState<string | null>(null);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const [playerId, setPlayerId] = useState('');

  const failText = (code: string) =>
    code === 'cdn_not_configured'
      ? 'Brak CF_ZONE_ID i CF_API_TOKEN na serwerze - bez nich CDN się nie czyści.'
      : code === 'cdn_purge_failed'
        ? 'Cloudflare nie przyjął czyszczenia. Sprawdź token i strefę.'
        : code === 'invalid_player'
          ? 'To nie jest FACEIT ID gracza.'
          : 'Nie udało się wyczyścić. Spróbuj jeszcze raz.';

  const run = async (scope: string, id?: string) => {
    if (pending) return;
    setPending(scope);
    setDone('');
    setError('');
    try {
      const cleared = id ? await clear(scope, id) : await clear(scope);
      setDone(`Wyczyszczono (${cleared.length}): ${new Date().toLocaleTimeString('pl-PL')}`);
    } catch (failure) {
      setError(failText(failure instanceof Error ? failure.message : ''));
    } finally {
      setPending(null);
    }
  };

  const refreshPlayer = (event: FormEvent) => {
    event.preventDefault();
    const id = playerId.trim();
    if (!PLAYER_ID.test(id)) {
      setError('To nie jest FACEIT ID gracza.');
      setDone('');
      return;
    }
    void run('player', id);
  };

  return (
    <section className="admin-card admin-cache">
      <div className="admin-section-head">
        <div>
          <h2>Pamięć podręczna</h2>
          <p>
            Wyczyść, gdy dane mają się odświeżyć od razu. Zaraz potem serwer pobiera je od nowa, więc przy dużym ruchu
            łatwiej o limit zapytań FACEIT.
          </p>
        </div>
        <StudioIcon name="cloud" />
      </div>
      {error && <p role="alert">{error}</p>}
      {done && <p role="status">{done}</p>}
      <form className="admin-cache-player" onSubmit={refreshPlayer}>
        <div>
          <strong>Jeden gracz</strong>
          <span>Zrzuca profil FACEIT, Twitch i listę na żywo tylko dla tego ID.</span>
        </div>
        <input
          type="text"
          spellCheck={false}
          autoComplete="off"
          aria-label="FACEIT ID gracza"
          placeholder="FACEIT ID…"
          value={playerId}
          onChange={(event) => setPlayerId(event.target.value)}
        />
        <button type="submit" disabled={pending !== null}>
          {pending === 'player' ? 'Odświeżam…' : 'Odśwież cache'}
        </button>
      </form>
      <ul>
        {SCOPES.map(({ scope, label, text }) => (
          <li key={scope}>
            <div>
              <strong>{label}</strong>
              <span>{text}</span>
            </div>
            <button type="button" disabled={pending !== null} onClick={() => void run(scope)} aria-label={label}>
              {pending === scope ? 'Czyszczę…' : 'Wyczyść'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
