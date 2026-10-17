export function tabFromSearch(search: string | URLSearchParams, count: number) {
  const raw = typeof search === 'string' ? new URLSearchParams(search).get('tab') : search.get('tab');
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value < count ? value : 0;
}
