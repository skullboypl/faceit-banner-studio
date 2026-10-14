import { meHandlers } from '@/server/me-routes';

export const dynamic = 'force-dynamic';
export const GET = meHandlers.listBanners;
export const POST = meHandlers.createBanner;
