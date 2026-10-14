import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../feedback/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../feedback/api')>()),
  adminList: vi.fn(),
  adminSetStatus: vi.fn(),
  adminDeletePost: vi.fn(),
  adminExport: vi.fn(),
}));

import { renderWithApp } from '../components/test-utils';
import * as api from '../feedback/api';
import { AdminQueue } from './AdminQueue';

const adminList = vi.mocked(api.adminList);
const adminSetStatus = vi.mocked(api.adminSetStatus);
const adminDeletePost = vi.mocked(api.adminDeletePost);
const adminExport = vi.mocked(api.adminExport);

const post = (id: string, title: string, extra: Partial<api.FeedbackPost> = {}): api.FeedbackPost => ({
  id,
  kind: 'request',
  title,
  status: 'new',
  votes: 4,
  comments: 2,
  createdAt: '2026-10-14T10:00:00.000Z',
  author: 'alice',
  ...extra,
});
const row = (title: string) => screen.getByText(title).closest('li') as HTMLElement;

beforeEach(() => {
  vi.resetAllMocks();
  adminList.mockResolvedValue({ posts: [post('1', 'Dark theme'), post('2', 'Clipped glow', { kind: 'bug' })], next: null });
});
afterEach(() => vi.restoreAllMocks());

describe('AdminQueue', () => {
  test('lists posts with status new by default, with kind, author, votes and comments', async () => {
    renderWithApp(<AdminQueue />);
    await screen.findByText('Dark theme');
    expect(adminList).toHaveBeenLastCalledWith('new');
    expect(within(row('Clipped glow')).getByText('Błąd')).toBeTruthy();
    expect(within(row('Dark theme')).getByText(/alice/)).toBeTruthy();
    expect(within(row('Dark theme')).getByText('4')).toBeTruthy();
  });

  test('the status filter reloads the queue', async () => {
    renderWithApp(<AdminQueue />);
    await screen.findByText('Dark theme');
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'planned' } });
    await waitFor(() => expect(adminList).toHaveBeenLastCalledWith('planned'));
  });

  test('changing the status removes the post from the "new" queue', async () => {
    adminSetStatus.mockResolvedValue({ post: post('1', 'Dark theme', { status: 'planned' }) });
    renderWithApp(<AdminQueue />);
    await screen.findByText('Dark theme');
    fireEvent.change(within(row('Dark theme')).getByRole('combobox'), { target: { value: 'planned' } });
    await waitFor(() => expect(adminSetStatus).toHaveBeenCalledWith('1', 'planned'));
    await waitFor(() => expect(screen.queryByText('Dark theme')).toBeNull());
    expect(screen.getByText('Clipped glow')).toBeTruthy();
  });

  test('"Skopiuj dla Claude" puts the export in the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    adminExport.mockResolvedValue('# Dark theme\n\nbody');
    renderWithApp(<AdminQueue />);
    await screen.findByText('Dark theme');
    fireEvent.click(within(row('Dark theme')).getByRole('button', { name: /Skopiuj dla Claude/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('# Dark theme\n\nbody'));
    expect(await within(row('Dark theme')).findByText('Skopiowano')).toBeTruthy();
    expect(adminExport).toHaveBeenCalledWith('1');
  });

  test('delete asks for confirmation and then removes the row', async () => {
    adminDeletePost.mockResolvedValue({ ok: true });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWithApp(<AdminQueue />);
    await screen.findByText('Dark theme');
    fireEvent.click(within(row('Dark theme')).getByRole('button', { name: /Usuń zgłoszenie/ }));
    expect(adminDeletePost).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(within(row('Dark theme')).getByRole('button', { name: /Usuń zgłoszenie/ }));
    await waitFor(() => expect(adminDeletePost).toHaveBeenCalledWith('1'));
    await waitFor(() => expect(screen.queryByText('Dark theme')).toBeNull());
  });

  test('an empty queue says so', async () => {
    adminList.mockResolvedValue({ posts: [], next: null });
    renderWithApp(<AdminQueue />);
    expect(await screen.findByText('Nic do obsłużenia w tym statusie.')).toBeTruthy();
  });

  test('a server error is shown', async () => {
    adminList.mockRejectedValue(new Error('boom'));
    renderWithApp(<AdminQueue />);
    expect((await screen.findByRole('alert')).textContent).toContain('boom');
  });

  test('markup in a title is rendered as text', async () => {
    adminList.mockResolvedValue({ posts: [post('1', '<b>bold</b> idea')], next: null });
    const { container } = renderWithApp(<AdminQueue />);
    expect(await screen.findByText('<b>bold</b> idea')).toBeTruthy();
    expect(container.querySelector('b')).toBeNull();
  });
});
