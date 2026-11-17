import { line, scaleLinear, scaleLog } from 'd3';
import { useState } from 'react';
import { DESIGNS } from '../lib/designs';
import { fmtAxis, fmtInt, fmtSignedPct } from '../lib/format';
import { useWidth } from '../lib/hooks';
import { DESIGN_IDS } from '../stats/designs';
import type { DesignId } from '../stats/designs/types';
import type { SweepRow } from '../workers/protocol';
import { ChartTooltip } from './ui';

export function SweepChart({ rows, ids, n }: { rows: SweepRow[] | null; ids: DesignId[]; n: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [ref2, width2] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (!rows) return <p className="font-serif italic text-muted">Calculando…</p>;
  const active = DESIGN_IDS.filter((d) => ids.includes(d));
  const ns = [...new Set(rows.map((r) => r.n))].sort((a, b) => a - b);
  const h = width < 520 ? 320 : 400;
  const mg = { top: 16, right: width < 520 ? 76 : 104, bottom: 44, left: 56 };
  const x = scaleLinear()
    .domain([ns[0], ns[ns.length - 1]])
    .range([mg.left, width - mg.right]);
  const vals = rows.filter((r) => active.includes(r.design)).map((r) => r.rmse);
  const y = scaleLog()
    .domain([Math.min(...vals) * 0.8, Math.max(...vals) * 1.2])
    .range([h - mg.bottom, mg.top]);
  const ln = line<SweepRow>()
    .x((r) => x(r.n))
    .y((r) => y(r.rmse));

  const ratio = rows.filter((r) => r.design === 'razon');
  const h2 = 240;
  const mg2 = { top: 16, right: 6, bottom: 44, left: 56 };
  const x2 = scaleLinear()
    .domain([ns[0] - 0.5, ns[ns.length - 1] + 0.5])
    .range([mg2.left, width2 - mg2.right]);
  const maxB = Math.max(...ratio.map((r) => Math.abs(r.relBias)), 1e-9);
  const y2 = scaleLinear()
    .domain([Math.min(0, ...ratio.map((r) => r.relBias)) * 1.1, Math.max(0, maxB) * 0.2])
    .range([h2 - mg2.bottom, mg2.top])
    .nice();
  const bw = Math.max(3, ((width2 - mg2.left - mg2.right) / ns.length) * 0.42);

  const ends = active
    .map((id) => {
      const rs = rows.filter((r) => r.design === id);
      const last = rs[rs.length - 1];
      return last ? { id, y: y(last.rmse), x: x(last.n) } : null;
    })
    .filter(Boolean) as { id: DesignId; y: number; x: number }[];
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;

  const logTicks = y.ticks(6).filter((t) => [1, 2, 5].includes(Math.round(t / 10 ** Math.floor(Math.log10(t) + 1e-9))));

  return (
    <div className="space-y-20">
      <figure>
        <figcaption className="mb-6 max-w-[64ch]">
          <h3 className="font-serif text-[22px] text-ink">√ECM según el tamaño de muestra</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            Escala logarítmica. En los diseños insesgados la curva es la DE exacta de la fórmula del formulario; en la razón es el √ECM
            exacto obtenido por enumeración. La línea vertical marca la n elegida.
          </p>
        </figcaption>
        <div ref={ref} className="relative">
          <svg
            width={width}
            height={h}
            role="img"
            aria-label="Raíz del error cuadrático medio de cada diseño contra n"
            onPointerMove={(e) => {
              const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const v = Math.round(x.invert(e.clientX - r.left));
              setHover(Math.min(ns[ns.length - 1], Math.max(ns[0], v)));
            }}
            onPointerLeave={() => setHover(null)}
            className="overflow-visible"
          >
            {logTicks.map((t) => (
              <g key={t} className="axis">
                <line className="gridline" x1={mg.left} x2={width - mg.right} y1={y(t)} y2={y(t)} />
                <text x={mg.left - 10} y={y(t)} dy="0.32em" textAnchor="end">
                  {fmtAxis(t)}
                </text>
              </g>
            ))}
            <g className="axis" transform={`translate(0,${h - mg.bottom})`}>
              {ns.map((v) => (
                <text key={v} x={x(v)} y={18} textAnchor="middle" style={v === n ? { fill: 'var(--ink)' } : undefined}>
                  {v}
                </text>
              ))}
              <text x={width - mg.right} y={36} textAnchor="end" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 14 }}>
                n
              </text>
            </g>
            <line x1={x(n)} x2={x(n)} y1={mg.top} y2={h - mg.bottom} stroke="var(--ink)" strokeOpacity={0.35} strokeDasharray="2 5" strokeLinecap="round" style={{ transition: 'all 600ms cubic-bezier(0.65,0,0.35,1)' }} />
            {active.map((id) => {
              const rs = rows.filter((r) => r.design === id);
              return (
                <g key={id} style={{ color: DESIGNS[id].color }} className="glow">
                  <path d={ln(rs) ?? ''} fill="none" stroke={DESIGNS[id].color} strokeWidth={2} pathLength={1} className="draw-in" />
                  {rs.map((r) => (
                    <circle
                      key={r.n}
                      cx={x(r.n)}
                      cy={y(r.rmse)}
                      r={r.n === hover || r.n === n ? 4 : 0}
                      fill={DESIGNS[id].color}
                      style={{ transition: 'r 250ms ease' }}
                    />
                  ))}
                </g>
              );
            })}
            {ends.map((e) => (
              <text key={e.id} x={e.x + 10} y={e.y} dy="0.32em" fontSize={12} className="fade-in" style={{ fill: 'var(--ink-2)' }}>
                {DESIGNS[e.id].corto}
              </text>
            ))}
            {hover != null && <line x1={x(hover)} x2={x(hover)} y1={mg.top} y2={h - mg.bottom} stroke="var(--faint)" />}
          </svg>
          {hover != null && (
            <ChartTooltip x={x(hover)} y={mg.top} width={width}>
              <div className="mb-1.5 font-serif text-[14px] italic text-ink">n = {hover}</div>
              <table className="w-full">
                <tbody>
                  {active
                    .map((id) => rows.find((r) => r.design === id && r.n === hover))
                    .filter(Boolean)
                    .sort((a, b) => a!.rmse - b!.rmse)
                    .map((r) => (
                      <tr key={r!.design}>
                        <td className="py-0.5 pr-3 text-ink-2">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: DESIGNS[r!.design].color }} />
                            {DESIGNS[r!.design].corto}
                          </span>
                        </td>
                        <td className="tabular text-right text-ink">{fmtInt(r!.rmse)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </ChartTooltip>
          )}
        </div>
      </figure>

      {ratio.length > 0 && (
        <figure>
          <figcaption className="mb-6 max-w-[64ch]">
            <h3 className="font-serif text-[22px] text-ink">Sesgo relativo del estimador de razón</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              Calculado de forma exacta, enumerando todas las muestras. Es de orden 1/n: se reduce rápidamente al crecer n y desaparece
              cuando n = N.
            </p>
          </figcaption>
          <div ref={ref2}>
            <svg width={width2} height={h2} role="img" aria-label="Sesgo relativo del estimador de razón contra n" className="overflow-visible">
              {y2.ticks(4).map((t) => (
                <g key={t} className="axis">
                  <line className="gridline" x1={mg2.left} x2={width2 - mg2.right} y1={y2(t)} y2={y2(t)} />
                  <text x={mg2.left - 10} y={y2(t)} dy="0.32em" textAnchor="end">
                    {fmtSignedPct(t, 1)}
                  </text>
                </g>
              ))}
              {ratio.map((r, i) => {
                const y0 = y2(0);
                const y1 = y2(r.relBias);
                return (
                  <rect
                    key={r.n}
                    x={x2(r.n) - bw / 2}
                    width={bw}
                    y={Math.min(y0, y1)}
                    height={Math.max(1, Math.abs(y1 - y0))}
                    rx={Math.min(bw / 2, 4)}
                    fill="var(--d-razon)"
                    fillOpacity={r.n === n ? 1 : 0.45}
                    className="fade-in"
                    style={{ animationDelay: `${i * 60}ms`, transition: 'fill-opacity 400ms ease' }}
                  >
                    <title>{`n = ${r.n}: sesgo ${fmtInt(r.bias)} (${fmtSignedPct(r.relBias, 3)})`}</title>
                  </rect>
                );
              })}
              <line x1={mg2.left} x2={width2 - mg2.right} y1={y2(0)} y2={y2(0)} stroke="var(--baseline)" />
              <g className="axis" transform={`translate(0,${h2 - mg2.bottom})`}>
                {ns.map((v) => (
                  <text key={v} x={x2(v)} y={18} textAnchor="middle" style={v === n ? { fill: 'var(--ink)' } : undefined}>
                    {v}
                  </text>
                ))}
                <text x={width2 - mg2.right} y={36} textAnchor="end" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 14 }}>
                  n
                </text>
              </g>
            </svg>
          </div>
        </figure>
      )}
    </div>
  );
}
