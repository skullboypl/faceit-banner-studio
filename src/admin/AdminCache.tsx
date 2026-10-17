import { useState } from 'react';
import { StudioIcon } from '../components/StudioIcon';

export type CacheScope = 'all' | 'faceit' | 'profiles' | 'avatars' | 'rankings' | 'live';

const SCOPES: { scope: CacheScope; label: string; text: string }[] = [
  { scope: 'all', label: 'Wszystko', text: 'Wszystkie poniższe naraz.' },
  { scope: 'faceit', label: 'Odpowiedzi FACEIT', text: 'Statystyki, profile i mecze, które banery pobierają przez nasz serwer (zwykle 15 s).' },
  { scope: 'profiles', label: 'Profile graczy', text: 'Nick, ELO, level, plan i Twitch na liście na żywo (6 godzin). Zdejmuje też pauzę po limicie FACEIT.' },
  { scope: 'avatars', label: 'Avatary', text: 'Zdjęcia graczy z listy na żywo (6 godzin).' },
  { scope: 'rankings', label: 'Miejsca w rankingu', text: 'Znaczek Challengera na liście na żywo (6 godzin).' },
  { scope: 'live', label: 'Lista na żywo', text: 'Gotowa lista i licznik banerów online (30 s).' },
];

async function requestClear(scope: string): Promise<string[]> {
  const response = await fetch('/api/admin/cache', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scope }),
  });
  if (!response.ok) throw new Error('cache');
  return ((await response.json()) as { cleared: string[] }).cleared;
}

export function AdminCache({ clear = requestClear }: { clear?: (scope: string) => Promise<string[]> }) {
  const [pending, setPending] = useState<CacheScope | null>(null);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  const run = async (scope: CacheScope) => {
    if (pending) return;
    setPending(scope);
    setDone('');
    setError('');
    try {
      const cleared = await clear(scope);
      setDone(`Wyczyszczono (${cleared.length}): ${new Date().toLocaleTimeString('pl-PL')}`);
    } catch {
      setError('Nie udało się wyczyścić. Spróbuj jeszcze raz.');
    } finally {
      setPending(null);
    }
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
