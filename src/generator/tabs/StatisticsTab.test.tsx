import { screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { defaultSettings, renderWithApp } from '../../components/test-utils';
import { StatisticsTab } from './StatisticsTab';

const draw = (extra: Record<string, unknown>) => renderWithApp(<StatisticsTab />, { ...defaultSettings(), ...extra } as never);
const slotsHeading = () => screen.queryByText('Statystyki na banerze');

describe('Statistics tab: the four stat slots only where a banner uses them', () => {
  test('a solo banner that fills its slots shows them', () => {
    draw({ widgetMode: 'solo', bannerDesign: '2026', style: 'card' });
    expect(slotsHeading()).toBeTruthy();
  });

  test('the old design always uses the slots', () => {
    draw({ widgetMode: 'solo', bannerDesign: 'legacy', style: 'ticker' });
    expect(slotsHeading()).toBeTruthy();
  });

  test('ticker has its own per-banner numbers, so there are no slots to fill', () => {
    draw({ widgetMode: 'solo', bannerDesign: '2026', style: 'ticker' });
    expect(slotsHeading()).toBeNull();
  });

  test.each(['versus', 'team', 'split', 'popup'])('%s has its own options, so there are no slots to fill', (widgetMode) => {
    draw({ widgetMode, bannerDesign: '2026', style: 'card' });
    expect(slotsHeading()).toBeNull();
  });

  test('the data settings stay, with the official-matches switch, wherever the slots are hidden', () => {
    draw({ widgetMode: 'team', bannerDesign: '2026', style: 'lineup' });
    expect(screen.getByText('Pobieraj statystyki z ostatnich:')).toBeTruthy();
    expect(screen.getAllByRole('switch').length).toBeGreaterThan(0);
  });
});
