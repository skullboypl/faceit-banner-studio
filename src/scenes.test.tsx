import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SceneScreen, type SceneData } from '../widget/src/widget/SceneScreen';
import {
  cleanHandle,
  formatCountdown,
  readSceneOptions,
  sceneHasCountdown,
  socialAddress,
  type SceneOptions,
} from '../widget/src/widget/scene-options';
import { BANNER_MODES, defaultBannerCatalog } from '../shared/banner-catalog.mjs';
import { broadcastPresets, presetMode } from '../widget/src/styles/styles';
import { SETTINGS_DEFINITIONS } from './settings/definition';
import { widgetQueryParams } from './settings/widget-query';
import type { SettingKey } from './settings/manager';
import { appearanceFor, settingsFor } from './generator/appearance';

const translate = (key: string, args?: string[]) => (args?.length ? `${key}:${args.join(',')}` : key);

const options = (patch: Partial<SceneOptions> = {}): SceneOptions => ({
  ...readSceneOptions(() => undefined),
  ...patch,
});

const data = (patch: Partial<SceneData> = {}): SceneData => ({
  username: 'SkullBoy',
  avatar: undefined,
  elo: 3184,
  level: 10,
  calibrating: false,
  ranking: 512,
  levelIcon: null,
  recent: { kd: '1.21', adr: '85.3', hs: '47', winRate: '55', matches: 20 },
  session: { wins: 3, losses: 1, eloDiff: 41, kd: 1.32, form: ['W', 'L', 'W', 'W'] },
  ...patch,
});

const draw = (kind: 'starting' | 'brb' | 'ending', opts = options(), player = data()) =>
  render(<SceneScreen preview kind={kind} options={opts} data={player} translate={translate} />).container;

describe('readSceneOptions', () => {
  test('falls back to a starting scene with chat on the right, a 5 minute timer and the aurora', () => {
    const read = readSceneOptions(() => undefined);
    expect(read).toMatchObject({ kind: 'starting', countdown: 5, chat: true, chatSide: 'right', stats: true, animation: 'aurora', socials: [] });
  });

  test('keeps known values, clamps the timer and drops what is not a handle', () => {
    const values: Record<string, unknown> = {
      sceneKind: 'ending',
      sceneCountdown: 500,
      sceneChat: false,
      sceneAnimation: 'fireworks',
      sceneTitleEnding: 'GG WP',
      sceneNoteBrb: '<script>',
      sceneTwitch: '@skullboypl',
      sceneX: 'bad handle with spaces',
      sceneDiscord: 'discord.gg/abc',
    };
    const read = readSceneOptions((key) => values[key]);
    expect(read.kind).toBe('ending');
    expect(read.countdown).toBe(90);
    expect(read.chat).toBe(false);
    expect(read.animation).toBe('aurora');
    expect(read.titles.ending).toBe('GG WP');
    expect(read.notes.brb).toBe('');
    expect(read.socials).toEqual([
      { kind: 'twitch', handle: 'skullboypl' },
      { kind: 'discord', handle: 'discord.gg/abc' },
    ]);
  });

  test('social addresses, handles and the countdown text', () => {
    expect(socialAddress('youtube', 'skullboy')).toBe('youtube.com/@skullboy');
    expect(socialAddress('discord', 'abc123')).toBe('discord.gg/abc123');
    expect(socialAddress('kick', 'skullboypl')).toBe('kick.com/skullboypl');
    expect(cleanHandle('  @@name ')).toBe('name');
    expect(cleanHandle('no spaces please')).toBe('');
    expect(formatCountdown(4 * 60_000 + 5_000)).toBe('4:05');
    expect(formatCountdown(3_725_000)).toBe('1:02:05');
    expect(formatCountdown(-10)).toBe('0:00');
    expect(sceneHasCountdown('ending', 5)).toBe(false);
    expect(sceneHasCountdown('brb', 0)).toBe(false);
    expect(sceneHasCountdown('starting', 1)).toBe(true);
  });
});

describe('SceneScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T20:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  test('a starting scene counts down from the chosen minutes and shows recent form', () => {
    const view = draw('starting', options({ countdown: 2 }));
    expect(view.querySelector('.scene-title')?.getAttribute('aria-label')).toBe('scene.starting.title');
    expect(view.querySelector('.scene-timer b')?.textContent).toBe('2:00');
    act(() => {
      vi.advanceTimersByTime(65_000);
    });
    expect(view.querySelector('.scene-timer b')?.textContent).toBe('0:55');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(view.querySelector('.scene-timer')?.classList.contains('is-done')).toBe(true);
    expect(view.querySelector('.scene-timer b')?.textContent).toBe('scene.countdown.done.starting');
    expect(view.querySelector('.scene-card-label')?.textContent).toBe('scene.recent:20');
  });

  test('the end of the stream sums up the session and has no timer', () => {
    const view = draw('ending');
    expect(view.querySelector('.scene-timer')).toBeNull();
    expect(view.querySelector('.scene-card-label')?.textContent).toBe('scene.today');
    expect([...view.querySelectorAll('.scene-cell b')].map((cell) => cell.textContent)).toEqual(['3–1', '+41', '1.32']);
    expect(view.querySelectorAll('.scene-form i')).toHaveLength(4);
  });

  test('custom texts replace the defaults, word by word in the title', () => {
    const view = draw('brb', options({ titles: { starting: '', brb: 'Pizza time', ending: '' }, notes: { starting: '', brb: 'back soon', ending: '' } }));
    expect([...view.querySelectorAll('.scene-title span')].map((word) => word.textContent)).toEqual(['Pizza', 'time']);
    expect(view.querySelector('.scene-note')?.textContent).toBe('back soon');
  });

  test('the chat panel follows its side, and the studio shows where the chat goes', () => {
    expect(draw('starting', options({ chatSide: 'left' })).querySelector('.scene-screen')?.className).toContain('chat-left');
    expect(draw('starting').querySelector('.scene-chat-hint')).not.toBeNull();
    expect(draw('starting', options({ chat: false })).querySelector('.scene-chat')).toBeNull();
  });

  test('no FACEIT card until the player has loaded, and socials link to their sites', () => {
    const view = draw('starting', options({ socials: [{ kind: 'twitch', handle: 'skullboypl' }] }), data({ elo: 0 }));
    expect(view.querySelector('.scene-card')).toBeNull();
    expect(view.querySelector('.scene-socials small')?.textContent).toBe('twitch.tv/skullboypl');
  });
});

describe('scenes mode wiring', () => {
  test('the mode is known everywhere and hidden until an admin opens it', () => {
    expect(BANNER_MODES).toContain('scenes');
    expect(defaultBannerCatalog().scenes).toBe(false);
    expect(SETTINGS_DEFINITIONS.widgetMode.options).toContain('scenes');
    expect(broadcastPresets.find((preset) => preset.id === 'stage')).toMatchObject({ width: 1920, height: 1080, group: 'scenes' });
    expect(presetMode('stage')).toBe('scenes');
    expect(appearanceFor('scenes').radius).toBe(false);
    expect(settingsFor('scenes')).toEqual({ elements: false, autoWidth: false, session: true });
  });

  test('the OBS link carries the scene options and leaves empty texts out', () => {
    const values: Record<string, unknown> = {
      widgetMode: 'scenes',
      sceneKind: 'brb',
      sceneTitleBrb: 'Pizza time',
      sceneTwitch: 'skullboypl',
    };
    const get = (key: SettingKey) => (key in values ? values[key] : SETTINGS_DEFINITIONS[key].defaultValue);
    const params = widgetQueryParams(get, 'pl');
    expect(params).toMatchObject({ mode: 'scenes', scene: 'brb', scene_title_brb: 'Pizza time', scene_twitch: 'skullboypl', scene_countdown: 5 });
    expect(params).not.toHaveProperty('scene_title_starting');
    expect(params).not.toHaveProperty('scene_kick');
  });
});
