import type { ScaleLinear } from 'd3';
import { fmtAxis, fmtInt } from '../lib/format';

/** Eje X minimalista: línea base fina, marcas cortas y etiquetas discretas. */
export function XAxis({
  scale,
  y,
  ticks = 6,
  format = fmtAxis,
  label,
  serif = true,
}: {
  scale: ScaleLinear<number, number>;
  y: number;
  ticks?: number;
  format?: (v: number) => string;
  label?: string;
  /** false para etiquetas con caracteres combinados (V̂) que la serif no compone bien */
  serif?: boolean;
}) {
  const [a, b] = scale.range();
  return (
    <g className="axis" transform={`translate(0,${y})`}>
      <line x1={a} x2={b} y1={0} y2={0} />
      {scale.ticks(ticks).map((t) => (
        <g key={t} transform={`translate(${scale(t)},0)`}>
          <line y2={4} />
          <text y={18} textAnchor={scale(t) - a < 24 ? 'start' : b - scale(t) < 24 ? 'end' : 'middle'}>
            {format(t)}
          </text>
        </g>
      ))}
      {label && (
        <text x={b} y={36} textAnchor="end" style={serif ? { fill: 'var(--muted)', fontStyle: 'italic', fontFamily: 'var(--font-serif)', fontSize: 13 } : { fill: 'var(--muted)', fontSize: 11.5 }}>
          {label}
        </text>
      )}
    </g>
  );
}

/** Línea vertical del valor verdadero Y. */
export function TruthLine({ x, top, bottom, label = true, Y }: { x: number; top: number; bottom: number; label?: boolean; Y: number }) {
  return (
    <g aria-hidden>
      <line x1={x} x2={x} y1={top} y2={bottom} stroke="var(--truth)" strokeWidth={1.25} strokeDasharray="2 5" strokeLinecap="round" />
      {label && (
        <text x={x + 7} y={top + 11} style={{ fill: 'var(--ink)', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 14 }}>
          Y = {fmtInt(Y)}
        </text>
      )}
    </g>
  );
}
