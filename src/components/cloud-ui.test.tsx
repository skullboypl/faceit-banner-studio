import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../cloud/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../cloud/api')>()),
  listBanners: vi.fn(),
  createBanner: vi.fn(),
  updateBanner: vi.fn(),
  deleteBanner: vi.fn(),
}));

import * as api from '../cloud/api';
import { ConflictDialog } from './ConflictDialog';
import { DonateLink } from './DonateLink';
import { MyBannersPanel } from './MyBannersPanel';
import { SyncChip } from './SyncChip';
import { defaultSettings, renderWithApp } from './test-utils';

const listBanners = vi.mocked(api.listBanners);
const createBanner = vi.mocked(api.createBanner);
const updateBanner = vi.mocked(api.updateBanner);
const deleteBanner = vi.mocked(api.deleteBanner);

const user = { guid: 'g1', nickname: 'tester', avatar: null };
const banner = (id: string, name: string, settings: Record<string, unknown> = { bannerRadius: 12 }) => ({
  id,
  name,
  settings,
  schemaVersion: 1,
  visibility: 'private' as const,
  createdAt: '2026-10-14T10:00:00.000Z',
  updatedAt: '2026-10-14T10:00:00.000Z',
});

beforeEach(() => {
  vi.resetAllMocks();
  listBanners.mockResolvedValue({ banners: [banner('1', 'Main'), banner('2', 'Stream')], limit: 25 });
});

afterEach(() => vi.restoreAllMocks());

describe('SyncChip', () => {
  const chip = (state: Parameters<typeof SyncChip>[0]['state'], signedIn = true, lastSavedAt: number | null = null) =>
    renderWithApp(<SyncChip state={state} lastSavedAt={lastSavedAt} user={signedIn ? user : null} />);

  test('shows a login call to action for guests', () => {
    chip('idle', false);
    expect(screen.getByText('Zaloguj się, by zapisywać w chmurze')).toBeTruthy();
    expect(screen.getByRole('link', { name: /FACEIT/ }).getAttribute('href')).toBe('/api/auth/login');
  });

  test('shows Zapisywanie… and then Zsynchronizowano', () => {
    const view = chip('saving');
    expect(screen.getByText('Zapisywanie…')).toBeTruthy();
    view.unmount();
    chip('saved', true, Date.now());
    expect(screen.getByText(/Zsynchronizowano/)).toBeTruthy();
  });

  test('shows offline and the re-login prompt', () => {
    const view = chip('offline');
    expect(screen.getByText('Offline — zmiany czekają')).toBeTruthy();
    view.unmount();
    chip('unauthorized');
    expect(screen.getByRole('link', { name: 'Zaloguj się ponownie' })).toBeTruthy();
  });
});

describe('DonateLink', () => {
  test('points to the donation page and opens it safely', () => {
    renderWithApp(<DonateLink variant="footer" />);
    const link = screen.getByRole('link', { name: /Wesprzyj projekt/ });
    expect(link.getAttribute('href')).toBe('https://donate.skullmedia.pl');
    expect(link.getAttribute('rel')).toContain('noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
  });
});

describe('ConflictDialog', () => {
  test('offers cloud and local settings', () => {
    const conflict = { cloud: {}, useCloud: vi.fn(), keepLocal: vi.fn() };
    renderWithApp(<ConflictDialog conflict={conflict} />);
    fireEvent.click(screen.getByRole('button', { name: 'Wczytaj z konta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zostaw lokalne' }));
    expect(conflict.useCloud).toHaveBeenCalledTimes(1);
    expect(conflict.keepLocal).toHaveBeenCalledTimes(1);
  });

  test('renders nothing without a conflict', () => {
    renderWithApp(<ConflictDialog conflict={null} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('MyBannersPanel', () => {
  test('guests see a login call to action and no request is made', () => {
    renderWithApp(<MyBannersPanel user={null} />);
    expect(screen.getByRole('link', { name: /FACEIT/ }).getAttribute('href')).toBe('/api/auth/login');
    expect(listBanners).not.toHaveBeenCalled();
  });

  test('lists banners with the counter n / 25', async () => {
    renderWithApp(<MyBannersPanel user={user} />);
    expect(await screen.findByText('Main')).toBeTruthy();
    expect(screen.getByText('Stream')).toBeTruthy();
    expect(screen.getByText('2 / 25')).toBeTruthy();
  });

  test('save-as sends the current settings as a delta and lists the new banner', async () => {
    const settings = { ...defaultSettings(), bannerRadius: 20, bannerRadiusCustom: true };
    createBanner.mockResolvedValue({ banner: banner('3', 'Nowy') });
    renderWithApp(<MyBannersPanel user={user} />, settings);
    await screen.findByText('Main');
    fireEvent.change(screen.getByPlaceholderText('Nazwa banera'), { target: { value: 'Nowy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz jako…' }));
    await screen.findByText('Nowy');
    expect(createBanner).toHaveBeenCalledWith('Nowy', { bannerRadius: 20, bannerRadiusCustom: true });
    expect(screen.getByText('3 / 25')).toBeTruthy();
  });

  test('save-as with a duplicate name shows the server message', async () => {
    createBanner.mockRejectedValue(new api.ApiError(409, 'duplicate_name', 'a banner with this name already exists'));
    renderWithApp(<MyBannersPanel user={user} />);
    await screen.findByText('Main');
    fireEvent.change(screen.getByPlaceholderText('Nazwa banera'), { target: { value: 'Main' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz jako…' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('a banner with this name already exists');
  });

  test('save-as is disabled at the limit', async () => {
    listBanners.mockResolvedValue({ banners: [banner('1', 'Main')], limit: 1 });
    renderWithApp(<MyBannersPanel user={user} />);
    await screen.findByText('Main');
    fireEvent.change(screen.getByPlaceholderText('Nazwa banera'), { target: { value: 'More' } });
    expect((screen.getByRole('button', { name: 'Zapisz jako…' }) as HTMLButtonElement).disabled).toBe(true);
  });

  test('overwrite sends the current settings as a delta', async () => {
    const settings = { ...defaultSettings(), bannerRadius: 8, bannerRadiusCustom: true };
    updateBanner.mockResolvedValue({ banner: banner('1', 'Main', { bannerRadius: 8, bannerRadiusCustom: true }) });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithApp(<MyBannersPanel user={user} />, settings);
    await screen.findByText('Main');
    fireEvent.click(screen.getAllByRole('button', { name: 'Nadpisz aktualnymi' })[0]);
    await waitFor(() =>
      expect(updateBanner).toHaveBeenCalledWith('1', { settings: { bannerRadius: 8, bannerRadiusCustom: true } })
    );
  });

  test('rename sends only the new name', async () => {
    updateBanner.mockResolvedValue({ banner: banner('1', 'Renamed') });
    renderWithApp(<MyBannersPanel user={user} />);
    await screen.findByText('Main');
    fireEvent.click(screen.getAllByRole('button', { name: 'Zmień nazwę' })[0]);
    fireEvent.change(screen.getByDisplayValue('Main'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz nazwę' }));
    await waitFor(() => expect(updateBanner).toHaveBeenCalledWith('1', { name: 'Renamed' }));
    expect(await screen.findByText('Renamed')).toBeTruthy();
  });

  test('delete asks for confirmation first', async () => {
    deleteBanner.mockResolvedValue({ ok: true });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWithApp(<MyBannersPanel user={user} />);
    await screen.findByText('Main');
    fireEvent.click(screen.getAllByRole('button', { name: 'Usuń' })[0]);
    expect(confirm).toHaveBeenCalled();
    expect(deleteBanner).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getAllByRole('button', { name: 'Usuń' })[0]);
    await waitFor(() => expect(deleteBanner).toHaveBeenCalledWith('1'));
    await waitFor(() => expect(screen.queryByText('Main')).toBeNull());
  });

  test('load applies the banner settings on top of the defaults', async () => {
    const { set } = renderWithApp(<MyBannersPanel user={user} />);
    await screen.findByText('Main');
    fireEvent.click(screen.getAllByRole('button', { name: 'Wczytaj' })[0]);
    expect(set).toHaveBeenCalledWith('bannerRadius', 12);
    // a key the banner does not mention is reset to its default
    expect(set).toHaveBeenCalledWith('bannerWidthMode', 'recommended');
  });
});
