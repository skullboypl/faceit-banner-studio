import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { renderWithApp } from '../components/test-utils';
import { getLiveBoard } from '../utils/presence';
import { TwitchStreamers } from './TwitchStreamers';

vi.mock('../utils/presence', () => ({
  LIVE_LIST_REFRESH_MS: 60_000,
  getLiveBoard: vi.fn(),
}));

const livePlayer = (index: number, viewers: number) => ({
  nickname: `Streamer ${index}`,
  twitch: `streamer${index}`,
  twitchStatus: {
    state: 'live' as const,
    viewers,
    title: `Transmisja ${index}`,
    thumbnail: `https://static-cdn.jtvnw.net/preview-${index}.jpg`,
  },
});

describe('TwitchStreamers', () => {
  beforeEach(() => {
    vi.mocked(getLiveBoard).mockResolvedValue({
      online: 20,
      ranked: 15,
      windowSeconds: 3600,
      players: [
        ...Array.from({ length: 12 }, (_, index) => livePlayer(index + 1, (index + 1) * 10)),
        { nickname: 'Offline Player', twitch: 'offlineplayer', twitchStatus: { state: 'offline' as const } },
        { nickname: 'Deleted Player', twitch: 'deletedplayer', twitchStatus: { state: 'missing' as const } },
      ],
    });
  });

  test('shows one Twitch embed and sorts the top ten by viewers', async () => {
    renderWithApp(<TwitchStreamers />);
    const frame = await screen.findByTitle('Transmisja Twitch: Streamer 12');
    expect(frame.getAttribute('src')).toContain('channel=streamer12');
    expect(frame.getAttribute('src')).toContain(`parent=${window.location.hostname}`);
    expect(screen.getAllByTitle(/Transmisja Twitch:/)).toHaveLength(1);
    const cards = screen.getAllByRole('button', { name: /LIVE/ });
    expect(cards).toHaveLength(10);
    expect(cards[0].textContent).toContain('Streamer 12');
    expect(cards[9].textContent).toContain('Streamer 3');
  });

  test('puts live channels outside top ten and offline banner users in the remaining list', async () => {
    renderWithApp(<TwitchStreamers />);
    const list = await screen.findByRole('list');
    const entries = within(list).getAllByRole('listitem');
    expect(entries).toHaveLength(3);
    expect(entries[0].textContent).toContain('Streamer 2');
    expect(entries[1].textContent).toContain('Streamer 1');
    expect(entries[2].textContent).toContain('Offline Player');
    expect(entries[2].textContent).toContain('OFFLINE');
    expect(screen.queryByText('Deleted Player')).toBeNull();
  });

  test('explains that an open banner and a linked FACEIT Twitch account are required', async () => {
    renderWithApp(<TwitchStreamers />);
    const note = await screen.findByRole('note');
    expect(note.textContent).toContain('Używaj naszego banera');
    expect(note.textContent).toContain('profilu FACEIT');
  });
});
