import { act, render } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { MatchPopup } from '../widget/src/widget/MatchPopup';
import { mapArt } from '../widget/src/widget/map-art';
import { collectStats } from '../widget/src/utils/faceit_match';
import { POPUP_DEFAULTS, POPUP_LAYOUTS, POPUP_THEMES, POPUP_MIN_TWO_COLUMNS, POPUP_FONT_KEYS, POPUP_RANGES, fontKeysFor, lookFor, popupCardWidth, popupCloseUp, popupMinWidth, readPopupOptions, type PopupOptions } from '../widget/src/widget/popup-options';
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
    const options = readPopupOptions((key) => ({ popupScale: 900, popupWidthPct: 1, popupPosition: 'nowhere' })[key as string]);
    expect(options.scale).toBe(160);
    expect(options.widthPct).toBe(30);
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
    const root = draw({ position: 'bottom-right', scale: 120, widthPct: 60, radius: 4, opacity: 70, theme: 'glass', animation: 'slide' });
    const popup = root.querySelector('.match-popup') as HTMLElement;
    expect(popup.dataset.position).toBe('bottom-right');
    expect(popup.dataset.theme).toBe('glass');
    expect(popup.dataset.animation).toBe('slide');
    expect(popup.style.getPropertyValue('--popup-scale')).toBe('1.2');
    expect(popup.style.getPropertyValue('--popup-width')).toBe('60');
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
    expect(draw({ highlightMe: true }).querySelector('.popup-sides li.is-me .popup-nick')?.textContent).toBe('skullboy');
    expect(draw({ highlightMe: false }).querySelector('.popup-sides li.is-me')).toBeNull();
  });

  test('rosters can be sorted by ELO, highest first', () => {
    const names = (root: HTMLElement) => [...root.querySelectorAll('.popup-sides section:last-child li .popup-nick')].map((node) => node.textContent);
    expect(names(draw({ sortElo: false }))[0]).toBe('NiKo');
    expect(names(draw({ sortElo: true }))).toEqual(['NiKo', 'm0NESY', 'huNter', 'nexa', 'Snax']);
    const left = [...draw({ sortElo: true }).querySelectorAll('.popup-sides section:first-child li .popup-nick')].map((node) => node.textContent);
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

describe('MatchPopup map background and avatars', () => {
  test('the map becomes a blurred background of the card, only when asked', () => {
    const on = draw({ mapBg: true, mapBlur: 20 }).querySelector('.match-popup') as HTMLElement;
    expect(on.dataset.mapBg).toBe('on');
    expect(on.style.getPropertyValue('--popup-map-blur')).toBe('20px');
    expect(on.querySelector('article')?.getAttribute('style')).toMatch(/--popup-map: url\(/);
    const off = draw({ mapBg: false }).querySelector('.match-popup') as HTMLElement;
    expect(off.dataset.mapBg).toBe('off');
    expect(off.querySelector('article')?.getAttribute('style') || '').not.toMatch(/--popup-map/);
  });

  test('a map without artwork keeps the plain card', () => {
    // sample() always uses mirage, so this guards the lookup itself
    expect(mapArt('mirage')).toBeTruthy();
    expect(mapArt('de_mirage')).toBeTruthy();
    expect(mapArt('unknown-map')).toBeUndefined();
    expect(mapArt(undefined)).toBeUndefined();
  });

  test('player avatars show as pictures, or initials when FACEIT has none, and never in compact', () => {
    const root = draw({ showAvatars: true });
    expect(root.querySelectorAll('.popup-sides li .popup-avatar').length).toBe(10);
    expect(root.querySelector('.popup-sides li .popup-avatar')?.textContent).toBe('S');
    expect(draw({ showAvatars: false }).querySelector('.popup-avatar')).toBeNull();
    expect(draw({ showAvatars: true, compact: true }).querySelector('.popup-avatar')).toBeNull();
  });

  test('map background and avatar options are read from the settings and clamped', () => {
    const options = readPopupOptions((key) => ({ popupMapBg: true, popupMapBlur: 999, popupShowAvatars: true })[key as string]);
    expect(options.mapBg).toBe(true);
    expect(options.mapBlur).toBe(30);
    expect(options.showAvatars).toBe(true);
    expect(POPUP_DEFAULTS.mapBg).toBe(false);
    expect(POPUP_DEFAULTS.showAvatars).toBe(false);
  });
});

describe('MatchPopup full scoreboard after the match', () => {
  const rows = (root: HTMLElement) => [...root.querySelectorAll('.popup-table tbody tr')];
  const heads = (root: HTMLElement) => [...(root.querySelector('.popup-table thead') as HTMLElement).querySelectorAll('th')].map((cell) => cell.textContent);

  test('is off by default and the roster lists stay', () => {
    const root = draw();
    expect(root.querySelector('.popup-table')).toBeNull();
    expect(root.querySelectorAll('.popup-sides li').length).toBe(10);
    expect(POPUP_DEFAULTS.scoreboard).toBe(false);
  });

  test('replaces the rosters with one table per team, one row per player', () => {
    const root = draw({ scoreboard: true });
    expect(root.querySelectorAll('.popup-table').length).toBe(2);
    expect(rows(root).length).toBe(10);
    expect(root.querySelector('.popup-sides li')).toBeNull();
  });

  test('columns follow the chosen stats and the ELO toggle', () => {
    expect(heads(draw({ scoreboard: true }))).toEqual(['', 'K', 'D', 'K/D', 'ADR', 'ELO']);
    const all = { kills: true, deaths: true, assists: true, kd: true, adr: true, hs: true, mvps: true };
    expect(heads(draw({ scoreboard: true, me: all, showElo: false }))).toEqual(['', 'K', 'D', 'A', 'K/D', 'ADR', 'HS%', 'MVP']);
  });

  test('shows each player their own numbers, best fragger first, and highlights the streamer', () => {
    const root = draw({ scoreboard: true });
    const first = rows(root)[0];
    expect(first.querySelector('.popup-nick')?.textContent).toBe('ropz');
    expect([...first.querySelectorAll('td.stat')].map((cell) => cell.textContent)).toEqual(['25', '12', '2.08', '98', '2010']);
    expect(root.querySelector('tr.is-me .popup-nick')?.textContent).toBe('skullboy');
  });

  test('only appears after the match, and not in the compact layout', () => {
    expect(draw({ scoreboard: true }, 'live').querySelector('.popup-table')).toBeNull();
    expect(draw({ scoreboard: true }, 'pre').querySelector('.popup-table')).toBeNull();
    expect(draw({ scoreboard: true, compact: true }).querySelector('.popup-table')).toBeNull();
  });

  test('is read from the settings', () => {
    expect(readPopupOptions((key) => (key === 'popupScoreboard' ? true : undefined)).scoreboard).toBe(true);
  });
});

describe('collectStats', () => {
  test('reads every player from a FACEIT match stats response', () => {
    const stats = collectStats({
      rounds: [
        {
          teams: [
            {
              players: [
                { player_id: 'a', player_stats: { Kills: '20', Deaths: '10', Assists: '5', ADR: '88.4', 'K/D Ratio': '2.00', 'Headshots %': '45', MVPs: '3' } },
                { player_id: 'b', player_stats: { Kills: '7', Deaths: '14', Assists: '2', ADR: '55', 'Headshots %': '30', MVPs: '0' } },
              ],
            },
          ],
        },
      ],
    });
    expect(stats.get('a')).toEqual({ kills: 20, deaths: 10, assists: 5, adr: 88, kd: 2, hs: 45, mvps: 3 });
    expect(stats.get('b')?.kd).toBe(0.5);
    expect(stats.get('nobody')).toBeUndefined();
  });
});

describe('MatchPopup layouts and themes', () => {
  test('the layout reaches the card and defaults to card', () => {
    expect(POPUP_DEFAULTS.layout).toBe('card');
    for (const layout of ['card', 'stack', 'strip'] as const) {
      expect((draw({ layout }).querySelector('.match-popup') as HTMLElement).dataset.layout).toBe(layout);
    }
  });

  test('every layout and theme is a known option, anything else falls back', () => {
    expect([...POPUP_LAYOUTS]).toEqual(['card', 'stack', 'strip']);
    expect([...POPUP_THEMES]).toEqual(['dark', 'glass', 'light', 'clear', 'midnight', 'crimson', 'carbon', 'neon']);
    expect(readPopupOptions((key) => (key === 'popupLayout' ? 'wide' : undefined)).layout).toBe('card');
    expect(readPopupOptions((key) => (key === 'popupTheme' ? 'neon' : undefined)).theme).toBe('neon');
  });

  test('the strip is one thin bar: team blocks and a score, no rosters or tables', () => {
    const root = draw({ layout: 'strip', scoreboard: true });
    expect(root.querySelector('.popup-strip')).toBeTruthy();
    expect(root.querySelectorAll('.popup-strip-team').length).toBe(2);
    expect(root.querySelector('.popup-score')?.textContent).toBe('139');
    expect(root.querySelector('.popup-sides')).toBeNull();
    expect(root.querySelector('.popup-table')).toBeNull();
  });

  test('the strip honours the score, average and team-name toggles and can list the players as avatars', () => {
    expect(draw({ layout: 'strip', showScore: false }).querySelector('.popup-score, .popup-vs')).toBeNull();
    expect(draw({ layout: 'strip', showAvg: false }).querySelector('.popup-strip-team em')).toBeNull();
    expect(draw({ layout: 'strip', showTeams: false }).querySelector('.popup-strip-team strong')).toBeNull();
    expect(draw({ layout: 'strip' }).querySelector('.popup-avatar')).toBeNull();
    expect(draw({ layout: 'strip', showAvatars: true }).querySelectorAll('.popup-strip-team .popup-avatar').length).toBe(10);
  });

  test('the other layouts keep the rosters', () => {
    for (const layout of ['card', 'stack'] as const) {
      expect(draw({ layout }).querySelectorAll('.popup-sides li').length, layout).toBe(10);
    }
  });
});

describe('MatchPopup table keeps the layout columns', () => {
  test('the card marks itself as wide when a table is drawn, so two columns fit', () => {
    expect(draw({ scoreboard: true }).querySelector('.match-popup')?.classList.contains('has-table')).toBe(true);
    expect(draw({ scoreboard: false }).querySelector('.match-popup')?.classList.contains('has-table')).toBe(false);
    expect(draw({ scoreboard: true }, 'live').querySelector('.match-popup')?.classList.contains('has-table')).toBe(false);
  });

  test('the table no longer forces a single column in the card layout', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('widget/src/styles/modes-preset.less', 'utf8');
    expect(css).not.toMatch(/\.popup-sides\.has-table\s*\{/);
    expect(css).not.toMatch(/\.match-popup\.has-table article\s*\{[^}]*\d+px/);
  });
});

describe('MatchPopup width is a share of the frame, not of the content', () => {
  test('the card width follows the setting exactly, with and without the map background or a table', () => {
    for (const extra of [{}, { mapBg: true }, { scoreboard: true }, { mapBg: true, scoreboard: true }]) {
      const popup = draw({ widthPct: 55, ...extra }).querySelector('.match-popup') as HTMLElement;
      expect(popup.style.getPropertyValue('--popup-width'), JSON.stringify(extra)).toBe('55');
    }
  });

  test('the stylesheet keeps the grid from being stretched by the content', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('widget/src/styles/modes-preset.less', 'utf8');
    expect(css).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(css).toMatch(/var\(--popup-width\)\s*\*\s*1%\s*\/\s*var\(--popup-scale\)/);
  });
});

describe('popupMinWidth: the card width two columns need with the stats you picked', () => {
  const base = POPUP_DEFAULTS;
  const all = { kills: true, deaths: true, assists: true, kd: true, adr: true, hs: true, mvps: true };

  test('two-column cards are never recommended narrower than 900 px', () => {
    expect(POPUP_MIN_TWO_COLUMNS).toBe(900);
    for (const layout of ['card'] as const) {
      expect(popupMinWidth({ ...base, layout }, 'live')).toBeGreaterThanOrEqual(900);
      expect(popupMinWidth({ ...base, layout, scoreboard: true }, 'post')).toBeGreaterThanOrEqual(900);
    }
    expect(popupMinWidth(base, 'live')).toBe(900);
  });

  test('grows past the floor with every stat column, the ELO column and the avatars', () => {
    const table = { ...base, scoreboard: true, me: all };
    const wide = popupMinWidth(table, 'post');
    expect(wide).toBeGreaterThan(900);
    expect(popupMinWidth({ ...table, showElo: false }, 'post')).toBeLessThan(wide);
    expect(popupMinWidth({ ...table, showAvatars: true }, 'post')).toBeGreaterThan(wide);
    expect(popupMinWidth({ ...table, me: { ...all, hs: false, mvps: false } }, 'post')).toBeLessThan(wide);
  });

  test('a table with many stats needs more room than a plain roster, and only exists after the match', () => {
    const table = popupMinWidth({ ...base, scoreboard: true, me: all }, 'post');
    expect(table).toBeGreaterThan(popupMinWidth(base, 'post'));
    expect(popupMinWidth({ ...base, scoreboard: true, me: all }, 'live')).toBe(popupMinWidth(base, 'live'));
  });

  test('the stacked, compact and strip layouts have their own, smaller needs', () => {
    expect(popupMinWidth({ ...base, layout: 'stack' }, 'live')).toBeLessThan(900);
    expect(popupMinWidth({ ...base, compact: true }, 'live')).toBeLessThan(900);
    expect(popupMinWidth({ ...base, layout: 'strip' }, 'live')).toBeGreaterThan(0);
  });

  test('the default width is at least that minimum on a 1920 px frame', () => {
    const frame = 1920;
    expect((frame * POPUP_DEFAULTS.widthPct) / 100).toBeGreaterThanOrEqual(popupMinWidth(POPUP_DEFAULTS, 'live'));
    expect((frame * POPUP_DEFAULTS.widthPct) / 100).toBeGreaterThanOrEqual(popupMinWidth({ ...POPUP_DEFAULTS, scoreboard: true }, 'post'));
  });
});

describe('MatchPopup adapts to a narrow frame', () => {
  test('an unmeasured card (width 0, e.g. before layout) is never narrow', () => {
    expect(draw().querySelector('.match-popup')?.classList.contains('is-narrow')).toBe(false);
  });

  test('the card switches to one column when it is narrower than the minimum, and back when it grows', () => {
    let width = 300;
    let notify: () => void = () => undefined;
    const original = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth');
    Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get: () => width });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notify = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
    try {
      const root = draw({ scoreboard: true });
      const popup = root.querySelector('.match-popup') as HTMLElement;
      expect(popup.classList.contains('is-narrow')).toBe(true);
      width = 2000;
      act(() => notify());
      expect(popup.classList.contains('is-narrow')).toBe(false);
    } finally {
      vi.unstubAllGlobals();
      if (original) Object.defineProperty(Element.prototype, 'clientWidth', original);
      else delete (Element.prototype as unknown as Record<string, unknown>).clientWidth;
    }
  });

  test('the card floor equals the minimum, so two columns win over a small percentage until the frame is full', () => {
    const popup = draw({ scoreboard: true }).querySelector('.match-popup') as HTMLElement;
    expect(popup.style.getPropertyValue('--popup-min')).toMatch(/^\d+px$/);
    expect(Number.parseInt(popup.style.getPropertyValue('--popup-min'))).toBe(popupMinWidth({ ...POPUP_DEFAULTS, scoreboard: true }, 'post'));
  });

  test('the stylesheet sizes the card from the share, floored by the minimum and capped by the frame', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('widget/src/styles/modes-preset.less', 'utf8');
    expect(css).toMatch(/min\(\s*calc\(100% \/ var\(--popup-scale\)\),\s*max\(/);
    expect(css).toMatch(/\.is-narrow[\s\S]*grid-template-columns:\s*1fr/);
  });
});

describe('per-phase look', () => {
  const look = { pre: { theme: 'neon' }, post: { layout: 'stack', mapBg: true } };
  const read = (extra: Record<string, unknown>) =>
    readPopupOptions((key) => ({ popupPerPhase: true, popupPhaseLook: JSON.stringify(look), ...extra })[key as string]);

  test('is off by default and the global look applies to every phase', () => {
    expect(POPUP_DEFAULTS.perPhase).toBe(false);
    expect(lookFor(POPUP_DEFAULTS, 'post')).toEqual(POPUP_DEFAULTS);
  });

  test('overrides only the phase that has one and keeps the rest', () => {
    const options = read({});
    expect(options.perPhase).toBe(true);
    expect(lookFor(options, 'pre').theme).toBe('neon');
    expect(lookFor(options, 'live').theme).toBe(options.theme);
    expect(lookFor(options, 'post').layout).toBe('stack');
    expect(lookFor(options, 'post').mapBg).toBe(true);
    expect(lookFor(options, 'post').showElo).toBe(options.showElo);
  });

  test('is ignored while the option is off, even if overrides are stored', () => {
    const options = read({ popupPerPhase: false });
    expect(lookFor(options, 'pre').theme).toBe(POPUP_DEFAULTS.theme);
  });

  test('drops unknown keys, bad values and broken JSON instead of failing', () => {
    expect(lookFor(read({ popupPhaseLook: '{"pre":{"theme":"rainbow","scale":9999,"hack":1,"layout":"strip"}}' }), 'pre')).toMatchObject({
      theme: POPUP_DEFAULTS.theme,
      scale: 160,
      layout: 'strip',
    });
    expect(read({ popupPhaseLook: 'not json' }).phaseLook).toEqual({});
    expect(read({ popupPhaseLook: '[1,2]' }).phaseLook).toEqual({});
  });

  test('the preview draws the previewed phase with the look of that phase', () => {
    const options = { ...POPUP_DEFAULTS, perPhase: true, phaseLook: { post: { layout: 'strip', theme: 'carbon' } } } as PopupOptions;
    const post = draw(options, 'post').querySelector('.match-popup') as HTMLElement;
    expect([post.dataset.layout, post.dataset.theme]).toEqual(['strip', 'carbon']);
    const live = draw(options, 'live').querySelector('.match-popup') as HTMLElement;
    expect([live.dataset.layout, live.dataset.theme]).toEqual([POPUP_DEFAULTS.layout, POPUP_DEFAULTS.theme]);
  });
});

describe('themes over the map background', () => {
  test('every coloured theme tints the overlay on top of the map instead of all sharing one dark layer', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('widget/src/styles/modes-preset.less', 'utf8');
    expect(css).toMatch(/rgba\(var\(--popup-tint-a/);
    for (const theme of ['midnight', 'crimson', 'carbon', 'neon']) {
      expect(css, theme).toMatch(new RegExp(String.raw`\[data-theme='${theme}'\]\s*\{[^}]*--popup-tint-a`));
    }
    expect(css).toMatch(/\[data-map-bg='on'\]\[data-theme='neon'\] article/);
  });
});

describe('the removed "big score" layout', () => {
  test('is gone, and a stored value falls back to the card', () => {
    expect([...POPUP_LAYOUTS]).not.toContain('hero');
    expect(readPopupOptions((key) => (key === 'popupLayout' ? 'hero' : undefined)).layout).toBe('card');
  });
});

describe('font sizes per element and layout', () => {
  const stored = JSON.stringify({ card: { score: 150, nick: 80 }, strip: { score: 70 } });
  const read = (extra: Record<string, unknown> = {}) => readPopupOptions((key) => ({ popupFonts: stored, ...extra })[key as string]);

  test('every element has a range and a known key, nothing is set by default', () => {
    expect([...POPUP_FONT_KEYS]).toEqual(['title', 'score', 'team', 'avg', 'nick', 'stats', 'me']);
    expect(POPUP_RANGES.font).toEqual([60, 200]);
    expect(POPUP_DEFAULTS.fonts).toEqual({});
  });

  test('are parsed per layout, clamped, and stripped of unknown keys and broken JSON', () => {
    expect(read().fonts).toEqual({ card: { score: 150, nick: 80 }, strip: { score: 70 } });
    expect(read({ popupFonts: '{"card":{"score":9999,"hack":5,"nick":"big"},"hero":{"score":120}}' }).fonts).toEqual({ card: { score: 200 } });
    expect(read({ popupFonts: 'nope' }).fonts).toEqual({});
    expect(read({ popupFonts: '[1]' }).fonts).toEqual({});
  });

  test('the strip has no roster, so it offers no nickname or stat sizes', () => {
    expect(fontKeysFor('strip')).toEqual(['title', 'score', 'team', 'avg', 'me']);
    expect(fontKeysFor('card')).toEqual([...POPUP_FONT_KEYS]);
    expect(fontKeysFor('stack')).toEqual([...POPUP_FONT_KEYS]);
  });

  test('the card gets one CSS multiplier per element, only for the layout it is drawn in', () => {
    const options = { ...POPUP_DEFAULTS, fonts: { card: { score: 150 }, strip: { score: 70 } } } as PopupOptions;
    const card = draw(options).querySelector('.match-popup') as HTMLElement;
    expect(card.style.getPropertyValue('--fs-score')).toBe('1.5');
    expect(card.style.getPropertyValue('--fs-nick')).toBe('');
    const strip = draw({ ...options, layout: 'strip' }).querySelector('.match-popup') as HTMLElement;
    expect(strip.style.getPropertyValue('--fs-score')).toBe('0.7');
  });

  test('bigger text asks for a wider card so the two columns still fit', () => {
    const plain = popupMinWidth({ ...POPUP_DEFAULTS, scoreboard: true, me: { ...POPUP_DEFAULTS.me, assists: true, hs: true, mvps: true } }, 'post');
    const big = popupMinWidth({ ...POPUP_DEFAULTS, scoreboard: true, me: { ...POPUP_DEFAULTS.me, assists: true, hs: true, mvps: true }, fonts: { card: { nick: 160 } } }, 'post');
    expect(big).toBeGreaterThan(plain);
  });

  test('the stylesheet applies each multiplier to its element', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('widget/src/styles/modes-preset.less', 'utf8');
    for (const key of POPUP_FONT_KEYS) expect(css, key).toContain(`var(--fs-${key}`);
  });
});

describe('popupCardWidth: where the card lands on the 1920 px OBS source', () => {
  test('is the chosen share of the frame, floored by the two-column minimum and capped by the frame', () => {
    expect(popupCardWidth(POPUP_DEFAULTS, 'live')).toBe(902);
    expect(popupCardWidth({ ...POPUP_DEFAULTS, widthPct: 30 }, 'live')).toBe(900);
    expect(popupCardWidth({ ...POPUP_DEFAULTS, widthPct: 100 }, 'live')).toBe(1920);
  });

  test('scale enlarges the floor, because the floor is measured in the own pixels of the card', () => {
    expect(popupCardWidth({ ...POPUP_DEFAULTS, widthPct: 30, scale: 120 }, 'live')).toBe(1080);
  });

  test('uses the look of the phase when each phase has its own', () => {
    const options = { ...POPUP_DEFAULTS, perPhase: true, phaseLook: { post: { widthPct: 80 } } } as PopupOptions;
    expect(popupCardWidth(options, 'post')).toBe(1536);
    expect(popupCardWidth(options, 'live')).toBe(902);
  });

  test('another frame width scales the share, not the floor', () => {
    expect(popupCardWidth({ ...POPUP_DEFAULTS, widthPct: 50 }, 'live', 1280)).toBe(900);
    expect(popupCardWidth({ ...POPUP_DEFAULTS, widthPct: 100 }, 'live', 1280)).toBe(1280);
  });
});

describe('popupCloseUp: how far to zoom the preview so the card is seen from close', () => {
  test('fills most of the preview and never zooms out or past 4x', () => {
    const close = popupCloseUp(POPUP_DEFAULTS, 'live');
    expect(close.zoom).toBeGreaterThan(1.5);
    expect(close.zoom).toBeLessThanOrEqual(4);
    expect(popupCloseUp({ ...POPUP_DEFAULTS, widthPct: 100 }, 'live').zoom).toBe(1);
    expect(popupCloseUp({ ...POPUP_DEFAULTS, layout: 'strip', widthPct: 30 }, 'live').zoom).toBeLessThanOrEqual(4);
  });

  test('anchors the zoom on the corner or edge the card sits in', () => {
    const origin = (position: PopupOptions['position']) => popupCloseUp({ ...POPUP_DEFAULTS, position }, 'live').origin;
    expect(origin('center')).toBe('50% 50%');
    expect(origin('top-left')).toBe('0% 0%');
    expect(origin('top')).toBe('50% 0%');
    expect(origin('right')).toBe('100% 50%');
    expect(origin('bottom-right')).toBe('100% 100%');
  });

  test('follows the look of the previewed phase', () => {
    const options = { ...POPUP_DEFAULTS, perPhase: true, phaseLook: { post: { position: 'bottom-left' } } } as PopupOptions;
    expect(popupCloseUp(options, 'post').origin).toBe('0% 100%');
    expect(popupCloseUp(options, 'live').origin).toBe('50% 50%');
  });
});

describe('popupCloseUp with the measured card', () => {
  test('a tall card limits the zoom by its height so it is never cut off', () => {
    const tall = popupCloseUp(POPUP_DEFAULTS, 'post', { width: 0.44, height: 0.7 });
    expect(tall.zoom).toBe(1.28);
    expect(0.7 * tall.zoom).toBeLessThanOrEqual(0.9);
  });

  test('a flat card is still limited by its width', () => {
    expect(popupCloseUp(POPUP_DEFAULTS, 'post', { width: 0.44, height: 0.12 }).zoom).toBe(2.04);
  });

  test('a card that already fills the frame is not zoomed, and zoom never passes 4x', () => {
    expect(popupCloseUp(POPUP_DEFAULTS, 'post', { width: 0.5, height: 0.95 }).zoom).toBe(1);
    expect(popupCloseUp(POPUP_DEFAULTS, 'post', { width: 0.1, height: 0.05 }).zoom).toBe(4);
  });

  test('without a measurement it falls back to the width estimate', () => {
    expect(popupCloseUp(POPUP_DEFAULTS, 'live').zoom).toBeGreaterThan(1.5);
  });
});

describe('map image opacity', () => {
  test('is full by default and read from the settings within its range', () => {
    expect(POPUP_DEFAULTS.mapOpacity).toBe(100);
    const read = (value: unknown) => readPopupOptions((key) => (key === 'popupMapOpacity' ? value : undefined)).mapOpacity;
    expect(read(60)).toBe(60);
    expect(read(2)).toBe(10);
    expect(read(500)).toBe(100);
    expect(read('x')).toBe(100);
  });

  test('reaches the card as a CSS variable, as a share of 1', () => {
    const popup = draw({ mapBg: true, mapOpacity: 35 }).querySelector('.match-popup') as HTMLElement;
    expect(popup.style.getPropertyValue('--popup-map-opacity')).toBe('0.35');
  });

  test('each phase can have its own', () => {
    const options = { ...POPUP_DEFAULTS, perPhase: true, phaseLook: { post: { mapOpacity: 40 } } } as PopupOptions;
    expect(lookFor(options, 'post').mapOpacity).toBe(40);
    expect(lookFor(options, 'live').mapOpacity).toBe(100);
    expect(readPopupOptions((key) => ({ popupPerPhase: true, popupPhaseLook: '{"post":{"mapOpacity":9999,"mapBg":true}}' })[key as string]).phaseLook.post).toEqual({ mapOpacity: 100, mapBg: true });
  });

  test('is a popup-only setting with a query name, and the stylesheet applies it to the map layer', async () => {
    const definition = SETTINGS_DEFINITIONS.popupMapOpacity as { query?: string[]; min?: number; max?: number; defaultValue?: number };
    expect(definition.query).toEqual(['popup_map_opacity']);
    expect([definition.min, definition.max, definition.defaultValue]).toEqual([10, 100, 100]);
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('widget/src/styles/modes-preset.less', 'utf8')).toContain('var(--popup-map-opacity');
  });
});

describe('glass theme', () => {
  const block = async (selector: string) => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('widget/src/styles/modes-preset.less', 'utf8');
    const start = css.indexOf(selector);
    expect(start, selector).toBeGreaterThan(-1);
    return css.slice(start, css.indexOf('\n  }', start) + 4);
  };

  test('blurs and saturates what is behind, strongly enough to read as glass', async () => {
    const glass = await block("&[data-theme='glass'] article");
    const blur = Number(/backdrop-filter:\s*blur\((\d+)px\)\s*saturate\((\d+)%\)/.exec(glass)?.[1]);
    const saturate = Number(/saturate\((\d+)%\)/.exec(glass)?.[1]);
    expect(blur).toBeGreaterThanOrEqual(24);
    expect(saturate).toBeGreaterThanOrEqual(160);
    expect(glass).toContain('-webkit-backdrop-filter');
  });

  test('has a bright rim, a specular highlight and a soft depth shadow', async () => {
    const glass = await block("&[data-theme='glass'] article");
    expect(glass).toMatch(/inset 0 1px 0 rgba\(255, 255, 255, 0\.[5-9]/);
    expect(glass).toMatch(/radial-gradient\([^)]*rgba\(255, 255, 255, 0\.[2-9]/);
    expect(glass).toMatch(/0 \d+px \d+px rgba\(0, 0, 0/);
  });

  test('keeps text readable on any scene: white with a soft shadow', async () => {
    const glass = await block("&[data-theme='glass'] article");
    expect(glass).toMatch(/color:\s*#fff/);
    expect(glass).toMatch(/text-shadow:/);
  });

  test('works without a blur behind it (OBS cannot blur the game): the tint carries the look on its own', async () => {
    const glass = await block("&[data-theme='glass'] article");
    expect(glass).toMatch(/linear-gradient\(/);
    expect(glass).toMatch(/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*calc\(var\(--popup-opacity\)/);
  });

  test('over the map background the glass keeps its rim and highlight', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('widget/src/styles/modes-preset.less', 'utf8');
    expect(css).toMatch(/\[data-map-bg='on'\]\[data-theme='glass'\] article\s*\{[^}]*inset 0 1px 0 rgba\(255, 255, 255/);
    expect(css).toMatch(/\[data-map-bg='on'\]\[data-theme='glass'\] article::after\s*\{[^}]*radial-gradient/);
  });
});
