import { screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { defaultSettings, renderWithApp } from '../../components/test-utils';
import { StatisticsTab } from './StatisticsTab';

const draw = (refreshInterval: number) => renderWithApp(<StatisticsTab />, { ...defaultSettings(), refreshInterval } as never);

describe('the refresh option of the Statistics tab', () => {
  test('offers 30, 60 and 120 seconds, and no faster choice', () => {
    draw(60);
    const select = screen.getByRole('combobox', { name: 'Odświeżaj statystyki co:' }) as HTMLSelectElement;
    expect([...select.options].map((option) => option.value)).toEqual(['30', '60', '120']);
    expect(select.value).toBe('60');
  });

  test('a banner saved with 10 seconds shows 30 and is moved to 30', () => {
    const { set } = draw(10);
    const select = screen.getByRole('combobox', { name: 'Odświeżaj statystyki co:' }) as HTMLSelectElement;
    expect(select.value).toBe('30');
    expect(set).toHaveBeenCalledWith('refreshInterval', 30);
  });

  test('a setting that is already slow is left alone', () => {
    const { set } = draw(120);
    expect(set).not.toHaveBeenCalledWith('refreshInterval', expect.anything());
  });
});
