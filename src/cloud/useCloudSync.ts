import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Settings } from '../settings/manager';
import { ApiError, getWorkspace, putWorkspace, type CloudWorkspace, type User } from './api';
import { canonical, fromDelta, toDelta } from './delta';

export const DEBOUNCE_MS = 1500;
const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 30_000;
const RATE_LIMIT_RETRY_MS = 5000;
const VERSION_KEY = 'fcw_cloud_version';
const VERSION_OWNER_KEY = 'fcw_cloud_guid';
const DEVICE_KEY = 'fcw_device_id';

export type SyncState = 'idle' | 'saving' | 'saved' | 'offline' | 'error' | 'unauthorized';
export type SyncConflict = {
  cloud: Partial<Settings>;
  keepLocal: () => void;
  useCloud: () => void;
};

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable: sync still works for this session
  }
};

function getDeviceId(): string {
  const saved = read(DEVICE_KEY);
  if (saved && /^[A-Za-z0-9_-]{1,64}$/.test(saved)) return saved;
  const id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9_-]/g, '');
  write(DEVICE_KEY, id.slice(0, 64));
  return id.slice(0, 64);
}

/** Last cloud version this device has seen for this account, or null on a device that never synced. */
function getKnownVersion(guid: string): number | null {
  if (read(VERSION_OWNER_KEY) !== guid) return null;
  const version = Number(read(VERSION_KEY));
  return Number.isInteger(version) && version >= 0 && read(VERSION_KEY) !== null ? version : null;
}

function setKnownVersion(guid: string, version: number) {
  write(VERSION_OWNER_KEY, guid);
  write(VERSION_KEY, String(version));
}

/**
 * Keeps the working settings of a logged-in user in step with their account.
 * localStorage stays the source for offline work; the cloud copy is written 1.5 s after the last change.
 */
export function useCloudSync(settings: Settings, apply: (settings: Partial<Settings>) => void, user: User | null) {
  const [state, setState] = useState<SyncState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [conflict, setConflict] = useState<SyncConflict | null>(null);

  const latest = useRef(settings);
  latest.current = settings;
  const applyRef = useRef(apply);
  applyRef.current = apply;

  const loaded = useRef(false);
  const conflictOpen = useRef(false);
  const knownVersion = useRef<number | null>(null);
  const syncedCanon = useRef<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retries = useRef(0);
  const inflight = useRef(false);
  const queued = useRef(false);
  const unmounted = useRef(false);
  const guid = user?.guid ?? null;

  const clearTimers = () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    debounceTimer.current = retryTimer.current = null;
  };

  const openConflict = useCallback(
    (current: CloudWorkspace, send: () => void) => {
      conflictOpen.current = true;
      setState('idle');
      setConflict({
        cloud: fromDelta(current.settings),
        useCloud: () => {
          knownVersion.current = current.version;
          if (guid) setKnownVersion(guid, current.version);
          syncedCanon.current = canonical(current.settings);
          conflictOpen.current = false;
          setConflict(null);
          setState('saved');
          applyRef.current(fromDelta(current.settings));
        },
        keepLocal: () => {
          knownVersion.current = current.version;
          if (guid) setKnownVersion(guid, current.version);
          conflictOpen.current = false;
          setConflict(null);
          send();
        },
      });
    },
    [guid]
  );

  const send = useCallback(async () => {
    if (!guid || conflictOpen.current) return;
    if (inflight.current) {
      queued.current = true;
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = null;

    const delta = toDelta(latest.current);
    const canon = canonical(delta);
    inflight.current = true;
    setState('saving');
    try {
      const { version } = await putWorkspace({
        settings: delta,
        deviceId: getDeviceId(),
        baseVersion: knownVersion.current ?? 0,
      });
      knownVersion.current = version;
      setKnownVersion(guid, version);
      syncedCanon.current = canon;
      retries.current = 0;
      if (unmounted.current) return;
      setState('saved');
      setLastSavedAt(Date.now());
    } catch (error) {
      if (unmounted.current) return;
      if (error instanceof ApiError && error.status === 409) {
        const current = error.details.current as CloudWorkspace | undefined;
        if (current) openConflict(current, () => void send());
        else setState('error');
      } else if (error instanceof ApiError && error.status === 401) {
        setState('unauthorized');
      } else if (error instanceof ApiError && error.status === 429) {
        setState('offline');
        retryTimer.current = setTimeout(() => void send(), RATE_LIMIT_RETRY_MS);
      } else if (error instanceof ApiError && error.status < 500) {
        setState('error');
      } else {
        setState('offline');
        const delay = Math.min(RETRY_BASE_MS * 2 ** retries.current, RETRY_MAX_MS);
        retries.current += 1;
        retryTimer.current = setTimeout(() => void send(), delay);
      }
    } finally {
      inflight.current = false;
      if (queued.current) {
        queued.current = false;
        if (!unmounted.current) void send();
      }
    }
  }, [guid, openConflict]);

  // First load after login (or account switch): decide between upload, silent apply and asking.
  useEffect(() => {
    loaded.current = false;
    conflictOpen.current = false;
    setConflict(null);
    clearTimers();
    if (!guid) {
      setState('idle');
      return;
    }

    let cancelled = false;
    setState('saving');
    (async () => {
      try {
        const { workspace } = await getWorkspace();
        if (cancelled) return;
        const local = toDelta(latest.current);
        const localCanon = canonical(local);
        knownVersion.current = getKnownVersion(guid);

        if (!workspace) {
          knownVersion.current = 0;
          setKnownVersion(guid, 0);
          syncedCanon.current = canonical({});
          loaded.current = true;
          if (Object.keys(local).length > 0) await send();
          else setState('saved');
          return;
        }

        const cloudCanon = canonical(workspace.settings);
        if (cloudCanon === localCanon) {
          knownVersion.current = workspace.version;
          setKnownVersion(guid, workspace.version);
          syncedCanon.current = localCanon;
          setState('saved');
        } else if (Object.keys(local).length === 0) {
          knownVersion.current = workspace.version;
          setKnownVersion(guid, workspace.version);
          syncedCanon.current = cloudCanon;
          setState('saved');
          applyRef.current(fromDelta(workspace.settings));
        } else if (knownVersion.current === workspace.version) {
          // The cloud has nothing this device has not seen, so the local edits are simply newer.
          syncedCanon.current = cloudCanon;
          loaded.current = true;
          await send();
          return;
        } else {
          syncedCanon.current = cloudCanon;
          openConflict(workspace, () => void send());
        }
        loaded.current = true;
      } catch (error) {
        if (cancelled) return;
        setState(error instanceof ApiError && error.status === 401 ? 'unauthorized' : 'offline');
      }
    })();

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [guid]);

  // Debounced write of every later change. It keys off the delta's content, not the settings object:
  // the generator re-creates that object with identical values every ~700 ms, which must not postpone the save.
  const deltaCanon = useMemo(() => canonical(toDelta(settings)), [settings]);
  useEffect(() => {
    if (!guid || !loaded.current || conflictOpen.current) return;
    if (deltaCanon === syncedCanon.current) return;
    setState((current) => (current === 'unauthorized' ? current : 'saving'));
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => void send(), DEBOUNCE_MS);
  }, [deltaCanon, guid, send]);

  // Leaving the page with an unsent change: send it with keepalive so the browser finishes the request.
  useEffect(() => {
    if (!guid) return;
    const onHide = () => {
      if (!debounceTimer.current || conflictOpen.current) return;
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
      void putWorkspace(
        { settings: toDelta(latest.current), deviceId: getDeviceId(), baseVersion: knownVersion.current ?? 0 },
        { keepalive: true }
      ).catch(() => undefined);
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [guid]);

  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      clearTimers();
    };
  }, []);

  return { state, lastSavedAt, conflict };
}
