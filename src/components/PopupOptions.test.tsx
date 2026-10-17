import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { PopupOptions } from './PopupOptions';
import { defaultSettings, renderWithApp } from './test-utils';

const withSettings = (extra: Record<string, unknown>) => ({ ...defaultSettings(), widgetMode: 'popup', ...extra }) as never;

describe('popup nationality flags', () => {
  test('are off until turned on, so existing widgets stay unchanged', () => {
    const { set } = renderWithApp(<PopupOptions />, withSettings({}));
    const toggle = screen.getByRole('switch', { name: 'Flagi narodowości' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(set).toHaveBeenCalledWith('popupShowCountry', true);
  });
});

describe('popup ELO sort', () => {
  test('says it is only before the match and live', () => {
    renderWithApp(<PopupOptions />, withSettings({}));
    expect(screen.getByRole('switch', { name: 'Sortuj graczy po ELO' })).toBeTruthy();
    expect(screen.getByText('Tylko przed meczem i na żywo. Po meczu zostaje kolejność z FACEIT.')).toBeTruthy();
  });
});

describe('popup hold and delay', () => {
  test('the sliders belong to the previewed phase', () => {
    renderWithApp(<PopupOptions />, withSettings({ popupPreview: 'live' }));
    expect(screen.getByText('Opóźnienie i długość dla fazy: Live. Każda faza ma własne suwaki.')).toBeTruthy();
  });

  test('moving length writes that phase only', () => {
    const { set } = renderWithApp(<PopupOptions />, withSettings({ popupPreview: 'post', popupSeconds: 12, popupDelay: 0 }));
    fireEvent.change(screen.getByLabelText(/Jak długo widać popup/), { target: { value: '20' } });
    expect(set).toHaveBeenCalledWith('popupPhaseTiming', JSON.stringify({ post: { seconds: 20, delay: 0 } }));
  });

  test('moving delay writes that phase only and keeps earlier phases', () => {
    const { set } = renderWithApp(
      <PopupOptions />,
      withSettings({
        popupPreview: 'live',
        popupPhaseTiming: JSON.stringify({ pre: { seconds: 8, delay: 2 } }),
      })
    );
    fireEvent.change(screen.getByLabelText(/Opóźnienie pokazania/), { target: { value: '5' } });
    expect(set).toHaveBeenCalledWith(
      'popupPhaseTiming',
      JSON.stringify({ pre: { seconds: 8, delay: 2 }, live: { seconds: 12, delay: 5 } })
    );
  });
});
