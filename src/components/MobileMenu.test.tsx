import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { MobileMenu } from './MobileMenu';
import { renderWithApp } from './test-utils';

const languages = [
  { id: 'en', name: 'English', translations: {} },
  { id: 'pl', name: 'Polski', translations: {} },
  { id: 'de', name: 'Deutsch', translations: {} },
];
const tabs = [
  { name: 'Ustawienia', icon: 'settings' as const },
  { name: 'Wygląd', icon: 'palette' as const },
  { name: 'Statystyki', icon: 'stats' as const },
  { name: 'Moje banery', icon: 'cloud' as const },
];
const user = { guid: 'g1', nickname: 'skullboy', avatar: null };

const menu = (overrides: Partial<Parameters<typeof MobileMenu>[0]> = {}) => {
  const props = {
    open: true,
    onClose: vi.fn(),
    tabs,
    selectedIndex: 0,
    onSelectTab: vi.fn(),
    languages,
    currentLanguage: languages[1],
    onLanguage: vi.fn(),
    user: null,
    admin: false,
    syncState: 'idle' as const,
    lastSavedAt: null,
    onLogout: vi.fn(),
    onOpenProfile: vi.fn(),
    liveStreamerCount: 2,
    onlineBannerCount: 7,
    ...overrides,
  };
  return { props, ...renderWithApp(<MobileMenu {...props} />) };
};

describe('MobileMenu', () => {
  test('renders nothing while closed', () => {
    menu({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('is a full-screen dialog with every section', () => {
    menu();
    const dialog = screen.getByRole('dialog', { name: 'Menu' });
    expect(within(dialog).getByRole('button', { name: 'Moje banery' })).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: /Visual eXtras Hub/ }).getAttribute('href')).toBe('https://vxh.pl/');
    expect(within(dialog).getByRole('link', { name: /Dokumentacja/ }).getAttribute('href')).toBe('/docs/');
    expect(within(dialog).getByRole('link', { name: /Nasi streamerzy/ }).textContent).toContain('2 online');
    expect(within(dialog).getByRole('link', { name: /Ranking ELO na żywo/ }).getAttribute('href')).toBe('/live');
    expect(within(dialog).getByRole('link', { name: /Ranking ELO na żywo/ }).textContent).toContain('7');
    expect(within(dialog).getByRole('link', { name: /Wesprzyj projekt/ }).getAttribute('href')).toBe(
      'https://donate.skullmedia.pl'
    );
  });

  test('picking a tab selects it and closes the menu', () => {
    const { props } = menu();
    fireEvent.click(screen.getByRole('button', { name: 'Moje banery' }));
    expect(props.onSelectTab).toHaveBeenCalledWith(3);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  test('marks the current tab', () => {
    menu({ selectedIndex: 1 });
    expect(screen.getByRole('button', { name: 'Wygląd' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Ustawienia' }).getAttribute('aria-current')).toBeNull();
  });

  test('lists every language and changes it', () => {
    const { props } = menu();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: /Polski/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: /Deutsch/ }));
    expect(props.onLanguage).toHaveBeenCalledWith(languages[2]);
  });

  test('guests get the FACEIT login button', () => {
    menu();
    expect(screen.getByRole('link', { name: /Zaloguj przez FACEIT/ }).getAttribute('href')).toBe('/api/auth/login');
  });

  test('a logged-in user sees the nickname, sync state and can log out', () => {
    const { props } = menu({ user, syncState: 'saved' });
    expect(screen.getByText('skullboy')).toBeTruthy();
    expect(screen.getByText(/Zsynchronizowano/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Wyloguj' }));
    expect(props.onLogout).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalled();
  });

  test('the admin link appears only for admins', () => {
    const view = menu({ user, admin: false });
    expect(screen.queryByRole('link', { name: 'Panel admina' })).toBeNull();
    view.unmount();
    menu({ user, admin: true });
    expect(screen.getByRole('link', { name: 'Panel admina' }).getAttribute('href')).toBe('/admin');
  });

  test('closes with the close button and with Escape', () => {
    const { props } = menu();
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij menu' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  test('locks page scrolling while open and restores it afterwards', () => {
    const view = menu();
    expect(document.body.style.overflow).toBe('hidden');
    view.unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
