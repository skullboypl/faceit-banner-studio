import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import schemaJson from '../../shared/settings-schema.json';
import { LanguageContext, SettingsContext } from '../generator/contexts';
import type { Settings } from '../settings/manager';
import { languages, tl as translate } from '../translations/translations';

export const defaultSettings = () =>
  Object.fromEntries(
    Object.entries(schemaJson as Record<string, { default?: unknown }>).map(([key, def]) => [key, def.default])
  ) as unknown as Settings;

/** Renders with the real Polish translations and a spy-able settings context. */
export function renderWithApp(ui: ReactElement, settings: Settings = defaultSettings(), language = 'pl') {
  const set = vi.fn(() => true);
  const lang = languages.find((entry) => entry.id === language)!;
  const tl = (text: string, args?: string[]) => translate(lang, text, args);
  const view = render(
    <LanguageContext.Provider value={tl}>
      <SettingsContext.Provider value={{ settings, get: ((key: string) => (settings as never)[key]) as never, set: set as never }}>
        {ui}
      </SettingsContext.Provider>
    </LanguageContext.Provider>
  );
  return { ...view, set, tl };
}
