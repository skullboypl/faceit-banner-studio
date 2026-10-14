import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LanguageContext } from '../generator/contexts';
import { languages, tl as translate } from '../translations/translations';
import { pickLanguage } from '../translations/detect';
import { AdminQueue } from './AdminQueue';

type User = { guid: string; nickname: string; avatar: string | null };
type Login = {
  guid: string;
  nickname: string;
  avatar: string | null;
  ip: string | null;
  createdAt: string;
};
type Overview = {
  online: number | null;
  storage: { sessions: string; logins: string };
  logins: Login[];
};

type State =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'forbidden'; user: User }
  | { status: 'ready'; user: User; overview: Overview };

const loadState = async (): Promise<State> => {
  const me = await fetch('/api/auth/me', { cache: 'no-store' }).then((r) =>
    r.json()
  );
  if (!me.user) return { status: 'guest' };
  if (!me.admin) return { status: 'forbidden', user: me.user };
  const response = await fetch('/api/admin/overview', { cache: 'no-store' });
  if (!response.ok) return { status: 'guest' };
  return { status: 'ready', user: me.user, overview: await response.json() };
};

export const AdminPage = () => {
  const [state, setState] = useState<State>({ status: 'loading' });

  const language = useMemo(
    () =>
      pickLanguage(
        {
          saved: localStorage.getItem('fcw_lang'),
          browser: navigator.languages?.length
            ? navigator.languages
            : [navigator.language],
        },
        languages
      ),
    []
  );
  const tl = useMemo(
    () => (text: string, args?: string[]) => translate(language, text, args),
    [language]
  );

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Admin · FACEIT Banner Studio';
    loadState()
      .then(setState)
      .catch(() => setState({ status: 'guest' }));
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setState({ status: 'guest' });
  };

  return (
    <LanguageContext.Provider value={tl}>
      <main className="admin-page">
        <header>
          <Link to="/">← Generator</Link>
          <h1>Panel admina</h1>
        </header>

        {state.status === 'loading' && <p>Ładowanie…</p>}

        {state.status === 'guest' && (
          <section className="admin-card">
            <p>Zaloguj się kontem FACEIT, żeby wejść do panelu.</p>
            <a className="admin-login" href="/api/auth/login">
              Zaloguj przez FACEIT
            </a>
          </section>
        )}

        {state.status === 'forbidden' && (
          <section className="admin-card">
            <p>
              Zalogowano jako <strong>{state.user.nickname}</strong>, ale to
              konto nie ma dostępu do panelu.
            </p>
            <button type="button" onClick={logout}>
              Wyloguj
            </button>
          </section>
        )}

        {state.status === 'ready' && (
          <>
            <section className="admin-card admin-user">
              {state.user.avatar && <img src={state.user.avatar} alt="" />}
              <span>{state.user.nickname}</span>
              <button type="button" onClick={logout}>
                Wyloguj
              </button>
            </section>
            <section className="admin-grid">
              <div className="admin-card">
                <small>Aktywne banery</small>
                <strong>{state.overview.online ?? '—'}</strong>
              </div>
              <div className="admin-card">
                <small>Sesje</small>
                <strong>{state.overview.storage.sessions}</strong>
              </div>
              <div className="admin-card">
                <small>Historia logowań</small>
                <strong>{state.overview.storage.logins}</strong>
              </div>
            </section>
            <section className="admin-card">
              <h2>Ostatnie logowania</h2>
              <table>
                <thead>
                  <tr>
                    <th>Gracz</th>
                    <th>IP</th>
                    <th>Kiedy</th>
                  </tr>
                </thead>
                <tbody>
                  {state.overview.logins.map((login, index) => (
                    <tr key={`${login.guid}-${index}`}>
                      <td>{login.nickname}</td>
                      <td>{login.ip ?? '—'}</td>
                      <td>
                        {new Date(login.createdAt).toLocaleString('pl-PL')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <AdminQueue />
          </>
        )}
      </main>
    </LanguageContext.Provider>
  );
};
