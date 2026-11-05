import { useCallback, useEffect, useState } from 'react';
import { StatisticType } from '../generator/tabs/StatisticsTab';
import { SETTINGS_DEFINITIONS } from './definition';
import { Language } from '../translations/translations';
import { ShowRanking } from '../../widget/src/widget/Widget';
import { useSearchParams } from 'react-router-dom';

export type SettingValueTypeMap = {
  string: string;
  string_undefined: string | undefined;
  number: number;
  boolean: boolean;
  statistic_type: StatisticType;
  language: Language;
  ranking_state: ShowRanking;
};

export type SettingKey = keyof typeof SETTINGS_DEFINITIONS;

export type SettingValue =
  | string
  | number
  | boolean
  | StatisticType
  | Language
  | ShowRanking
  | undefined;

export type SettingValueType<K extends SettingKey> =
  (typeof SETTINGS_DEFINITIONS)[K]['type'] extends keyof SettingValueTypeMap
    ? SettingValueTypeMap[(typeof SETTINGS_DEFINITIONS)[K]['type']]
    : unknown;

export type SetSettingFunction = <K extends SettingKey>(
  key: K,
  value: SettingValueType<K>
) => boolean;

export type SettingDefinition = {
  type:
    | 'string'
    | 'string_undefined'
    | 'number'
    | 'boolean'
    | 'statistic_type'
    | 'language'
    | 'ranking_state';
  min?: number;
  max?: number;
  regex?: RegExp;
  query?: string[];
  /** Every requirement must hold; a list of values means any one of them. */
  requirements?: { setting: string; value: SettingValue | readonly SettingValue[] }[];
  hidden?: boolean;
  options?: SettingValue[];
  defaultValue: SettingValue;
  defaultWidgetValue?: SettingValue;
};

export type Settings = { [K in SettingKey]: SettingValueType<K> };

const isValidSettingValue = (
  definition: SettingDefinition,
  value: unknown
): value is SettingValue => {
  if (definition.type === 'number' || definition.type === 'ranking_state') {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return false;
    }
    if (
      definition.min !== undefined &&
      definition.max !== undefined &&
      (value < definition.min || value > definition.max)
    ) {
      return false;
    }
  }

  if (definition.type === 'boolean' && typeof value !== 'boolean') {
    return false;
  }

  if (
    (definition.type === 'string' || definition.type === 'string_undefined') &&
    typeof value !== 'string' &&
    value !== undefined
  ) {
    return false;
  }

  if (definition.regex && typeof value === 'string' && !definition.regex.test(value)) {
    return false;
  }

  if (
    definition.options &&
    !definition.options.includes(value as SettingValue)
  ) {
    return false;
  }

  return true;
};

/**
 * @param useWidgetDefaults If true, uses `defaultWidgetValue` instead of `defaultValue`
 */
export function useSettings(useWidgetDefaults?: boolean, storageKey?: string) {
  const [searchParams] = useSearchParams();

  const [settings, setSettings] = useState<Settings>(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const defaultSettings = (Object.entries(SETTINGS_DEFINITIONS) as [
      SettingKey,
      any,
    ][]).reduce(
      (acc, [key, val]) => {
        acc[key] = val.defaultValue;
        if (
          useWidgetDefaults &&
          (SETTINGS_DEFINITIONS[key] as { defaultWidgetValue?: boolean })
            .defaultWidgetValue
        ) {
          acc[key] = val.defaultWidgetValue;
        }
        return acc;
      },
      {} as Partial<Settings>
    ) as Settings;

    if (!storageKey) {
      return defaultSettings;
    }

    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) {
        return defaultSettings;
      }

      const parsed = JSON.parse(saved) as Record<string, unknown>;
      const restoredSettings = { ...defaultSettings } as Partial<Settings>;

      (Object.entries(SETTINGS_DEFINITIONS) as [SettingKey, SettingDefinition][]).forEach(
        ([key, definition]) => {
          const value = parsed[key];
          if (value === undefined) {
            return;
          }

          if (!isValidSettingValue(definition, value)) {
            return;
          }

          // Przypisz tylko jeśli typ value zgadza się z typem domyślnym
          const defaultType = typeof defaultSettings[key];
          if (typeof value === defaultType) {
            (restoredSettings as any)[key] = value;
          }
        }
      );

      return restoredSettings as Settings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(settings));
  }, [settings, storageKey]);

  const setSetting = useCallback(
    <K extends SettingKey>(key: K, value: SettingValueType<K>): boolean => {
      const definition: SettingDefinition = SETTINGS_DEFINITIONS[key];
      if (
        definition.min !== undefined &&
        definition.max !== undefined &&
        typeof value === 'number'
      ) {
        if (definition.min > value || definition.max < value) {
          return false;
        }
      }

      if (
        definition.regex &&
        typeof value === 'string' &&
        !definition.regex.test(value)
      ) {
        return false;
      }

      if (
        definition.options &&
        !definition.options.includes(value as SettingValue)
      )
        return false;

      setSettings((previousSettings) => ({
        ...previousSettings,
        [key]: value,
      }));
      return true;
    },
    []
  );

  const loadSettingsFromQuery = useCallback(() => {
    const decodeBase64Utf8 = (value: string): string | null => {
      try {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return new TextDecoder().decode(bytes);
      } catch {
        return null;
      }
    };

    const newSettings: { [key: string]: SettingValue } = {};
    (
      Object.entries(SETTINGS_DEFINITIONS) as [SettingKey, SettingDefinition][]
    ).forEach(([key, definition]) => {
      if (!definition.query || definition.query.length === 0) {
        return;
      }
      definition.query.forEach((query) => {
        const queryVal = searchParams.get(query);
        if (!queryVal) return;
        if (
          definition.type === 'number' ||
          definition.type === 'ranking_state'
        ) {
          const number =
            definition.type === 'ranking_state'
              ? parseInt(queryVal)
              : parseFloat(queryVal);
          if (!isNaN(number)) {
            newSettings[key] = number;
          }
        } else if (definition.type === 'boolean') {
          newSettings[key] = queryVal === 'true';
        } else {
          if (key === 'customInlineCSS') {
            const decoded = query === 'inline_css_b64' ? decodeBase64Utf8(queryVal) : queryVal;
            if (decoded !== null) {
              newSettings[key] = decoded;
            }
            return;
          }
          newSettings[key] = queryVal;
        }
      });
    });
    setSettings((previousSettings) => ({
      ...previousSettings,
      ...newSettings,
    }));
  }, [searchParams]);

  const getSetting = useCallback(
    <K extends SettingKey>(key: K | string): SettingValueType<K> => {
      return settings[key as K] as SettingValueType<K>;
    },
    [settings]
  );

  return {
    settings,
    getSetting,
    setSetting,
    loadSettingsFromQuery,
  };
}
