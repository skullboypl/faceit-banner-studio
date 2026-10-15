import { screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { ObsMonitor } from './ObsMonitor';
import { renderWithApp } from './test-utils';

describe('ObsMonitor', () => {
  test('is a small screen labelled with the real OBS source size', () => {
    renderWithApp(
      <ObsMonitor cardWidth={902}>
        <span data-testid="stage">stage</span>
      </ObsMonitor>
    );
    expect(screen.getByText('Źródło w OBS')).toBeTruthy();
    expect(screen.getAllByText('1920 × 1080').length).toBeGreaterThan(0);
    expect(screen.getByTestId('stage')).toBeTruthy();
  });

  test('keeps the 16:9 shape of the source', () => {
    const { container } = renderWithApp(<ObsMonitor cardWidth={902}>x</ObsMonitor>);
    expect((container.querySelector('.obs-monitor-screen') as HTMLElement).style.aspectRatio).toBe('1920 / 1080');
  });

  test('says how wide the card is on that source and what share of it that is', () => {
    renderWithApp(<ObsMonitor cardWidth={902}>x</ObsMonitor>);
    expect(screen.getByText('Karta: 902 px z 1920 px (47%)')).toBeTruthy();
  });

  test('marks the frame edges with the source dimensions', () => {
    const { container } = renderWithApp(<ObsMonitor cardWidth={900}>x</ObsMonitor>);
    expect(container.querySelector('.obs-monitor-rule--x')?.textContent).toBe('1920');
    expect(container.querySelector('.obs-monitor-rule--y')?.textContent).toBe('1080');
  });

  test('hands its screen element to the owner, so the card on it can be measured', () => {
    let screen: HTMLElement | null = null;
    renderWithApp(
      <ObsMonitor cardWidth={900} screenRef={(element) => (screen = element)}>
        x
      </ObsMonitor>
    );
    expect(screen).not.toBeNull();
    expect((screen as unknown as HTMLElement).className).toContain('obs-monitor-screen');
  });
});
