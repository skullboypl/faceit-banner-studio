import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { AdminLogins } from './AdminLogins';
import { loginsCsv, type Login } from './data';

const logins: Login[] = Array.from({ length: 14 }, (_, i) => ({
  guid: `id-${i}`,
  nickname: `Player ${String(i).padStart(2, '0')}`,
  avatar: null,
  ip: `203.0.113.${i}`,
  createdAt: `2026-10-${String(i + 1).padStart(2, '0')}T12:00:00Z`,
}));

describe('AdminLogins', () => {
  test('paginates, sorts, searches by ID and resets the page when filtering', () => {
    render(<AdminLogins logins={logins} />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    expect(within(table).getAllByRole('row')[1].textContent).toContain(
      'Player 13'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Następna →' }));
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    fireEvent.change(screen.getByLabelText('Szukaj logowania'), {
      target: { value: 'id-12' },
    });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('Player 12')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Wyczyść filtry ×' }));
    fireEvent.change(screen.getByLabelText('Sortowanie'), {
      target: { value: 'old' },
    });
    expect(within(table).getAllByRole('row')[1].textContent).toContain(
      'Player 00'
    );
  });

  test('uses inclusive date filters and explains an invalid date range', () => {
    render(<AdminLogins logins={logins} />);
    fireEvent.change(screen.getByLabelText('Od dnia'), {
      target: { value: '2026-10-10' },
    });
    fireEvent.change(screen.getByLabelText('Do dnia'), {
      target: { value: '2026-10-10' },
    });
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(
      2
    );
    expect(screen.getByText('Player 09')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Od dnia'), {
      target: { value: '2026-10-11' },
    });
    expect(screen.getByRole('alert').textContent).toContain('Data początkowa');
    expect(
      (
        screen.getByRole('button', {
          name: 'Eksportuj CSV ↓',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  test('exports filtered rows rather than all entries', () => {
    vi.useFakeTimers();
    const create = vi.fn(() => 'blob:csv');
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn() });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    try {
      render(<AdminLogins logins={logins} />);
      fireEvent.change(screen.getByLabelText('Szukaj logowania'), {
        target: { value: 'Player 13' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Eksportuj CSV ↓' }));
      expect(create).toHaveBeenCalledOnce();
      expect((create.mock.calls[0] as unknown as [Blob])[0].size).toBe(
        new Blob([loginsCsv([logins[13]])]).size
      );
      expect(click).toHaveBeenCalledOnce();
    } finally {
      vi.runAllTimers();
      vi.useRealTimers();
      click.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  test('refreshes cache for a player on the logins table', async () => {
    const clearPlayer = vi.fn(async () => ['player']);
    render(
      <AdminLogins
        logins={[
          {
            guid: '11111111-1111-1111-1111-111111111111',
            nickname: 'Jebaka4K',
            avatar: null,
            ip: '203.0.113.9',
            createdAt: '2026-10-18T12:00:00Z',
          },
        ]}
        clearPlayer={clearPlayer}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Odśwież cache: Jebaka4K' }));
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(clearPlayer).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111');
  });

  test('keeps an address blurred until the cell is hovered or focused', () => {
    render(<AdminLogins logins={logins} />);
    const cell = screen.getByLabelText('Adres IP: 203.0.113.13');
    expect(cell.className).toContain('admin-private-ip');
    expect(cell.querySelector('span')?.textContent).toBe('203.0.113.13');
  });

  test('escapes CSV separators and quotes and neutralizes spreadsheet formulas', () => {
    const csv = loginsCsv([
      { ...logins[0], nickname: '=HYPERLINK("bad");x', ip: null },
    ]);
    expect(csv).toContain('"\'=HYPERLINK(""bad"");x"');
    expect(csv).toContain(';"";');
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });
});
