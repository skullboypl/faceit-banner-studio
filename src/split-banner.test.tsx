import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { SplitBanner } from '../widget/src/widget/SplitBanner';
import { readSplitOptions, type SplitStats } from '../widget/src/widget/split-options';

const stats: SplitStats = { kd: 1.22, adr: 82, hs: 48, wr: 56, kills: 18, kr: 0.9, wins: 18, losses: 12, streak: 4 };

const banner = (values: Record<string, unknown>, part: 'radar' | 'camera') =>
  render(
    <SplitBanner
      part={part}
      options={readSplitOptions((key) => values[key])}
      stats={stats}
      username="donk666"
      elo={5194}
      level={10}
      ranking={1}
    />
  );

describe('SplitBanner', () => {
  test('two radar values are numbers and three draw the chart', () => {
    const { container, unmount } = banner({ splitAxes: 'kd,adr' }, 'radar');
    expect(screen.getByText('1.22')).toBeTruthy();
    expect(screen.getByText('ADR')).toBeTruthy();
    expect(container.querySelector('svg')).toBeNull();
    unmount();
    const chart = banner({ splitAxes: 'kd,adr,hs' }, 'radar');
    expect(chart.container.querySelector('svg')).toBeTruthy();
    expect(chart.container.querySelectorAll('text').length).toBe(3);
  });

  test('the camera bar can be only ELO and the session', () => {
    const { container } = banner({ splitCamera: 'elo,session' }, 'camera');
    expect(screen.getByText('5194')).toBeTruthy();
    expect(screen.getByText('ELO')).toBeTruthy();
    expect(screen.getByText('18')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.queryByText('donk666')).toBeNull();
    expect(container.querySelector('.split-session')).toBeTruthy();
  });

  test('none leaves a quiet placeholder', () => {
    banner({ splitAxes: 'none', splitRadar: 'combat' }, 'radar');
    expect(screen.getByText('—')).toBeTruthy();
  });
});
