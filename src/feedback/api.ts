import { ApiError, request } from '../cloud/api';

export type PostKind = 'request' | 'bug';
export type PostStatus = 'new' | 'planned' | 'in_progress' | 'done' | 'declined' | 'duplicate';
export const POST_STATUSES: PostStatus[] = ['new', 'planned', 'in_progress', 'done', 'declined', 'duplicate'];

/** `author`, `mine` and `voted` are only present for logged-in viewers. */
export type FeedbackPost = {
  id: string;
  kind: PostKind;
  title: string;
  status: PostStatus;
  votes: number;
  comments: number;
  createdAt: string;
  author?: string;
  mine?: boolean;
  voted?: boolean;
};

export type FeedbackComment = {
  id: string;
  body: string;
  byAdmin: boolean;
  createdAt: string;
  author: string;
  mine: boolean;
};

export type FeedbackDetail = FeedbackPost & {
  body: string;
  context: Record<string, unknown> | null;
  thread: FeedbackComment[];
};

export type ListQuery = { kind?: PostKind; status?: PostStatus; sort: 'top' | 'new'; cursor?: string };
export type NewPost = { kind: PostKind; title: string; body: string; context?: Record<string, unknown>; website?: string };

const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  return search.toString();
};

export const listPosts = (q: ListQuery) =>
  request<{ posts: FeedbackPost[]; next: string | null }>(
    'GET',
    `/api/posts?${query({ kind: q.kind, status: q.status, sort: q.sort, cursor: q.cursor })}`
  );
export const createPost = (input: NewPost) => request<{ post: FeedbackPost }>('POST', '/api/posts', input);
export const getPost = (id: string) => request<{ post: FeedbackDetail }>('GET', `/api/posts/${id}`);
export const deletePost = (id: string) => request<{ ok: true }>('DELETE', `/api/posts/${id}`);
export const vote = (id: string) => request<{ voted: boolean; votes: number }>('POST', `/api/posts/${id}/vote`, {});
export const addComment = (id: string, body: string) =>
  request<{ comment: FeedbackComment }>('POST', `/api/posts/${id}/comments`, { body });

export const adminList = (status?: PostStatus) =>
  request<{ posts: FeedbackPost[]; next: string | null }>('GET', `/api/admin/posts?${query({ status })}`.replace(/\?$/, ''));
export const adminSetStatus = (id: string, status: PostStatus) =>
  request<{ post: FeedbackPost }>('PATCH', `/api/admin/posts/${id}`, { status });
export const adminDeletePost = (id: string) => request<{ ok: true }>('DELETE', `/api/admin/posts/${id}`);
export const adminDeleteComment = (id: string) => request<{ ok: true }>('DELETE', `/api/admin/comments/${id}`);

/** Markdown for pasting into a chat with Claude. */
export async function adminExport(id: string): Promise<string> {
  const response = await fetch(`/api/admin/posts/${id}/export`, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new ApiError(response.status, data.error ?? 'error', data.message ?? response.statusText);
  }
  return response.text();
}
