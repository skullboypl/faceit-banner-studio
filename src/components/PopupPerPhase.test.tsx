import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { PopupLayoutPicker, PopupLookOptions } from './PopupOptions';
import { defaultSettings, renderWithApp } from './test-utils';

const withSettings = (extra: Record<string, unknown>) => ({ ...defaultSettings(), widgetMode: 'popup', ...extra }) as never;

describe('per-phase look editing', () => {
  test('offers a checkbox for a separate look per phase', () => {
    renderWithApp(<PopupLayoutPicker />, withSettings({}));
    expect(screen.getByRole('switch', { name: /Osobny wygląd dla każdej fazy/ })).toBeTruthy();
  });

  test('turning it on is a plain setting change', () => {
    const { set } = renderWithApp(<PopupLayoutPicker />, withSettings({}));
    fireEvent.click(screen.getByRole('switch', { name: /Osobny wygląd dla każdej fazy/ }));
    expect(set).toHaveBeenCalledWith('popupPerPhase', true);
  });

  test('without the option, the theme select edits the global theme', () => {
    const { set } = renderWithApp(<PopupLookOptions />, withSettings({ popupPreview: 'post' }));
    fireEvent.change(screen.getByLabelText('Motyw karty'), { target: { value: 'neon' } });
    expect(set).toHaveBeenCalledWith('popupTheme', 'neon');
  });

  test('with the option, the same select edits only the previewed phase', () => {
    const { set } = renderWithApp(<PopupLookOptions />, withSettings({ popupPerPhase: true, popupPreview: 'post' }));
    fireEvent.change(screen.getByLabelText('Motyw karty'), { target: { value: 'neon' } });
    expect(set).toHaveBeenCalledWith('popupPhaseLook', JSON.stringify({ post: { theme: 'neon' } }));
  });

  test('edits of another phase are kept next to the new one', () => {
    const stored = JSON.stringify({ pre: { layout: 'strip' } });
    const { set } = renderWithApp(
      <PopupLookOptions />,
      withSettings({ popupPerPhase: true, popupPreview: 'live', popupPhaseLook: stored })
    );
    fireEvent.change(screen.getByLabelText('Motyw karty'), { target: { value: 'carbon' } });
    expect(set).toHaveBeenCalledWith('popupPhaseLook', JSON.stringify({ pre: { layout: 'strip' }, live: { theme: 'carbon' } }));
  });

  test('shows the phase being edited and what each field currently holds for it', () => {
    renderWithApp(
      <PopupLookOptions />,
      withSettings({ popupPerPhase: true, popupPreview: 'pre', popupPhaseLook: JSON.stringify({ pre: { theme: 'crimson' } }) })
    );
    expect((screen.getByLabelText('Motyw karty') as HTMLSelectElement).value).toBe('crimson');
    expect(screen.getByText(/Edytujesz wygląd fazy: Przed/)).toBeTruthy();
  });

  test('tells the minimum card width needed for two columns and where the current width lands on 1920 px', () => {
    renderWithApp(<PopupLookOptions />, withSettings({}));
    expect(screen.getByText(/Dla dwóch kolumn karta potrzebuje min\. \d+ px/)).toBeTruthy();
    expect(screen.getByText(/Przy ramce 1920 px: \d+ px/)).toBeTruthy();
  });
});
