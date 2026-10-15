import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { PopupFontOptions, PopupLayoutPicker } from './PopupOptions';
import { PresetCards } from './PresetCards';
import { defaultSettings, renderWithApp } from './test-utils';

const withSettings = (extra: Record<string, unknown>) => ({ ...defaultSettings(), widgetMode: 'popup', ...extra }) as never;

describe('layout picker', () => {
  test('offers card, stack and strip with a small picture of each, and no big-score layout', () => {
    const { container } = renderWithApp(<PopupLayoutPicker />, withSettings({}));
    const buttons = [...container.querySelectorAll('.popup-layouts button')];
    expect(buttons.map((button) => button.querySelector('strong')?.textContent)).toEqual([
      'Karta (dwie kolumny)',
      'Drużyny jedna pod drugą',
      'Cienki pasek',
    ]);
    for (const button of buttons) expect(button.querySelector('svg.layout-thumb'), button.textContent ?? '').toBeTruthy();
    expect(container.textContent).not.toContain('Wielki wynik');
  });

  test('each picture is drawn differently', () => {
    const { container } = renderWithApp(<PopupLayoutPicker />, withSettings({}));
    const drawings = [...container.querySelectorAll('svg.layout-thumb')].map((svg) => svg.innerHTML);
    expect(new Set(drawings).size).toBe(3);
  });
});

describe('the single Live card theme', () => {
  test('is not offered as a button in popup mode, where it is the only choice', () => {
    const { container } = renderWithApp(<PresetCards mode="popup" />, withSettings({}));
    expect(container.querySelector('.broadcast-preset')).toBeNull();
  });

  test('other modes keep their theme cards', () => {
    const { container } = renderWithApp(<PresetCards mode="solo" />, { ...defaultSettings(), bannerDesign: '2026' } as never);
    expect(container.querySelectorAll('.broadcast-preset').length).toBeGreaterThan(1);
  });
});

describe('font size options', () => {
  test('list one slider per element of the current layout', () => {
    renderWithApp(<PopupFontOptions />, withSettings({ popupLayout: 'card' }));
    for (const label of ['Tytuł fazy', 'Wynik', 'Nazwa drużyny', 'Średnie ELO', 'Nicki graczy', 'Liczby (ELO i statystyki)', 'Moje statystyki']) {
      expect(screen.getByLabelText(new RegExp(label.replace(/[()]/g, (char) => '\\' + char))), label).toBeTruthy();
    }
  });

  test('the strip has no roster, so no nickname or number sliders', () => {
    renderWithApp(<PopupFontOptions />, withSettings({ popupLayout: 'strip' }));
    expect(screen.queryByLabelText(/Nicki graczy/)).toBeNull();
    expect(screen.queryByLabelText(/Liczby/)).toBeNull();
    expect(screen.getByLabelText(/Wynik/)).toBeTruthy();
  });

  test('a change is saved for the current layout only, next to what other layouts already have', () => {
    const stored = JSON.stringify({ strip: { score: 70 } });
    const { set } = renderWithApp(<PopupFontOptions />, withSettings({ popupLayout: 'card', popupFonts: stored }));
    fireEvent.change(screen.getByLabelText(/Wynik/), { target: { value: '140' } });
    expect(set).toHaveBeenCalledWith('popupFonts', JSON.stringify({ strip: { score: 70 }, card: { score: 140 } }));
  });

  test('shows the saved size and offers a reset for the layout', () => {
    const { set } = renderWithApp(
      <PopupFontOptions />,
      withSettings({ popupLayout: 'card', popupFonts: JSON.stringify({ card: { score: 150 }, strip: { score: 70 } }) })
    );
    expect((screen.getByLabelText(/Wynik/) as HTMLInputElement).value).toBe('150');
    fireEvent.click(screen.getByRole('button', { name: /Przywróć domyślne/ }));
    expect(set).toHaveBeenCalledWith('popupFonts', JSON.stringify({ strip: { score: 70 } }));
  });

  test('says which layout the sizes belong to', () => {
    renderWithApp(<PopupFontOptions />, withSettings({ popupLayout: 'stack' }));
    expect(screen.getByText(/Rozmiary czcionek układu: Drużyny jedna pod drugą/)).toBeTruthy();
  });
});
