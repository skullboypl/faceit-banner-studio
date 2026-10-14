import { useState } from 'react';

export type DayPoint = { day: string; count: number; players: number };

const labelOf = (day: string) => {
  const [, month, date] = day.split('-');
  return `${Number(date)}.${month}`;
};

export function AdminChart({
  title,
  hint,
  series,
  field,
  summary,
}: {
  title: string;
  hint: string;
  series: DayPoint[];
  field: 'count' | 'players';
  summary: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const values = series.map((point) => point[field]);
  const max = Math.max(1, ...values);
  const width = 640;
  const height = 220;
  const pad = { left: 36, right: 12, top: 16, bottom: 28 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const step = series.length > 1 ? innerW / (series.length - 1) : 0;
  const points = series.map((point, index) => ({
    ...point,
    value: point[field],
    x: pad.left + index * step,
    y: pad.top + innerH - (point[field] / max) * innerH,
  }));
  const line = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`
    )
    .join(' ');
  const area =
    points.length > 0
      ? `${line} L${points[points.length - 1].x.toFixed(1)},${pad.top + innerH} L${points[0].x.toFixed(1)},${pad.top + innerH} Z`
      : '';
  if (points.length === 0) {
    return (
      <section className="admin-chart">
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

  const active = hover !== null ? points[hover] : null;
  const ticks = [...new Set([max, Math.round(max / 2), 0])];
  const xLabels = [
    0,
    Math.floor((points.length - 1) / 2),
    points.length - 1,
  ].filter(
    (index, position, all) => index >= 0 && all.indexOf(index) === position
  );

  return (
    <section className={`admin-chart admin-chart--${field}`}>
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
        onFocus={() => setHover(points.length - 1)}
        onBlur={() => setHover(null)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          setHover((current) =>
            Math.max(
              0,
              Math.min(
                points.length - 1,
                (current ?? points.length - 1) +
                  (event.key === 'ArrowLeft' ? -1 : 1)
              )
            )
          );
        }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          if (points.length === 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * width;
          let nearest = 0;
          let best = Infinity;
          points.forEach((point, index) => {
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
            key={points[index].day}
            className="admin-chart-x"
            x={points[index].x}
            y={height - 8}
            textAnchor="middle"
          >
            {labelOf(points[index].day)}
          </text>
        ))}
      </svg>
      <p className="admin-chart-tip" aria-live="polite">
        {active
          ? `${labelOf(active.day)} · ${active.value}`
          : 'Najedź na wykres lub użyj strzałek po zaznaczeniu.'}
      </p>
      <details className="admin-chart-data">
        <summary>Pokaż dane wykresu</summary>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Dzień (UTC)</th>
                <th scope="col">
                  {field === 'count' ? 'Logowania' : 'Gracze'}
                </th>
              </tr>
            </thead>
            <tbody>
              {series.map((point) => (
                <tr key={point.day}>
                  <td>{point.day}</td>
                  <td>{point[field]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
