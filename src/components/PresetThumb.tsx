import { ReactNode } from 'react';

const ACCENT = '#ff6b18';
const RIVAL = '#3b82f6';
const LIGHT = '#e3d9d2';
const MID = '#69615c';
const DIM = '#3a332e';
const GREEN = '#3ddc84';
const RED = '#ff5a5a';

type Draw = {
  /** Rounded rectangle; every value is a fraction of the banner. */
  r: (x: number, y: number, w: number, h: number, fill: string, round?: number) => ReactNode;
  /** Circle; the radius is a fraction of the banner height. */
  c: (x: number, y: number, rad: number, fill: string) => ReactNode;
  /** Ring around a (avatar) circle. */
  ring: (x: number, y: number, rad: number, color?: string, fraction?: number) => ReactNode;
  /** Row of small stat cells. */
  cells: (x: number, y: number, w: number, h: number, count: number, fill?: string) => ReactNode;
  w: number;
  h: number;
};

const make = (w: number, h: number): Draw => {
  const unit = Math.min(w, h);
  return {
    w,
    h,
    r: (x, y, rw, rh, fill, round = 0.2) => (
      <rect key={`${x}-${y}-${fill}`} x={x * w} y={y * h} width={rw * w} height={rh * h} rx={round * Math.min(rw * w, rh * h)} fill={fill} />
    ),
    c: (x, y, rad, fill) => <circle key={`${x}-${y}-${fill}`} cx={x * w} cy={y * h} r={rad * h} fill={fill} />,
    ring: (x, y, rad, color = ACCENT, fraction = 0.8) => {
      const radius = rad * h;
      const length = 2 * Math.PI * radius;
      return (
        <g key={`ring-${x}-${y}`}>
          <circle cx={x * w} cy={y * h} r={radius} fill="none" stroke={DIM} strokeWidth={unit * 0.045} />
          <circle
            cx={x * w}
            cy={y * h}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={unit * 0.045}
            strokeLinecap="round"
            strokeDasharray={`${length * fraction} ${length}`}
            transform={`rotate(-90 ${x * w} ${y * h})`}
          />
          <circle cx={x * w} cy={y * h} r={radius * 0.68} fill={MID} opacity={0.55} />
        </g>
      );
    },
    cells: (x, y, cw, ch, count, fill = DIM) =>
      Array.from({ length: count }, (_, index) => {
        const gap = 0.012;
        const each = (cw - gap * (count - 1)) / count;
        return (
          <rect
            key={`cell-${x}-${y}-${index}`}
            x={(x + index * (each + gap)) * w}
            y={y * h}
            width={each * w}
            height={ch * h}
            rx={Math.min(each * w, ch * h) * 0.2}
            fill={fill}
          />
        );
      }),
  };
};

/** One drawing per layout, in fractions of that banner's own size. */
const DRAWINGS: Record<string, (d: Draw) => ReactNode> = {
  showcase: (d) => (
    <>
      {d.ring(0.1, 0.38, 0.2)}
      {d.r(0.22, 0.2, 0.3, 0.12, MID)}
      {d.r(0.22, 0.4, 0.26, 0.22, LIGHT)}
      {d.r(0.06, 0.8, 0.88, 0.03, DIM, 0.5)}
      {d.r(0.06, 0.8, 0.25, 0.03, ACCENT, 0.5)}
    </>
  ),
  spotlight: (d) => (
    <>
      {d.ring(0.5, 0.26, 0.14)}
      {d.r(0.36, 0.5, 0.28, 0.17, LIGHT)}
      {d.r(0.06, 0.8, 0.88, 0.03, DIM, 0.5)}
      {d.r(0.06, 0.8, 0.3, 0.03, ACCENT, 0.5)}
    </>
  ),
  broadcast: (d) => (
    <>
      {d.r(0.05, 0.09, 0.18, 0.05, ACCENT, 0.5)}
      {d.ring(0.1, 0.4, 0.14)}
      {d.r(0.22, 0.28, 0.3, 0.1, MID)}
      {d.r(0.22, 0.43, 0.24, 0.16, LIGHT)}
      {d.cells(0.05, 0.7, 0.9, 0.2, 4)}
    </>
  ),
  rail: (d) => (
    <>
      {d.ring(0.06, 0.5, 0.3)}
      {d.r(0.12, 0.28, 0.14, 0.18, MID)}
      {d.r(0.12, 0.52, 0.12, 0.26, LIGHT)}
      {d.cells(0.45, 0.25, 0.5, 0.5, 4)}
    </>
  ),
  focus: (d) => (
    <>
      {d.ring(0.5, 0.2, 0.11)}
      {d.r(0.32, 0.4, 0.36, 0.06, MID)}
      {d.r(0.28, 0.5, 0.44, 0.1, LIGHT)}
      {d.cells(0.08, 0.68, 0.84, 0.12, 2)}
      {d.cells(0.08, 0.83, 0.84, 0.12, 2)}
    </>
  ),
  orbit: (d) => (
    <>
      {d.ring(0.5, 0.3, 0.2)}
      {d.r(0.32, 0.58, 0.36, 0.08, MID)}
      {d.r(0.3, 0.68, 0.4, 0.1, LIGHT)}
      {d.cells(0.08, 0.84, 0.84, 0.1, 2)}
    </>
  ),
  halo: (d) => (
    <>
      {d.ring(0.1, 0.5, 0.34)}
      {d.r(0.2, 0.26, 0.2, 0.16, MID)}
      {d.r(0.2, 0.5, 0.26, 0.26, LIGHT)}
      {d.cells(0.62, 0.26, 0.3, 0.2, 2)}
      {d.cells(0.62, 0.54, 0.3, 0.2, 2)}
    </>
  ),
  pulse: (d) => (
    <>
      {d.ring(0.5, 0.34, 0.2)}
      {d.r(0.36, 0.62, 0.28, 0.08, MID)}
      {d.r(0.3, 0.74, 0.4, 0.1, LIGHT)}
    </>
  ),
  ticker: (d) => (
    <>
      {d.r(0.05, 0.12, 0.2, 0.2, '#e7002c', 0.5)}
      {d.r(0.28, 0.14, 0.14, 0.16, LIGHT)}
      {d.r(0.46, 0.14, 0.12, 0.16, MID)}
      {d.r(0.8, 0.14, 0.14, 0.16, MID)}
      {d.r(0.4, 0.44, 0.2, 0.05, MID)}
      {d.cells(0.05, 0.58, 0.9, 0.3, 4)}
    </>
  ),
  slab: (d) => (
    <>
      {d.ring(0.08, 0.5, 0.3)}
      {d.r(0.17, 0.28, 0.2, 0.16, MID)}
      {d.r(0.17, 0.52, 0.2, 0.24, LIGHT)}
      {d.cells(0.55, 0.26, 0.4, 0.48, 3)}
    </>
  ),
  gauge: (d) => (
    <>
      <path d={`M ${d.w * 0.2} ${d.h * 0.6} A ${d.w * 0.3} ${d.w * 0.3} 0 0 1 ${d.w * 0.8} ${d.h * 0.6}`} fill="none" stroke={DIM} strokeWidth={d.h * 0.06} strokeLinecap="round" />
      <path d={`M ${d.w * 0.2} ${d.h * 0.6} A ${d.w * 0.3} ${d.w * 0.3} 0 0 1 ${d.w * 0.62} ${d.h * 0.34}`} fill="none" stroke={ACCENT} strokeWidth={d.h * 0.06} strokeLinecap="round" />
      {d.r(0.38, 0.46, 0.24, 0.14, LIGHT)}
      {d.r(0.32, 0.7, 0.36, 0.06, MID)}
      {d.cells(0.3, 0.82, 0.4, 0.1, 2)}
    </>
  ),
  card: (d) => (
    <>
      {d.r(0, 0, 1, 0.34, '#2b2a33', 0.04)}
      {d.c(0.86, 0.34, 0.1, ACCENT)}
      {d.r(0.08, 0.46, 0.3, 0.07, MID)}
      {d.r(0.08, 0.58, 0.26, 0.12, LIGHT)}
      {d.cells(0.08, 0.78, 0.84, 0.14, 4)}
    </>
  ),
  reel: (d) => (
    <>
      {d.ring(0.1, 0.5, 0.3)}
      {d.r(0.2, 0.28, 0.2, 0.14, MID)}
      {d.r(0.2, 0.5, 0.22, 0.24, LIGHT)}
      {d.r(0.66, 0.14, 0.28, 0.72, DIM, 0.12)}
      {d.r(0.72, 0.28, 0.16, 0.22, LIGHT)}
      {d.c(0.76, 0.72, 0.03, ACCENT)}
      {d.c(0.8, 0.72, 0.03, MID)}
      {d.c(0.84, 0.72, 0.03, MID)}
    </>
  ),
  ribbon: (d) => (
    <>
      {d.ring(0.06, 0.5, 0.3)}
      {d.r(0.12, 0.3, 0.14, 0.14, MID)}
      {d.r(0.12, 0.52, 0.16, 0.22, LIGHT)}
      {d.cells(0.38, 0.2, 0.58, 0.6, 6)}
    </>
  ),
  tower: (d) => (
    <>
      {d.ring(0.5, 0.18, 0.1)}
      {d.r(0.3, 0.36, 0.4, 0.04, MID)}
      {d.r(0.28, 0.43, 0.44, 0.06, LIGHT)}
      {[0.55, 0.64, 0.73, 0.82].map((y) => d.r(0.1, y, 0.8, 0.06, DIM, 0.3))}
    </>
  ),
  dials: (d) => (
    <>
      {d.r(0.06, 0.24, 0.3, 0.12, MID)}
      {d.r(0.06, 0.46, 0.26, 0.22, LIGHT)}
      {d.ring(0.56, 0.5, 0.26, ACCENT, 0.6)}
      {d.ring(0.72, 0.5, 0.26, ACCENT, 0.45)}
      {d.ring(0.88, 0.5, 0.26, ACCENT, 0.7)}
    </>
  ),
  marquee: (d) => (
    <>
      {d.r(0.06, 0.14, 0.2, 0.16, MID)}
      {d.r(0.34, 0.14, 0.18, 0.2, LIGHT)}
      {d.r(0.02, 0.56, 0.2, 0.28, DIM, 0.5)}
      {d.r(0.25, 0.56, 0.2, 0.28, DIM, 0.5)}
      {d.r(0.48, 0.56, 0.2, 0.28, DIM, 0.5)}
      {d.r(0.71, 0.56, 0.2, 0.28, DIM, 0.5)}
      {d.r(0.92, 0.56, 0.08, 0.28, DIM, 0.5)}
    </>
  ),
  duel: (d) => (
    <>
      {d.ring(0.12, 0.5, 0.3)}
      {d.r(0.24, 0.4, 0.14, 0.2, LIGHT)}
      {d.r(0.44, 0.28, 0.12, 0.1, MID, 0.5)}
      {d.r(0.43, 0.46, 0.14, 0.2, GREEN)}
      {d.ring(0.88, 0.5, 0.3, RIVAL)}
      {d.r(0.62, 0.4, 0.14, 0.2, LIGHT)}
    </>
  ),
  edge: (d) => (
    <>
      {d.ring(0.08, 0.5, 0.32)}
      {d.r(0.17, 0.4, 0.12, 0.22, LIGHT)}
      {d.r(0.36, 0.52, 0.28, 0.14, ACCENT, 0.5)}
      {d.r(0.5, 0.52, 0.14, 0.14, RIVAL, 0.5)}
      {d.r(0.43, 0.26, 0.14, 0.16, GREEN)}
      {d.ring(0.92, 0.5, 0.32, RIVAL)}
      {d.r(0.71, 0.4, 0.12, 0.22, LIGHT)}
    </>
  ),
  faceoff: (d) => (
    <>
      {d.ring(0.14, 0.2, 0.12)}
      {d.r(0.4, 0.14, 0.2, 0.12, GREEN)}
      {d.ring(0.86, 0.2, 0.12, RIVAL)}
      {[0.42, 0.58, 0.74, 0.88].map((y) => d.r(0.08, y, 0.84, 0.1, DIM, 0.3))}
      {[0.42, 0.58, 0.74, 0.88].map((y) => d.r(0.44, y + 0.03, 0.12, 0.04, MID))}
    </>
  ),
  clash: (d) => (
    <>
      {d.r(0, 0, 0.5, 1, '#3a2418', 0.04)}
      {d.r(0.5, 0, 0.5, 1, '#1b2a44', 0.04)}
      {d.ring(0.12, 0.5, 0.3)}
      {d.r(0.24, 0.42, 0.16, 0.22, LIGHT)}
      {d.r(0.45, 0.35, 0.1, 0.3, '#0b0e14', 0.1)}
      {d.ring(0.88, 0.5, 0.3, RIVAL)}
      {d.r(0.6, 0.42, 0.16, 0.22, LIGHT)}
    </>
  ),
  tug: (d) => (
    <>
      {d.ring(0.1, 0.28, 0.2)}
      {d.r(0.22, 0.2, 0.2, 0.16, LIGHT)}
      {d.ring(0.9, 0.28, 0.2, RIVAL)}
      {d.r(0.58, 0.2, 0.2, 0.16, LIGHT)}
      {d.r(0.06, 0.66, 0.88, 0.14, DIM, 0.5)}
      {d.r(0.06, 0.66, 0.55, 0.14, ACCENT, 0.5)}
      {d.r(0.5, 0.62, 0.16, 0.22, '#0b0e14', 0.5)}
    </>
  ),
  rivals: (d) => (
    <>
      {d.ring(0.1, 0.25, 0.15)}
      {d.r(0.22, 0.14, 0.2, 0.08, MID)}
      {d.r(0.22, 0.3, 0.5, 0.07, ACCENT, 0.5)}
      {d.r(0.82, 0.18, 0.12, 0.14, LIGHT)}
      {d.ring(0.1, 0.62, 0.15, RIVAL)}
      {d.r(0.22, 0.51, 0.2, 0.08, MID)}
      {d.r(0.22, 0.67, 0.42, 0.07, RIVAL, 0.5)}
      {d.r(0.82, 0.55, 0.12, 0.14, LIGHT)}
      {d.r(0.34, 0.86, 0.32, 0.07, GREEN)}
    </>
  ),
  matchup: (d) => (
    <>
      {d.ring(0.14, 0.2, 0.12)}
      {d.r(0.4, 0.14, 0.2, 0.12, GREEN)}
      {d.ring(0.86, 0.2, 0.12, RIVAL)}
      {[0.44, 0.6, 0.76, 0.9].map((y, i) => (
        <g key={y}>
          {d.r(0.5 - (0.36 - i * 0.04), y, 0.36 - i * 0.04, 0.06, ACCENT, 0.5)}
          {d.r(0.5, y, 0.3 + i * 0.03, 0.06, RIVAL, 0.5)}
        </g>
      ))}
    </>
  ),
  scoreboard: (d) => (
    <>
      {d.ring(0.07, 0.5, 0.3)}
      {d.r(0.14, 0.4, 0.1, 0.14, MID)}
      {d.cells(0.3, 0.2, 0.4, 0.6, 4)}
      {d.ring(0.93, 0.5, 0.3, RIVAL)}
      {d.r(0.76, 0.4, 0.1, 0.14, MID)}
    </>
  ),
  cycle: (d) => (
    <>
      {d.ring(0.1, 0.5, 0.3)}
      {d.r(0.4, 0.14, 0.2, 0.06, MID)}
      {d.cells(0.3, 0.32, 0.4, 0.34, 2)}
      {d.r(0.4, 0.76, 0.2, 0.08, GREEN)}
      {d.ring(0.9, 0.5, 0.3, RIVAL)}
    </>
  ),
  surge: (d) => (
    <>
      {d.ring(0.1, 0.28, 0.2)}
      {d.r(0.22, 0.2, 0.2, 0.16, LIGHT)}
      {d.ring(0.9, 0.28, 0.2, RIVAL)}
      {d.r(0.58, 0.2, 0.2, 0.16, LIGHT)}
      {d.r(0.06, 0.66, 0.88, 0.14, DIM, 0.5)}
      {d.r(0.06, 0.66, 0.5, 0.14, ACCENT, 0.5)}
      {d.r(0.3, 0.66, 0.06, 0.14, '#ffffffcc', 0.5)}
      {d.r(0.45, 0.62, 0.14, 0.22, '#0b0e14', 0.5)}
    </>
  ),
  tally: (d) => (
    <>
      {d.ring(0.12, 0.28, 0.2)}
      {d.r(0.34, 0.14, 0.12, 0.28, GREEN)}
      {d.r(0.54, 0.14, 0.12, 0.28, MID)}
      {d.ring(0.88, 0.28, 0.2, RIVAL)}
      {[0.06, 0.24, 0.42, 0.6, 0.78].map((x, i) => (
        <g key={x}>
          {d.r(x, 0.6, 0.16, 0.3, DIM)}
          {d.r(x, 0.86, 0.16, 0.04, i % 2 ? RIVAL : ACCENT, 0.5)}
        </g>
      ))}
    </>
  ),
  overlay: (d) => {
    const point = (index: number, share: number) => {
      const angle = (Math.PI * 2 * index) / 5;
      return `${d.w * 0.5 + Math.sin(angle) * d.h * 0.3 * share},${d.h * 0.6 - Math.cos(angle) * d.h * 0.3 * share}`;
    };
    const shape = (shares: number[]) => shares.map((share, index) => point(index, share)).join(' ');
    return (
      <>
        {d.ring(0.14, 0.14, 0.1)}
        {d.ring(0.86, 0.14, 0.1, RIVAL)}
        <polygon points={shape([1, 1, 1, 1, 1])} fill="none" stroke={DIM} strokeWidth={1.5} />
        <polygon points={shape([0.5, 0.5, 0.5, 0.5, 0.5])} fill="none" stroke={DIM} strokeWidth={1.5} />
        <polygon points={shape([0.95, 0.7, 0.85, 0.6, 0.8])} fill={`${ACCENT}55`} stroke={ACCENT} strokeWidth={2} />
        <polygon points={shape([0.6, 0.9, 0.55, 0.85, 0.65])} fill={`${RIVAL}55`} stroke={RIVAL} strokeWidth={2} />
      </>
    );
  },
  ladder: (d) => (
    <>
      <circle cx={d.w * 0.46} cy={d.h * 0.4} r={d.h * 0.11} fill={MID} stroke={ACCENT} strokeWidth={d.h * 0.025} />
      <circle cx={d.w * 0.74} cy={d.h * 0.4} r={d.h * 0.11} fill={MID} stroke={RIVAL} strokeWidth={d.h * 0.025} />
      {d.r(0.06, 0.12, 0.2, 0.1, LIGHT)}
      {d.r(0.74, 0.12, 0.2, 0.1, LIGHT)}
      {d.r(0.44, 0.1, 0.12, 0.12, GREEN)}
      {Array.from({ length: 10 }, (_, index) => d.r(0.06 + index * 0.088, 0.66, 0.08, 0.1, index < 3 ? MID : index < 7 ? '#c9a227' : ACCENT, 0.3))}
      {d.r(0.06, 0.86, 0.04, 0.05, MID)}
      {d.r(0.5, 0.86, 0.04, 0.05, MID)}
      {d.r(0.9, 0.86, 0.04, 0.05, MID)}
    </>
  ),
};

/** Thumbnail of one banner layout, drawn at the banner's own proportions. */
export function PresetThumb({ id, width, height }: { id: string; width: number; height: number }) {
  const d = make(width, height);
  const round = id === 'halo' ? 0.5 : id === 'pulse' ? 0.5 : id === 'clash' ? 0.06 : 0.07;
  return (
    <span className="preset-thumb" aria-hidden="true">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        <rect x={1} y={1} width={width - 2} height={height - 2} rx={Math.min(width, height) * round} fill="#1a1d24" stroke="#3a332e" strokeWidth={Math.min(width, height) * 0.012} />
        {DRAWINGS[id]?.(d)}
      </svg>
    </span>
  );
}
