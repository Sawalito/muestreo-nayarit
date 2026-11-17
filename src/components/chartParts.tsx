import type { ScaleLinear } from 'd3';
import { fmtAxis, fmtInt } from '../lib/format';

export function XAxis({
  scale,
  y,
  ticks = 6,
  format = fmtAxis,
  label,
}: {
  scale: ScaleLinear<number, number>;
  y: number;
  ticks?: number;
  format?: (v: number) => string;
  label?: string;
}) {
  const [a, b] = scale.range();
  return (
    <g className="axis" transform={`translate(0,${y})`}>
      <line x1={a} x2={b} y1={0} y2={0} />
      {scale.ticks(ticks).map((t) => (
        <g key={t} transform={`translate(${scale(t)},0)`}>
          <line y2={4} />
          <text y={16} textAnchor={scale(t) - a < 24 ? 'start' : b - scale(t) < 24 ? 'end' : 'middle'}>
            {format(t)}
          </text>
        </g>
      ))}
      {label && (
        <text x={b} y={32} textAnchor="end" style={{ fill: 'var(--muted)' }}>
          {label}
        </text>
      )}
    </g>
  );
}

export function YAxis({
  scale,
  x,
  width,
  ticks = 4,
  format = fmtAxis,
  grid = true,
}: {
  scale: ScaleLinear<number, number>;
  x: number;
  width: number;
  ticks?: number;
  format?: (v: number) => string;
  grid?: boolean;
}) {
  return (
    <g className="axis">
      {scale.ticks(ticks).map((t) => (
        <g key={t} transform={`translate(0,${scale(t)})`}>
          {grid && <line className="gridline" x1={x} x2={x + width} />}
          <text x={x - 6} dy="0.32em" textAnchor="end">
            {format(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Línea vertical del valor verdadero Y. */
export function TruthLine({ x, top, bottom, label = true, Y }: { x: number; top: number; bottom: number; label?: boolean; Y: number }) {
  return (
    <g aria-hidden>
      <line x1={x} x2={x} y1={top} y2={bottom} stroke="var(--truth)" strokeWidth={1.5} strokeDasharray="4 3" />
      {label && (
        <text x={x + 5} y={top + 10} fontSize={11} fontWeight={600} style={{ fill: 'var(--ink)' }}>
          Y = {fmtInt(Y)}
        </text>
      )}
    </g>
  );
}
