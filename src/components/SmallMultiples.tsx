import { area, curveStepAfter, line, scaleLinear } from 'd3';
import { useState } from 'react';
import { DESIGNS } from '../lib/designs';
import { fmt2, fmtInt } from '../lib/format';
import { useWidth } from '../lib/hooks';
import type { DesignId } from '../stats/designs/types';
import { weightedHistogram } from '../stats/summarize';
import type { DesignResult } from '../workers/protocol';
import { TruthLine, XAxis } from './chartParts';
import { ExactBadge, Num, Segmented } from './ui';

function Panel({ r, domain, Y, bins, ymaxShared, k }: { r: DesignResult; domain: [number, number]; Y: number; bins: number; ymaxShared: number | null; k: string }) {
  const [ref, width] = useWidth<HTMLDivElement>(320);
  const meta = DESIGNS[r.design];
  const m = r.metrics!;
  const height = 180;
  const mg = { top: 14, right: 4, bottom: 34, left: 4 };
  const h = Array.from(weightedHistogram(r.est!, r.prob!, domain[0], domain[1], bins));
  h.push(h[h.length - 1]);
  const bw = (domain[1] - domain[0]) / bins;
  const x = scaleLinear().domain(domain).range([mg.left, width - mg.right]);
  const ymax = ymaxShared ?? Math.max(...h);
  const y = scaleLinear().domain([0, ymax * 1.05]).range([height - mg.bottom, mg.top]).clamp(true);
  const areaGen = area<number>()
    .x((_, i) => x(domain[0] + i * bw))
    .y0(y(0))
    .y1((d) => y(d))
    .curve(curveStepAfter);
  const lineGen = line<number>()
    .x((_, i) => x(domain[0] + i * bw))
    .y((d) => y(d))
    .curve(curveStepAfter);

  return (
    <figure className="min-w-0">
      <figcaption className="mb-3 flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
          <span className="font-serif text-[19px] text-ink">{meta.corto}</span>
        </span>
        <ExactBadge exact={m.exact} />
      </figcaption>
      <div ref={ref}>
        <svg width={width} height={height} role="img" aria-label={`Histograma de ${meta.nombre}`} className="overflow-visible">
          <path key={'a' + k} d={areaGen(h) ?? ''} fill={meta.color} fillOpacity={0.16} className="fade-in" />
          <path
            key={'l' + k}
            d={lineGen(h) ?? ''}
            fill="none"
            stroke={meta.color}
            style={{ color: meta.color }}
            strokeWidth={1.5}
            pathLength={1}
            className="draw-in glow"
          />
          <line x1={x(m.mean)} x2={x(m.mean)} y1={mg.top} y2={height - mg.bottom} stroke={meta.color} strokeWidth={1.5} />
          <TruthLine x={x(Y)} top={mg.top - 6} bottom={height - mg.bottom} Y={Y} label={false} />
          <XAxis scale={x} y={height - mg.bottom} ticks={width < 360 ? 3 : 5} />
        </svg>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        {[
          ['E(Ŷ)', m.mean, fmtInt],
          ['DE(Ŷ)', m.sd, fmtInt],
          ['vs MAS', m.efficiency, (v: number) => fmt2(v) + '×'],
        ].map(([k2, v, f]) => (
          <div key={k2 as string}>
            <dt className="label">{k2 as string}</dt>
            <dd className="mt-0.5 text-[15px] text-ink">
              <Num value={v as number} format={f as (v: number) => string} />
            </dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}

export function SmallMultiples({
  results,
  ids,
  domain,
  Y,
  stateKey,
}: {
  results: Partial<Record<DesignId, DesignResult>>;
  ids: DesignId[];
  domain: [number, number];
  Y: number;
  stateKey: string;
}) {
  const [shared, setShared] = useState<'libre' | 'comun'>('libre');
  const valid = ids.map((id) => results[id]).filter((r): r is DesignResult => !!r?.valid && !!r.metrics);
  const bins = 90;
  const ymaxShared =
    shared === 'comun' ? Math.max(...valid.map((r) => Math.max(...weightedHistogram(r.est!, r.prob!, domain[0], domain[1], bins)))) : null;
  return (
    <div>
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <p className="text-[13.5px] text-muted">
          Mismo eje horizontal en todos los paneles. La línea punteada es <span className="font-serif italic text-ink-2">Y</span> y la
          línea sólida es <span className="font-serif italic text-ink-2">E(Ŷ)</span>.
        </p>
        <Segmented
          label="Escala del eje vertical"
          value={shared}
          onChange={setShared}
          options={[
            { value: 'libre', label: 'Altura libre' },
            { value: 'comun', label: 'Altura común' },
          ]}
        />
      </div>
      <div className="grid gap-x-14 gap-y-16 md:grid-cols-2 2xl:grid-cols-3">
        {valid.map((r) => (
          <Panel key={r.design} r={r} domain={domain} Y={Y} bins={bins} ymaxShared={ymaxShared} k={stateKey + shared} />
        ))}
      </div>
    </div>
  );
}
