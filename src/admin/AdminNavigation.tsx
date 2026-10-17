import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { StudioBrand } from '../components/StudioBrand';
import { StudioIcon, type IconName } from '../components/StudioIcon';
import { Player } from './AdminLogins';
import type { AdminUser } from './data';

export type AdminTab = 'overview' | 'logins' | 'queue' | 'gallery' | 'images' | 'system';
export const ADMIN_TABS: {
  id: AdminTab;
  label: string;
  icon: IconName;
  lead: string;
}[] = [
  {
    id: 'overview',
    label: 'Przegląd',
    icon: 'stats',
    lead: 'Aktywność graczy i banerów w jednym miejscu.',
  },
  {
    id: 'logins',
    label: 'Logowania',
    icon: 'layers',
    lead: 'Przeglądaj ostatnie wejścia przez FACEIT i eksportuj wybrane wpisy.',
  },
  {
    id: 'queue',
    label: 'Zgłoszenia',
    icon: 'message',
    lead: 'Porządkuj pomysły społeczności i zgłoszone błędy.',
  },
  {
    id: 'gallery',
    label: 'Banery publiczne',
    icon: 'layers',
    lead: 'Zatwierdzaj banery zgłoszone do publicznej galerii.',
  },
  {
    id: 'images',
    label: 'Grafiki',
    icon: 'palette',
    lead: 'Zatwierdzaj, odrzucaj i usuwaj własne avatary i tła graczy.',
  },
  {
    id: 'system',
    label: 'System',
    icon: 'settings',
    lead: 'Sprawdź sposób przechowywania danych i ustaw odświeżanie panelu.',
  },
];
const links: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Otwórz generator', icon: 'monitor' },
  { href: '/live', label: 'Ranking na żywo', icon: 'stats' },
  { href: '/docs/', label: 'Dokumentacja', icon: 'book' },
];

export function AdminNavigation({
  tab,
  setTab,
  user,
  logout,
  loggingOut,
}: {
  tab: AdminTab;
  setTab: (tab: AdminTab) => void;
  user: AdminUser | null;
  logout: () => void;
  loggingOut: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const sheet = dialog.current!;
    sheet.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const media = window.matchMedia('(min-width: 701px)');
    const onResize = () => {
      if (media.matches) setOpen(false);
    };
    media.addEventListener('change', onResize);
    return () => {
      sheet.close();
      document.body.style.overflow = previous;
      media.removeEventListener('change', onResize);
    };
  }, [open]);
  const select = (id: AdminTab) => {
    close();
    setTab(id);
  };
  return (
    <>
      <aside className="admin-side">
        <StudioBrand />
        <p className="admin-nav-label">Panel administratora</p>
        <nav className="admin-nav" aria-label="Panel admina">
          {ADMIN_TABS.map(({ id, label, icon }, index) => (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              data-overflow={index >= 3 || undefined}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
            >
              <StudioIcon name={icon} />
              <span>{label}</span>
              <StudioIcon name="chevron" />
            </button>
          ))}
          <button
            ref={trigger}
            type="button"
            className="admin-menu-toggle"
            aria-label="Otwórz menu"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-current={tab === 'system' ? 'page' : undefined}
            onClick={() => setOpen(true)}
          >
            <StudioIcon name="menu" />
            <span>Menu</span>
          </button>
        </nav>
        <div className="admin-side-links">
          {links.map((link) =>
            link.href === '/docs/' ? (
              <a
                key={link.href}
                href={link.href}
                title={link.label}
                aria-label={link.label}
              >
                <StudioIcon name={link.icon} />
                <span>{link.label}</span>
              </a>
            ) : (
              <Link
                key={link.href}
                to={link.href}
                title={link.label}
                aria-label={link.label}
              >
                <StudioIcon name={link.icon} />
                <span>{link.label}</span>
              </Link>
            )
          )}
        </div>
        <div className="admin-side-note">
          <span className="admin-eyebrow">CS2</span>
          <p>Zarządzaj aktywnością studia i zgłoszeniami społeczności.</p>
          <small>by Skull</small>
        </div>
      </aside>
      {open && (
        <dialog
          ref={dialog}
          className="mobile-menu admin-mobile-menu"
          aria-label="Menu administratora"
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
        >
          <div className="mobile-menu-head">
            <strong>Menu</strong>
            <button
              type="button"
              autoFocus
              aria-label="Zamknij menu"
              onClick={close}
            >
              <StudioIcon name="close" />
            </button>
          </div>
          <div className="mobile-menu-body">
            <section className="mobile-menu-section">
              <h3>Panel administratora</h3>
              {ADMIN_TABS.map(({ id, label, icon }) => (
                <button
                  key={id}
                  type="button"
                  className="mobile-menu-item"
                  aria-current={tab === id ? 'page' : undefined}
                  onClick={() => select(id)}
                >
                  <StudioIcon name={icon} />
                  <span>{label}</span>
                </button>
              ))}
            </section>
            <section className="mobile-menu-section">
              <h3>Studio</h3>
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="mobile-menu-item"
                >
                  <StudioIcon name={link.icon} />
                  <span>{link.label}</span>
                </a>
              ))}
            </section>
            {user && (
              <section className="mobile-menu-section">
                <h3>Konto</h3>
                <Player user={user} />
                <button
                  type="button"
                  className="mobile-menu-item mobile-menu-item--danger"
                  disabled={loggingOut}
                  onClick={() => {
                    close();
                    logout();
                  }}
                >
                  <StudioIcon name="back" />
                  <span>Wyloguj</span>
                </button>
              </section>
            )}
          </div>
        </dialog>
      )}
    </>
  );
}
