import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ApiError } from '../cloud/api';
import * as feedback from './api';

const fetchMock = vi.fn();
const ok = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const lastCall = () => fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit];

describe('feedback api', () => {
  test('listPosts builds the query string and skips empty filters', async () => {
    fetchMock.mockReturnValue(ok({ posts: [], next: null }));
    await feedback.listPosts({ kind: 'bug', sort: 'new', cursor: 'abc', status: undefined });
    expect(lastCall()[0]).toBe('/api/posts?kind=bug&sort=new&cursor=abc');
    await feedback.listPosts({ sort: 'top' });
    expect(lastCall()[0]).toBe('/api/posts?sort=top');
  });

  test('createPost sends JSON with POST', async () => {
    fetchMock.mockReturnValue(ok({ post: { id: '1' } }, 201));
    await feedback.createPost({ kind: 'request', title: 'Dark theme', body: 'Please' });
    const [url, init] = lastCall();
    expect(url).toBe('/api/posts');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ kind: 'request', title: 'Dark theme', body: 'Please' });
  });

  test('vote and addComment hit the right paths', async () => {
    fetchMock.mockReturnValue(ok({ voted: true, votes: 1 }));
    await feedback.vote('p1');
    expect(lastCall()[0]).toBe('/api/posts/p1/vote');
    fetchMock.mockReturnValue(ok({ comment: { id: 'c1' } }, 201));
    await feedback.addComment('p1', 'hello');
    expect(lastCall()[0]).toBe('/api/posts/p1/comments');
    expect(JSON.parse(lastCall()[1].body as string)).toEqual({ body: 'hello' });
  });

  test('errors become ApiError with the server code', async () => {
    fetchMock.mockReturnValue(ok({ error: 'login_required', message: 'Log in' }, 401));
    await expect(feedback.getPost('p1')).rejects.toMatchObject({ status: 401, code: 'login_required' });
    await expect(feedback.getPost('p1')).rejects.toBeInstanceOf(ApiError);
  });

  test('admin calls use the admin paths', async () => {
    fetchMock.mockReturnValue(ok({ post: {} }));
    await feedback.adminSetStatus('p1', 'planned');
    expect(lastCall()[0]).toBe('/api/admin/posts/p1');
    expect(lastCall()[1].method).toBe('PATCH');
    fetchMock.mockReturnValue(ok({ ok: true }));
    await feedback.adminDeletePost('p1');
    expect(lastCall()[1].method).toBe('DELETE');
    await feedback.adminDeleteComment('c1');
    expect(lastCall()[0]).toBe('/api/admin/comments/c1');
    fetchMock.mockReturnValue(ok({ posts: [], next: null }));
    await feedback.adminList('planned');
    expect(lastCall()[0]).toBe('/api/admin/posts?status=planned');
  });

  test('adminExport returns the markdown text', async () => {
    fetchMock.mockReturnValue(Promise.resolve(new Response('# Title\n\nbody', { status: 200 })));
    expect(await feedback.adminExport('p1')).toBe('# Title\n\nbody');
    expect(lastCall()[0]).toBe('/api/admin/posts/p1/export');
  });

  test('adminExport throws ApiError on failure', async () => {
    fetchMock.mockReturnValue(ok({ error: 'forbidden', message: 'no' }, 403));
    await expect(feedback.adminExport('p1')).rejects.toMatchObject({ status: 403 });
  });
});
