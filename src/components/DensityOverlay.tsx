import { area, curveBasis, line, scaleLinear } from 'd3';
import { useMemo, useState } from 'react';
import { DESIGNS } from '../lib/designs';
import { fmtInt, fmtPct } from '../lib/format';
import { useWidth } from '../lib/hooks';
import type { DesignId } from '../stats/designs/types';
import { smooth, weightedHistogram } from '../stats/summarize';
import type { DesignResult } from '../workers/protocol';
import { TruthLine, XAxis } from './chartParts';
import { ChartTooltip, Swatch } from './ui';

const BINS = 180;

export interface Curve {
  id: DesignId;
  dens: Float64Array;
  cdf: Float64Array;
  /** masa por debajo del dominio */
  below: number;
  mean: number;
}

export function buildCurves(results: Partial<Record<DesignId, DesignResult>>, ids: DesignId[], lo: number, hi: number): Curve[] {
  const w = (hi - lo) / BINS;
  const out: Curve[] = [];
  for (const id of ids) {
    const r = results[id];
    if (!r?.valid || !r.est || !r.prob || !r.metrics) continue;
    const h = weightedHistogram(r.est, r.prob, lo, hi, BINS);
    const dens = smooth(h, 1.4);
    let below = 0;
    for (let i = 0; i < r.est.length; i++) if (r.est[i] < lo) below += r.prob[i];
    const cdf = new Float64Array(BINS);
    let c = below;
    for (let b = 0; b < BINS; b++) {
      c += h[b] * w;
      cdf[b] = c;
    }
    out.push({ id, dens, cdf, below, mean: r.metrics.mean });
  }
  return out;
}

export function DensityOverlay({
  curves,
  domain,
  Y,
  hidden,
  onToggle,
}: {
  curves: Curve[];
  domain: [number, number];
  Y: number;
  hidden: Set<DesignId>;
  onToggle: (id: DesignId) => void;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = width < 500 ? 280 : 360;
  const m = { top: 16, right: 16, bottom: 40, left: 16 };
  const [hover, setHover] = useState<{ x: number; px: number; py: number } | null>(null);

  const visible = curves.filter((c) => !hidden.has(c.id));
  const x = scaleLinear().domain(domain).range([m.left, width - m.right]);
  const ymax = Math.max(1e-12, ...visible.map((c) => Math.max(...c.dens)));
  const y = scaleLinear().domain([0, ymax * 1.08]).range([height - m.bottom, m.top]);
  const binW = (domain[1] - domain[0]) / BINS;
  const xs = Array.from({ length: BINS }, (_, b) => domain[0] + (b + 0.5) * binW);

  const areaGen = area<number>()
    .x((_, i) => x(xs[i]))
    .y0(y(0))
    .y1((d) => y(d))
    .curve(curveBasis);
  const lineGen = line<number>()
    .x((_, i) => x(xs[i]))
    .y((d) => y(d))
    .curve(curveBasis);

  // Etiquetas directas en el pico de cada curva, separadas verticalmente si chocan.
  const labels = useMemo(() => {
    const ls = visible.map((c) => {
      let bi = 0;
      for (let b = 1; b < BINS; b++) if (c.dens[b] > c.dens[bi]) bi = b;
      return { id: c.id, x: x(xs[bi]), y: y(c.dens[bi]) - 8 };
    });
    ls.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ls.length; i++) {
      for (let j = 0; j < i; j++) {
        if (Math.abs(ls[i].x - ls[j].x) < 110 && Math.abs(ls[i].y - ls[j].y) < 15) ls[i].y = ls[j].y + 15;
      }
    }
    return ls;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.map((c) => c.id).join(), width, height, domain[0], domain[1], ymax]);

  const hoverBin = hover ? Math.min(BINS - 1, Math.max(0, Math.floor((hover.x - domain[0]) / binW))) : -1;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Mostrar u ocultar diseños">
        {curves.map((c) => {
          const on = !hidden.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(c.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                on ? 'border-line bg-surface text-ink' : 'border-dashed border-line bg-transparent text-muted line-through'
              }`}
            >
              <Swatch color={DESIGNS[c.id].color} className={on ? '' : 'opacity-30'} />
              {DESIGNS[c.id].corto}
            </button>
          );
        })}
      </div>
      <div ref={ref} className="relative w-full">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Densidades de la distribución en el muestreo de cada diseño, con el valor verdadero Y marcado"
          onPointerMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = e.clientX - r.left;
            setHover({ x: x.invert(px), px, py: e.clientY - r.top });
          }}
          onPointerLeave={() => setHover(null)}
          className="touch-pan-y select-none"
        >
          {y.ticks(4).map((t) => (
            <line key={t} className="gridline" x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} />
          ))}
          {visible.map((c) => (
            <path key={c.id + 'a'} d={areaGen(Array.from(c.dens)) ?? ''} fill={DESIGNS[c.id].color} fillOpacity={0.1} />
          ))}
          {visible.map((c) => (
            <path
              key={c.id + 'l'}
              d={lineGen(Array.from(c.dens)) ?? ''}
              fill="none"
              stroke={DESIGNS[c.id].color}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          ))}
          {/* Marcas de E(Ŷ) sobre el eje */}
          {visible.map((c) => (
            <path
              key={c.id + 'm'}
              d={`M${x(c.mean)},${height - m.bottom - 1} l-5,-8 h10 z`}
              fill={DESIGNS[c.id].color}
              stroke="var(--surface)"
              strokeWidth={1.5}
            >
              <title>
                E(Ŷ) {DESIGNS[c.id].corto}: {fmtInt(c.mean)}
              </title>
            </path>
          ))}
          <TruthLine x={x(Y)} top={m.top} bottom={height - m.bottom} Y={Y} />
          {width >= 500 && labels.map((l) => (
            <text
              key={l.id}
              x={Math.min(Math.max(l.x, m.left + 30), width - m.right - 30)}
              y={Math.max(l.y, m.top + 22)}
              textAnchor="middle"
              fontSize={11.5}
              fontWeight={600}
              stroke="var(--surface)"
              strokeWidth={3}
              paintOrder="stroke"
              style={{ fill: 'var(--ink)' }}
            >
              {DESIGNS[l.id].corto}
            </text>
          ))}
          {hover && (
            <line x1={hover.px} x2={hover.px} y1={m.top} y2={height - m.bottom} stroke="var(--axis)" strokeWidth={1} />
          )}
          <XAxis scale={x} y={height - m.bottom} ticks={width < 500 ? 3 : 7} label="Ŷ (habitantes)" />
        </svg>
        {hover && hoverBin >= 0 && visible.length > 0 && (
          <ChartTooltip x={hover.px} y={hover.py} width={width}>
            <div className="mb-1 font-semibold text-ink">Ŷ ≤ {fmtInt(hover.x)}</div>
            <table className="w-full">
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id}>
                    <td className="py-0.5 pr-2">
                      <span className="inline-flex items-center gap-1.5 text-ink-2">
                        <Swatch color={DESIGNS[c.id].color} />
                        {DESIGNS[c.id].corto}
                      </span>
                    </td>
                    <td className="tabular text-right font-medium text-ink">{fmtPct(Math.min(1, c.cdf[hoverBin]))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[11px] text-muted">Probabilidad acumulada P(Ŷ ≤ x)</p>
          </ChartTooltip>
        )}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <svg width="18" height="10" aria-hidden>
            <line x1="9" x2="9" y1="0" y2="10" stroke="var(--truth)" strokeWidth="1.5" strokeDasharray="3 2" />
          </svg>
          Valor verdadero Y₁₉₈₀
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="12" height="10" aria-hidden>
            <path d="M6,10 l-5,-8 h10 z" fill="var(--muted)" />
          </svg>
          E(Ŷ) de cada diseño. Si no coincide con Y, hay sesgo.
        </span>
      </p>
    </div>
  );
}
