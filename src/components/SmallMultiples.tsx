import { scaleLinear } from 'd3';
import { useState } from 'react';
import { DESIGNS } from '../lib/designs';
import { fmt2, fmtInt, fmtPct } from '../lib/format';
import { useWidth } from '../lib/hooks';
import type { DesignId } from '../stats/designs/types';
import { weightedHistogram } from '../stats/summarize';
import type { DesignResult } from '../workers/protocol';
import { TruthLine, XAxis } from './chartParts';
import { ExactBadge, Segmented } from './ui';

function Panel({
  r,
  domain,
  Y,
  bins,
  ymaxShared,
}: {
  r: DesignResult;
  domain: [number, number];
  Y: number;
  bins: number;
  ymaxShared: number | null;
}) {
  const [ref, width] = useWidth<HTMLDivElement>(320);
  const [hover, setHover] = useState<number | null>(null);
  const meta = DESIGNS[r.design];
  const m = r.metrics!;
  const height = 170;
  const mg = { top: 10, right: 10, bottom: 34, left: 10 };
  const h = weightedHistogram(r.est!, r.prob!, domain[0], domain[1], bins);
  const bw = (domain[1] - domain[0]) / bins;
  const x = scaleLinear().domain(domain).range([mg.left, width - mg.right]);
  const ymax = ymaxShared ?? Math.max(...h);
  const y = scaleLinear().domain([0, ymax * 1.05]).range([height - mg.bottom, mg.top]);
  const px = (width - mg.left - mg.right) / bins;
  const gap = px > 4 ? 1 : 0;

  return (
    <figure className="rounded-xl border border-line bg-surface p-3">
      <figcaption className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <span className="h-3 w-1 rounded-full" style={{ background: meta.color }} />
          {meta.corto}
        </span>
        <ExactBadge exact={m.exact} />
      </figcaption>
      <div ref={ref} className="relative">
        <svg width={width} height={height} role="img" aria-label={`Histograma de ${meta.nombre}`}>
          {Array.from(h).map((v, b) => {
            if (v <= 0) return null;
            const x0 = x(domain[0] + b * bw);
            return (
              <rect
                key={b}
                x={x0 + gap / 2}
                y={y(Math.min(v, ymax * 1.05))}
                width={Math.max(px - gap, 0.8)}
                height={y(0) - y(Math.min(v, ymax * 1.05))}
                rx={px > 6 ? 1.5 : 0}
                fill={meta.color}
                fillOpacity={hover === b ? 1 : 0.78}
                onPointerEnter={() => setHover(b)}
                onPointerLeave={() => setHover(null)}
              >
                <title>
                  {`${fmtInt(domain[0] + b * bw)} – ${fmtInt(domain[0] + (b + 1) * bw)}: ${fmtPct(v * bw, 2)}`}
                </title>
              </rect>
            );
          })}
          <line x1={x(m.mean)} x2={x(m.mean)} y1={mg.top} y2={height - mg.bottom} stroke={meta.color} strokeWidth={2} />
          <TruthLine x={x(Y)} top={mg.top} bottom={height - mg.bottom} Y={Y} label={false} />
          <XAxis scale={x} y={height - mg.bottom} ticks={width < 360 ? 3 : 5} />
        </svg>
      </div>
      <dl className="mt-1 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-muted">E(Ŷ)</dt>
          <dd className="tabular font-semibold text-ink">{fmtInt(m.mean)}</dd>
        </div>
        <div>
          <dt className="text-muted">DE(Ŷ)</dt>
          <dd className="tabular font-semibold text-ink">{fmtInt(m.sd)}</dd>
        </div>
        <div>
          <dt className="text-muted">Eficiencia vs MAS</dt>
          <dd className="tabular font-semibold text-ink">{fmt2(m.efficiency)}×</dd>
        </div>
      </dl>
    </figure>
  );
}

export function SmallMultiples({
  results,
  ids,
  domain,
  Y,
}: {
  results: Partial<Record<DesignId, DesignResult>>;
  ids: DesignId[];
  domain: [number, number];
  Y: number;
}) {
  const [shared, setShared] = useState<'libre' | 'comun'>('libre');
  const valid = ids.map((id) => results[id]).filter((r): r is DesignResult => !!r?.valid && !!r.metrics);
  const bins = 90;
  const ymaxShared =
    shared === 'comun'
      ? Math.max(...valid.map((r) => Math.max(...weightedHistogram(r.est!, r.prob!, domain[0], domain[1], bins))))
      : null;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted">
          Todos los paneles comparten el <strong className="text-ink-2">eje X</strong>. La línea punteada es Y y la
          línea sólida es E(Ŷ).
        </p>
        <div className="w-56">
          <Segmented
            label="Escala del eje Y"
            size="sm"
            value={shared}
            onChange={setShared}
            options={[
              { value: 'libre', label: 'Eje Y libre' },
              { value: 'comun', label: 'Eje Y común' },
            ]}
          />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {valid.map((r) => (
          <Panel key={r.design} r={r} domain={domain} Y={Y} bins={bins} ymaxShared={ymaxShared} />
        ))}
      </div>
    </div>
  );
}
