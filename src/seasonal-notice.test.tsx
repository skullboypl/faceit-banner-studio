import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SeasonalNotice, inXmasSeason, xmasNoticeKey } from './components/SeasonalNotice';
import { LanguageContext, SettingsContext } from './generator/contexts';

const tl = (key: string) => key;

const mount = (values: Record<string, unknown>, date: Date, onOpen = vi.fn()) => {
  const settings = { settings: values, get: (key: string) => values[key], set: vi.fn() } as never;
  const view = render(
    <LanguageContext.Provider value={tl}>
      <SettingsContext.Provider value={settings}>
        <SeasonalNotice onOpen={onOpen} now={() => date} />
      </SettingsContext.Provider>
    </LanguageContext.Provider>
  );
  act(() => {
    vi.advanceTimersByTime(1500);
  });
  return { ...view, onOpen };
};

describe('Christmas extras bubble in the studio', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('the season runs from 1 November to 6 January, with one key per season', () => {
    expect(inXmasSeason(new Date(2026, 9, 31))).toBe(false);
    expect(inXmasSeason(new Date(2026, 10, 1))).toBe(true);
    expect(inXmasSeason(new Date(2026, 11, 31))).toBe(true);
    expect(inXmasSeason(new Date(2027, 0, 6))).toBe(true);
    expect(inXmasSeason(new Date(2027, 0, 7))).toBe(false);
    expect(xmasNoticeKey(new Date(2026, 10, 4))).toBe(xmasNoticeKey(new Date(2027, 0, 3)));
    expect(xmasNoticeKey(new Date(2027, 10, 4))).not.toBe(xmasNoticeKey(new Date(2026, 10, 4)));
  });

  test('shows in season, opens the options and stays closed afterwards', () => {
    const date = new Date(2026, 10, 4);
    const { onOpen, unmount } = mount({}, date);
    fireEvent.click(screen.getByText('xmas.notice.open'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('seasonal-notice')).toBeNull();
    unmount();
    mount({}, date);
    expect(screen.queryByTestId('seasonal-notice')).toBeNull();
  });

  test('stays away out of season and once an extra is already on', () => {
    mount({}, new Date(2026, 6, 1));
    expect(screen.queryByTestId('seasonal-notice')).toBeNull();
    mount({ xmasDrift: true }, new Date(2026, 10, 4));
    expect(screen.queryByTestId('seasonal-notice')).toBeNull();
  });

  test('"Later" and the cross close it too', () => {
    const date = new Date(2026, 11, 1);
    const first = mount({}, date);
    expect(screen.getByTestId('seasonal-notice')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('xmas.notice.close'));
    expect(screen.queryByTestId('seasonal-notice')).toBeNull();
    first.unmount();
    localStorage.clear();
    mount({}, date);
    fireEvent.click(screen.getByText('xmas.notice.later'));
    expect(screen.queryByTestId('seasonal-notice')).toBeNull();
  });
});
