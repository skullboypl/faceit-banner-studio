import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { AccountMenu } from './AccountMenu';
import { LanguageSelect } from './LanguageSelect';
import { renderWithApp } from './test-utils';

const user = { guid: 'g1', nickname: 'skullboy', avatar: 'https://example.test/a.png' };

const account = (overrides: Partial<Parameters<typeof AccountMenu>[0]> = {}) =>
  renderWithApp(
    <AccountMenu
      user={user}
      admin={false}
      syncState="saved"
      lastSavedAt={null}
      onOpenBanners={vi.fn()}
      onLogout={vi.fn()}
      {...overrides}
    />
  );

describe('AccountMenu', () => {
  test('guests get a login link to FACEIT and no menu', () => {
    account({ user: null });
    expect(screen.getByRole('link', { name: /Zaloguj przez FACEIT/ }).getAttribute('href')).toBe('/api/auth/login');
    expect(screen.queryByRole('button', { name: /skullboy/ })).toBeNull();
  });

  test('shows the avatar and nickname on the trigger', () => {
    account();
    const trigger = screen.getByRole('button', { name: /skullboy/ });
    expect(trigger.textContent).toContain('skullboy');
    expect(trigger.querySelector('img')?.getAttribute('src')).toBe('https://example.test/a.png');
  });

  test('falls back to the first letter when there is no avatar', () => {
    account({ user: { ...user, avatar: null } });
    expect(screen.getByRole('button', { name: /skullboy/ }).textContent).toContain('S');
  });

  test('opens on click and closes on Escape and on an outside click', () => {
    account();
    const trigger = screen.getByRole('button', { name: /skullboy/ });
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  test('my banners and logout call back and close the menu', () => {
    const onOpenBanners = vi.fn();
    const onLogout = vi.fn();
    account({ onOpenBanners, onLogout });
    fireEvent.click(screen.getByRole('button', { name: /skullboy/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Moje banery' }));
    expect(onOpenBanners).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /skullboy/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Wyloguj' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  test('the admin link appears only for admins', () => {
    const view = account({ admin: false });
    fireEvent.click(screen.getByRole('button', { name: /skullboy/ }));
    expect(screen.queryByRole('menuitem', { name: 'Panel admina' })).toBeNull();
    view.unmount();
    account({ admin: true });
    fireEvent.click(screen.getByRole('button', { name: /skullboy/ }));
    expect(screen.getByRole('menuitem', { name: 'Panel admina' }).getAttribute('href')).toBe('/admin');
  });

  test('shows the sync state inside the menu and as a status dot on the trigger', () => {
    account({ syncState: 'offline' });
    expect(screen.getByRole('button', { name: /skullboy/ }).querySelector('.account-dot--offline')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /skullboy/ }));
    expect(screen.getByText('Offline — zmiany czekają')).toBeTruthy();
  });
});

describe('LanguageSelect', () => {
  const languages = [
    { id: 'en', name: 'English', translations: {} },
    { id: 'pl', name: 'Polski', translations: {} },
    { id: 'de', name: 'Deutsch', translations: {} },
  ];
  const select = (onChange = vi.fn()) =>
    renderWithApp(<LanguageSelect languages={languages} current={languages[1]} onChange={onChange} />);

  test('shows the current language and lists all of them when opened', () => {
    select();
    const trigger = screen.getByRole('button', { name: /Język/ });
    expect(trigger.textContent).toContain('Polski');
    fireEvent.click(trigger);
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('option', { name: /Polski/ }).getAttribute('aria-selected')).toBe('true');
  });

  test('choosing a language calls back and closes the list', () => {
    const onChange = vi.fn();
    select(onChange);
    fireEvent.click(screen.getByRole('button', { name: /Język/ }));
    fireEvent.click(screen.getByRole('option', { name: /Deutsch/ }));
    expect(onChange).toHaveBeenCalledWith(languages[2]);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  test('Escape closes it without changing the language', () => {
    const onChange = vi.fn();
    select(onChange);
    fireEvent.click(screen.getByRole('button', { name: /Język/ }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
