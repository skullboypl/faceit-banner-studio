import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { SplitLookOptions, SplitOptionsPanel } from './SplitOptions';
import { defaultSettings, renderWithApp } from './test-utils';
import { RADAR_PRESETS } from '../../widget/src/widget/split-options';

const withSettings = (extra: Record<string, unknown>) => ({ ...defaultSettings(), widgetMode: 'split', ...extra }) as never;

describe('SplitOptionsPanel', () => {
  test('a preset fills the list and a switch writes any mix', () => {
    const { set } = renderWithApp(<SplitOptionsPanel />, withSettings({}));
    expect(screen.getByRole('button', { name: 'Walka' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Rozbudowane' }));
    expect(set).toHaveBeenCalledWith('splitAxes', RADAR_PRESETS.full.join(','));
    fireEvent.click(screen.getByRole('button', { name: 'ELO i sesja' }));
    expect(set).toHaveBeenCalledWith('splitCamera', 'elo,session');
    fireEvent.click(screen.getByRole('switch', { name: 'K/D' }));
    expect(set).toHaveBeenCalledWith('splitAxes', 'adr,hs,wr,kills');
    fireEvent.click(screen.getByRole('button', { name: 'Dane' }));
    expect(set).toHaveBeenCalledWith('splitView', 'data');
  });

  test('each radar layout offers its own look', () => {
    const data = renderWithApp(<SplitOptionsPanel />, withSettings({ splitView: 'data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    expect(data.set).toHaveBeenCalledWith('splitDataLook', 'list');
    data.unmount();
    const motion = renderWithApp(<SplitOptionsPanel />, withSettings({ splitView: 'motion' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cykl' }));
    expect(motion.set).toHaveBeenCalledWith('splitMotionLook', 'cycle');
    motion.unmount();
    const chart = renderWithApp(<SplitOptionsPanel />, withSettings({ splitView: 'chart' }));
    expect(screen.getByRole('button', { name: 'Obok wykresu' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Na osiach' }));
    expect(chart.set).toHaveBeenCalledWith('splitChartLook', 'ring');
  });

  test('shows the saved mix instead of the legacy preset', () => {
    renderWithApp(<SplitOptionsPanel />, withSettings({ splitAxes: 'wins,losses', splitCamera: 'elo,session', splitRadar: 'combat' }));
    expect(screen.getByRole('switch', { name: 'Wygrane sesji' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: 'K/D' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('button', { name: 'ELO i sesja' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Walka' }).getAttribute('aria-pressed')).toBe('false');
  });
});

describe('SplitLookOptions', () => {
  test('theme, accent and radius write the plate settings', () => {
    const { set } = renderWithApp(<SplitLookOptions />, withSettings({ splitsetAccent: 'ff5900' }));
    fireEvent.change(screen.getByLabelText('Motyw'), { target: { value: 'glass' } });
    expect(set).toHaveBeenCalledWith('splitTheme', 'glass');
    fireEvent.change(screen.getByLabelText('Kolor akcentu'), { target: { value: '#112233' } });
    expect(set).toHaveBeenCalledWith('splitAccent', '112233');
    fireEvent.change(screen.getByLabelText(/Zaokrąglenie/), { target: { value: '40' } });
    expect(set).toHaveBeenCalledWith('splitRadius', 40);
  });
});
