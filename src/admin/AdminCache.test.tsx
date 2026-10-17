import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { AdminCache } from './AdminCache';

describe('AdminCache', () => {
  test('offers every kind of cache and clears the one that was picked', async () => {
    const clear = vi.fn(async (scope: string) => (scope === 'all' ? ['faceit', 'profiles'] : [scope]));
    render(<AdminCache clear={clear} />);
    for (const name of ['Wszystko', 'Odpowiedzi FACEIT', 'Profile graczy', 'Avatary', 'Miejsca w rankingu', 'Lista na żywo', 'CSS i HTML na CDN']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Avatary' }));
    await waitFor(() => expect(clear).toHaveBeenCalledWith('avatars'));
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Wyczyszczono');
  });

  test('"Wszystko" clears everything', async () => {
    const clear = vi.fn(async () => ['faceit']);
    render(<AdminCache clear={clear} />);
    fireEvent.click(screen.getByRole('button', { name: 'Wszystko' }));
    await waitFor(() => expect(clear).toHaveBeenCalledWith('all'));
  });

  test('says so when clearing fails, and lets the admin try again', async () => {
    const clear = vi.fn(async () => {
      throw new Error('offline');
    });
    render(<AdminCache clear={clear} />);
    fireEvent.click(screen.getByRole('button', { name: 'Profile graczy' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Nie udało się');
    expect((screen.getByRole('button', { name: 'Profile graczy' }) as HTMLButtonElement).disabled).toBe(false);
  });

  test('warns that the next reads are slower while the caches fill again', () => {
    render(<AdminCache clear={vi.fn()} />);
    expect(screen.getByText(/limit zapytań/)).toBeTruthy();
  });

  test('refreshes one player by FACEIT id', async () => {
    const clear = vi.fn(async () => ['player']);
    render(<AdminCache clear={clear} />);
    fireEvent.change(screen.getByLabelText('FACEIT ID gracza'), {
      target: { value: '11111111-1111-1111-1111-111111111111' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Odśwież cache' }));
    await waitFor(() => expect(clear).toHaveBeenCalledWith('player', '11111111-1111-1111-1111-111111111111'));
    expect(await screen.findByRole('status')).toBeTruthy();
  });

  test('rejects a value that is not a FACEIT id', async () => {
    const clear = vi.fn(async () => ['player']);
    render(<AdminCache clear={clear} />);
    fireEvent.change(screen.getByLabelText('FACEIT ID gracza'), { target: { value: 'Jebaka4K' } });
    fireEvent.click(screen.getByRole('button', { name: 'Odśwież cache' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/FACEIT ID/);
    expect(clear).not.toHaveBeenCalled();
  });

  test('CSS on the CDN is its own button, and a missing Cloudflare token is said plainly', async () => {
    const clear = vi.fn(async () => {
      throw new Error('cdn_not_configured');
    });
    render(<AdminCache clear={clear} />);
    fireEvent.click(screen.getByRole('button', { name: 'CSS i HTML na CDN' }));
    await waitFor(() => expect(clear).toHaveBeenCalledWith('css'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/CF_ZONE_ID/);
  });
});
