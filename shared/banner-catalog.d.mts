export const BANNER_MODES: readonly ['solo', 'versus', 'team', 'split', 'popup'];
export type BannerCatalogMode = (typeof BANNER_MODES)[number];
export type BannerCatalog = Record<BannerCatalogMode, boolean>;
export function defaultBannerCatalog(): BannerCatalog;
export function normalizeBannerCatalog(value: unknown): BannerCatalog;
export function applyBannerCatalog(current: unknown, patch: unknown): BannerCatalog;
