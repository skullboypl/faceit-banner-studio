import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { TeamLookOptions, TeamOptionsPanel } from './ModeOptions';
import { defaultSettings, renderWithApp } from './test-utils';

const withSettings = (extra: Record<string, unknown>) => ({ ...defaultSettings(), widgetMode: 'team', ...extra }) as never;

describe('TeamOptionsPanel (Settings tab): data and list', () => {
  test('has a switch for each picture, stat column and the header average', () => {
    renderWithApp(<TeamOptionsPanel />, withSettings({}));
    const names = ['Zdjęcia profilowe', 'Ikony poziomów', 'ELO', 'K/D', 'Win rate', 'HS% (średnia)', 'ADR (średnia)', 'K/R', 'Mecze', 'Wygrane', 'Seria wygranych', 'Średnie ELO w nagłówku'];
    for (const name of names) expect(screen.getByRole('switch', { name }), name).toBeTruthy();
  });

  test('the header label and the banner player session default to on, and a session column is its own switch', () => {
    const { set } = renderWithApp(<TeamOptionsPanel />, withSettings({}));
    expect(screen.getByRole('switch', { name: 'Napis w nagłówku' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Wygrane i porażki gracza banera w nagłówku' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Wygrane sesji' }).getAttribute('aria-checked')).toBe('false');
    fireEvent.click(screen.getByRole('switch', { name: 'Napis w nagłówku' }));
    expect(set).toHaveBeenCalledWith('teamShowKicker', false);
    fireEvent.click(screen.getByRole('switch', { name: 'Wygrane i porażki gracza banera w nagłówku' }));
    expect(set).toHaveBeenCalledWith('teamShowForm', false);
    fireEvent.click(screen.getByRole('switch', { name: 'Kille łącznie' }));
    expect(set).toHaveBeenCalledWith('teamSessionKills', true);
  });

  test('the stat switches flip their settings', () => {
    const { set } = renderWithApp(<TeamOptionsPanel />, withSettings({}));
    fireEvent.click(screen.getByRole('switch', { name: 'K/D' }));
    expect(set).toHaveBeenCalledWith('teamShowKd', false);
    fireEvent.click(screen.getByRole('switch', { name: 'HS% (średnia)' }));
    expect(set).toHaveBeenCalledWith('teamShowHs', true);
    fireEvent.click(screen.getByRole('switch', { name: 'ADR (średnia)' }));
    expect(set).toHaveBeenCalledWith('teamShowAdr', true);
    fireEvent.click(screen.getByRole('switch', { name: 'Seria wygranych' }));
    expect(set).toHaveBeenCalledWith('teamShowStreak', true);
  });

  test('sorting offers the typed order and every stat', () => {
    const { set } = renderWithApp(<TeamOptionsPanel />, withSettings({}));
    const select = screen.getByLabelText('Sortuj graczy') as HTMLSelectElement;
    expect([...select.options].map((option) => option.value)).toEqual(['order', 'elo', 'kd', 'wr', 'hs', 'adr', 'matches']);
    fireEvent.change(select, { target: { value: 'adr' } });
    expect(set).toHaveBeenCalledWith('teamSort', 'adr');
  });

  test('numbering, the ELO bar and highlighting the best player are list options', () => {
    const { set } = renderWithApp(<TeamOptionsPanel />, withSettings({}));
    for (const name of ['Numeruj graczy', 'Pasek ELO pod nickiem', 'Wyróżnij najlepszego gracza']) {
      expect(screen.getByRole('switch', { name }), name).toBeTruthy();
    }
    fireEvent.click(screen.getByRole('switch', { name: 'Numeruj graczy' }));
    expect(set).toHaveBeenCalledWith('teamShowRank', true);
  });

  test('the title is saved and stops at 24 characters', () => {
    const { set } = renderWithApp(<TeamOptionsPanel />, withSettings({}));
    const field = screen.getByLabelText(/Własny tytuł/) as HTMLInputElement;
    expect(field.maxLength).toBe(24);
    fireEvent.change(field, { target: { value: 'Team Skull' } });
    expect(set).toHaveBeenCalledWith('teamTitle', 'Team Skull');
  });

  test('does not carry the look controls any more: those live in the Look tab', () => {
    renderWithApp(<TeamOptionsPanel />, withSettings({}));
    for (const label of ['Motyw panelu', 'Styl wierszy', 'Kształt zdjęć', 'Animacja wejścia', 'Gęstość listy']) {
      expect(screen.queryByLabelText(label), label).toBeNull();
    }
    expect(screen.queryByLabelText('Kolor panelu')).toBeNull();
  });

  test('shows the current values', () => {
    renderWithApp(<TeamOptionsPanel />, withSettings({ teamShowKd: false, teamSort: 'hs', teamTitle: 'Moja ekipa' }));
    expect(screen.getByRole('switch', { name: 'K/D' }).getAttribute('aria-checked')).toBe('false');
    expect((screen.getByLabelText('Sortuj graczy') as HTMLSelectElement).value).toBe('hs');
    expect((screen.getByLabelText(/Własny tytuł/) as HTMLInputElement).value).toBe('Moja ekipa');
  });
});

describe('TeamLookOptions (Look tab)', () => {
  test('has selects for the theme, the row style, the picture shape, the density and the entrance', () => {
    const { set } = renderWithApp(<TeamLookOptions />, withSettings({}));
    fireEvent.change(screen.getByLabelText('Motyw panelu'), { target: { value: 'glass' } });
    expect(set).toHaveBeenCalledWith('teamTheme', 'glass');
    fireEvent.change(screen.getByLabelText('Styl wierszy'), { target: { value: 'flat' } });
    expect(set).toHaveBeenCalledWith('teamRows', 'flat');
    fireEvent.change(screen.getByLabelText('Kształt zdjęć'), { target: { value: 'square' } });
    expect(set).toHaveBeenCalledWith('teamAvatarShape', 'square');
    fireEvent.change(screen.getByLabelText('Gęstość listy'), { target: { value: 'compact' } });
    expect(set).toHaveBeenCalledWith('teamDensity', 'compact');
    fireEvent.change(screen.getByLabelText('Animacja wejścia'), { target: { value: 'fade' } });
    expect(set).toHaveBeenCalledWith('teamAnimation', 'fade');
  });

  test('has sliders for the radius, the panel opacity and the text size', () => {
    const { set } = renderWithApp(<TeamLookOptions />, withSettings({}));
    fireEvent.change(screen.getByLabelText(/Zaokrąglenie: 16 px/), { target: { value: '8' } });
    expect(set).toHaveBeenCalledWith('teamRadius', 8);
    fireEvent.change(screen.getByLabelText(/Krycie panelu: 92%/), { target: { value: '70' } });
    expect(set).toHaveBeenCalledWith('teamOpacity', 70);
    fireEvent.change(screen.getByLabelText(/Rozmiar tekstu: 100%/), { target: { value: '120' } });
    expect(set).toHaveBeenCalledWith('teamFontScale', 120);
  });

  test('the opacity slider disappears with the "no panel" theme, which has nothing to fade', () => {
    renderWithApp(<TeamLookOptions />, withSettings({ teamTheme: 'clear' }));
    expect(screen.queryByLabelText(/Krycie panelu/)).toBeNull();
  });

  test('the captions under the numbers are a look switch', () => {
    const { set } = renderWithApp(<TeamLookOptions />, withSettings({}));
    fireEvent.click(screen.getByRole('switch', { name: 'Podpisy pod liczbami' }));
    expect(set).toHaveBeenCalledWith('teamLabels', false);
  });

  test('has colour pickers for the panel, the text, the bars and the highlight, saved without the #', () => {
    const { set } = renderWithApp(<TeamLookOptions />, withSettings({}));
    const cases: [string, string][] = [
      ['Kolor panelu', 'teamPanelColor'],
      ['Kolor tekstu', 'teamTextColor'],
      ['Kolor pasków ELO', 'teamBarColor'],
      ['Kolor wyróżnienia', 'teamTopColor'],
    ];
    for (const [label, key] of cases) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: '#12ab34' } });
      expect(set, key).toHaveBeenCalledWith(key, '12ab34');
    }
  });

  test('a colour left unset says it follows the theme, and all can be reset', () => {
    const { set } = renderWithApp(<TeamLookOptions />, withSettings({ teamPanelColor: 'ff8800', teamBarColor: '00ff88' }));
    expect(screen.getAllByText('Jak w motywie').length).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Przywróć kolory motywu' }));
    for (const key of ['teamPanelColor', 'teamTextColor', 'teamBarColor', 'teamTopColor']) expect(set).toHaveBeenCalledWith(key, '');
  });

  test('the reset button is only active when some colour was changed', () => {
    renderWithApp(<TeamLookOptions />, withSettings({}));
    expect((screen.getByRole('button', { name: 'Przywróć kolory motywu' }) as HTMLButtonElement).disabled).toBe(true);
  });

  test('shows the saved values', () => {
    renderWithApp(<TeamLookOptions />, withSettings({ teamTheme: 'light', teamRows: 'flat', teamRadius: 4, teamFontScale: 110 }));
    expect((screen.getByLabelText('Motyw panelu') as HTMLSelectElement).value).toBe('light');
    expect((screen.getByLabelText('Styl wierszy') as HTMLSelectElement).value).toBe('flat');
    expect(screen.getByLabelText(/Zaokrąglenie: 4 px/)).toBeTruthy();
    expect(screen.getByLabelText(/Rozmiar tekstu: 110%/)).toBeTruthy();
  });
});
