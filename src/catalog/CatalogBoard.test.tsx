import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { renderWithApp } from '../components/test-utils';
import { CatalogBoard } from './CatalogBoard';

vi.mock('./api', () => ({
  listCatalog: vi.fn(),
  listMinePublications: vi.fn(),
  votePublication: vi.fn(),
  withdrawPublication: vi.fn(),
}));

import { listCatalog, listMinePublications, votePublication } from './api';

const item = {
  id: 'pub-1',
  bannerId: 'ban-1',
  title: 'Night pulse',
  body: 'A round banner for the cam.',
  status: 'approved' as const,
  votes: 4,
  vote: 0 as const,
  settings: { style: 'pulse' },
  schemaVersion: 1,
  createdAt: '2026-10-17T10:00:00.000Z',
  author: 'SkullBoy',
};

const user = { guid: 'g1', nickname: 'tester', avatar: null };

beforeEach(() => {
  vi.mocked(listCatalog).mockResolvedValue({ publications: [item], next: null });
  vi.mocked(listMinePublications).mockResolvedValue({
    publications: [{ ...item, id: 'pub-2', status: 'pending', title: 'Waiting halo', mine: true }],
  });
  vi.mocked(votePublication).mockResolvedValue({ votes: 5, vote: 1 });
});

describe('CatalogBoard: public gallery and your submissions', () => {
  test('shows published banners with author, description and reddit votes', async () => {
    renderWithApp(<CatalogBoard user={user} />);
    expect(await screen.findByText('Night pulse')).toBeTruthy();
    expect(screen.getByText('A round banner for the cam.')).toBeTruthy();
    expect(screen.getByText(/SkullBoy/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Plus' }));
    await waitFor(() => expect(votePublication).toHaveBeenCalledWith('pub-1', 1));
  });

  test('a missing publications list does not crash the public tab', async () => {
    vi.mocked(listCatalog).mockResolvedValue({} as never);
    renderWithApp(<CatalogBoard user={user} />);
    expect(await screen.findByText('Nie ma jeszcze publicznych banerów.')).toBeTruthy();
  });

  test('your list shows the review status', async () => {
    renderWithApp(<CatalogBoard user={user} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Twoje zgłoszenia' }));
    expect(await screen.findByText('Waiting halo')).toBeTruthy();
    expect(screen.getByText('Oczekuje')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Twoje zgłoszenia' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Lista publiczna' }).getAttribute('aria-selected')).toBe('false');
  });

  test('a guest sees a login CTA after clicking a vote', async () => {
    renderWithApp(<CatalogBoard user={null} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Plus' }));
    expect(screen.getByText('Zaloguj się przez FACEIT, żeby oceniać banery.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Zaloguj przez FACEIT' }).getAttribute('href')).toBe('/api/auth/login');
    expect(votePublication).not.toHaveBeenCalled();
  });

  test('Load this banner applies the look and opens settings', async () => {
    const onOpenSettings = vi.fn();
    const view = renderWithApp(<CatalogBoard user={user} onOpenSettings={onOpenSettings} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Załaduj ten baner' }));
    expect(view.set).toHaveBeenCalledWith('style', 'pulse');
    expect(view.set.mock.calls.some(([key]) => key === 'playerId')).toBe(false);
    expect(onOpenSettings).toHaveBeenCalled();
  });
});
