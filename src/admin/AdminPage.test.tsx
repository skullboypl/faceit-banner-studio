import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AdminPage } from './AdminPage';

const series = Array.from({ length: 14 }, (_, index) => ({
  day: `2026-10-${String(index + 1).padStart(2, '0')}`,
  count: index === 13 ? 4 : 1,
  players: index === 13 ? 2 : 1,
}));

function json(data: unknown, ok = true) {
  return { ok, json: async () => data };
}

describe('AdminPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes('/api/auth/me')) {
          return json({
            user: { guid: '1', nickname: 'Skull', avatar: null },
            admin: true,
          });
        }
        if (url.includes('/api/admin/overview')) {
          return json({
            online: 12,
            storage: { sessions: 'redis', logins: 'postgres' },
            logins: [
              {
                guid: '1',
                nickname: 'Skull',
                avatar: null,
                ip: '203.0.113.8',
                createdAt: '2026-10-14T12:00:00.000Z',
              },
            ],
            activity: { days: 14, total: 40, inRange: 17, unique: 8, series },
          });
        }
        return json({}, false);
      })
    );
  });

  test('shows live tiles, switches the chart range and opens the login table', async () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );
    expect(await screen.findByText('Banery online')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(
      screen.getByRole('img', { name: 'Logowania dziennie' })
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '7 dni' }));
    expect(
      screen.getByRole('button', { name: '7 dni' }).getAttribute('aria-pressed')
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Logowania' }));
    expect(await screen.findByText('203.0.113.8')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Szukaj logowania'), {
      target: { value: 'brak' },
    });
    expect(screen.getByText('Brak wpisów.')).toBeTruthy();
  });

  test('sends a signed-out visitor straight to the homepage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ user: null, admin: false }))
    );
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/" element={<h1>Studio</h1>} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: 'Studio' })).toBeTruthy();
    expect(
      screen.queryByRole('link', { name: 'Zaloguj przez FACEIT' })
    ).toBeNull();
  });

  test('preserves existing data after a refresh failure and allows retry', async () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );
    await screen.findByText('Banery online');
    const fetcher = vi.mocked(fetch);
    const original = fetcher.getMockImplementation()!;
    fetcher.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Odśwież dane ↻' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'ostatniego udanego odświeżenia'
    );
    expect(screen.getByText('Banery online')).toBeTruthy();
    fetcher.mockImplementation(original);
    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  test('shows a retry on initial network failure rather than redirecting', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Spróbuj ponownie' })
    ).toBeTruthy();
  });

  test('shows forbidden access without requesting admin data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          user: { guid: '1', nickname: 'Guest', avatar: null },
          admin: false,
        })
      )
    );
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );
    expect(
      await screen.findByRole('heading', { name: 'Brak dostępu' })
    ).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('polling can be enabled and disabled from system settings', async () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );
    await screen.findByText('Banery online');
    fireEvent.click(screen.getByRole('button', { name: 'System' }));
    vi.useFakeTimers();
    try {
      const before = vi.mocked(fetch).mock.calls.length;
      fireEvent.click(screen.getByLabelText('Automatyczne odświeżanie'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000);
      });
      expect(fetch).toHaveBeenCalledTimes(before + 2);
      fireEvent.click(screen.getByLabelText('Automatyczne odświeżanie'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000);
      });
      expect(fetch).toHaveBeenCalledTimes(before + 2);
    } finally {
      vi.useRealTimers();
    }
  });
});
