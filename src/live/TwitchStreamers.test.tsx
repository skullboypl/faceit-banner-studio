import { screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { renderWithApp } from '../components/test-utils';
import { getLiveBoard } from '../utils/presence';
import { TwitchStreamers, twitchPlayerFrame } from './TwitchStreamers';

function renderBoard() {
  return renderWithApp(
    <MemoryRouter>
      <TwitchStreamers />
    </MemoryRouter>
  );
}

vi.mock('../utils/presence', () => ({
  LIVE_LIST_REFRESH_MS: 60_000,
  getLiveBoard: vi.fn(),
}));

vi.mock('./streamer-api', () => ({
  getStreamerRanking: vi.fn().mockResolvedValue({ ok: true, days: 7, historyDays: 90, generatedAt: 0, cacheSeconds: 60, streamers: [], archive: [] }),
  getStreamerPage: vi.fn(),
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
    renderBoard();
    const frame = await screen.findByTitle('Transmisja Twitch: Streamer 12');
    expect(frame.getAttribute('src')).toContain('channel=streamer12');
    expect(frame.getAttribute('src')).toContain(`parent=${window.location.hostname}`);
    expect(frame.getAttribute('src')).toContain('autoplay=true');
    expect(screen.getAllByTitle(/Transmisja Twitch:/)).toHaveLength(1);
    const cards = screen.getAllByRole('button', { name: /LIVE/ });
    expect(cards).toHaveLength(10);
    expect(cards[0].textContent).toContain('Streamer 12');
    expect(cards[9].textContent).toContain('Streamer 3');
  });

  test('keeps extra live channels in the remaining list and shows offline nicks as compact links', async () => {
    renderBoard();
    const list = await screen.findByRole('list');
    const entries = within(list).getAllByRole('listitem');
    expect(entries).toHaveLength(2);
    expect(entries[0].textContent).toContain('Streamer 2');
    expect(entries[1].textContent).toContain('Streamer 1');
    expect(entries[0].textContent).not.toContain('OFFLINE');
    expect(screen.getByRole('heading', { name: 'Offline:' })).toBeTruthy();
    const offline = screen.getByRole('link', { name: 'Offline Player' });
    expect(offline.getAttribute('href')).toBe('/streamers/offlineplayer');
    expect(offline.closest('.streamers-offline')).toBeTruthy();
    expect(screen.queryByText('Deleted Player')).toBeNull();
  });

  test('scales the Twitch player into the slot instead of widening the page', () => {
    const wide = twitchPlayerFrame(800);
    expect(wide?.scale).toBe(1);
    expect(wide?.width).toBe(800);
    expect(wide?.height).toBe(450);
    const phone = twitchPlayerFrame(320);
    expect(phone!.width).toBeGreaterThanOrEqual(400);
    expect(phone!.height).toBeGreaterThanOrEqual(300);
    expect(phone!.width * phone!.scale).toBeCloseTo(320);
    expect(phone!.height * phone!.scale).toBeCloseTo(180);
    expect(twitchPlayerFrame(0)).toBeNull();
  });

  test('explains that an open banner and a linked FACEIT Twitch account are required', async () => {
    renderBoard();
    const note = await screen.findByRole('note');
    expect(note.textContent).toContain('Używaj naszego banera');
    expect(note.textContent).toContain('profilu FACEIT');
    expect(note.textContent).toContain('Kick');
    const ranking = screen.getByRole('link', { name: 'Ranking i historia streamerów' });
    expect(ranking.getAttribute('href')).toBe('/streamers/ranking');
    expect(screen.queryByRole('heading', { name: 'Ranking streamerów – 7 dni' })).toBeNull();
  });

  test('shows only compact nicks when nobody is live', async () => {
    vi.mocked(getLiveBoard).mockResolvedValue({
      online: 1,
      ranked: 1,
      windowSeconds: 3600,
      players: [
        { nickname: 'QuietOne', twitch: 'quietone', twitchStatus: { state: 'offline' } },
        { nickname: 'AlsoQuiet', kick: 'alsoquiet', kickStatus: { state: 'offline' } },
      ],
    });
    renderBoard();
    expect(await screen.findByRole('heading', { name: 'Nikt teraz nie nadaje' })).toBeTruthy();
    expect(screen.queryAllByTitle(/Transmisja/)).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /LIVE/ })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Offline:' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'QuietOne' }).getAttribute('href')).toBe('/streamers/quietone');
    expect(screen.getByRole('link', { name: 'AlsoQuiet' }).getAttribute('href')).toBe('/streamers/alsoquiet');
  });

  test('embeds a Kick player when that channel is the live one', async () => {
    vi.mocked(getLiveBoard).mockResolvedValue({
      online: 1,
      ranked: 1,
      windowSeconds: 3600,
      players: [{ nickname: 'KickPlayer', kick: 'mapet', kickStatus: { state: 'live', viewers: 33, title: 'CS2' } }],
    });
    renderBoard();
    const frame = await screen.findByTitle('Transmisja Kick: KickPlayer');
    expect(frame.getAttribute('src')).toBe('https://player.kick.com/mapet');
    expect(screen.getByRole('link', { name: 'Otwórz kanał na Kick' }).getAttribute('href')).toBe('https://kick.com/mapet');
  });
});
