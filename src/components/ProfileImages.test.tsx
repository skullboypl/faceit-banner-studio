import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { ApiError } from '../cloud/api';
import type { OwnProfileImage } from '../profile/images';
import { OverrideNotice, ProfileImages } from './ProfileImages';
import { renderWithApp } from './test-utils';

const image = (overrides: Partial<OwnProfileImage> = {}): OwnProfileImage => ({
  kind: 'avatar',
  status: 'approved',
  url: 'https://fbstorage.vxh.pl/pf/avatar/aa.webp',
  width: 512,
  height: 512,
  rejectReason: null,
  ...overrides,
});

const api = (images: OwnProfileImage[] = []) => ({
  list: vi.fn(async () => images),
  upload: vi.fn(async (kind: 'avatar' | 'cover') => image({ kind, status: 'pending' })),
  remove: vi.fn(async () => undefined),
});
const prepare = vi.fn(async () => new Blob(['x'], { type: 'image/webp' }));

describe('ProfileImages', () => {
  test('has a card for the avatar and one for the background, and explains the scope', async () => {
    renderWithApp(<ProfileImages api={api()} prepare={prepare} />);
    expect(await screen.findByText('Avatar na banerach')).toBeTruthy();
    expect(screen.getByText('Tło na banerach')).toBeTruthy();
    expect(screen.getByText(/tylko w banerach z tego projektu/)).toBeTruthy();
    expect(screen.getByText(/widzi je każdy, kto wpisze Twój nick/)).toBeTruthy();
  });

  test('shows the status of each image: waiting, live, refused with the reason, hidden after reports', async () => {
    renderWithApp(
      <ProfileImages
        api={api([
          image({ kind: 'avatar', status: 'pending' }),
          image({ kind: 'cover', status: 'rejected', rejectReason: 'Not a photo of you' }),
        ])}
        prepare={prepare}
      />
    );
    expect(await screen.findByText('Czeka na akceptację')).toBeTruthy();
    expect(screen.getByText('Odrzucone')).toBeTruthy();
    expect(screen.getByText(/Not a photo of you/)).toBeTruthy();
  });

  test('approved and hidden states read clearly', async () => {
    const approved = renderWithApp(<ProfileImages api={api([image({ status: 'approved' })])} prepare={prepare} />);
    expect(await screen.findByText('Widoczne na banerach')).toBeTruthy();
    approved.unmount();
    renderWithApp(<ProfileImages api={api([image({ status: 'hidden' })])} prepare={prepare} />);
    expect(await screen.findByText('Ukryte po zgłoszeniach, czeka na decyzję admina')).toBeTruthy();
  });

  test('choosing a file prepares it in the browser, uploads it and shows it as waiting', async () => {
    const client = api();
    const { container } = renderWithApp(<ProfileImages api={client} prepare={prepare} />);
    await screen.findByText('Avatar na banerach');
    const input = container.querySelector('input[type="file"][data-kind="avatar"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['raw'], 'me.png', { type: 'image/png' })] } });
    await waitFor(() => expect(client.upload).toHaveBeenCalledWith('avatar', expect.any(Blob)));
    expect(prepare).toHaveBeenCalledWith(expect.any(File), 'avatar');
    expect(await screen.findByText('Czeka na akceptację')).toBeTruthy();
  });

  test('a refused upload shows the reason in plain words and keeps the old image', async () => {
    const client = api([image({ status: 'approved' })]);
    client.upload.mockRejectedValueOnce(new ApiError(413, 'too_big', 'Image is larger than 1 MB.'));
    const { container } = renderWithApp(<ProfileImages api={client} prepare={prepare} />);
    await screen.findByText('Widoczne na banerach');
    fireEvent.change(container.querySelector('input[data-kind="avatar"]') as HTMLInputElement, {
      target: { files: [new File(['raw'], 'me.png', { type: 'image/png' })] },
    });
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Widoczne na banerach')).toBeTruthy();
  });

  test('a file that is not an image never reaches the server', async () => {
    const client = api();
    const { container } = renderWithApp(<ProfileImages api={client} prepare={prepare} />);
    await screen.findByText('Avatar na banerach');
    fireEvent.change(container.querySelector('input[data-kind="cover"]') as HTMLInputElement, {
      target: { files: [new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })] },
    });
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(client.upload).not.toHaveBeenCalled();
  });

  test('removing asks the server and clears the card', async () => {
    const client = api([image({ kind: 'avatar', status: 'approved' })]);
    renderWithApp(<ProfileImages api={client} prepare={prepare} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Usuń avatar' }));
    await waitFor(() => expect(client.remove).toHaveBeenCalledWith('avatar'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Usuń avatar' })).toBeNull());
  });
});

describe('OverrideNotice', () => {
  const report = vi.fn(async () => undefined);
  const base = { playerId: 'guid-alice', overridden: { avatar: true, cover: true }, loggedIn: true, own: false, report };

  test('says the player has custom pictures and offers to report each one', () => {
    renderWithApp(<OverrideNotice {...base} />);
    expect(screen.getByText(/ma własne zdjęcia na banerach/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zgłoś avatar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zgłoś tło' })).toBeTruthy();
  });

  test('only offers what was actually replaced', () => {
    renderWithApp(<OverrideNotice {...base} overridden={{ cover: true }} />);
    expect(screen.queryByRole('button', { name: 'Zgłoś avatar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Zgłoś tło' })).toBeTruthy();
  });

  test('says nothing when nothing was replaced, and never to the owner', () => {
    const none = renderWithApp(<OverrideNotice {...base} overridden={undefined} />);
    expect(none.container.textContent).toBe('');
    none.unmount();
    const own = renderWithApp(<OverrideNotice {...base} own />);
    expect(own.container.textContent).toBe('');
  });

  test('a guest is asked to log in instead of getting report buttons', () => {
    renderWithApp(<OverrideNotice {...base} loggedIn={false} />);
    expect(screen.queryByRole('button', { name: 'Zgłoś avatar' })).toBeNull();
    expect(screen.getByText(/Zaloguj się, żeby zgłosić/)).toBeTruthy();
  });

  test('reporting sends the player and kind, then thanks the user', async () => {
    renderWithApp(<OverrideNotice {...base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zgłoś avatar' }));
    await waitFor(() => expect(report).toHaveBeenCalledWith('guid-alice', 'avatar', ''));
    expect(await screen.findByText('Dziękujemy, zgłoszenie zapisane.')).toBeTruthy();
  });

  test('a repeated report is explained, not shown as an error', async () => {
    const duplicate = vi.fn(async () => {
      throw new ApiError(409, 'already_reported', 'You already reported this image.');
    });
    renderWithApp(<OverrideNotice {...base} report={duplicate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zgłoś tło' }));
    expect(await screen.findByText('Już zgłosiłeś to zdjęcie.')).toBeTruthy();
  });
});
