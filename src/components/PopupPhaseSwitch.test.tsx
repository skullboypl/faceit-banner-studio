import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { PopupPhaseSwitch } from './PopupOptions';
import { defaultSettings, renderWithApp } from './test-utils';

describe('PopupPhaseSwitch', () => {
  test('offers before, live and after and marks the previewed phase', () => {
    renderWithApp(<PopupPhaseSwitch />, { ...defaultSettings(), popupPreview: 'post' } as never);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.querySelector('strong')?.textContent)).toEqual(['Przed', 'Live', 'Po']);
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
  });

  test('clicking a phase changes the widget preview', () => {
    const { set } = renderWithApp(<PopupPhaseSwitch />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(set).toHaveBeenCalledWith('popupPreview', 'pre');
  });

  test('the label says what the switch does', () => {
    renderWithApp(<PopupPhaseSwitch />);
    expect(screen.getByRole('group', { name: 'Podgląd fazy' })).toBeTruthy();
  });

  test('each phase says in a subtitle which moment of the match it is', () => {
    renderWithApp(<PopupPhaseSwitch />);
    const hints = screen.getAllByRole('button').map((button) => button.querySelector('small')?.textContent);
    expect(hints).toEqual(['Lobby: skład i mapa', 'Mecz trwa', 'Wynik i statystyki']);
  });
});
