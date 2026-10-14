import { LevelMark } from '../components/LevelMark';
import type { BannerSizeLimits } from '../utils/banner_size';

export type SplitRadar = 'combat' | 'aim' | 'results';
export type SplitCamera = 'identity' | 'elo' | 'session' | 'form';

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

type Axis = { label: string; value: number; max: number };

type Props = {
  part: 'radar' | 'camera';
  radar: SplitRadar;
  camera: SplitCamera;
  username: string;
  avatar?: string;
  elo: number;
  level: number;
  ranking: number;
  wins: number;
  losses: number;
  winStreak: number;
  winRate: number;
  kd: number;
  adr: number;
  hs: number;
  kills: number;
  kr: number;
};

function point(index: number, amount: number, total: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  const radius = 34 * Math.max(0.08, Math.min(1, amount));
  return [50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius];
}

function RadarPlate({ axes }: { axes: Axis[] }) {
  const shape = axes
    .map((axis, index) => point(index, axis.value / axis.max, axes.length).join(','))
    .join(' ');
  const rings = [0.35, 0.7, 1].map((scale) =>
    axes
      .map((_, index) => point(index, scale, axes.length).join(','))
      .join(' ')
  );
  return (
    <div className="split-plate" data-part="radar">
      <svg viewBox="0 0 100 100" role="img">
        {rings.map((ring) => (
          <polygon key={ring} points={ring} />
        ))}
        <polygon className="split-shape" points={shape} />
        {axes.map((axis, index) => {
          const [x, y] = point(index, 1.18, axes.length);
          return (
            <text key={axis.label} x={x} y={y}>
              {axis.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function CameraPlate({
  camera,
  username,
  avatar,
  elo,
  level,
  ranking,
  wins,
  losses,
  winStreak,
  winRate,
}: Props) {
  return (
    <div className="split-plate" data-part="camera">
      {camera === 'session' ? (
        <div className="split-session">
          <p>
            <b>{wins}</b>
            <small>W</small>
          </p>
          <p>
            <b>{losses}</b>
            <small>L</small>
          </p>
        </div>
      ) : camera === 'form' ? (
        <div className="split-form">
          <b>{winStreak}</b>
          <small>
            {winRate}% WR
          </small>
        </div>
      ) : camera === 'elo' ? (
        <div className="split-identity">
          <b>{elo > 0 ? elo : '—'}</b>
          <LevelMark level={level} />
        </div>
      ) : (
        <div className="split-who">
          {avatar ? <img src={avatar} alt="" /> : <i />}
          <div>
            <strong>{username}</strong>
            <LevelMark level={level} />
          </div>
          <div className="split-identity">
            <b>{elo > 0 ? elo : '—'}</b>
            <small>{ranking > 0 ? `#${ranking}` : '—'}</small>
          </div>
        </div>
      )}
    </div>
  );
}

export function SplitBanner(props: Props) {
  if (props.part === 'camera') return <CameraPlate {...props} />;
  const axes: Axis[] =
    props.radar === 'aim'
      ? [
          { label: 'HS', value: props.hs, max: 70 },
          { label: 'KR', value: props.kr, max: 100 },
          { label: 'ADR', value: props.adr, max: 120 },
          { label: 'K/D', value: props.kd, max: 2 },
          { label: 'K', value: props.kills, max: 30 },
        ]
      : props.radar === 'results'
        ? [
            { label: 'WR', value: props.winRate, max: 80 },
            { label: 'S', value: props.winStreak, max: 12 },
            { label: 'W', value: props.wins, max: 30 },
            { label: 'L', value: props.losses, max: 30 },
            { label: 'K/D', value: props.kd, max: 2 },
          ]
        : [
            { label: 'K/D', value: props.kd, max: 2 },
            { label: 'ADR', value: props.adr, max: 120 },
            { label: 'HS', value: props.hs, max: 70 },
            { label: 'WR', value: props.winRate, max: 80 },
            { label: 'K', value: props.kills, max: 30 },
          ];
  return <RadarPlate axes={axes} />;
}
