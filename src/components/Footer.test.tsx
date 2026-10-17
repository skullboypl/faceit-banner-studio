import { screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Footer, SKULL_YOUTUBE_URL } from './Footer';
import { renderWithApp } from './test-utils';

describe('Footer: the CS2 line lives here, Skull goes to YouTube', () => {
  test('the widget one-liner is in the footer, not a CS2 card', () => {
    renderWithApp(<Footer />);
    expect(screen.getByText(/Widżet statystyk FACEIT dla Twojej transmisji/)).toBeTruthy();
    expect(screen.queryByText('CS2', { selector: '.game-label' })).toBeNull();
  });

  test('Skull opens the YouTube channel', () => {
    renderWithApp(<Footer />);
    const skull = screen.getByRole('link', { name: 'Skull' });
    expect(skull.getAttribute('href')).toBe(SKULL_YOUTUBE_URL);
    expect(skull.getAttribute('target')).toBe('_blank');
  });
});
