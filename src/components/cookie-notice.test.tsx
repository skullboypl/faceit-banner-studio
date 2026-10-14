import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import { CookieNotice } from './CookieNotice';
import { renderWithApp } from './test-utils';

describe('CookieNotice', () => {
  beforeEach(() => localStorage.clear());

  test('explains the session cookie and stays dismissed', () => {
    const view = renderWithApp(<CookieNotice />);
    expect(screen.getByText(/fb_session/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Rozumiem' }));
    expect(screen.queryByText(/fb_session/)).toBeNull();
    expect(localStorage.getItem('fb_cookie_notice')).toBe('1');
    view.unmount();
    renderWithApp(<CookieNotice />);
    expect(screen.queryByText(/fb_session/)).toBeNull();
  });
});
