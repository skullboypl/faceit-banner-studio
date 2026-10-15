import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { TEAM_DEFAULTS, readTeamOptions, teamRecommendedWidth, type TeamOptions } from '../widget/src/widget/team-options';
import { BannerSizeControls } from './components/BannerSizeControls';
import { GeneratedWidgetModal } from './components/GeneratedWidgetModal';
import { defaultSettings, renderWithApp } from './components/test-utils';
import { languages } from './translations/translations';

const width = (options: Partial<TeamOptions> = {}, layout: 'lineup' | 'sheet' = 'lineup') =>
  teamRecommendedWidth({ ...TEAM_DEFAULTS, ...options }, layout);
const all = { hs: true, adr: true, kr: true, matches: true, wins: true, streak: true } as const;

describe('teamRecommendedWidth: the width the roster needs for what it shows', () => {
  test('the default roster needs about what the Lineup preset always promised', () => {
    expect(width()).toBeGreaterThanOrEqual(420);
    expect(width()).toBeLessThanOrEqual(470);
  });

  test('every extra stat column makes it wider', () => {
    const columns = ['hs', 'adr', 'kr', 'matches', 'wins', 'streak'] as const;
    let previous = width();
    columns.forEach((_, index) => {
      const options = Object.fromEntries(columns.slice(0, index + 1).map((key) => [key, true]));
      const next = width(options);
      expect(next, columns[index]).toBeGreaterThan(previous);
      previous = next;
    });
  });

  test('hiding a stat or a picture makes it narrower', () => {
    expect(width({ kd: false })).toBeLessThan(width());
    expect(width({ elo: false, kd: false, winRate: false })).toBeLessThan(width({ kd: false }));
    expect(width({ avatars: false })).toBeLessThan(width());
    expect(width({ levels: false })).toBeLessThan(width());
  });

  test('place numbers add room', () => {
    expect(width({ rank: true })).toBeGreaterThan(width());
  });

  test('a compact list is narrower than a comfortable one', () => {
    expect(width({ density: 'compact', ...all })).toBeLessThan(width({ density: 'comfortable', ...all }));
  });

  test('larger text asks for proportionally more room, smaller text for less', () => {
    expect(width({ fontScale: 120 })).toBeGreaterThanOrEqual(Math.round(width() * 1.18));
    expect(width({ fontScale: 80 })).toBeLessThan(width());
  });

  test('the two-column sheet is wider than the lineup for the same data', () => {
    expect(width({}, 'sheet')).toBeGreaterThan(width({}, 'lineup'));
    expect(width({ ...all }, 'sheet')).toBeGreaterThan(width({ ...all }, 'lineup'));
  });

  test('is rounded up to ten pixels, and stays between a nickname alone and a very full roster', () => {
    for (const options of [{}, { ...all }, { elo: false, kd: false, winRate: false, avatars: false, levels: false }]) {
      const value = width(options as Partial<TeamOptions>);
      expect(value % 10).toBe(0);
      expect(value).toBeGreaterThanOrEqual(180);
      expect(value).toBeLessThanOrEqual(1400);
    }
  });

  test('even every column fits: the stat cells plus a readable nickname are inside the width', () => {
    const everything = width({ ...all, rank: true });
    const statCells = 58 + 46 + 42 + 42 + 42 + 42 + 52 + 52 + 42;
    expect(everything).toBeGreaterThanOrEqual(statCells + 130 + 32 + 22 + 18 + 36);
  });
});

describe('the recommended width follows the data in the generator', () => {
  const settings = (extra: Record<string, unknown>) => ({ ...defaultSettings(), widgetMode: 'team', bannerDesign: '2026', style: 'lineup', ...extra }) as never;

  test('the size control shows the width the chosen columns need', () => {
    const plain = renderWithApp(<BannerSizeControls />, settings({}));
    const plainText = plain.container.querySelector('.banner-size-heading span')?.textContent ?? '';
    plain.unmount();
    const rich = renderWithApp(<BannerSizeControls />, settings({ teamShowHs: true, teamShowAdr: true, teamShowMatches: true, teamShowRank: true }));
    const richText = rich.container.querySelector('.banner-size-heading span')?.textContent ?? '';
    const numbers = (text: string) => [...text.matchAll(/\d+/g)].map((match) => Number(match[0]));
    expect(Math.max(...numbers(richText))).toBeGreaterThan(Math.max(...numbers(plainText)));
    const expected = teamRecommendedWidth(readTeamOptions((key) => ({ teamShowHs: true, teamShowAdr: true, teamShowMatches: true, teamShowRank: true })[key as string]), 'lineup');
    expect(richText).toContain(String(expected));
  });
});

describe('the OBS source size in the link dialog follows the data', () => {
  const language = languages.find((entry) => entry.id === 'pl')!;
  const open = (url: string) => render(<GeneratedWidgetModal language={language} url={url} setURL={() => undefined} />).container;
  const base = 'https://faceitbanner.test/widget/?username=donk666&design=2026&style=lineup&mode=team&roster=donk666,ropz';

  test('a roster with more columns recommends a wider source than the default one', () => {
    const plain = open(base).querySelector('.obs-size-value')?.textContent ?? '';
    const rich = open(`${base}&team_hs=true&team_adr=true&team_kr=true&team_matches=true&team_wins=true&team_streak=true`).querySelector('.obs-size-value')?.textContent ?? '';
    const wide = (text: string) => Number(/(\d+) ×/.exec(text)?.[1]);
    expect(wide(rich)).toBeGreaterThan(wide(plain));
    const expected = teamRecommendedWidth({ ...TEAM_DEFAULTS, hs: true, adr: true, kr: true, matches: true, wins: true, streak: true }, 'lineup');
    expect(wide(rich)).toBe(expected);
  });

  test('the default roster link still shows its default width', () => {
    const text = open(base).querySelector('.obs-size-value')?.textContent ?? '';
    expect(Number(/(\d+) ×/.exec(text)?.[1])).toBe(teamRecommendedWidth(TEAM_DEFAULTS, 'lineup'));
  });

  test('the sheet layout and a larger text size are taken into account too', () => {
    const sheet = open(base.replace('style=lineup', 'style=sheet')).querySelector('.obs-size-value')?.textContent ?? '';
    expect(Number(/(\d+) ×/.exec(sheet)?.[1])).toBe(teamRecommendedWidth(TEAM_DEFAULTS, 'sheet'));
    const big = open(`${base}&team_font_scale=120`).querySelector('.obs-size-value')?.textContent ?? '';
    expect(Number(/(\d+) ×/.exec(big)?.[1])).toBe(teamRecommendedWidth({ ...TEAM_DEFAULTS, fontScale: 120 }, 'lineup'));
  });
});
