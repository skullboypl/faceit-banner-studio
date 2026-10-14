import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SETTINGS_DEFINITIONS } from '../settings/definition';
import { useSettings, type SettingKey } from '../settings/manager';

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  getWorkspace: vi.fn(),
  putWorkspace: vi.fn(),
}));

import * as api from './api';
import { useCloudSync } from './useCloudSync';

const getWorkspace = vi.mocked(api.getWorkspace);
const putWorkspace = vi.mocked(api.putWorkspace);
const user = { guid: 'g1', nickname: 'tester', avatar: null };
const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

/** The generator's real wiring: useSettings feeds useCloudSync, and applying cloud settings goes through setSetting. */
function useGenerator() {
  const { settings, setSetting } = useSettings(false, 'fcw_generator_settings');
  const sync = useCloudSync(
    settings,
    (cloud) => {
      for (const [key, value] of Object.entries(cloud)) setSetting(key as SettingKey, value as never);
    },
    user
  );
  return { settings, sync };
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  getWorkspace.mockReset();
  putWorkspace.mockReset();
  putWorkspace.mockResolvedValue({ version: 99 });
});
afterEach(() => vi.useRealTimers());

describe('cloud sync with the real settings hook', () => {
  test('applying cloud settings on a fresh device ends in saved, without writing back', async () => {
    getWorkspace.mockResolvedValue({
      workspace: { settings: { bannerRadius: 7 }, version: 1, deviceId: 'other' },
    });
    const { result } = renderHook(useGenerator, { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.settings.bannerRadius).toBe(7);
    expect(putWorkspace).not.toHaveBeenCalled();
    expect(result.current.sync.state).toBe('saved');
  });

  test('every default survives being applied through setSetting', () => {
    const { result } = renderHook(() => useSettings(false), { wrapper });
    const rejected = Object.keys(SETTINGS_DEFINITIONS).filter((key) => {
      const value = (result.current.settings as Record<string, unknown>)[key];
      let accepted = true;
      act(() => {
        accepted = result.current.setSetting(key as SettingKey, value as never);
      });
      return !accepted;
    });
    expect(rejected).toEqual([]);
  });
});
