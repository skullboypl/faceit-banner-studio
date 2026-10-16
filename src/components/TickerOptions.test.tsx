import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { PresetSettings } from './PresetSettings';
import { defaultSettings, renderWithApp } from './test-utils';

const ticker = () => ({ ...defaultSettings(), bannerDesign: '2026', style: 'ticker' }) as never;
const boxFor = (text: string, index: number) => screen.getAllByRole('switch', { name: text })[index];

describe('ticker options', () => {
  test('each page lists its numbers, with the defaults ticked and the extras off', () => {
    renderWithApp(<PresetSettings />, ticker());
    expect(screen.getAllByRole('switch', { name: 'K/R' }).length).toBe(2);
    expect(screen.getAllByRole('switch', { name: 'HS %' }).length).toBe(2);
    expect(boxFor('Wygrane', 0).getAttribute('aria-checked')).toBe('true');
    expect(boxFor('K/R', 0).getAttribute('aria-checked')).toBe('false');
    expect(boxFor('K/R', 1).getAttribute('aria-checked')).toBe('true');
    expect(boxFor('HS %', 1).getAttribute('aria-checked')).toBe('false');
  });

  test('ticking HS % for the last matches writes that setting', () => {
    const { set } = renderWithApp(<PresetSettings />, ticker());
    fireEvent.click(boxFor('HS %', 1));
    expect(set).toHaveBeenCalledWith('tickerLastHs', true);
  });
});
