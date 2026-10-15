import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { renderWithApp } from '../components/test-utils';
import type { ReviewFilter, ReviewImage } from '../profile/images';
import { AdminProfileImages } from './AdminProfileImages';

const row = (overrides: Partial<ReviewImage> = {}): ReviewImage => ({
  id: 'img-1',
  ownerGuid: 'guid-alice',
  nickname: 'alice',
  kind: 'avatar',
  status: 'pending',
  url: 'https://fbstorage.vxh.pl/pf/avatar/aa.webp',
  width: 512,
  height: 512,
  rejectReason: null,
  reports: 0,
  createdAt: '2026-10-15T10:00:00.000Z',
  ...overrides,
});

const make = (rows: ReviewImage[] = [row()]) => ({
  list: vi.fn(async (filter: ReviewFilter) => (filter ? rows : [])),
  review: vi.fn(async () => undefined),
});

describe('AdminProfileImages', () => {
  test('lists who uploaded what with the picture, the kind and the report count', async () => {
    const api = make([row({ reports: 2, status: 'hidden' })]);
    renderWithApp(<AdminProfileImages api={api} />);
    expect(await screen.findByText('alice')).toBeTruthy();
    expect(screen.getByText('Zgłoszeń: 2')).toBeTruthy();
    expect(screen.getByRole('img', { name: /alice/ }).getAttribute('src')).toBe('https://fbstorage.vxh.pl/pf/avatar/aa.webp');
  });

  test('opens on the waiting queue and switches between the queues', async () => {
    const api = make();
    renderWithApp(<AdminProfileImages api={api} />);
    await screen.findByText('alice');
    expect(api.list).toHaveBeenCalledWith('pending');
    fireEvent.click(screen.getByRole('button', { name: 'Zgłoszone' }));
    await waitFor(() => expect(api.list).toHaveBeenCalledWith('reported'));
  });

  test('says when a queue is empty', async () => {
    renderWithApp(<AdminProfileImages api={make([])} />);
    expect(await screen.findByText('Brak zdjęć w tej kolejce.')).toBeTruthy();
  });

  test('approving sends the decision and removes the row', async () => {
    const api = make();
    renderWithApp(<AdminProfileImages api={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Zatwierdź' }));
    await waitFor(() => expect(api.review).toHaveBeenCalledWith('img-1', 'approve', undefined));
    await waitFor(() => expect(screen.queryByText('alice')).toBeNull());
  });

  test('rejecting asks for a reason first, then sends it', async () => {
    const api = make();
    renderWithApp(<AdminProfileImages api={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Odrzuć' }));
    expect(api.review).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Powód odrzucenia (widzi go właściciel)'), { target: { value: 'Not a photo of you' } });
    fireEvent.click(screen.getByRole('button', { name: 'Odrzuć' }));
    await waitFor(() => expect(api.review).toHaveBeenCalledWith('img-1', 'reject', 'Not a photo of you'));
  });

  test('removing sends the decision', async () => {
    const api = make([row({ status: 'approved' })]);
    renderWithApp(<AdminProfileImages api={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Usuń' }));
    await waitFor(() => expect(api.review).toHaveBeenCalledWith('img-1', 'remove', undefined));
  });

  test('a failed decision keeps the row and says so', async () => {
    const api = make();
    api.review.mockRejectedValueOnce(new Error('boom'));
    renderWithApp(<AdminProfileImages api={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Zatwierdź' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('alice')).toBeTruthy();
  });
});
