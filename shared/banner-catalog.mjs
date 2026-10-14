/** Modes the configurator can offer. A hidden mode still renders an existing widget. */
export const BANNER_MODES = ['solo', 'versus', 'team', 'split', 'popup'];

/** Fresh installs show only the two original modes until an admin opens the rest. */
export function defaultBannerCatalog() {
  return { solo: true, versus: true, team: false, split: false, popup: false };
}

/** Keep only known modes. Missing keys stay on the default. */
export function normalizeBannerCatalog(value) {
  const next = defaultBannerCatalog();
  if (!value || typeof value !== 'object') return next;
  for (const mode of BANNER_MODES) {
    if (typeof value[mode] === 'boolean') next[mode] = value[mode];
  }
  return next;
}

/** Apply a partial admin edit without wiping modes that were not sent. */
export function applyBannerCatalog(current, patch) {
  return normalizeBannerCatalog({ ...normalizeBannerCatalog(current), ...patch });
}
