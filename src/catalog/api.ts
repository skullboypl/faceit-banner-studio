import { request } from '../cloud/api';

export type PublicationStatus = 'pending' | 'approved' | 'declined';
export const PUBLICATION_STATUSES: PublicationStatus[] = ['pending', 'approved', 'declined'];

export type CatalogPublication = {
  id: string;
  bannerId: string;
  title: string;
  body: string;
  status: PublicationStatus;
  votes: number;
  vote: -1 | 0 | 1;
  settings: Record<string, unknown>;
  schemaVersion: number;
  createdAt: string;
  author: string;
  mine?: boolean;
};

const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  return search.toString();
};

export const listCatalog = (sort: 'top' | 'new', cursor?: string) =>
  request<{ publications: CatalogPublication[]; next: string | null }>(
    'GET',
    `/api/catalog/banners?${query({ sort, cursor })}`
  );

export const listMinePublications = () =>
  request<{ publications: CatalogPublication[] }>('GET', '/api/me/publications');

export const publishBanner = (bannerId: string, title: string, body: string) =>
  request<{ publication: CatalogPublication }>('POST', `/api/me/banners/${bannerId}/publish`, { title, body });

export const votePublication = (id: string, value: 1 | -1) =>
  request<{ votes: number; vote: -1 | 0 | 1 }>('POST', `/api/catalog/banners/${id}/vote`, { value });

export const withdrawPublication = (id: string) => request<{ ok: true }>('DELETE', `/api/me/publications/${id}`);

export const adminListPublications = (status: PublicationStatus = 'pending', cursor?: string) =>
  request<{ publications: CatalogPublication[]; next: string | null }>(
    'GET',
    `/api/admin/publications?${query({ status, cursor })}`
  );

export const adminSetPublicationStatus = (id: string, status: 'approved' | 'declined') =>
  request<{ publication: CatalogPublication }>('PATCH', `/api/admin/publications/${id}`, { status });
