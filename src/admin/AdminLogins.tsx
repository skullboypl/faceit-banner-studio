import { useState } from 'react';
import { downloadLogins, formatDate, type Login } from './data';

export function Player({ user }: { user: Pick<Login, 'nickname' | 'avatar'> }) {
  return (
    <span className="admin-player">
      <span className="admin-avatar">
        {user.avatar ? (
          <img src={user.avatar} alt="" />
        ) : (
          user.nickname.slice(0, 2).toUpperCase()
        )}
      </span>
      <strong>{user.nickname}</strong>
    </span>
  );
}
export function LoginRows({ rows }: { rows: Login[] }) {
  return (
    <div className="admin-table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Gracz</th>
            <th scope="col">Adres IP</th>
            <th scope="col">Data logowania</th>
            <th scope="col">Profil</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((login, index) => (
              <tr key={`${login.guid}-${login.createdAt}-${index}`}>
                <td>
                  <Player user={login} />
                </td>
                <td className="admin-mono">
                  {login.ip ? (
                    <span
                      className="admin-private-ip"
                      tabIndex={0}
                      aria-label={`Adres IP: ${login.ip}`}
                    >
                      <span aria-hidden="true">{login.ip}</span>
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <time dateTime={login.createdAt}>
                    {formatDate(login.createdAt)}
                  </time>
                </td>
                <td>
                  <a
                    href={`https://www.faceit.com/en/players/${encodeURIComponent(login.nickname)}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Profil FACEIT: ${login.nickname}`}
                  >
                    FACEIT ↗
                  </a>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="admin-empty">
                Brak wpisów.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export function AdminLogins({ logins }: { logins: Login[] }) {
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('new');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const needle = query.trim().toLowerCase();
  const invalidDates = Boolean(from && to && from > to);
  const rows = logins
    .filter((login) => {
      const date = new Date(login.createdAt);
      const localDay = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return (
        !invalidDates &&
        (!needle ||
          [login.nickname, login.ip ?? '', login.guid].some((value) =>
            value.toLowerCase().includes(needle)
          )) &&
        (!from || localDay >= from) &&
        (!to || localDay <= to)
      );
    })
    .sort((a, b) =>
      sort === 'name'
        ? a.nickname.localeCompare(b.nickname, 'pl')
        : (sort === 'old' ? 1 : -1) *
          (Date.parse(a.createdAt) - Date.parse(b.createdAt))
    );
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages);
  const reset = () => {
    setQuery('');
    setFrom('');
    setTo('');
    setSort('new');
    setPage(1);
  };
  return (
    <section className="admin-card">
      <div className="admin-section-head">
        <div>
          <h2>Ostatnie logowania</h2>
          <p>Do 50 ostatnich wpisów. Filtry i eksport obejmują tę listę.</p>
        </div>
        <button
          type="button"
          onClick={() => downloadLogins(rows)}
          disabled={!rows.length}
        >
          Eksportuj CSV ↓
        </button>
      </div>
      <div className="admin-filters">
        <label className="admin-search">
          Szukaj gracza
          <input
            type="search"
            aria-label="Szukaj logowania"
            placeholder="Nick, adres IP lub FACEIT ID…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Od dnia
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Do dnia
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Sortowanie
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="new">Najnowsze</option>
            <option value="old">Najstarsze</option>
            <option value="name">Nazwa gracza A–Z</option>
          </select>
        </label>
      </div>
      <div className="admin-filter-summary">
        <span>
          Wyniki: <b>{rows.length}</b> / {logins.length}
        </span>
        {(query || from || to || sort !== 'new') && (
          <button type="button" onClick={reset}>
            Wyczyść filtry ×
          </button>
        )}
      </div>
      {invalidDates && (
        <p className="admin-error" role="alert">
          Data początkowa musi być wcześniejsza lub równa końcowej.
        </p>
      )}
      <LoginRows rows={rows.slice((current - 1) * size, current * size)} />
      <div className="admin-pagination">
        <label>
          Wierszy na stronę{' '}
          <select
            value={size}
            onChange={(e) => {
              setSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 25, 50].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <span>
          Strona {current} z {pages}
        </span>
        <button
          type="button"
          disabled={current === 1}
          onClick={() => setPage(current - 1)}
        >
          ← Poprzednia
        </button>
        <button
          type="button"
          disabled={current === pages}
          onClick={() => setPage(current + 1)}
        >
          Następna →
        </button>
      </div>
    </section>
  );
}
