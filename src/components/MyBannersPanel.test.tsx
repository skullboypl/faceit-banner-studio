import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { SavedBanner } from '../cloud/api';
import { MyBannersPanel } from './MyBannersPanel';
import { defaultSettings, renderWithApp } from './test-utils';

vi.mock('../cloud/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../cloud/api')>()),
  listBanners: vi.fn(),
  createBanner: vi.fn(),
  updateBanner: vi.fn(),
  deleteBanner: vi.fn(),
}));

import { deleteBanner, listBanners } from '../cloud/api';

const banner = (id: string, name: string, settings: Record<string, unknown>): SavedBanner => ({
  id,
  name,
  settings,
  schemaVersion: 1,
  visibility: 'private',
  createdAt: '2026-10-15T10:00:00.000Z',
  updatedAt: '2026-10-16T10:00:00.000Z',
});

const user = { guid: '11111111-1111-4111-8111-111111111111', nickname: 'tester', avatar: null };

beforeEach(() => {
  vi.mocked(listBanners).mockResolvedValue({
    limit: 25,
    banners: [
      banner('a', 'Main look', { style: 'prime', playerId: '22222222-2222-4222-8222-222222222222' }),
      banner('b', 'Popup', { widgetMode: 'popup', playerId: '22222222-2222-4222-8222-222222222222' }),
    ],
  });
});

const open = async () => {
  const view = renderWithApp(<MyBannersPanel user={user} />, defaultSettings());
  await screen.findByText('Main look');
  return view;
};

describe('MyBannersPanel: a picture of each saved banner', () => {
  test('every banner has a small live preview of its own widget, switched off from counting and from the studio session', async () => {
    await open();
    const first = screen.getByTitle('Main look') as HTMLIFrameElement;
    const url = new URL(first.src);
    expect(url.pathname).toBe('/widget/');
    expect(url.searchParams.get('style')).toBe('prime');
    expect(url.searchParams.get('player_id')).toBe('22222222-2222-4222-8222-222222222222');
    expect(url.searchParams.get('presence')).toBe('off');
    expect(url.searchParams.get('intro')).toBe('false');
    expect(url.searchParams.get('save_session')).toBe('false');
    expect(url.searchParams.get('thumb')).toBe('true');
  });

  test('the preview is laid out like the real banner and shrunk into the card', async () => {
    await open();
    const main = screen.getByTitle('Main look') as HTMLIFrameElement;
    expect(Number(main.getAttribute('width'))).toBeGreaterThan(200);
    expect(main.style.width).toBe(`${main.getAttribute('width')}px`);
    expect(main.style.height).toBe(`${main.getAttribute('height')}px`);
    expect(main.style.transform).toMatch(/^scale\(/);
    const popup = screen.getByTitle('Popup') as HTMLIFrameElement;
    expect(popup.getAttribute('width')).toBe('1920');
    expect(popup.getAttribute('height')).toBe('1080');
    expect(popup.style.width).toBe('1920px');
    expect(popup.style.height).toBe('1080px');
    expect(new URL(popup.src).searchParams.get('popup_preview')).toBe('pre');
    expect(new URL(popup.src).searchParams.get('thumb')).toBe('true');
  });

  test('a roster preview is only as tall as its players, not the five-row OBS slot', async () => {
    vi.mocked(listBanners).mockResolvedValue({
      limit: 25,
      banners: [banner('t', 'boty squad', { widgetMode: 'team', style: 'lineup', teamRoster: 'SkullBoy,SweetGrandpa' })],
    });
    renderWithApp(<MyBannersPanel user={user} />, defaultSettings());
    const frame = (await screen.findByTitle('boty squad')) as HTMLIFrameElement;
    expect(Number(frame.getAttribute('height'))).toBeLessThan(280);
    expect(frame.style.transform).toMatch(/^scale\(/);
    expect(new URL(frame.src).searchParams.get('banner_height_mode')).toBe('recommended');
  });

  test('a banner saved without a player is previewed with the player of the studio', async () => {
    vi.mocked(listBanners).mockResolvedValue({ limit: 25, banners: [banner('c', 'No player', { style: 'prime' })] });
    renderWithApp(<MyBannersPanel user={user} />, { ...defaultSettings(), playerId: '33333333-3333-4333-8333-333333333333' } as never);
    const frame = (await screen.findByTitle('No player')) as HTMLIFrameElement;
    expect(new URL(frame.src).searchParams.get('player_id')).toBe('33333333-3333-4333-8333-333333333333');
  });
});

describe('MyBannersPanel: coloured buttons with icons', () => {
  test('each action has an icon and its own colour', async () => {
    await open();
    const row = screen.getByText('Main look').closest('li')!;
    for (const [name, tone] of [['Wczytaj', 'load'], ['Generuj link OBS', 'obs'], ['Zmień nazwę', 'rename'], ['Nadpisz aktualnymi', 'overwrite'], ['Opublikuj', 'publish'], ['Usuń', 'delete']] as const) {
      const button = within(row).getByRole('button', { name });
      expect(button.className, name).toContain(`is-${tone}`);
      expect(button.querySelector('svg.studio-icon'), name).toBeTruthy();
    }
  });

  test('"Zapisz jako…" has an icon too', async () => {
    await open();
    const save = screen.getByRole('button', { name: 'Zapisz jako…' });
    expect(save.querySelector('svg.studio-icon')).toBeTruthy();
  });

  test('Generuj link OBS opens the widget URL of that saved banner', async () => {
    const onGenerateObs = vi.fn();
    const view = renderWithApp(<MyBannersPanel user={user} onGenerateObs={onGenerateObs} />, defaultSettings());
    await screen.findByText('Main look');
    fireEvent.click(within(screen.getByText('Main look').closest('li')!).getByRole('button', { name: 'Generuj link OBS' }));
    expect(onGenerateObs).toHaveBeenCalledTimes(1);
    expect(String(onGenerateObs.mock.calls[0][0])).toContain('/widget/');
    view.unmount();
  });

  test('Opublikuj asks for a title and a description', async () => {
    await open();
    const row = screen.getByText('Main look').closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Opublikuj' }));
    expect(within(row).getByLabelText('Tytuł')).toBeTruthy();
    expect(within(row).getByLabelText('Opis')).toBeTruthy();
    expect(within(row).getByRole('button', { name: 'Wyślij do weryfikacji' })).toBeTruthy();
  });

  test('the actions still work: loading applies the banner, deleting asks first and removes it', async () => {
    vi.mocked(deleteBanner).mockResolvedValue({ ok: true });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { set } = await open();
    const row = screen.getByText('Popup').closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Wczytaj' }));
    expect(set).toHaveBeenCalledWith('widgetMode', 'popup');
    fireEvent.click(within(row).getByRole('button', { name: 'Usuń' }));
    await waitFor(() => expect(screen.queryByText('Popup')).toBeNull());
  });
});
