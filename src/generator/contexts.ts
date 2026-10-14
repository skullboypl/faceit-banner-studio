import { createContext } from 'react';
import type {
  SetSettingFunction,
  SettingKey,
  SettingValueType,
  Settings,
} from '../settings/manager';

export const LanguageContext = createContext<
  ((text: string, args?: string[]) => string) | null
>(null);

export const SettingsContext = createContext<{
  settings: Settings;
  get: <K extends SettingKey>(key: K) => SettingValueType<K>;
  set: SetSettingFunction;
} | null>(null);
