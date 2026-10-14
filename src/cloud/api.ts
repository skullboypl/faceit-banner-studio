export type User = { guid: string; nickname: string; avatar: string | null };
export type CloudWorkspace = { settings: Record<string, unknown>; version: number; deviceId: string };
export type WorkspaceBody = { settings: Record<string, unknown>; deviceId: string; baseVersion: number };
export type SavedBanner = {
  id: string;
  name: string;
  settings: Record<string, unknown>;
  schemaVersion: number;
  visibility: 'private';
  createdAt: string;
  updatedAt: string;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: { keepalive?: boolean } = {}
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
    cache: 'no-store',
    keepalive: options.keepalive,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const { error, message, ...details } = data as Record<string, unknown>;
    throw new ApiError(response.status, String(error ?? 'error'), String(message ?? response.statusText), details);
  }
  return data as T;
}

export const fetchMe = () => request<{ user: User | null; admin: boolean }>('GET', '/api/auth/me');

export const logout = () => request<{ ok: true }>('POST', '/api/auth/logout', {});

export const getWorkspace = () => request<{ workspace: CloudWorkspace | null }>('GET', '/api/me/workspace');
export const putWorkspace = (body: WorkspaceBody, options?: { keepalive?: boolean }) =>
  request<{ version: number }>('PUT', '/api/me/workspace', body, options);

export const listBanners = () => request<{ banners: SavedBanner[]; limit: number }>('GET', '/api/me/banners');
export const createBanner = (name: string, settings: Record<string, unknown>) =>
  request<{ banner: SavedBanner }>('POST', '/api/me/banners', { name, settings });
export const updateBanner = (id: string, patch: { name?: string; settings?: Record<string, unknown> }) =>
  request<{ banner: SavedBanner }>('PATCH', `/api/me/banners/${id}`, patch);
export const deleteBanner = (id: string) => request<{ ok: true }>('DELETE', `/api/me/banners/${id}`);
