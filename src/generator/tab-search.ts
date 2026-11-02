/** Requests/bugs tab in the studio. Tickets live at `/feedback/:id`. */
export const FEEDBACK_TAB_INDEX = 5;
export const feedbackBoardPath = `/?tab=${FEEDBACK_TAB_INDEX}`;
export const feedbackPostPath = (id: string) => `/feedback/${id}`;

export function tabFromSearch(search: string | URLSearchParams, count: number) {
  const raw = typeof search === 'string' ? new URLSearchParams(search).get('tab') : search.get('tab');
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value < count ? value : 0;
}

/** A ticket permalink must open the feedback board, not the settings tab. */
export function tabFromLocation(pathname: string, search: string | URLSearchParams, count: number) {
  if (/^\/feedback\/[^/]+$/.test(pathname)) {
    return FEEDBACK_TAB_INDEX < count ? FEEDBACK_TAB_INDEX : 0;
  }
  return tabFromSearch(search, count);
}
