import type { CSSProperties } from 'react';
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

function point(index: number, amount: number, total: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  const radius = 34 * Math.max(0.08, Math.min(1, amount));
  return [50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius];
}

function RadarPlate({ options, stats }: { options: SplitOptions; stats: SplitStats }) {
  const axes = options.axes.map((id) => ({
    id,
    label: SPLIT_AXIS_LABEL[id],
    value: stats[id],
    max: SPLIT_AXIS_MAX[id],
  }));
  const style = plateStyle(options);
  if (axes.length < 3) {
    return (
      <div className="split-plate" data-part="radar" data-theme={options.theme} style={style}>
        {axes.length === 0 ? (
          <b className="split-empty">—</b>
        ) : (
          <div className="split-stack">
            {axes.map((axis) => (
              <p key={axis.id}>
                <b>{formatStat(axis.id, axis.value)}</b>
                <small>{axis.label}</small>
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }
  const shape = axes.map((axis, index) => point(index, axis.value / axis.max, axes.length).join(',')).join(' ');
  const rings = [0.35, 0.7, 1].map((scale) => axes.map((_, index) => point(index, scale, axes.length).join(',')).join(' '));
  return (
    <div className="split-plate" data-part="radar" data-theme={options.theme} style={style}>
      <svg viewBox="0 0 100 100" role="img" aria-label={axes.map((axis) => `${axis.label} ${formatStat(axis.id, axis.value)}`).join(', ')}>
        {rings.map((ring) => (
          <polygon key={ring} points={ring} />
        ))}
        <polygon className="split-shape" points={shape} />
        {axes.map((axis, index) => {
          const [x, y] = point(index, 1.18, axes.length);
          return (
            <text key={axis.id} x={x} y={y}>
              {axis.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function CameraPlate({ options, stats, username, avatar, elo, level, ranking }: Props) {
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
              {show('level') && <LevelMark level={level} ranking={ranking} />}
            </div>
          )}
          {trail && (
            <div className="split-trail">
              {(show('elo') || show('rank')) && (
                <p className="split-elo">
                  {show('elo') && <b>{elo > 0 ? elo : '—'}</b>}
                  {show('rank') && <small>{ranking > 0 ? `#${ranking}` : '—'}</small>}
                  {show('elo') && !show('rank') && <small>ELO</small>}
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
