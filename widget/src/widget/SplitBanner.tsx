import type { CSSProperties, ReactNode } from 'react';
import { LevelMark } from '../components/LevelMark';
import type { BannerSizeLimits } from '../utils/banner_size';
import {
  SPLIT_AXIS_LABEL,
  SPLIT_AXIS_MAX,
  type SplitAxis,
  type SplitOptions,
  type SplitStats,
} from './split-options';

/** Rozmiar źródła OBS dla każdej części. Radar jest kwadratem, pasek jest niski. */
export const SPLIT_PARTS: Record<'radar' | 'camera', BannerSizeLimits> = {
  radar: {
    width: 300,
    height: 300,
    square: true,
    minWidth: 180,
    maxWidth: 640,
    minHeight: 180,
    maxHeight: 640,
  },
  camera: {
    width: 360,
    height: 128,
    square: false,
    minWidth: 240,
    maxWidth: 720,
    minHeight: 80,
    maxHeight: 220,
  },
};

type Props = {
  part: 'radar' | 'camera';
  options: SplitOptions;
  stats: SplitStats;
  username: string;
  avatar?: string;
  elo: number;
  level: number;
  ranking: number;
  /** Placements are unfinished, so the level stays off and `knownLabel` sits by the ELO. */
  calibrating?: boolean;
  knownLabel?: string;
};

function formatStat(id: SplitAxis, value: number) {
  if (id === 'kd' || id === 'kr') return (Number.isFinite(value) ? value : 0).toFixed(2);
  return String(Math.round(Number.isFinite(value) ? value : 0));
}

function plateStyle(options: SplitOptions): CSSProperties {
  return {
    ['--split-radius' as string]: `${options.radius}px`,
    ['--split-opacity' as string]: String(options.opacity / 100),
    ['--split-scale' as string]: String(options.font / 100),
    ...(options.accent ? { ['--split-accent' as string]: `#${options.accent}` } : {}),
  };
}

type Axis = { id: SplitAxis; label: string; value: number; max: number };

function point(index: number, amount: number, total: number, reach = 34) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  const radius = reach * Math.max(0.08, Math.min(1, amount));
  return [50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius];
}

function fillOf(axis: Axis) {
  if (!Number.isFinite(axis.value) || axis.max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((axis.value / axis.max) * 100)));
}

function Plate({
  options,
  look,
  children,
}: {
  options: SplitOptions;
  look: string;
  children: ReactNode;
}) {
  return (
    <div
      className="split-plate"
      data-part="radar"
      data-theme={options.theme}
      data-view={options.view}
      data-look={look}
      style={plateStyle(options)}
    >
      {children}
    </div>
  );
}

function Hero({ axes }: { axes: Axis[] }) {
  return (
    <div className="split-stack" data-count={axes.length}>
      {axes.map((axis) => (
        <p key={axis.id}>
          <b>{formatStat(axis.id, axis.value)}</b>
          <small>{axis.label}</small>
        </p>
      ))}
    </div>
  );
}

function Tiles({ axes }: { axes: Axis[] }) {
  return (
    <div className="split-tiles" data-count={axes.length}>
      {axes.map((axis) => (
        <p key={axis.id}>
          <b>{formatStat(axis.id, axis.value)}</b>
          <small>{axis.label}</small>
        </p>
      ))}
    </div>
  );
}

function Meters({ axes }: { axes: Axis[] }) {
  return (
    <div className="split-meter" data-count={axes.length}>
      {axes.map((axis, index) => (
        <p key={axis.id} style={{ ['--fill' as string]: `${fillOf(axis)}%`, ['--i' as string]: index }}>
          <small>{axis.label}</small>
          <i />
          <b>{formatStat(axis.id, axis.value)}</b>
        </p>
      ))}
    </div>
  );
}

function cycleCss(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const slot = 100 / count;
    const fade = Math.min(2.5, slot * 0.22);
    const start = index * slot;
    const show = start + fade;
    const hold = start + slot - fade;
    const end = Math.min(100, start + slot);
    return `@keyframes split-cycle-${index} { 0%, ${start}% { opacity: 0; transform: translateY(8px); } ${show}%, ${hold}% { opacity: 1; transform: none; } ${end}%, 100% { opacity: 0; transform: translateY(-8px); } }`;
  }).join('\n');
}

function Cycle({ axes }: { axes: Axis[] }) {
  return (
    <div className="split-cycle" style={{ ['--count' as string]: axes.length }}>
      <style>{cycleCss(axes.length)}</style>
      {axes.map((axis, index) => (
        <p key={axis.id} style={{ animationName: `split-cycle-${index}` }}>
          <b>{formatStat(axis.id, axis.value)}</b>
          <small>{axis.label}</small>
        </p>
      ))}
    </div>
  );
}

function Chart({ axes, look }: { axes: Axis[]; look: SplitOptions['chartLook'] }) {
  const reach = look === 'ring' ? 26 : 34;
  const shape = axes.map((axis, index) => point(index, axis.value / axis.max, axes.length, reach).join(',')).join(' ');
  const rings = [0.35, 0.7, 1].map((scale) =>
    axes.map((_, index) => point(index, scale, axes.length, reach).join(',')).join(' ')
  );
  const label = axes.map((axis) => `${axis.label} ${formatStat(axis.id, axis.value)}`).join(', ');
  return (
    <div className={look === 'side' ? 'split-chart' : 'split-chart is-ring'} data-count={axes.length}>
      <svg viewBox="0 0 100 100" role="img" aria-label={label}>
        {rings.map((ring) => (
          <polygon key={ring} points={ring} />
        ))}
        <polygon className="split-shape" points={shape} />
        {look === 'ring' &&
          axes.map((axis, index) => {
            const [x, y] = point(index, 1.18, axes.length, reach);
            return (
              <text key={axis.id} x={x} y={y}>
                <tspan x={x} dy="-0.55em">
                  {axis.label}
                </tspan>
                <tspan className="split-value" x={x} dy="1.25em">
                  {formatStat(axis.id, axis.value)}
                </tspan>
              </text>
            );
          })}
      </svg>
      {look === 'side' && (
        <ul className="split-chart-values">
          {axes.map((axis) => (
            <li key={axis.id}>
              <small>{axis.label}</small>
              <b>{formatStat(axis.id, axis.value)}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RadarPlate({ options, stats }: { options: SplitOptions; stats: SplitStats }) {
  const axes: Axis[] = options.axes.map((id) => ({
    id,
    label: SPLIT_AXIS_LABEL[id],
    value: stats[id],
    max: SPLIT_AXIS_MAX[id],
  }));
  if (axes.length === 0) {
    return (
      <Plate options={options} look="empty">
        <b className="split-empty">—</b>
      </Plate>
    );
  }
  if (options.view === 'data') {
    const look = options.dataLook;
    return (
      <Plate options={options} look={look}>
        {look === 'list' ? <Meters axes={axes} /> : look === 'hero' ? <Hero axes={axes} /> : <Tiles axes={axes} />}
      </Plate>
    );
  }
  if (options.view === 'motion') {
    const look = options.motionLook;
    return (
      <Plate options={options} look={look}>
        {look === 'cycle' ? <Cycle axes={axes} /> : <Meters axes={axes} />}
      </Plate>
    );
  }
  if (axes.length < 3) {
    return (
      <Plate options={options} look="hero">
        <Hero axes={axes} />
      </Plate>
    );
  }
  return (
    <Plate options={options} look={options.chartLook}>
      <Chart axes={axes} look={options.chartLook} />
    </Plate>
  );
}

function CameraPlate({ options, stats, username, avatar, elo, level, ranking, calibrating, knownLabel }: Props) {
  const show = (bit: (typeof options.bits)[number]) => options.bits.includes(bit);
  const lead = show('avatar') || show('name') || show('level');
  const trail = show('elo') || show('rank') || show('session') || show('streak') || show('wr');
  return (
    <div className="split-plate" data-part="camera" data-theme={options.theme} style={plateStyle(options)}>
      {options.bits.length === 0 ? (
        <b className="split-empty">—</b>
      ) : (
        <div className={lead ? 'split-bar' : 'split-bar is-solo'}>
          {show('avatar') && (avatar ? <img src={avatar} alt="" /> : <i />)}
          {(show('name') || show('level')) && (
            <div className="split-name">
              {show('name') && <strong>{username}</strong>}
              {show('level') && <LevelMark level={level || 1} ranking={ranking} unranked={calibrating} />}
            </div>
          )}
          {trail && (
            <div className="split-trail">
              {(show('elo') || show('rank')) && (
                <p className="split-elo">
                  {show('elo') && calibrating ? (
                    <span className="elo-stack">
                      <b>{elo > 0 ? elo : '—'}</b>
                      <small className="elo-known">{knownLabel}</small>
                    </span>
                  ) : (
                    show('elo') && <b>{elo > 0 ? elo : '—'}</b>
                  )}
                  {show('rank') && !calibrating && <small>{ranking > 0 ? `#${ranking}` : '—'}</small>}
                  {show('elo') && !calibrating && !show('rank') && <small>ELO</small>}
                </p>
              )}
              {show('session') && (
                <div className="split-session">
                  <p>
                    <b>{Math.round(stats.wins)}</b>
                    <small>W</small>
                  </p>
                  <p>
                    <b>{Math.round(stats.losses)}</b>
                    <small>L</small>
                  </p>
                </div>
              )}
              {show('streak') && (
                <p className="split-pill">
                  <b>{Math.round(stats.streak)}</b>
                  <small>S</small>
                </p>
              )}
              {show('wr') && (
                <p className="split-pill">
                  <b>{Math.round(stats.wr)}%</b>
                  <small>WR</small>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SplitBanner(props: Props) {
  if (props.part === 'camera') return <CameraPlate {...props} />;
  return <RadarPlate options={props.options} stats={props.stats} />;
}
