import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateIntro, introLayout } from '../../widget/src/components/UpdateIntro';
import { WIDGET_RELEASE } from '../../widget/src/release';
import { languages } from '../translations/translations';

const polish = languages.find((language) => language.id === 'pl')!;

describe('UpdateIntro', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('counts the seconds down and disappears when the time is up', () => {
    const { container } = render(<UpdateIntro enabled language={polish} />);
    const seconds = Math.ceil(WIDGET_RELEASE.introDuration / 1000);
    const value = () => container.querySelector('.update-timer-value')?.textContent;

    expect(screen.getByRole('status')).toBeTruthy();
    expect(value()).toBe(String(seconds));
    expect(container.querySelector('.update-timer')?.getAttribute('title')).toBe(
      `Zniknie za ${seconds} s`
    );

    act(() => vi.advanceTimersByTime(2000));
    expect(value()).toBe(String(seconds - 2));

    act(() => vi.advanceTimersByTime(WIDGET_RELEASE.introDuration));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders nothing when the intro is turned off', () => {
    render(<UpdateIntro enabled={false} language={polish} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('picks the layout from the size the banner has on screen', () => {
    expect(introLayout(540, 250, 1).variants).toEqual([]);
    expect(introLayout(620, 116, 1).variants).toEqual(['compact']);
    expect(introLayout(220, 380, 1).variants).toEqual(['tall']);
    expect(introLayout(440, 460, 1).variants).toEqual(['tall']);
    expect(introLayout(680, 300, 1).variants).toEqual(['rich']);
    // A 40 % slab: the layout box is 480 x 100, the stream sees 192 x 40.
    expect(introLayout(192, 40, 0.4)).toEqual({ variants: ['strip', 'narrow'], zoom: 0.4 });
    expect(introLayout(400, 30, 1).variants).toEqual(['strip', 'tiny']);
    expect(introLayout(500, 180, Number.NaN).zoom).toBe(1);
  });
});
