import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { SETTINGS_DEFINITIONS } from './settings/definition';
import { TEAM_DEFAULTS, readTeamOptions, type TeamOptions } from '../widget/src/widget/team-options';

vi.mock('../widget/src/utils/faceit_util', () => ({
  lookupRosterCard: vi.fn(async (name: string) => ({
    username: name,
    avatar: name === 'noavatar' ? undefined : `https://cdn.test/${name}.jpg`,
    elo: { alpha: 1500, bravo: 2200, charlie: 1800, noavatar: 1000 }[name] ?? 1000,
    level: name === 'bravo' ? 10 : 7,
    ranking: name === 'bravo' ? 50 : undefined,
    kd: { alpha: 1.1, bravo: 1.4, charlie: 1.25 }[name] ?? 1.25,
    winRate: 55,
    hs: { alpha: 40, bravo: 55, charlie: 47 }[name] ?? 40,
    adr: { alpha: 70, bravo: 91, charlie: 80 }[name] ?? 70,
    kr: { alpha: 0.7, bravo: 0.85, charlie: 0.77 }[name] ?? 0.7,
    matches: { alpha: 1200, bravo: 3400, charlie: 800 }[name] ?? 500,
    wins: { alpha: 600, bravo: 1900, charlie: 410 }[name] ?? 250,
    losses: { alpha: 8, bravo: 2, charlie: 11 }[name] ?? 10,
    streak: { alpha: 0, bravo: 5, charlie: 2 }[name] ?? 0,
    form: (name === 'bravo' ? ['W', 'W', 'L', 'W', 'W', 'L'] : ['L', 'W', 'W', 'L', 'W']) as ('W' | 'L')[],
  })),
}));

import { lookupRosterCard } from '../widget/src/utils/faceit_util';
import { TeamBanner } from '../widget/src/widget/TeamBanner';

const translate = (text: string) =>
  ({
    'team.kicker': 'Skład',
    'team.avg': 'śr.',
    'team.empty': 'Pusto',
    'team.stat.matches': 'MECZE',
    'team.stat.wins': 'WYGR.',
    'team.stat.streak': 'SERIA',
    'widget.wins': 'wygrane',
    'widget.losses': 'porażki',
    'team.window_short': 'ostatnie 20',
    'team.session_caption': 'aktualna sesja',
  })[text] ?? text;

const draw = async (
  options: Partial<TeamOptions> = {},
  roster = 'alpha,bravo,charlie',
  layout: 'lineup' | 'sheet' = 'lineup',
  owner = '',
  session = { wins: 0, losses: 0, form: [] as ('W' | 'L')[] }
) => {
  const asked = vi.mocked(lookupRosterCard).mock.calls.length;
  const view = render(
    <TeamBanner
      roster={roster}
      layout={layout}
      owner={owner}
      session={session}
      options={{ ...TEAM_DEFAULTS, ...options }}
      translate={translate}
    />
  );
  /* wait until every lookup was asked for and its answer was applied */
  await waitFor(() => expect(vi.mocked(lookupRosterCard).mock.calls.length - asked).toBeGreaterThanOrEqual(roster.split(',').length));
  await act(async () => undefined);
  await waitFor(() => expect(view.container.querySelector('.team-name')?.textContent).toBeTruthy());
  return view.container;
};
const names = (root: HTMLElement) => [...root.querySelectorAll('.team-name')].map((node) => node.textContent);

beforeEach(() => vi.clearAllMocks());

describe('readTeamOptions', () => {
  test('everything is shown by default, in the given order, in a comfortable density', () => {
    const options = readTeamOptions(() => undefined);
    expect(options).toEqual(TEAM_DEFAULTS);
    expect(TEAM_DEFAULTS).toMatchObject({ avatars: true, levels: true, elo: true, kd: true, winRate: true, average: true, sort: 'order', density: 'comfortable', title: '' });
  });

  test('takes valid values from the settings and ignores invalid ones', () => {
    const options = readTeamOptions((key) => ({ teamShowKd: false, teamDensity: 'compact', teamSort: 'elo' })[key as string]);
    expect(options).toMatchObject({ kd: false, density: 'compact', sort: 'elo' });
    expect(readTeamOptions((key) => (key === 'teamDensity' ? 'huge' : undefined)).density).toBe('comfortable');
  });

  test('the recent window is 20 or 30, and the owner form is on unless turned off', () => {
    expect(readTeamOptions(() => undefined)).toMatchObject({ matchWindow: 20, form: true, playerForm: false });
    expect(readTeamOptions((key) => (key === 'teamMatchWindow' ? '30' : key === 'teamShowForm' ? false : key === 'teamShowPlayerForm' ? true : undefined))).toMatchObject({
      matchWindow: 30,
      form: false,
      playerForm: true,
    });
    expect(readTeamOptions((key) => (key === 'teamMatchWindow' ? 'lifetime' : undefined)).matchWindow).toBe(20);
  });

  test('the title is trimmed and capped at 24 characters', () => {
    expect(readTeamOptions((key) => (key === 'teamTitle' ? '  Team Skull  ' : undefined)).title).toBe('Team Skull');
    expect(readTeamOptions((key) => (key === 'teamTitle' ? 'x'.repeat(80) : undefined)).title).toHaveLength(24);
    expect(readTeamOptions((key) => (key === 'teamTitle' ? 5 : undefined)).title).toBe('');
  });

  test('every team option is a team-only setting with a query name', () => {
    const keys = Object.keys(SETTINGS_DEFINITIONS).filter((key) => /^team[A-Z]/.test(key) && key !== 'teamRoster');
    expect(keys.length).toBeGreaterThanOrEqual(29);
    for (const key of keys) {
      const definition = SETTINGS_DEFINITIONS[key as keyof typeof SETTINGS_DEFINITIONS] as { query?: string[]; requirements?: unknown };
      expect(definition.query?.[0], key).toMatch(/^team_/);
      expect(definition.requirements, key).toEqual([{ setting: 'widgetMode', value: 'team' }]);
    }
  });
});

describe('TeamBanner options', () => {
  test('shows avatar, level, ELO, K/D and win rate for every player by default', async () => {
    const root = await draw();
    expect(root.querySelectorAll('li img').length).toBe(3);
    expect(root.querySelectorAll('li svg').length).toBe(3);
    expect(root.querySelectorAll('li p').length).toBe(9);
  });

  test('a level 10 in the top 1000 uses the challenger mark as the level icon', async () => {
    const root = await draw({}, 'alpha,bravo');
    const row = (name: string) =>
      [...root.querySelectorAll('li')].find((item) => item.querySelector('.team-name')?.textContent === name);
    expect(row('bravo')?.querySelector('[data-tier="challenger"]')).toBeTruthy();
    expect(row('alpha')?.querySelector('[data-tier="challenger"]')).toBeNull();
    expect(row('alpha')?.querySelector('.faceit-level-mark')?.getAttribute('style')).toContain('--faceit-level-7');
  });

  test('each column and picture can be hidden on its own', async () => {
    expect((await draw({ avatars: false })).querySelector('li img, li i')).toBeNull();
    expect((await draw({ levels: false })).querySelector('li svg')).toBeNull();
    const noElo = await draw({ elo: false });
    expect([...noElo.querySelectorAll('li small')].map((node) => node.textContent)).not.toContain('ELO');
    const noKd = await draw({ kd: false });
    expect([...noKd.querySelectorAll('li small')].map((node) => node.textContent)).not.toContain('K/D');
    const noWr = await draw({ winRate: false });
    expect([...noWr.querySelectorAll('li small')].map((node) => node.textContent)).not.toContain('WR');
  });

  test('the average in the header can be turned off, and the header can carry the player\'s own title', async () => {
    expect((await draw({ average: false })).querySelector('.team-head em')).toBeNull();
    const titled = await draw({ title: 'Team Skull' });
    expect(titled.querySelector('.team-head span')?.textContent).toBe('Team Skull');
    expect((await draw()).querySelector('.team-head span')?.textContent).toBe('Skład');
  });

  test('players can be sorted by ELO, best first, otherwise keep the typed order', async () => {
    expect(names(await draw())).toEqual(['alpha', 'bravo', 'charlie']);
    expect(names(await draw({ sort: 'elo' }))).toEqual(['bravo', 'charlie', 'alpha']);
  });

  test('density reaches the banner as a class, in both layouts', async () => {
    expect((await draw({ density: 'compact' })).querySelector('.team-banner')?.classList.contains('is-compact')).toBe(true);
    expect((await draw({ density: 'comfortable' }, 'a,b', 'sheet')).querySelector('.team-banner')?.classList.contains('is-compact')).toBe(false);
  });

  test('hidden columns also change a data attribute the stylesheet uses to reflow the grid', async () => {
    const root = await draw({ kd: false, winRate: false });
    expect((root.querySelector('.team-banner') as HTMLElement).dataset.stats).toBe('elo');
    expect(((await draw()).querySelector('.team-banner') as HTMLElement).dataset.stats).toBe('elo,kd,wr');
    expect(((await draw({ elo: false, kd: false, winRate: false })).querySelector('.team-banner') as HTMLElement).dataset.stats).toBe('');
  });
});

describe('readTeamOptions: look options', () => {
  test('defaults give a dark panel with card rows, round pictures and a staggered entrance', () => {
    expect(TEAM_DEFAULTS).toMatchObject({
      theme: 'dark',
      radius: 16,
      opacity: 92,
      rows: 'cards',
      avatarShape: 'circle',
      rank: false,
      eloBar: false,
      highlightTop: false,
      fontScale: 100,
      animation: 'stagger',
    });
  });

  test('valid values are read, anything else falls back, numbers are clamped', () => {
    const read = (values: Record<string, unknown>) => readTeamOptions((key) => values[key]);
    expect(read({ teamTheme: 'glass', teamRows: 'flat', teamAvatarShape: 'square', teamAnimation: 'fade' })).toMatchObject({
      theme: 'glass',
      rows: 'flat',
      avatarShape: 'square',
      animation: 'fade',
    });
    expect(read({ teamTheme: 'rainbow', teamRows: 'x', teamAvatarShape: 'hexagon', teamAnimation: 'spin' })).toMatchObject({
      theme: 'dark',
      rows: 'cards',
      avatarShape: 'circle',
      animation: 'stagger',
    });
    expect(read({ teamRadius: 999, teamOpacity: 1, teamFontScale: 5 })).toMatchObject({ radius: 28, opacity: 40, fontScale: 80 });
    expect(read({ teamRadius: 'x', teamOpacity: null })).toMatchObject({ radius: 16, opacity: 92 });
  });
});

describe('TeamBanner look', () => {
  test('theme, row style, picture shape and entrance reach the banner as data attributes', async () => {
    const banner = (await draw({ theme: 'glass', rows: 'flat', avatarShape: 'rounded', animation: 'fade' })).querySelector('.team-banner') as HTMLElement;
    expect([banner.dataset.theme, banner.dataset.rows, banner.dataset.avatar, banner.dataset.animation]).toEqual(['glass', 'flat', 'rounded', 'fade']);
  });

  test('radius, opacity and text scale reach it as CSS variables', async () => {
    const banner = (await draw({ radius: 6, opacity: 70, fontScale: 120 })).querySelector('.team-banner') as HTMLElement;
    expect(banner.style.getPropertyValue('--team-radius')).toBe('6px');
    expect(banner.style.getPropertyValue('--team-opacity')).toBe('0.7');
    expect(banner.style.getPropertyValue('--team-scale')).toBe('1.2');
  });

  test('numbers the players in the order they are shown, only when asked', async () => {
    expect([...(await draw({ rank: true, sort: 'elo' })).querySelectorAll('.team-rank')].map((node) => node.textContent)).toEqual(['1', '2', '3']);
    expect((await draw()).querySelector('.team-rank')).toBeNull();
  });

  test('draws an ELO bar under each name, as a share of the best player, only when asked', async () => {
    const widths = [...(await draw({ eloBar: true })).querySelectorAll('.team-bar')].map((node) => (node as HTMLElement).style.width);
    expect(widths).toEqual(['68%', '100%', '82%']);
    expect((await draw()).querySelector('.team-bar')).toBeNull();
  });

  test('highlights the best ELO, only when asked', async () => {
    const top = [...(await draw({ highlightTop: true })).querySelectorAll('li.is-top .team-name')].map((node) => node.textContent);
    expect(top).toEqual(['bravo']);
    expect((await draw()).querySelector('li.is-top')).toBeNull();
  });

  test('the owner form is the session tally, and each row can show its own recent form', async () => {
    const header = await draw({}, 'alpha,bravo', 'lineup', 'bravo', { wins: 2, losses: 1, form: ['W', 'L', 'W'] });
    const owner = header.querySelector('.team-owner-form');
    expect(owner?.textContent).toContain('bravo');
    expect(owner?.textContent).toContain('2');
    expect(owner?.textContent).not.toContain('1900');
    expect(owner?.textContent).toContain('wygrane');
    expect(owner?.textContent).toContain('porażki');
    expect(owner?.textContent).toContain('aktualna sesja');
    expect(owner?.textContent).not.toContain('ostatnie');
    const head = header.querySelector('.team-head');
    expect(head?.firstElementChild?.className).toBe('team-head-lead');
    expect(head?.querySelector('.team-head-lead em')?.textContent).toContain('śr.');
    expect(head?.lastElementChild?.className).toBe('team-owner-form');
    expect(owner?.querySelectorAll('.team-form i')).toHaveLength(3);
    expect(header.querySelector('li .team-form')).toBeNull();

    const rows = await draw({ playerForm: true }, 'alpha,bravo', 'lineup', 'missing-owner', { wins: 0, losses: 0, form: [] });
    expect(rows.querySelectorAll('li .team-form')).toHaveLength(2);
    expect(rows.querySelector('.team-owner-form')?.textContent).toContain('missing-owner');
    expect(rows.querySelector('.team-owner-form')?.textContent).toContain('0');
    expect(vi.mocked(lookupRosterCard).mock.calls.some(([name]) => name === 'missing-owner')).toBe(false);
  });

  test('a 30-match window is what the roster asks FACEIT for', async () => {
    await draw({ matchWindow: 30 }, 'alpha');
    expect(vi.mocked(lookupRosterCard).mock.calls.some(([, window]) => window === 30)).toBe(true);
  });

  test('each row knows its place for the staggered entrance', async () => {
    const rows = [...(await draw()).querySelectorAll('li')] as HTMLElement[];
    expect(rows.map((row) => row.style.getPropertyValue('--i'))).toEqual(['0', '1', '2']);
  });
});

describe('readTeamOptions: more data and colours', () => {
  const read = (values: Record<string, unknown>) => readTeamOptions((key) => values[key]);

  test('extra stat columns, captions and colours have quiet defaults', () => {
    expect(TEAM_DEFAULTS).toMatchObject({
      hs: false,
      adr: false,
      kr: false,
      matches: false,
      wins: false,
      streak: false,
      labels: true,
      panelColor: '',
      textColor: '',
      barColor: '',
      topColor: '',
    });
  });

  test('sorting offers the typed order, ELO, K/D, win rate, headshots, ADR and matches', () => {
    for (const sort of ['order', 'elo', 'kd', 'wr', 'hs', 'adr', 'matches']) expect(read({ teamSort: sort }).sort).toBe(sort);
    expect(read({ teamSort: 'luck' }).sort).toBe('order');
  });

  test('a colour is six hex digits (any case), anything else means "use the theme"', () => {
    expect(read({ teamPanelColor: 'FF8800', teamTextColor: 'ffffff', teamBarColor: '12ab34', teamTopColor: '000000' })).toMatchObject({
      panelColor: 'ff8800',
      textColor: 'ffffff',
      barColor: '12ab34',
      topColor: '000000',
    });
    for (const bad of ['red', '#fff', '12345', '12345g', 'ff88001', 5, null]) expect(read({ teamPanelColor: bad }).panelColor, String(bad)).toBe('');
  });

  test('colour settings accept only a hex colour or nothing', () => {
    for (const key of ['teamPanelColor', 'teamTextColor', 'teamBarColor', 'teamTopColor']) {
      const definition = SETTINGS_DEFINITIONS[key as keyof typeof SETTINGS_DEFINITIONS] as { regex?: RegExp; defaultValue?: string };
      expect(definition.defaultValue, key).toBe('');
      expect(definition.regex?.test('ff8800'), key).toBe(true);
      expect(definition.regex?.test(''), key).toBe(true);
      expect(definition.regex?.test('<script>'), key).toBe(false);
    }
  });
});

describe('TeamBanner: more data', () => {
  const labels = (root: HTMLElement) => [...root.querySelectorAll('li:first-child small')].map((node) => node.textContent);

  test('each extra stat is its own column, shown only when asked', async () => {
    expect(labels(await draw())).toEqual(['ELO', 'K/D', 'WR']);
    expect(labels(await draw({ hs: true }))).toEqual(['ELO', 'K/D', 'WR', 'HS%']);
    expect(labels(await draw({ adr: true, kr: true, matches: true, wins: true, streak: true }))).toEqual(['ELO', 'K/D', 'WR', 'ADR', 'K/R', 'MECZE', 'WYGR.', 'SERIA']);
  });

  test('shows each player\'s own numbers in those columns', async () => {
    const root = await draw({ elo: false, kd: false, winRate: false, hs: true, adr: true, kr: true, matches: true, wins: true, streak: true });
    const bravo = [...root.querySelectorAll('li')].find((row) => row.querySelector('.team-name')?.textContent === 'bravo')!;
    expect([...bravo.querySelectorAll('.team-stat b')].map((node) => node.textContent)).toEqual(['55%', '91', '0.85', '3400', '1900', '5']);
  });

  test('a stat FACEIT does not return shows a dash, never a zero or NaN', async () => {
    const root = await draw({ elo: false, kd: false, winRate: false, streak: true });
    const alpha = [...root.querySelectorAll('li')].find((row) => row.querySelector('.team-name')?.textContent === 'alpha')!;
    expect(alpha.querySelector('.team-stat b')?.textContent).toBe('—');
  });

  test('players can be ordered by any of the stats, best first', async () => {
    expect(names(await draw({ sort: 'kd' }))).toEqual(['bravo', 'charlie', 'alpha']);
    expect(names(await draw({ sort: 'hs' }))).toEqual(['bravo', 'charlie', 'alpha']);
    expect(names(await draw({ sort: 'adr' }))).toEqual(['bravo', 'charlie', 'alpha']);
    expect(names(await draw({ sort: 'matches' }))).toEqual(['bravo', 'alpha', 'charlie']);
    expect(names(await draw({ sort: 'order' }))).toEqual(['alpha', 'bravo', 'charlie']);
  });

  test('the small captions under the numbers can be switched off', async () => {
    expect((await draw({ labels: false })).querySelector('li small')).toBeNull();
    expect((await draw()).querySelector('li small')).toBeTruthy();
  });
});

describe('TeamBanner: colours', () => {
  const banner = async (options: Partial<TeamOptions>) => (await draw(options)).querySelector('.team-banner') as HTMLElement;

  test('a custom panel colour becomes an rgb variable and marks the banner', async () => {
    const element = await banner({ panelColor: 'ff8800' });
    expect(element.style.getPropertyValue('--team-panel-rgb')).toBe('255, 136, 0');
    expect(element.dataset.panel).toBe('custom');
  });

  test('text, bar and highlight colours become variables', async () => {
    const element = await banner({ textColor: 'eeeeee', barColor: '00ff88', topColor: 'ff0044' });
    expect(element.style.getPropertyValue('--team-text')).toBe('#eeeeee');
    expect(element.style.getPropertyValue('--team-bar')).toBe('#00ff88');
    expect(element.style.getPropertyValue('--team-top')).toBe('#ff0044');
    expect(element.dataset.text).toBe('custom');
  });

  test('with no custom colours nothing is overridden', async () => {
    const element = await banner({});
    expect(element.style.getPropertyValue('--team-panel-rgb')).toBe('');
    expect(element.style.getPropertyValue('--team-text')).toBe('');
    expect(element.dataset.panel).toBeUndefined();
    expect(element.dataset.text).toBeUndefined();
  });

  test('the stylesheet uses those variables', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('widget/src/styles/modes-preset.less', 'utf8');
    for (const name of ['--team-panel-rgb', '--team-text', '--team-bar', '--team-top']) expect(css, name).toContain(`var(${name}`);
  });
});
