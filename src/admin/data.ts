import type { DayPoint } from './AdminChart';

export type AdminUser = {
  guid: string;
  nickname: string;
  avatar: string | null;
};
export type Login = AdminUser & { ip: string | null; createdAt: string };
export type Overview = {
  online: number | null;
  storage: { sessions: string; logins: string };
  logins: Login[];
  activity: {
    days: number;
    total: number;
    inRange: number;
    unique: number;
    series: DayPoint[];
  };
  onlineHistory?: {
    hours: number;
    series: { hour: string; online: number }[];
  };
};
export const storageLabel = (value: string) =>
  ({ postgres: 'PostgreSQL', redis: 'Redis' })[value] ?? 'Pamięć lokalna';
export const formatDate = (value: string) =>
  new Date(value).toLocaleString('pl-PL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

// Quote every field and neutralize spreadsheet formulas in user-controlled values.
export function loginsCsv(rows: Login[]) {
  const cell = (value: string) =>
    `"${(/^[\s]*[=+@-]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`;
  return (
    '\uFEFF' +
    [
      ['Gracz', 'FACEIT ID', 'IP', 'Data (UTC)'],
      ...rows.map((row) => [
        row.nickname,
        row.guid,
        row.ip ?? '',
        row.createdAt,
      ]),
    ]
      .map((row) => row.map(cell).join(';'))
      .join('\r\n')
  );
}
export function downloadLogins(rows: Login[]) {
  const url = URL.createObjectURL(
    new Blob([loginsCsv(rows)], { type: 'text/csv;charset=utf-8;' })
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `faceit-logowania-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
