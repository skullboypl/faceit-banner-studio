import { useEffect, useState } from 'react';
import { StudioIcon } from '../components/StudioIcon';
import {
  BANNER_MODES,
  type BannerCatalog,
  type BannerCatalogMode,
} from '../../shared/banner-catalog.mjs';

const LABELS: Record<BannerCatalogMode, { title: string; text: string }> = {
  solo: { title: 'Solo', text: 'Tylko statystyki jednego gracza.' },
  versus: { title: 'Versus', text: 'Porównanie z rywalem.' },
  team: { title: 'Skład', text: 'Lista do 10 graczy.' },
  split: { title: 'Split', text: 'Dwa linki: radar i pasek pod kamerkę.' },
  popup: { title: 'Popup', text: 'Karta meczu na środku ekranu.' },
};

export function AdminCatalog() {
  const [modes, setModes] = useState<BannerCatalog | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<BannerCatalogMode | null>(null);

  useEffect(() => {
    let cancel = false;
    fetch('/api/admin/catalog', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('catalog');
        return response.json();
      })
      .then((body) => {
        if (!cancel) setModes(body.modes);
      })
      .catch(() => {
        if (!cancel) setError('Nie udało się wczytać widoczności banerów.');
      });
    return () => {
      cancel = true;
    };
  }, []);

  const toggle = async (mode: BannerCatalogMode) => {
    if (!modes || pending) return;
    const visible = !modes[mode];
    setPending(mode);
    setError('');
    try {
      const response = await fetch('/api/admin/catalog', {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ modes: { [mode]: visible } }),
      });
      if (!response.ok) throw new Error('save');
      const body = await response.json();
      setModes(body.modes);
    } catch {
      setError('Nie udało się zapisać. Odśwież stronę i spróbuj jeszcze raz.');
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="admin-card admin-catalog">
      <div className="admin-section-head">
        <div>
          <h2>Widoczność banerów</h2>
          <p>
            Domyślnie konfigurator pokazuje solo i versus. Ukryty tryb znika z
            listy opcji. Kto już ma link OBS, dalej go używa.
          </p>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      <ul>
        {BANNER_MODES.map((mode) => {
          const visible = modes ? modes[mode] : mode === 'solo' || mode === 'versus';
          return (
            <li key={mode}>
              <div>
                <strong>{LABELS[mode].title}</strong>
                <span>{LABELS[mode].text}</span>
              </div>
              <button
                type="button"
                className={visible ? 'is-on' : ''}
                aria-pressed={visible}
                disabled={!modes || pending === mode}
                onClick={() => void toggle(mode)}
              >
                <StudioIcon name={visible ? 'eye' : 'eye-off'} />
                {visible ? 'Widoczny' : 'Ukryty'}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
