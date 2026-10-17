import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { LanguageContext } from '../generator/contexts';
import { languages, tl as translate } from '../translations/translations';
import { AdminQueue } from './AdminQueue';
import { AdminProfileImages } from './AdminProfileImages';
import { AdminChart } from './AdminChart';
import { AdminLogins, LoginRows, Player } from './AdminLogins';
import { storageLabel, type AdminUser, type Overview } from './data';
import { CookieNotice } from '../components/CookieNotice';
import { StudioIcon, type IconName } from '../components/StudioIcon';
import {
  AdminNavigation,
  ADMIN_TABS,
  type AdminTab as Tab,
} from './AdminNavigation';
import { AdminCatalog } from './AdminCatalog';
import { AdminCache } from './AdminCache';
import { AdminPublications } from './AdminPublications';

type State =
  | { status: 'loading' | 'guest' | 'error' }
  | { status: 'forbidden'; user: AdminUser }
  | { status: 'ready'; user: AdminUser; overview: Overview };
type Range = 7 | 14 | 30;

const dayLabel = (day: string) => {
  const [, month, date] = day.split('-');
  return `${Number(date)}.${month}`;
};

const hourLabel = (hour: string) => {
  const date = new Date(hour);
  if (Number.isNaN(date.getTime())) return hour;
  const day = date.getUTCDate();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const clock = String(date.getUTCHours()).padStart(2, '0');
  return `${day}.${month} ${clock}:00`;
};
const tl = (text: string, args?: string[]) =>
  translate(languages.find((language) => language.id === 'pl')!, text, args);

async function loadState(signal: AbortSignal): Promise<State> {
  const auth = await fetch('/api/auth/me', { cache: 'no-store', signal });
  if (auth.status === 401) return { status: 'guest' };
  if (!auth.ok) throw new Error('Nie udało się sprawdzić sesji.');
  const me = await auth.json();
  if (!me.user) return { status: 'guest' };
  if (!me.admin) return { status: 'forbidden', user: me.user };
  const response = await fetch('/api/admin/overview', {
    cache: 'no-store',
    signal,
  });
  if (response.status === 401) return { status: 'guest' };
  if (response.status === 403) return { status: 'forbidden', user: me.user };
  if (!response.ok) throw new Error('Nie udało się pobrać danych.');
  return { status: 'ready', user: me.user, overview: await response.json() };
}

export const AdminPage = () => {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [tab, setTab] = useState<Tab>('overview');
  const [range, setRange] = useState<Range>(14);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setRefreshing(true);
    try {
      const next = await loadState(controller.signal);
      if (controller.signal.aborted) return;
      setState(next);
      setError('');
      if (next.status === 'ready') setUpdated(new Date());
    } catch {
      if (controller.signal.aborted) return;
      setError(
        'Nie udało się odświeżyć danych. Sprawdź połączenie i spróbuj ponownie.'
      );
      setState((previous) =>
        previous.status === 'ready' ? previous : { status: 'error' }
      );
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Admin · FACEIT Banner Studio';
    void refresh();
    return () => {
      document.title = previousTitle;
      request.current?.abort();
      request.current = null;
    };
  }, [refresh]);
  useEffect(() => {
    if (!autoRefresh || state.status !== 'ready' || loggingOut) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, state.status, loggingOut, refresh]);
  const logout = async () => {
    setLoggingOut(true);
    request.current?.abort();
    request.current = null;
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error();
      setAutoRefresh(false);
      setState({ status: 'guest' });
    } catch {
      setError('Nie udało się wylogować. Spróbuj ponownie.');
    } finally {
      setLoggingOut(false);
      setRefreshing(false);
    }
  };
  if (state.status === 'guest') return <Navigate to="/" replace />;
  const active = ADMIN_TABS.find((entry) => entry.id === tab)!;
  return (
    <LanguageContext.Provider value={tl}>
      <div className="admin-shell">
        <AdminNavigation
          tab={tab}
          setTab={setTab}
          user={
            state.status === 'ready' || state.status === 'forbidden'
              ? state.user
              : null
          }
          logout={() => void logout()}
          loggingOut={loggingOut}
        />
        <main className="admin-main">
          <div className="admin-utility">
            <span>
              Studio <span>/</span> Panel administratora <span>/</span>{' '}
              <b>{active.label}</b>
            </span>
            <div className="admin-account">
              {(state.status === 'ready' || state.status === 'forbidden') && (
                <>
                  <Player user={state.user} />
                  <button
                    type="button"
                    aria-label="Wyloguj"
                    title="Wyloguj"
                    disabled={loggingOut}
                    onClick={() => void logout()}
                  >
                    <StudioIcon name="back" />
                  </button>
                </>
              )}
            </div>
          </div>
          <header className="admin-top">
            <div>
              <p className="admin-eyebrow">Panel administratora</p>
              <h1>{active.label}</h1>
              <p className="admin-lead">{active.lead}</p>
            </div>
            {state.status === 'ready' && (
              <div className="admin-top-actions">
                <small>
                  {updated &&
                    `Aktualizacja: ${updated.toLocaleTimeString('pl-PL')}`}
                </small>
                <button
                  type="button"
                  className="admin-primary"
                  onClick={() => void refresh()}
                  disabled={refreshing || loggingOut}
                >
                  {refreshing ? 'Odświeżanie…' : 'Odśwież dane ↻'}
                </button>
              </div>
            )}
          </header>
          {error && (
            <div className="admin-error" role="alert">
              {error}
              {state.status === 'ready' &&
                ' Wyświetlane dane pochodzą z ostatniego udanego odświeżenia.'}
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={refreshing || loggingOut}
              >
                Spróbuj ponownie
              </button>
            </div>
          )}
          {state.status === 'loading' && (
            <div className="admin-loading" role="status">
              Ładowanie panelu…
              <div />
              <div />
              <div />
            </div>
          )}
          {state.status === 'forbidden' && (
            <section className="admin-card admin-gate">
              <h2>Brak dostępu</h2>
              <p>
                Konto <strong>{state.user.nickname}</strong> nie ma dostępu do
                panelu administratora.
              </p>
              <Link to="/">Wróć do generatora →</Link>
            </section>
          )}
          {state.status === 'ready' && (
            <>
              {tab === 'overview' && (
                <Dashboard
                  overview={state.overview}
                  range={range}
                  setRange={setRange}
                  setTab={setTab}
                />
              )}
              {tab === 'logins' && (
                <AdminLogins logins={state.overview.logins} />
              )}
              {tab === 'queue' && <AdminQueue user={state.user} />}
              {tab === 'gallery' && <AdminPublications />}
              {tab === 'images' && <AdminProfileImages />}
              {tab === 'system' && (
                <>
                  <AdminCatalog />
                  <SystemStatus overview={state.overview} />
                  <AdminCache />
                  <section className="admin-card admin-preferences">
                    <div>
                      <h2>Odświeżanie w tle</h2>
                      <p>
                        Pobieraj statystyki co 30 sekund, gdy karta przeglądarki
                        jest widoczna. Zgłoszenia odświeżysz osobno w ich
                        zakładce.
                      </p>
                    </div>
                    <label className="admin-toggle">
                      <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={(e) => setAutoRefresh(e.target.checked)}
                      />
                      Automatyczne odświeżanie
                    </label>
                  </section>
                  <section className="admin-card">
                    <h2>Zakres danych</h2>
                    <p>
                      Wykresy logowań obejmują ostatnie{' '}
                      {state.overview.activity?.days ?? 30} dni (UTC). Liczba
                      banerów online jest zapisywana co godzinę. Lista logowań
                      zawiera do 50 ostatnich wpisów, z datami w Twojej strefie
                      czasowej. Kafelek banerów pokazuje stan z chwili
                      aktualizacji.
                    </p>
                  </section>
                </>
              )}
              <footer className="admin-footer">
                <span>
                  FACEIT Banner Studio <span> / </span> Panel administratora
                </span>
                <span>
                  {autoRefresh
                    ? 'Automatyczne odświeżanie · 30 s'
                    : 'Odświeżanie ręczne'}
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      <CookieNotice placement="plain" />
    </LanguageContext.Provider>
  );
};

function SystemStatus({
  overview,
  compact = false,
}: {
  overview: Overview;
  compact?: boolean;
}) {
  return (
    <section className="admin-card admin-system">
      <div className="admin-section-head">
        <div>
          <h2>Przechowywanie danych</h2>
          <p>Aktualnie używane magazyny</p>
        </div>
        <StudioIcon name="cloud" />
      </div>
      {(
        [
          ['sessions', 'Sesje użytkowników'],
          ['logins', 'Historia logowań'],
        ] as const
      ).map(([key, label]) => {
        const persistent = ['postgres', 'redis'].includes(
          overview.storage[key]
        );
        return (
          <div className="admin-system-row" key={key}>
            <span
              className={`admin-status-dot ${persistent ? '' : 'is-warning'}`}
            />
            <span>
              {label}
              <small>{storageLabel(overview.storage[key])}</small>
            </span>
            <b>{persistent ? 'Zewnętrzny magazyn' : 'Tryb lokalny'}</b>
          </div>
        );
      })}
      {!compact && (
        <p className="admin-note">
          Dane przechowywane w pamięci lokalnej mogą zniknąć po restarcie
          serwera. To informacja o używanym magazynie, a nie pełny test
          dostępności usług.
        </p>
      )}
    </section>
  );
}

function Dashboard({
  overview,
  range,
  setRange,
  setTab,
}: {
  overview: Overview;
  range: Range;
  setRange: (range: Range) => void;
  setTab: (tab: Tab) => void;
}) {
  const series = (overview.activity?.series ?? []).slice(-range);
  const newestOnline = Date.parse(
    overview.onlineHistory?.series.at(-1)?.hour ?? ''
  );
  const onlineSeries = (overview.onlineHistory?.series ?? []).filter(
    (point) =>
      Number.isFinite(newestOnline) &&
      newestOnline - Date.parse(point.hour) < range * 24 * 60 * 60 * 1000
  );
  const onlinePeak = onlineSeries.reduce((best, point) =>
    point.online > best ? point.online : best
  , 0);
  const total = series.reduce((sum, point) => sum + point.count, 0);
  const peak = series.reduce<(typeof series)[number] | null>(
    (best, point) => (!best || point.count > best.count ? point : best),
    null
  );
  const recent = [...overview.logins]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 5);
  const metrics: {
    label: string;
    value: number | string;
    hint: string;
    icon: IconName;
  }[] = [
    {
      label: 'Banery online',
      value: overview.online ?? '—',
      hint:
        overview.online === null
          ? 'Licznik chwilowo niedostępny'
          : 'Aktywne w chwili aktualizacji',
      icon: 'monitor',
    },
    {
      label: 'Logowania',
      value: total,
      hint: `W wybranych ${range} dniach`,
      icon: 'layers',
    },
    {
      label: 'Unikalni gracze',
      value: overview.activity?.unique ?? 0,
      hint: `Ostatnie ${overview.activity?.days ?? 30} dni`,
      icon: 'stats',
    },
    {
      label: 'Historia logowań',
      value: overview.activity?.total ?? overview.logins.length,
      hint: 'Wszystkie zapisane wejścia',
      icon: 'cloud',
    },
  ];
  return (
    <>
      <div className="admin-section-head admin-period">
        <div>
          <h2>Aktywność studia</h2>
          <p>Dane rzeczywiste · dni bez aktywności mają wartość 0</p>
        </div>
        <div className="admin-range" role="group" aria-label="Zakres wykresu">
          {([7, 14, 30] as Range[]).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={range === value}
              onClick={() => setRange(value)}
            >
              {value} dni
            </button>
          ))}
        </div>
      </div>
      <section className="admin-tiles" aria-label="Statystyki">
        {metrics.map((metric) => (
          <article key={metric.label}>
            <div>
              <small>{metric.label}</small>
              <StudioIcon name={metric.icon} />
            </div>
            <strong>
              {typeof metric.value === 'number'
                ? metric.value.toLocaleString('pl-PL')
                : metric.value}
            </strong>
            <span>{metric.hint}</span>
          </article>
        ))}
      </section>
      <div className="admin-charts">
        <AdminChart
          title="Banery online w czasie"
          hint="Najwyższa liczba otwartych banerów w danej godzinie UTC. Godzina bez pomiaru ma wartość 0."
          tone="online"
          column="Banery"
          summary={onlinePeak.toLocaleString('pl-PL')}
          points={onlineSeries.map((point) => ({
            key: point.hour,
            label: hourLabel(point.hour),
            value: point.online,
          }))}
        />
        <AdminChart
          title="Logowania dziennie"
          hint="Udane wejścia przez FACEIT · UTC"
          tone="count"
          column="Logowania"
          summary={total.toLocaleString('pl-PL')}
          points={series.map((point) => ({
            key: point.day,
            label: dayLabel(point.day),
            value: point.count,
          }))}
        />
        <AdminChart
          title="Gracze dziennie"
          hint="Różne konta każdego dnia · szczyt okresu"
          tone="players"
          column="Gracze"
          summary={Math.max(
            0,
            ...series.map((point) => point.players)
          ).toLocaleString('pl-PL')}
          points={series.map((point) => ({
            key: point.day,
            label: dayLabel(point.day),
            value: point.players,
          }))}
        />
      </div>
      <div className="admin-insights">
        <span>
          Średnio dziennie{' '}
          <b>
            {(series.length ? total / series.length : 0).toLocaleString(
              'pl-PL',
              { maximumFractionDigits: 1 }
            )}
          </b>
        </span>
        <span>
          Najaktywniejszy dzień{' '}
          <b>
            {peak && peak.count > 0
              ? new Date(`${peak.day}T00:00:00Z`).toLocaleDateString('pl-PL', {
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'UTC',
                })
              : '—'}
          </b>
        </span>
        <span>
          Dni z aktywnością{' '}
          <b>
            {series.filter((point) => point.count > 0).length} / {series.length}
          </b>
        </span>
      </div>
      <div className="admin-bottom-grid">
        <section className="admin-card">
          <div className="admin-section-head">
            <div>
              <h2>Ostatnie wejścia</h2>
              <p>Najnowsze logowania do studia</p>
            </div>
            <button
              type="button"
              className="admin-text-button"
              onClick={() => setTab('logins')}
            >
              Wszystkie logowania →
            </button>
          </div>
          <LoginRows rows={recent} />
        </section>
        <div>
          <SystemStatus overview={overview} compact />
          <section className="admin-card admin-shortcut">
            <StudioIcon name="message" />
            <h2>Głos społeczności</h2>
            <p>
              Sprawdź nowe pomysły i błędy. Zdecyduj, co trafi do kolejnej
              aktualizacji.
            </p>
            <button type="button" onClick={() => setTab('queue')}>
              Przejdź do zgłoszeń →
            </button>
          </section>
        </div>
      </div>
    </>
  );
}
