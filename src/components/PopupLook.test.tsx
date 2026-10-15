import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { PopupLookOptions } from './PopupOptions';
import { defaultSettings, renderWithApp } from './test-utils';

const withSettings = (extra: Record<string, unknown>) => ({ ...defaultSettings(), widgetMode: 'popup', ...extra }) as never;

describe('card size options', () => {
  test('are plain options, not hidden inside a dropdown', () => {
    const { container } = renderWithApp(<PopupLookOptions />, withSettings({}));
    expect(container.querySelector('details.popup-size')).toBeNull();
    const slider = screen.getByLabelText(/Szerokość karty/);
    expect(slider.closest('details')).toBeNull();
    expect(screen.getByLabelText(/Skala tekstu i elementów/).closest('details')).toBeNull();
  });

  test('sit under their own "Rozmiar karty" heading with the two-column hints', () => {
    const { container } = renderWithApp(<PopupLookOptions />, withSettings({}));
    const headings = [...container.querySelectorAll('.popup-group h4')].map((node) => node.textContent);
    expect(headings).toContain('Rozmiar karty');
    expect(screen.getByText(/Dla dwóch kolumn karta potrzebuje min\. \d+ px/)).toBeTruthy();
    expect(screen.getByText(/Przy ramce 1920 px: \d+ px/)).toBeTruthy();
  });
});

describe('position picker', () => {
  test('is a small 16:9 screen with nine places, the chosen one highlighted and no floating marker', () => {
    const { container } = renderWithApp(<PopupLookOptions />, withSettings({ popupPosition: 'bottom-right' }));
    expect(screen.getAllByRole('radio')).toHaveLength(9);
    expect(screen.getByRole('radio', { name: 'Dół, prawo' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getAllByRole('radio').filter((radio) => radio.getAttribute('aria-checked') === 'true')).toHaveLength(1);
    expect(container.querySelector('.popup-position-card')).toBeNull();
    expect(container.querySelector('.popup-position-screen')).toBeNull();
  });

  test('the stylesheet highlights the active zone itself', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/styles/app.less', 'utf8');
    expect(css).toMatch(/\.popup-position button\[aria-checked='true'\][^}]*background/);
    expect(css).not.toContain('.popup-position-card');
  });

  test('clicking a place moves the card there', () => {
    const { set } = renderWithApp(<PopupLookOptions />, withSettings({}));
    fireEvent.click(screen.getByRole('radio', { name: 'Góra, lewo' }));
    expect(set).toHaveBeenCalledWith('popupPosition', 'top-left');
  });

  test('names the chosen place in words', () => {
    renderWithApp(<PopupLookOptions />, withSettings({ popupPosition: 'left' }));
    expect(screen.getByText(/Środek, lewo/, { selector: 'strong' })).toBeTruthy();
  });
});

describe('map background options', () => {
  test('blur and opacity of the map image appear only when the map is on', () => {
    const off = renderWithApp(<PopupLookOptions />, withSettings({ popupMapBg: false }));
    expect(screen.queryByLabelText(/Rozmycie tła mapy/)).toBeNull();
    expect(screen.queryByLabelText(/Krycie obrazu mapy/)).toBeNull();
    off.unmount();
    renderWithApp(<PopupLookOptions />, withSettings({ popupMapBg: true }));
    expect(screen.getByLabelText(/Rozmycie tła mapy/)).toBeTruthy();
    expect(screen.getByLabelText(/Krycie obrazu mapy: 100%/)).toBeTruthy();
  });

  test('the opacity slider edits the map opacity', () => {
    const { set } = renderWithApp(<PopupLookOptions />, withSettings({ popupMapBg: true }));
    fireEvent.change(screen.getByLabelText(/Krycie obrazu mapy/), { target: { value: '55' } });
    expect(set).toHaveBeenCalledWith('popupMapOpacity', 55);
  });

  test('with a separate look per phase it is saved for the previewed phase only', () => {
    const { set } = renderWithApp(<PopupLookOptions />, withSettings({ popupMapBg: true, popupPerPhase: true, popupPreview: 'post', popupPhaseLook: '{"post":{"mapBg":true}}' }));
    fireEvent.change(screen.getByLabelText(/Krycie obrazu mapy/), { target: { value: '30' } });
    expect(set).toHaveBeenCalledWith('popupPhaseLook', JSON.stringify({ post: { mapBg: true, mapOpacity: 30 } }));
  });
});
