import { line, scaleLinear, scaleLog } from 'd3';
import { useState } from 'react';
import { DESIGNS } from '../lib/designs';
import { fmtAxis, fmtInt, fmtSignedPct } from '../lib/format';
import { useWidth } from '../lib/hooks';
import { DESIGN_IDS } from '../stats/designs';
import type { DesignId } from '../stats/designs/types';
import type { SweepRow } from '../workers/protocol';
import { ChartTooltip, Swatch } from './ui';

export function SweepChart({ rows, ids, n }: { rows: SweepRow[] | null; ids: DesignId[]; n: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [ref2, width2] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (!rows) return <p className="text-sm text-muted">Calculando…</p>;
  const active = DESIGN_IDS.filter((d) => ids.includes(d));
  const ns = [...new Set(rows.map((r) => r.n))].sort((a, b) => a - b);
  const h = 300;
  const mg = { top: 14, right: 90, bottom: 38, left: 64 };
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
  const h2 = 220;
  const mg2 = { top: 14, right: 16, bottom: 38, left: 64 };
  const x2 = scaleLinear()
    .domain([ns[0] - 0.5, ns[ns.length - 1] + 0.5])
    .range([mg2.left, width2 - mg2.right]);
  const maxB = Math.max(...ratio.map((r) => Math.abs(r.relBias)), 1e-9);
  const y2 = scaleLinear().domain([Math.min(0, ...ratio.map((r) => r.relBias)) * 1.1, Math.max(0, maxB) * 1.1]).range([h2 - mg2.bottom, mg2.top]).nice();
  const bw = Math.max(4, ((width2 - mg2.left - mg2.right) / ns.length) * 0.6);

  // Etiquetas directas al final de cada línea, separadas si se enciman.
  const ends = active
    .map((id) => {
      const rs = rows.filter((r) => r.design === id);
      const last = rs[rs.length - 1];
      return last ? { id, y: y(last.rmse), x: x(last.n) } : null;
    })
    .filter(Boolean) as { id: DesignId; y: number; x: number }[];
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-ink">√ECM según el tamaño de muestra</h3>
        <p className="mb-2 text-xs text-muted">
          Escala logarítmica. En los diseños insesgados es la DE exacta de la fórmula del formulario; en la razón es el √ECM exacto por
          enumeración. La línea vertical marca la n elegida.
        </p>
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
          >
            {y.ticks(5).filter((t) => [1, 2, 5].includes(Math.round(t / 10 ** Math.floor(Math.log10(t) + 1e-9)))).map((t) => (
              <g key={t} className="axis">
                <line className="gridline" x1={mg.left} x2={width - mg.right} y1={y(t)} y2={y(t)} />
                <text x={mg.left - 6} y={y(t)} dy="0.32em" textAnchor="end">
                  {fmtAxis(t)}
                </text>
              </g>
            ))}
            <g className="axis" transform={`translate(0,${h - mg.bottom})`}>
              <line x1={mg.left} x2={width - mg.right} />
              {ns.map((v) => (
                <text key={v} x={x(v)} y={16} textAnchor="middle">
                  {v}
                </text>
              ))}
              <text x={width - mg.right} y={32} textAnchor="end">
                n
              </text>
            </g>
            <line x1={x(n)} x2={x(n)} y1={mg.top} y2={h - mg.bottom} stroke="var(--axis)" strokeDasharray="3 3" />
            {active.map((id) => {
              const rs = rows.filter((r) => r.design === id);
              return (
                <g key={id}>
                  <path d={ln(rs) ?? ''} fill="none" stroke={DESIGNS[id].color} strokeWidth={2} />
                  {rs.map((r) => (
                    <circle key={r.n} cx={x(r.n)} cy={y(r.rmse)} r={r.n === hover ? 4.5 : 2.5} fill={DESIGNS[id].color} stroke="var(--surface)" strokeWidth={1.5} />
                  ))}
                </g>
              );
            })}
            {ends.map((e) => (
              <text key={e.id} x={e.x + 8} y={e.y} dy="0.32em" fontSize={11} fontWeight={600} style={{ fill: 'var(--ink)' }}>
                {DESIGNS[e.id].corto}
              </text>
            ))}
            {hover != null && <line x1={x(hover)} x2={x(hover)} y1={mg.top} y2={h - mg.bottom} stroke="var(--axis)" />}
          </svg>
          {hover != null && (
            <ChartTooltip x={x(hover)} y={mg.top} width={width}>
              <div className="mb-1 font-semibold text-ink">n = {hover}</div>
              <table className="w-full">
                <tbody>
                  {active
                    .map((id) => rows.find((r) => r.design === id && r.n === hover))
                    .filter(Boolean)
                    .sort((a, b) => a!.rmse - b!.rmse)
                    .map((r) => (
                      <tr key={r!.design}>
                        <td className="py-0.5 pr-2 text-ink-2">
                          <span className="inline-flex items-center gap-1.5">
                            <Swatch color={DESIGNS[r!.design].color} />
                            {DESIGNS[r!.design].corto}
                          </span>
                        </td>
                        <td className="tabular text-right font-medium text-ink">{fmtInt(r!.rmse)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </ChartTooltip>
          )}
        </div>
      </div>

      {ratio.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink">Sesgo relativo del estimador de razón</h3>
          <p className="mb-2 text-xs text-muted">
            Exacto (enumerando todas las muestras). Es de orden 1/n: se reduce rápidamente al crecer n y desaparece en n = N.
          </p>
          <div ref={ref2}>
            <svg width={width2} height={h2} role="img" aria-label="Sesgo relativo del estimador de razón contra n">
              {y2.ticks(4).map((t) => (
                <g key={t} className="axis">
                  <line className="gridline" x1={mg2.left} x2={width2 - mg2.right} y1={y2(t)} y2={y2(t)} />
                  <text x={mg2.left - 6} y={y2(t)} dy="0.32em" textAnchor="end">
                    {fmtSignedPct(t, 2)}
                  </text>
                </g>
              ))}
              {ratio.map((r) => {
                const y0 = y2(0);
                const y1 = y2(r.relBias);
                return (
                  <g key={r.n}>
                    <rect
                      x={x2(r.n) - bw / 2}
                      width={bw}
                      y={Math.min(y0, y1)}
                      height={Math.max(1, Math.abs(y1 - y0))}
                      rx={3}
                      fill="var(--d-razon)"
                      fillOpacity={r.n === n ? 1 : 0.6}
                    >
                      <title>{`n = ${r.n}: sesgo ${fmtInt(r.bias)} (${fmtSignedPct(r.relBias, 3)})`}</title>
                    </rect>
                  </g>
                );
              })}
              <g className="axis" transform={`translate(0,${h2 - mg2.bottom})`}>
                <line x1={mg2.left} x2={width2 - mg2.right} />
                {ns.map((v) => (
                  <text key={v} x={x2(v)} y={16} textAnchor="middle" style={v === n ? { fill: 'var(--ink)', fontWeight: 700 } : undefined}>
                    {v}
                  </text>
                ))}
                <text x={width2 - mg2.right} y={32} textAnchor="end">
                  n
                </text>
              </g>
              <line x1={mg2.left} x2={width2 - mg2.right} y1={y2(0)} y2={y2(0)} stroke="var(--baseline)" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
