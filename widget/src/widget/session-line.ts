import type { SessionCard } from '../utils/faceit_util';

const round = (value: number, digits: number) => {
  const scale = 10 ** digits;
  return String(Math.round(value * scale) / scale);
};

/** The session's kills per match with ADR, and K/D, as shown on the ticker's "today" page; null until a match was played. */
export function sessionLine(session: SessionCard | undefined) {
  if (!session || session.matches <= 0) return { killsAdr: null, kd: null, kr: null, hs: null };
  return {
    killsAdr: session.adr > 0 ? `${Math.round(session.avg)}/${round(session.adr, 1)}` : null,
    kd: session.kd > 0 ? round(session.kd, 2) : null,
    kr: session.kr > 0 ? round(session.kr, 2) : null,
    hs: session.hs > 0 ? `${Math.round(session.hs)}%` : null,
  };
}
