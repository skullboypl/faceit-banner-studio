export type AppearanceControls = {
  /** Banner corner radius. */
  radius: boolean;
  /** Colour scheme select and the custom-colour pickers. */
  scheme: boolean;
  /** Font family. */
  font: boolean;
  /** Per-element font sizes and weights, ELO suffix spacing (solo banner markup only). */
  fontSizes: boolean;
  /** Level and ranking icon scale (solo banner markup only). */
  iconScale: boolean;
  /** Card surface: opacity, background image, blur and shadow. */
  surface: boolean;
};

const ALL: AppearanceControls = { radius: true, scheme: true, font: true, fontSizes: true, iconScale: true, surface: true };

/**
 * Which Look-tab controls change something in a given widget mode. Solo and versus banners use the classic
 * element markup; team and split render their own components, and the popup is a transparent full-frame card
 * with its own theme, so hiding what does nothing keeps the tab honest.
 */
export function appearanceFor(mode: string): AppearanceControls {
  if (mode === 'popup') {
    return { radius: false, scheme: false, font: true, fontSizes: false, iconScale: false, surface: false };
  }
  if (mode === 'team' || mode === 'split') {
    return { ...ALL, fontSizes: false, iconScale: false };
  }
  return ALL;
}
