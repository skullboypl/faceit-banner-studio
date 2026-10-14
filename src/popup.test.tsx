import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { MatchPopup } from '../widget/src/widget/MatchPopup';
import { POPUP_DEFAULTS, readPopupOptions, type PopupOptions } from '../widget/src/widget/popup-options';
import { SETTINGS_DEFINITIONS } from './settings/definition';

const translate = (text: string) => text;

const draw = (overrides: Partial<PopupOptions> = {}, phase: 'pre' | 'live' | 'post' = 'post') =>
  render(
    <MatchPopup
      preview
      playerId=""
      username="skullboy"
      phase={phase}
      options={{ ...POPUP_DEFAULTS, ...overrides }}
      translate={translate}
    />
  ).container;

describe('readPopupOptions', () => {
  test('falls back to the defaults and clamps out-of-range numbers', () => {
    const options = readPopupOptions((key) => ({ popupScale: 900, popupWidth: 1, popupPosition: 'nowhere' })[key as string]);
    expect(options.scale).toBe(160);
    expect(options.width).toBe(420);
    expect(options.position).toBe(POPUP_DEFAULTS.position);
    expect(options.showElo).toBe(true);
  });

  test('every option is declared as a popup-only setting with a query name', () => {
    const keys = Object.keys(SETTINGS_DEFINITIONS).filter((key) => key.startsWith('popup') && key !== 'popupPreview');
    expect(keys.length).toBeGreaterThanOrEqual(25);
    for (const key of keys) {
      const definition = SETTINGS_DEFINITIONS[key as keyof typeof SETTINGS_DEFINITIONS] as {
        query?: string[];
        requirements?: { setting: string; value: unknown }[];
      };
      expect(definition.query?.[0], key).toMatch(/^popup_/);
      expect(definition.requirements, key).toEqual([{ setting: 'widgetMode', value: 'popup' }]);
    }
  });
});

describe('MatchPopup layout options', () => {
  test('position, scale, width, radius, theme and animation reach the card as data attributes and CSS variables', () => {
    const root = draw({ position: 'bottom-right', scale: 120, width: 640, radius: 4, opacity: 70, theme: 'glass', animation: 'slide' });
    const popup = root.querySelector('.match-popup') as HTMLElement;
    expect(popup.dataset.position).toBe('bottom-right');
    expect(popup.dataset.theme).toBe('glass');
    expect(popup.dataset.animation).toBe('slide');
    expect(popup.style.getPropertyValue('--popup-scale')).toBe('1.2');
    expect(popup.style.getPropertyValue('--popup-width')).toBe('640px');
    expect(popup.style.getPropertyValue('--popup-radius')).toBe('4px');
    expect(popup.style.getPropertyValue('--popup-opacity')).toBe('0.7');
  });

  test('compact hides the rosters and keeps the score and averages', () => {
    const root = draw({ compact: true });
    expect(root.querySelector('.popup-sides ol')).toBeNull();
    expect(root.querySelector('.popup-score')).toBeTruthy();
    expect(root.querySelectorAll('.popup-sides header em').length).toBe(2);
  });
});

describe('MatchPopup content options', () => {
  test('map, score, averages, team names, ELO and levels can each be hidden', () => {
    expect(draw({ showMap: false }).querySelector('.popup-kicker em')).toBeNull();
    expect(draw({ showScore: false }).querySelector('.popup-score, .popup-vs')).toBeNull();
    expect(draw({ showAvg: false }).querySelector('.popup-sides header em')).toBeNull();
    expect(draw({ showTeams: false }).querySelector('.popup-sides header strong')).toBeNull();
    expect(draw({ showElo: false }).querySelector('.popup-sides li b')).toBeNull();
    expect(draw({ showLevels: false }).querySelector('.popup-sides li svg')).toBeNull();
  });

  test('shows everything by default', () => {
    const root = draw();
    expect(root.querySelector('.popup-kicker em')?.textContent).toBe('mirage');
    expect(root.querySelectorAll('.popup-sides li').length).toBe(10);
    expect(root.querySelectorAll('.popup-sides li b').length).toBe(10);
  });

  test('the streamer is highlighted in the roster only when asked', () => {
    expect(draw({ highlightMe: true }).querySelector('.popup-sides li.is-me span')?.textContent).toBe('skullboy');
    expect(draw({ highlightMe: false }).querySelector('.popup-sides li.is-me')).toBeNull();
  });

  test('rosters can be sorted by ELO, highest first', () => {
    const names = (root: HTMLElement) => [...root.querySelectorAll('.popup-sides section:last-child li span')].map((node) => node.textContent);
    expect(names(draw({ sortElo: false }))[0]).toBe('NiKo');
    expect(names(draw({ sortElo: true }))).toEqual(['NiKo', 'm0NESY', 'huNter', 'nexa', 'Snax']);
    const left = [...draw({ sortElo: true }).querySelectorAll('.popup-sides section:first-child li span')].map((node) => node.textContent);
    expect(left[0]).toBe('ropz');
  });
});

describe('MatchPopup personal stats after the match', () => {
  const labels = (root: HTMLElement) => [...root.querySelectorAll('.popup-me span')].map((node) => node.textContent?.replace(/\d+(\.\d+)?/, '').trim());

  test('default set is K, D, K/D and ADR', () => {
    expect(labels(draw())).toEqual(['K', 'D', 'K/D', 'ADR']);
  });

  test('each stat toggles on its own, including assists, headshots and MVPs', () => {
    const all = draw({ me: { kills: true, deaths: true, assists: true, kd: true, adr: true, hs: true, mvps: true } });
    expect(labels(all)).toEqual(['K', 'D', 'A', 'K/D', 'ADR', 'HS%', 'MVP']);
    expect(labels(draw({ me: { kills: false, deaths: false, assists: false, kd: false, adr: true, hs: false, mvps: false } }))).toEqual(['ADR']);
  });

  test('the whole block can be hidden, and it never shows before the match ends', () => {
    expect(draw({ showMe: false }).querySelector('.popup-me')).toBeNull();
    expect(draw({}, 'live').querySelector('.popup-me')).toBeNull();
  });
});

describe('MatchPopup timing', () => {
  test('a disabled phase is not drawn live (preview always draws)', () => {
    expect(draw({ post: false }).querySelector('.match-popup')).toBeTruthy();
  });
});
