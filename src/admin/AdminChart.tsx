import { useState } from 'react';

export type DayPoint = { day: string; count: number; players: number };
export type ChartPoint = { key: string; label: string; value: number };

export function AdminChart({
  title,
  hint,
  points,
  summary,
  column,
  tone = 'count',
}: {
  title: string;
  hint: string;
  points: ChartPoint[];
  summary: string;
  column: string;
  tone?: 'count' | 'players' | 'online';
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((point) => point.value));
  const width = 640;
  const height = 220;
  const pad = { left: 36, right: 12, top: 16, bottom: 28 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;
  const plotted = points.map((point, index) => ({
    ...point,
    x: pad.left + index * step,
    y: pad.top + innerH - (point.value / max) * innerH,
  }));
  const line = plotted
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`
    )
    .join(' ');
  const area =
    plotted.length > 0
      ? `${line} L${plotted[plotted.length - 1].x.toFixed(1)},${pad.top + innerH} L${plotted[0].x.toFixed(1)},${pad.top + innerH} Z`
      : '';
  if (plotted.length === 0) {
    return (
      <section className={`admin-chart admin-chart--${tone}`}>
        <header>
          <div>
            <h2>{title}</h2>
            <p>{hint}</p>
          </div>
          <strong>{summary}</strong>
        </header>
        <p className="admin-muted">Brak danych w tym zakresie.</p>
      </section>
    );
  }

  const active = hover !== null ? plotted[hover] : null;
  const ticks = [...new Set([max, Math.round(max / 2), 0])];
  const xLabels = [
    0,
    Math.floor((plotted.length - 1) / 2),
    plotted.length - 1,
  ].filter(
    (index, position, all) => index >= 0 && all.indexOf(index) === position
  );

  return (
    <section className={`admin-chart admin-chart--${tone}`}>
      <header>
        <div>
          <h2>{title}</h2>
          <p>{hint}</p>
        </div>
        <strong>{summary}</strong>
      </header>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={title}
        tabIndex={0}
        onFocus={() => setHover(plotted.length - 1)}
        onBlur={() => setHover(null)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          setHover((current) =>
            Math.max(
              0,
              Math.min(
                plotted.length - 1,
                (current ?? plotted.length - 1) +
                  (event.key === 'ArrowLeft' ? -1 : 1)
              )
            )
          );
        }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          if (plotted.length === 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * width;
          let nearest = 0;
          let best = Infinity;
          plotted.forEach((point, index) => {
            const distance = Math.abs(point.x - x);
            if (distance < best) {
              best = distance;
              nearest = index;
            }
          });
          setHover(nearest);
        }}
      >
        {ticks.map((tick) => {
          const y = pad.top + innerH - (tick / max) * innerH;
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} />
              <text x={pad.left - 8} y={y + 4}>
                {tick}
              </text>
            </g>
          );
        })}
        {area && <path className="admin-chart-area" d={area} />}
        {line && <path className="admin-chart-line" d={line} />}
        {active && (
          <>
            <line
              className="admin-chart-guide"
              x1={active.x}
              x2={active.x}
              y1={pad.top}
              y2={pad.top + innerH}
            />
            <circle cx={active.x} cy={active.y} r="4" />
          </>
        )}
        {xLabels.map((index) => (
          <text
            key={plotted[index].key}
            className="admin-chart-x"
            x={plotted[index].x}
            y={height - 8}
            textAnchor="middle"
          >
            {plotted[index].label}
          </text>
        ))}
      </svg>
      <p className="admin-chart-tip" aria-live="polite">
        {active
          ? `${active.label} · ${active.value}`
          : 'Najedź na wykres lub użyj strzałek po zaznaczeniu.'}
      </p>
      <details className="admin-chart-data">
        <summary>Pokaż dane wykresu</summary>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Czas (UTC)</th>
                <th scope="col">{column}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.key}>
                  <td>{point.label}</td>
                  <td>{point.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
