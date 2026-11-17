import { area, curveBasis, line, scaleLinear } from 'd3';
import { useMemo, useState } from 'react';
import { DESIGNS } from '../lib/designs';
import { fmtInt, fmtPct } from '../lib/format';
import { useWidth } from '../lib/hooks';
import { useMorph } from '../lib/motion';
import type { DesignId } from '../stats/designs/types';
import { smooth, weightedHistogram } from '../stats/summarize';
import type { DesignResult } from '../workers/protocol';
import { XAxis } from './chartParts';
import { ChartTooltip, DesignChip } from './ui';

export const BINS = 180;

export interface Curve {
  id: DesignId;
  dens: Float64Array;
  cdf: Float64Array;
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
    out.push({ id, dens, cdf, mean: r.metrics.mean });
  }
  return out;
}

interface View {
  curves: Curve[];
  domain: [number, number];
}

export function DensityOverlay({
  curves,
  domain,
  Y,
  allIds,
  active,
  onToggle,
  stateKey,
}: {
  curves: Curve[];
  domain: [number, number];
  Y: number;
  allIds: DesignId[];
  active: DesignId[];
  onToggle: (id: DesignId) => void;
  stateKey: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = width < 520 ? 300 : 420;
  const m = { top: 28, right: 8, bottom: 44, left: 8 };
  const [hover, setHover] = useState<{ x: number; px: number; py: number } | null>(null);

  // Transición suave (morph) entre el estado anterior y el nuevo.
  const { from, to, t } = useMorph<View>({ curves, domain }, stateKey);
  const lerp = (a: number, b: number) => a + (b - a) * t;
  const dom: [number, number] = [lerp(from.domain[0], to.domain[0]), lerp(from.domain[1], to.domain[1])];
  const shown = to.curves.map((c) => {
    const prev = from.curves.find((p) => p.id === c.id);
    if (!prev || t >= 1) return { ...c, isNew: !prev };
    const dens = new Float64Array(BINS);
    for (let b = 0; b < BINS; b++) dens[b] = lerp(prev.dens[b], c.dens[b]);
    return { ...c, dens, mean: lerp(prev.mean, c.mean), isNew: false };
  });

  const x = scaleLinear().domain(dom).range([m.left, width - m.right]);
  const ymaxTo = Math.max(1e-12, ...to.curves.map((c) => Math.max(...c.dens)));
  const ymaxFrom = Math.max(1e-12, ...from.curves.map((c) => Math.max(...c.dens)));
  const ymax = from.curves.length ? lerp(ymaxFrom, ymaxTo) : ymaxTo;
  const y = scaleLinear().domain([0, ymax * 1.1]).range([height - m.bottom, m.top]);
  const binW = (dom[1] - dom[0]) / BINS;
  const xs = Array.from({ length: BINS }, (_, b) => dom[0] + (b + 0.5) * binW);

  const areaGen = area<number>()
    .x((_, i) => x(xs[i]))
    .y0(y(0))
    .y1((d) => y(d))
    .curve(curveBasis);
  const eps = ymax * 0.004;
  const lineGen = line<number>()
    .defined((d, i, arr) => d > eps || (arr[i - 1] ?? 0) > eps || (arr[i + 1] ?? 0) > eps)
    .x((_, i) => x(xs[i]))
    .y((d) => y(d))
    .curve(curveBasis);

  // Etiquetas directas en el pico de cada curva (separadas si chocan).
  const labels = useMemo(() => {
    const ls = to.curves.map((c) => {
      let bi = 0;
      for (let b = 1; b < BINS; b++) if (c.dens[b] > c.dens[bi]) bi = b;
      const xx = scaleLinear().domain(to.domain).range([m.left, width - m.right]);
      const yy = scaleLinear().domain([0, ymaxTo * 1.1]).range([height - m.bottom, m.top]);
      return { id: c.id, x: xx(to.domain[0] + (bi + 0.5) * ((to.domain[1] - to.domain[0]) / BINS)), y: yy(c.dens[bi]) - 10 };
    });
    ls.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ls.length; i++)
      for (let j = 0; j < i; j++)
        if (Math.abs(ls[i].x - ls[j].x) < 96 && Math.abs(ls[i].y - ls[j].y) < 16) ls[i].y = ls[j].y + 16;
    return ls;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey, width, height, to.curves.length]);

  const hoverBin = hover ? Math.min(BINS - 1, Math.max(0, Math.floor((hover.x - dom[0]) / binW))) : -1;

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-x-6 gap-y-2" role="group" aria-label="Diseños activos">
        {allIds.map((id) => (
          <DesignChip key={id} color={DESIGNS[id].color} label={DESIGNS[id].corto} on={active.includes(id)} onClick={() => onToggle(id)} />
        ))}
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
          className="touch-pan-y select-none overflow-visible"
        >
          {shown.map((c) => (
            <path
              key={c.id + 'a' + (c.isNew ? stateKey : '')}
              d={areaGen(Array.from(c.dens)) ?? ''}
              fill={DESIGNS[c.id].color}
              fillOpacity={0.07}
              className="fade-in"
            />
          ))}
          {shown.map((c) => (
            <path
              key={c.id + 'l' + (c.isNew ? stateKey : '')}
              d={lineGen(Array.from(c.dens)) ?? ''}
              fill="none"
              stroke={DESIGNS[c.id].color}
              style={{ color: DESIGNS[c.id].color }}
              strokeWidth={2}
              strokeLinejoin="round"
              pathLength={c.isNew ? 1 : undefined}
              className={c.isNew ? 'draw-in glow' : 'glow'}
            />
          ))}
          {/* E(Ŷ) de cada diseño: marca sobre el eje */}
          {shown.map((c) => (
            <g key={c.id + 'm'} transform={`translate(${x(c.mean)},${height - m.bottom})`}>
              <line y1={0} y2={-7} stroke={DESIGNS[c.id].color} strokeWidth={2} strokeLinecap="round" />
              <title>
                E(Ŷ) {DESIGNS[c.id].corto}: {fmtInt(c.mean)}
              </title>
            </g>
          ))}
          {/* Valor verdadero */}
          <g aria-hidden>
            <line x1={x(Y)} x2={x(Y)} y1={m.top - 14} y2={height - m.bottom} stroke="var(--truth)" strokeWidth={1.25} strokeDasharray="2 5" strokeLinecap="round" />
            <text x={x(Y) + 8} y={m.top - 6} style={{ fill: 'var(--ink)', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 15 }}>
              Y = {fmtInt(Y)}
            </text>
          </g>
          {width >= 520 &&
            t >= 1 &&
            labels.map((l) => (
              <text
                key={l.id + stateKey}
                x={Math.min(Math.max(l.x, m.left + 34), width - m.right - 34)}
                y={Math.max(l.y, m.top + 26)}
                textAnchor="middle"
                fontSize={12}
                fontWeight={500}
                stroke="var(--page)"
                strokeWidth={4}
                paintOrder="stroke"
                className="fade-in"
                style={{ fill: 'var(--ink)' }}
              >
                {DESIGNS[l.id].corto}
              </text>
            ))}
          {hover && <line x1={hover.px} x2={hover.px} y1={m.top} y2={height - m.bottom} stroke="var(--faint)" strokeWidth={1} />}
          <XAxis scale={x} y={height - m.bottom} ticks={width < 520 ? 3 : 7} label="Ŷ  (habitantes)" />
        </svg>
        {hover && hoverBin >= 0 && shown.length > 0 && (
          <ChartTooltip x={hover.px} y={hover.py} width={width}>
            <div className="mb-1.5 font-serif text-[14px] italic text-ink">Ŷ ≤ {fmtInt(hover.x)}</div>
            <table className="w-full">
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id}>
                    <td className="py-0.5 pr-3">
                      <span className="inline-flex items-center gap-2 text-ink-2">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: DESIGNS[c.id].color }} />
                        {DESIGNS[c.id].corto}
                      </span>
                    </td>
                    <td className="tabular text-right text-ink">{fmtPct(Math.min(1, c.cdf[hoverBin]))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1.5 text-[11px] text-muted">probabilidad acumulada P(Ŷ ≤ x)</p>
          </ChartTooltip>
        )}
      </div>
    </div>
  );
}
