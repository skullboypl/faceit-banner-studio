import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  listPosts: vi.fn(),
  createPost: vi.fn(),
  getPost: vi.fn(),
  deletePost: vi.fn(),
  vote: vi.fn(),
  addComment: vi.fn(),
  adminSetStatus: vi.fn(),
  adminDeletePost: vi.fn(),
  adminDeleteComment: vi.fn(),
  adminExport: vi.fn(),
}));

import { ApiError } from '../cloud/api';
import { defaultSettings, renderWithApp } from '../components/test-utils';
import * as api from './api';
import { FeedbackBoard } from './FeedbackBoard';

const listPosts = vi.mocked(api.listPosts);
const createPost = vi.mocked(api.createPost);
const getPost = vi.mocked(api.getPost);
const vote = vi.mocked(api.vote);
const addComment = vi.mocked(api.addComment);
const adminSetStatus = vi.mocked(api.adminSetStatus);
const adminDeletePost = vi.mocked(api.adminDeletePost);
const adminExport = vi.mocked(api.adminExport);

const alice = { guid: 'g-alice', nickname: 'alice', avatar: null };
const post = (id: string, title: string, extra: Partial<api.FeedbackPost> = {}): api.FeedbackPost => ({
  id,
  kind: 'request',
  title,
  status: 'new',
  votes: 3,
  comments: 1,
  createdAt: '2026-10-14T10:00:00.000Z',
  ...extra,
});
const memberPost = (id: string, title: string, extra: Partial<api.FeedbackPost> = {}) =>
  post(id, title, { author: 'bob', mine: false, voted: false, ...extra });
const detail = (base: api.FeedbackPost, extra: Partial<api.FeedbackDetail> = {}): api.FeedbackDetail => ({
  ...base,
  body: 'Full description of the post.',
  context: null,
  thread: [],
  ...extra,
});

beforeEach(() => {
  vi.resetAllMocks();
  listPosts.mockResolvedValue({ posts: [memberPost('1', 'Dark theme'), memberPost('2', 'Banner animations')], next: null });
});
afterEach(() => vi.restoreAllMocks());

describe('lists', () => {
  test('requests and bugs are separate lists', async () => {
    renderWithApp(<FeedbackBoard user={alice} admin={false} />);
    await screen.findByText('Dark theme');
    expect(listPosts).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'request' }));
    listPosts.mockResolvedValue({ posts: [memberPost('9', 'Clipped glow', { kind: 'bug' })], next: null });
    fireEvent.click(screen.getByRole('tab', { name: 'Błędy' }));
    await screen.findByText('Clipped glow');
    expect(listPosts).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'bug' }));
    expect(screen.queryByText('Dark theme')).toBeNull();
  });

  test('the status filter and the sort order are sent to the server', async () => {
    renderWithApp(<FeedbackBoard user={alice} admin={false} />);
    await screen.findByText('Dark theme');
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'planned' } });
    await waitFor(() => expect(listPosts).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'planned' })));
    fireEvent.change(screen.getByLabelText('Sortowanie'), { target: { value: 'new' } });
    await waitFor(() => expect(listPosts).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'new' })));
  });

  test('"Pokaż więcej" loads the next page with the cursor', async () => {
    listPosts.mockResolvedValueOnce({ posts: [memberPost('1', 'First page')], next: 'cursor-2' });
    renderWithApp(<FeedbackBoard user={alice} admin={false} />);
    await screen.findByText('First page');
    listPosts.mockResolvedValueOnce({ posts: [memberPost('2', 'Second page')], next: null });
    fireEvent.click(screen.getByRole('button', { name: 'Pokaż więcej' }));
    await screen.findByText('Second page');
    expect(listPosts).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'cursor-2' }));
    expect(screen.getByText('First page')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pokaż więcej' })).toBeNull();
  });

  test('an empty list says so', async () => {
    listPosts.mockResolvedValue({ posts: [], next: null });
    renderWithApp(<FeedbackBoard user={alice} admin={false} />);
    expect(await screen.findByText('Nic tu jeszcze nie ma. Dodaj pierwsze zgłoszenie.')).toBeTruthy();
  });

  test('markup in a title is rendered as text', async () => {
    listPosts.mockResolvedValue({ posts: [memberPost('1', '<img src=x onerror=alert(1)> hi')], next: null });
    const { container } = renderWithApp(<FeedbackBoard user={alice} admin={false} />);
    expect(await screen.findByText('<img src=x onerror=alert(1)> hi')).toBeTruthy();
    expect(container.querySelector('img[src="x"]')).toBeNull();
  });
});

describe('guests', () => {
  beforeEach(() => {
    listPosts.mockResolvedValue({ posts: [post('1', 'Dark theme'), post('2', 'Banner animations')], next: null });
  });

  test('see titles and counters but no authors', async () => {
    renderWithApp(<FeedbackBoard user={null} admin={false} />);
    await screen.findByText('Dark theme');
    expect(screen.queryByText(/bob/)).toBeNull();
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });

  test('opening a post shows the login call to action and never asks for details', async () => {
    renderWithApp(<FeedbackBoard user={null} admin={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Dark theme' }));
    expect(screen.getByRole('link', { name: /Zaloguj przez FACEIT/ }).getAttribute('href')).toBe('/api/auth/login');
    expect(screen.getByText(/Zaloguj się, aby zobaczyć szczegóły/)).toBeTruthy();
    expect(getPost).not.toHaveBeenCalled();
  });

  test('voting and adding are login links, not actions', async () => {
    renderWithApp(<FeedbackBoard user={null} admin={false} />);
    await screen.findByText('Dark theme');
    expect(screen.queryByRole('button', { name: /Popieram/ })).toBeNull();
    expect(screen.getAllByRole('link', { name: /Popieram/ })[0].getAttribute('href')).toBe('/api/auth/login');
    expect(screen.getByRole('link', { name: 'Nowe zgłoszenie' }).getAttribute('href')).toBe('/api/auth/login');
    expect(vote).not.toHaveBeenCalled();
  });
});

describe('logged-in users', () => {
  test('see authors in the list', async () => {
    renderWithApp(<FeedbackBoard user={alice} admin={false} />);
    await screen.findByText('Dark theme');
    expect(screen.getAllByText(/bob/).length).toBeGreaterThan(0);
  });

  test('the vote button toggles and updates the counter', async () => {
    vote.mockResolvedValueOnce({ voted: true, votes: 4 }).mockResolvedValueOnce({ voted: false, votes: 3 });
    renderWithApp(<FeedbackBoard user={alice} admin={false} />);
    await screen.findByText('Dark theme');
    const button = () => screen.getAllByRole('button', { name: /Popieram/ })[0];
    fireEvent.click(button());
    await waitFor(() => expect(button().getAttribute('aria-pressed')).toBe('true'));
    expect(button().textContent).toContain('4');
    fireEvent.click(button());
    await waitFor(() => expect(button().getAttribute('aria-pressed')).toBe('false'));
    expect(button().textContent).toContain('3');
    expect(vote).toHaveBeenCalledWith('1');
  });

  test('bug lists label the vote "U mnie też"', async () => {
    listPosts.mockResolvedValue({ posts: [memberPost('9', 'Clipped glow', { kind: 'bug' })], next: null });
    renderWithApp(<FeedbackBoard user={alice} admin={false} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Błędy' }));
    expect(await screen.findByRole('button', { name: /U mnie też/ })).toBeTruthy();
  });

  test('opening a post loads its details and comments', async () => {
    getPost.mockResolvedValue({
      post: detail(memberPost('1', 'Dark theme'), {
        thread: [{ id: 'c1', body: 'Great idea', byAdmin: false, createdAt: '2026-10-14T11:00:00.000Z', author: 'carol', mine: false }],
      }),
    });
    renderWithApp(<FeedbackBoard user={alice} admin={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Dark theme' }));
    expect(await screen.findByText('Full description of the post.')).toBeTruthy();
    expect(screen.getByText('Great idea')).toBeTruthy();
    expect(screen.getByText('carol')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '← Wróć do listy' }));
    expect(await screen.findByText('Banner animations')).toBeTruthy();
  });

  test('a comment is posted and appended', async () => {
    getPost.mockResolvedValue({ post: detail(memberPost('1', 'Dark theme')) });
    addComment.mockResolvedValue({
      comment: { id: 'c2', body: 'My two cents', byAdmin: false, createdAt: '2026-10-14T12:00:00.000Z', author: 'alice', mine: true },
    });
    renderWithApp(<FeedbackBoard user={alice} admin={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Dark theme' }));
    await screen.findByText('Full description of the post.');
    fireEvent.change(screen.getByPlaceholderText('Napisz komentarz…'), { target: { value: 'My two cents' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj komentarz' }));
    expect(await screen.findByText('My two cents')).toBeTruthy();
    expect(addComment).toHaveBeenCalledWith('1', 'My two cents');
  });

  test('admin comments carry an admin badge', async () => {
    getPost.mockResolvedValue({
      post: detail(memberPost('1', 'Dark theme'), {
        thread: [{ id: 'c1', body: 'Planned for next week', byAdmin: true, createdAt: '2026-10-14T11:00:00.000Z', author: 'SkullBoy', mine: false }],
      }),
    });
    renderWithApp(<FeedbackBoard user={alice} admin={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Dark theme' }));
    expect(await screen.findByText('admin')).toBeTruthy();
  });

  test('a server error on a comment is shown', async () => {
    getPost.mockResolvedValue({ post: detail(memberPost('1', 'Dark theme')) });
    addComment.mockRejectedValue(new ApiError(429, 'rate_limited', 'Too many requests, slow down.'));
    renderWithApp(<FeedbackBoard user={alice} admin={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Dark theme' }));
    await screen.findByText('Full description of the post.');
    fireEvent.change(screen.getByPlaceholderText('Napisz komentarz…'), { target: { value: 'spam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj komentarz' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Too many requests');
  });
});

describe('new post form', () => {
  const open = async () => {
    renderWithApp(<FeedbackBoard user={alice} admin={false} />, { ...defaultSettings(), bannerRadius: 22, bannerRadiusCustom: true } as never);
    await screen.findByText('Dark theme');
    fireEvent.click(screen.getByRole('button', { name: 'Nowe zgłoszenie' }));
  };
  const fill = (title: string, body: string) => {
    fireEvent.change(screen.getByLabelText('Tytuł'), { target: { value: title } });
    fireEvent.change(screen.getByLabelText('Opis'), { target: { value: body } });
  };

  test('is disabled until the title and the description are long enough', async () => {
    await open();
    const submit = () => screen.getByRole('button', { name: 'Wyślij zgłoszenie' }) as HTMLButtonElement;
    expect(submit().disabled).toBe(true);
    fill('ab', 'Something');
    expect(submit().disabled).toBe(true);
    fill('Dark theme please', '');
    expect(submit().disabled).toBe(true);
    fill('Dark theme please', 'Because my eyes hurt.');
    expect(submit().disabled).toBe(false);
  });

  test('submits a request and puts it on top of the list', async () => {
    createPost.mockResolvedValue({ post: memberPost('7', 'Brand new idea', { votes: 0, comments: 0, author: 'alice', mine: true }) });
    await open();
    fill('Brand new idea', 'Details of the idea.');
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }));
    await screen.findByText('Brand new idea');
    expect(createPost).toHaveBeenCalledWith({ kind: 'request', title: 'Brand new idea', body: 'Details of the idea.' });
  });

  test('a bug attaches the current banner settings by default and can drop them', async () => {
    createPost.mockResolvedValue({ post: memberPost('8', 'Glow is cut', { kind: 'bug', author: 'alice', mine: true }) });
    renderWithApp(<FeedbackBoard user={alice} admin={false} />, { ...defaultSettings(), bannerRadius: 22, bannerRadiusCustom: true } as never);
    fireEvent.click(screen.getByRole('tab', { name: 'Błędy' }));
    await screen.findByText('Dark theme').catch(() => undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Nowe zgłoszenie' }));
    fill('Glow is cut', 'On the left side.');
    const attach = screen.getByRole('checkbox', { name: 'Dołącz aktualne ustawienia banera' }) as HTMLInputElement;
    expect(attach.checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    const sent = createPost.mock.calls[0][0];
    expect(sent.kind).toBe('bug');
    expect(sent.context).toMatchObject({ settings: { bannerRadius: 22, bannerRadiusCustom: true } });
    expect(typeof sent.context?.userAgent).toBe('string');
    expect(typeof sent.context?.appVersion).toBe('string');
  });

  test('dropping the attachment sends no settings', async () => {
    createPost.mockResolvedValue({ post: memberPost('8', 'Glow is cut', { kind: 'bug' }) });
    renderWithApp(<FeedbackBoard user={alice} admin={false} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Błędy' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Nowe zgłoszenie' }));
    fill('Glow is cut', 'On the left side.');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Dołącz aktualne ustawienia banera' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    expect(createPost.mock.calls[0][0].context).not.toHaveProperty('settings');
  });

  test('a request has no attachment option', async () => {
    await open();
    expect(screen.queryByRole('checkbox', { name: 'Dołącz aktualne ustawienia banera' })).toBeNull();
  });

  test('a server rejection is shown and the form keeps its text', async () => {
    createPost.mockRejectedValue(new ApiError(429, 'rate_limited', 'Too many requests, slow down.'));
    await open();
    fill('Another idea', 'Body text.');
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Too many requests');
    expect((screen.getByLabelText('Tytuł') as HTMLInputElement).value).toBe('Another idea');
  });
});

describe('admin tools', () => {
  const openAs = async (admin: boolean) => {
    getPost.mockResolvedValue({ post: detail(memberPost('1', 'Dark theme')) });
    renderWithApp(<FeedbackBoard user={alice} admin={admin} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Dark theme' }));
    await screen.findByText('Full description of the post.');
  };

  test('an admin sees the status select, export and delete; a normal user does not', async () => {
    await openAs(false);
    expect(screen.queryByRole('button', { name: 'Skopiuj dla Claude' })).toBeNull();
    expect(screen.queryByLabelText('Status')).toBeNull();
  });

  test('an admin changes the status', async () => {
    adminSetStatus.mockResolvedValue({ post: memberPost('1', 'Dark theme', { status: 'planned' }) });
    await openAs(true);
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'planned' } });
    await waitFor(() => expect(adminSetStatus).toHaveBeenCalledWith('1', 'planned'));
    await waitFor(() => expect(document.querySelector('.status-badge')?.textContent).toBe('Planowane'));
  });

  test('export copies the markdown to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    adminExport.mockResolvedValue('# Dark theme\n\nbody');
    await openAs(true);
    fireEvent.click(screen.getByRole('button', { name: 'Skopiuj dla Claude' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('# Dark theme\n\nbody'));
    expect(await screen.findByText('Skopiowano')).toBeTruthy();
  });

  test('delete asks for confirmation and returns to the list', async () => {
    adminDeletePost.mockResolvedValue({ ok: true });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await openAs(true);
    fireEvent.click(screen.getByRole('button', { name: 'Usuń zgłoszenie' }));
    expect(adminDeletePost).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Usuń zgłoszenie' }));
    await waitFor(() => expect(adminDeletePost).toHaveBeenCalledWith('1'));
    expect(await screen.findByText('Banner animations')).toBeTruthy();
    expect(within(screen.getByRole('list')).queryByText('Dark theme')).toBeNull();
  });
});
