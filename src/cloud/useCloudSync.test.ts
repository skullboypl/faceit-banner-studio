import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import schemaJson from '../../shared/settings-schema.json';
import type { Settings } from '../settings/manager';

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  getWorkspace: vi.fn(),
  putWorkspace: vi.fn(),
}));

import * as api from './api';
import { useCloudSync } from './useCloudSync';

const getWorkspace = vi.mocked(api.getWorkspace);
const putWorkspace = vi.mocked(api.putWorkspace);

const defaults = () =>
  Object.fromEntries(
    Object.entries(schemaJson as Record<string, { default?: unknown }>).map(([key, def]) => [key, def.default])
  ) as unknown as Settings;
const withRadius = (bannerRadius: number) => ({ ...defaults(), bannerRadius, bannerRadiusCustom: true }) as Settings;
const user = { guid: 'g1', nickname: 'tester', avatar: null };
const cloud = (settings: Record<string, unknown>, version: number, deviceId = 'other') => ({
  workspace: { settings, version, deviceId },
});

const flush = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

function setup(initial: Settings, signedIn = true) {
  const apply = vi.fn();
  const view = renderHook(({ settings, who }) => useCloudSync(settings, apply, who), {
    initialProps: { settings: initial, who: signedIn ? user : null },
  });
  return { apply, ...view };
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  getWorkspace.mockReset();
  putWorkspace.mockReset();
  putWorkspace.mockResolvedValue({ version: 99 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('debounced saving', () => {
  test('sends one PUT 1500 ms after the last change', async () => {
    getWorkspace.mockResolvedValue(cloud({}, 1, 'this-device'));
    const { rerender } = setup(defaults());
    await flush();
    expect(putWorkspace).not.toHaveBeenCalled();

    rerender({ settings: withRadius(10), who: user });
    await flush(1000);
    rerender({ settings: withRadius(11), who: user });
    await flush(1499);
    expect(putWorkspace).not.toHaveBeenCalled();
    await flush(1);
    expect(putWorkspace).toHaveBeenCalledTimes(1);
    expect(putWorkspace.mock.calls[0][0]).toMatchObject({
      settings: { bannerRadius: 11, bannerRadiusCustom: true },
      baseVersion: 1,
    });
  });

  test('re-renders with an identical settings object do not postpone the save', async () => {
    getWorkspace.mockResolvedValue(cloud({}, 1, 'this-device'));
    const { rerender } = setup(defaults());
    await flush();
    rerender({ settings: withRadius(10), who: user });
    for (let elapsed = 0; elapsed < 1400; elapsed += 350) {
      await flush(350);
      rerender({ settings: withRadius(10), who: user }); // new object, same values (the app does this every ~700 ms)
    }
    await flush(200);
    expect(putWorkspace).toHaveBeenCalledTimes(1);
  });

  test('does not talk to the server for a guest', async () => {
    const { rerender } = setup(defaults(), false);
    rerender({ settings: withRadius(10), who: null });
    await flush(5000);
    expect(getWorkspace).not.toHaveBeenCalled();
    expect(putWorkspace).not.toHaveBeenCalled();
  });

  test('state goes saving, then saved with a timestamp', async () => {
    getWorkspace.mockResolvedValue(cloud({}, 1));
    let finish: (value: { version: number }) => void = () => undefined;
    putWorkspace.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { result, rerender } = setup(defaults());
    await flush();
    rerender({ settings: withRadius(10), who: user });
    await flush(1500);
    expect(result.current.state).toBe('saving');
    await act(async () => finish({ version: 2 }));
    expect(result.current.state).toBe('saved');
    expect(result.current.lastSavedAt).not.toBeNull();
  });

  test('pagehide flushes a pending change with keepalive', async () => {
    getWorkspace.mockResolvedValue(cloud({}, 1));
    const { rerender } = setup(defaults());
    await flush();
    rerender({ settings: withRadius(10), who: user });
    await flush(200);
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(putWorkspace).toHaveBeenCalledTimes(1);
    expect(putWorkspace.mock.calls[0][1]).toEqual({ keepalive: true });
  });
});

describe('first load after login', () => {
  test('empty cloud: uploads the local settings right away', async () => {
    getWorkspace.mockResolvedValue({ workspace: null });
    setup(withRadius(10));
    await flush();
    expect(putWorkspace).toHaveBeenCalledTimes(1);
    expect(putWorkspace.mock.calls[0][0]).toMatchObject({ baseVersion: 0, settings: { bannerRadius: 10 } });
  });

  test('default local settings: applies the cloud settings silently', async () => {
    getWorkspace.mockResolvedValue(cloud({ bannerRadius: 9, bannerRadiusCustom: true }, 4));
    const { apply, result } = setup(defaults());
    await flush();
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ bannerRadius: 9 }));
    expect(result.current.conflict).toBeNull();
    expect(localStorage.getItem('fcw_cloud_version')).toBe('4');
  });

  test('different local settings on a new device: asks instead of overwriting', async () => {
    getWorkspace.mockResolvedValue(cloud({ bannerRadius: 9, bannerRadiusCustom: true }, 4));
    const { apply, result } = setup(withRadius(10));
    await flush();
    expect(result.current.conflict).not.toBeNull();
    expect(apply).not.toHaveBeenCalled();
    expect(putWorkspace).not.toHaveBeenCalled();
  });

  test('identical settings: just remembers the cloud version', async () => {
    getWorkspace.mockResolvedValue(cloud({ bannerRadius: 10, bannerRadiusCustom: true }, 6));
    const { result } = setup(withRadius(10));
    await flush();
    expect(result.current.conflict).toBeNull();
    expect(result.current.state).toBe('saved');
    expect(localStorage.getItem('fcw_cloud_version')).toBe('6');
  });
});

describe('conflicts', () => {
  const conflictSetup = async () => {
    getWorkspace.mockResolvedValue(cloud({}, 1, 'this-device'));
    putWorkspace.mockRejectedValue(
      new api.ApiError(409, 'conflict', 'newer', {
        current: { settings: { bannerRadius: 5, bannerRadiusCustom: true }, version: 3, deviceId: 'other' },
      })
    );
    const view = setup(defaults());
    await flush();
    view.rerender({ settings: withRadius(10), who: user });
    await flush(1500);
    return view;
  };

  test('a 409 exposes a conflict and does not overwrite local settings', async () => {
    const { result, apply } = await conflictSetup();
    expect(result.current.conflict).not.toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });

  test('useCloud applies the cloud settings and stores its version', async () => {
    const { result, apply } = await conflictSetup();
    act(() => result.current.conflict!.useCloud());
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ bannerRadius: 5 }));
    expect(localStorage.getItem('fcw_cloud_version')).toBe('3');
    expect(result.current.conflict).toBeNull();
  });

  test('keepLocal re-sends with the cloud version as the base', async () => {
    const { result } = await conflictSetup();
    putWorkspace.mockReset();
    putWorkspace.mockResolvedValue({ version: 4 });
    await act(async () => result.current.conflict!.keepLocal());
    await flush();
    expect(putWorkspace).toHaveBeenCalledTimes(1);
    expect(putWorkspace.mock.calls[0][0]).toMatchObject({ baseVersion: 3, settings: { bannerRadius: 10 } });
    expect(result.current.conflict).toBeNull();
  });
});

describe('failures', () => {
  test('a network error shows offline and retries with backoff', async () => {
    getWorkspace.mockResolvedValue(cloud({}, 1, 'this-device'));
    putWorkspace.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue({ version: 2 });
    const { result, rerender } = setup(defaults());
    await flush();
    rerender({ settings: withRadius(10), who: user });
    await flush(1500);
    expect(result.current.state).toBe('offline');
    await flush(2000);
    expect(putWorkspace).toHaveBeenCalledTimes(2);
    expect(result.current.state).toBe('saved');
  });

  test('a 401 shows unauthorized, does not retry and leaves localStorage alone', async () => {
    localStorage.setItem('fcw_generator_settings', '{"keep":"me"}');
    getWorkspace.mockResolvedValue(cloud({}, 1, 'this-device'));
    putWorkspace.mockRejectedValue(new api.ApiError(401, 'unauthorized', 'log in'));
    const { result, rerender } = setup(defaults());
    await flush();
    rerender({ settings: withRadius(10), who: user });
    await flush(1500);
    await flush(60_000);
    expect(result.current.state).toBe('unauthorized');
    expect(putWorkspace).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('fcw_generator_settings')).toBe('{"keep":"me"}');
  });

  test('a failed first load shows offline instead of throwing', async () => {
    getWorkspace.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = setup(defaults());
    await flush();
    expect(result.current.state).toBe('offline');
  });
});
