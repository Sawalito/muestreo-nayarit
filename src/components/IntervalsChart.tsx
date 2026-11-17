import { scaleLinear } from 'd3';
import { useMemo, useState } from 'react';
import { DESIGNS } from '../lib/designs';
import { fmtInt, fmtPct } from '../lib/format';
import { useWidth } from '../lib/hooks';
import type { DesignId, PreparedDesign } from '../stats/designs/types';
import { deriveSeed, mulberry32 } from '../stats/rng';
import type { Metrics } from '../stats/summarize';
import { TruthLine, XAxis } from './chartParts';
import { ChartTooltip, DesignChip, Icon, IconButton, Segmented } from './ui';

const K = 100;

export function IntervalsChart({
  prepared,
  ids,
  Y,
  seed,
  metrics,
}: {
  prepared: Partial<Record<DesignId, PreparedDesign>>;
  ids: DesignId[];
  Y: number;
  seed: number;
  metrics: Partial<Record<DesignId, Metrics>>;
}) {
  const available = ids.filter((id) => prepared[id]?.valid);
  const [design, setDesign] = useState<DesignId>(available.includes('razon') ? 'razon' : (available[0] ?? 'mas'));
  const id = available.includes(design) ? design : available[0];
  const d = id ? prepared[id] : undefined;
  const [round, setRound] = useState(0);
  const [order, setOrder] = useState<'extraccion' | 'estimacion'>('extraccion');
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const draws = useMemo(() => {
    if (!d) return [];
    const rng = mulberry32(deriveSeed(seed + round * 7919, 'ic-' + d.id));
    const out: { est: number; lo: number; hi: number; covers: boolean; k: number }[] = [];
    let guard = 0;
    while (out.length < K && guard++ < K * 20) {
      const s = d.draw(rng);
      if (s.vhat == null) continue;
      const h = 1.96 * Math.sqrt(Math.max(0, s.vhat));
      out.push({ est: s.est, lo: s.est - h, hi: s.est + h, covers: Math.abs(s.est - Y) <= h, k: out.length + 1 });
    }
    return out;
  }, [d, seed, round, Y]);

  if (!d || !id) return <p className="text-sm text-muted">No hay diseños válidos con V̂ para esta n.</p>;
  const shown = order === 'estimacion' ? [...draws].sort((a, b) => a.est - b.est) : draws;
  const misses = draws.filter((r) => !r.covers).length;
  const rowH = width < 520 ? 4.2 : 5;
  const mg = { top: 22, right: 6, bottom: 44, left: 6 };
  const height = mg.top + mg.bottom + K * rowH;
  const lo = Math.min(Y, ...draws.map((r) => r.lo));
  const hi = Math.max(Y, ...draws.map((r) => r.hi));
  const pad = (hi - lo) * 0.03 || 1;
  const x = scaleLinear().domain([lo - pad, hi + pad]).range([mg.left, width - mg.right]);
  const cov = metrics[id]?.coverage;
  const animKey = `${id}-${round}-${seed}-${order}`;

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-center justify-between gap-x-10 gap-y-6">
        <div role="radiogroup" aria-label="Diseño" className="flex flex-wrap gap-x-6 gap-y-2">
          {available.map((k) => (
            <DesignChip key={k} role="radio" color={DESIGNS[k].color} label={DESIGNS[k].corto} on={k === id} onClick={() => setDesign(k)} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <Segmented
            label="Orden de los intervalos"
            value={order}
            onChange={setOrder}
            options={[
              { value: 'extraccion', label: 'En orden de extracción' },
              { value: 'estimacion', label: 'Ordenados por Ŷ' },
            ]}
          />
          <IconButton label="Extraer 100 muestras nuevas" onClick={() => setRound((r) => r + 1)}>
            <Icon name="dice" />
            Otras 100
          </IconButton>
        </div>
      </div>

      <dl className="mb-10 grid grid-cols-3 gap-6 sm:max-w-2xl">
        <div>
          <dt className="label">Cubren a Y</dt>
          <dd className="tabular mt-1 font-serif text-[40px] leading-none text-ink">
            {draws.length - misses}
            <span className="text-[18px] text-muted"> / {draws.length}</span>
          </dd>
        </div>
        <div>
          <dt className="label">No cubren</dt>
          <dd className="tabular mt-1 font-serif text-[40px] leading-none text-critical">{misses}</dd>
        </div>
        <div>
          <dt className="label">Cobertura exacta</dt>
          <dd className="tabular mt-1 font-serif text-[40px] leading-none text-ink">{cov != null ? fmtPct(cov, 0) : '—'}</dd>
        </div>
      </dl>

      <div ref={ref} className="relative w-full">
        <svg width={width} height={height} role="img" aria-label={`${K} intervalos de confianza al 95 % para ${DESIGNS[id].nombre}`} className="overflow-visible">
          {shown.map((r, row) => {
            const yy = mg.top + row * rowH + rowH / 2;
            const c = r.covers ? 'var(--axis)' : 'var(--critical)';
            const dim = hover != null && hover !== row;
            return (
              <g
                key={animKey + r.k}
                onPointerEnter={() => setHover(row)}
                onPointerLeave={() => setHover(null)}
                opacity={dim ? 0.35 : 1}
                style={{ transition: 'opacity 200ms ease', color: c }}
                className={r.covers ? '' : 'glow'}
              >
                <rect x={mg.left} width={Math.max(0, width - mg.left - mg.right)} y={yy - rowH / 2} height={rowH} fill="transparent" />
                <line
                  x1={x(r.lo)}
                  x2={x(r.hi)}
                  y1={yy}
                  y2={yy}
                  stroke={c}
                  strokeWidth={r.covers ? 1.25 : 2}
                  strokeLinecap="round"
                  pathLength={1}
                  className="draw-in"
                  style={{ animationDelay: `${row * 9}ms`, animationDuration: '700ms' }}
                />
                <circle cx={x(r.est)} cy={yy} r={1.5} fill={c} className="fade-in" style={{ animationDelay: `${row * 9 + 300}ms` }} />
              </g>
            );
          })}
          <TruthLine x={x(Y)} top={mg.top - 16} bottom={height - mg.bottom} Y={Y} />
          <XAxis scale={x} y={height - mg.bottom} ticks={width < 520 ? 3 : 7} label="Ŷ ± 1.96·√V̂" serif={false} />
        </svg>
        {hover != null && shown[hover] && (
          <ChartTooltip x={x(shown[hover].est)} y={mg.top + hover * rowH} width={width}>
            <div className="font-serif text-[14px] italic text-ink">Muestra {shown[hover].k}</div>
            <div className="tabular mt-1 text-ink-2">Ŷ = {fmtInt(shown[hover].est)}</div>
            <div className="tabular text-ink-2">
              IC: {fmtInt(shown[hover].lo)} a {fmtInt(shown[hover].hi)}
            </div>
            <div className={`mt-1 ${shown[hover].covers ? 'text-muted' : 'text-critical'}`}>{shown[hover].covers ? 'Cubre a Y' : 'No cubre a Y'}</div>
          </ChartTooltip>
        )}
      </div>
      <p className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-px w-6" style={{ background: 'var(--axis)' }} /> cubre a Y
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-6 bg-critical" /> no cubre a Y
        </span>
        <span>Las muestras sin V̂ (por ejemplo, con n_h = 1 en algún estrato) no producen intervalo.</span>
      </p>
    </div>
  );
}
