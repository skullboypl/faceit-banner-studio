import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  FACEIT_PLAYER_ID,
  STUDIO_PRESENCE_DEBOUNCE_MS,
  isFaceitPlayerId,
  startStudioPresenceHeartbeat,
  studioPresenceInfo,
} from './presence';

const guid = '11111111-1111-4111-8111-111111111111';

describe('studioPresenceInfo', () => {
  test('uses the FACEIT guid as playerId and drops Dev Admin', () => {
    expect(studioPresenceInfo({ guid, nickname: 'SkullBoy' })).toEqual({
      playerId: guid,
      nickname: 'SkullBoy',
    });
    expect(studioPresenceInfo({ guid: 'dev-admin', nickname: 'Dev Admin' })).toBeUndefined();
    expect(studioPresenceInfo({ guid: 'not-a-player', nickname: 'Nope' })).toBeUndefined();
    expect(studioPresenceInfo(null)).toBeUndefined();
    expect(isFaceitPlayerId(guid)).toBe(true);
    expect(isFaceitPlayerId('dev-admin')).toBe(false);
    expect(FACEIT_PLAYER_ID.test(guid)).toBe(true);
  });

  test('keeps live stats only when they belong to that FACEIT account', () => {
    expect(
      studioPresenceInfo({ guid, nickname: 'SkullBoy' }, { elo: 2400, level: 8, country: 'pl' })
    ).toEqual({
      playerId: guid,
      nickname: 'SkullBoy',
      elo: 2400,
      level: 8,
      country: 'pl',
    });
  });
});

describe('startStudioPresenceHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ online: 1 }), { status: 200 }))
    );
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('does not ping for Dev Admin or a missing FACEIT identity', () => {
    const stop = startStudioPresenceHeartbeat(() =>
      studioPresenceInfo({ guid: 'dev-admin', nickname: 'Dev Admin' })
    );
    vi.advanceTimersByTime(STUDIO_PRESENCE_DEBOUNCE_MS + 20);
    expect(fetch).not.toHaveBeenCalled();
    stop();
  });

  test('sends one debounced ping with the FACEIT guid as playerId', () => {
    const stop = startStudioPresenceHeartbeat(() => studioPresenceInfo({ guid, nickname: 'SkullBoy' }));
    expect(fetch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(STUDIO_PRESENCE_DEBOUNCE_MS - 50);
    expect(fetch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60);
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(body.info).toEqual({ playerId: guid, nickname: 'SkullBoy' });
    expect(body.id).toMatch(/^[a-zA-Z0-9]{32}$/);
    stop();
  });
});
