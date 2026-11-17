import { scaleLinear } from 'd3';
import { useMemo, useState } from 'react';
import { DESIGNS } from '../lib/designs';
import { fmtInt, fmtPct } from '../lib/format';
import { useWidth } from '../lib/hooks';
import type { DesignId, PreparedDesign } from '../stats/designs/types';
import { deriveSeed, mulberry32 } from '../stats/rng';
import type { Metrics } from '../stats/summarize';
import { TruthLine, XAxis } from './chartParts';
import { Button, ChartTooltip, Icon, Segmented, Swatch } from './ui';

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
  const [design, setDesign] = useState<DesignId>(available.includes('razon') ? 'razon' : available[0] ?? 'mas');
  const id = available.includes(design) ? design : available[0];
  const d = id ? prepared[id] : undefined;
  const [round, setRound] = useState(0);
  const [order, setOrder] = useState<'extraccion' | 'estimacion'>('extraccion');
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const draws = useMemo(() => {
    if (!d) return [];
    const rng = mulberry32(deriveSeed(seed + round * 7919, 'ic-' + d.id));
    const out: { est: number; lo: number; hi: number; covers: boolean; k: number; ok: boolean }[] = [];
    let guard = 0;
    while (out.length < K && guard++ < K * 20) {
      const s = d.draw(rng);
      if (s.vhat == null) continue; // sin V̂ no hay intervalo
      const h = 1.96 * Math.sqrt(Math.max(0, s.vhat));
      out.push({ est: s.est, lo: s.est - h, hi: s.est + h, covers: Math.abs(s.est - Y) <= h, k: out.length + 1, ok: true });
    }
    return out;
  }, [d, seed, round, Y]);

  const shown = order === 'estimacion' ? [...draws].sort((a, b) => a.est - b.est) : draws;
  const misses = draws.filter((r) => !r.covers).length;
  const rowH = width < 500 ? 4 : 4.6;
  const mg = { top: 10, right: 14, bottom: 38, left: 14 };
  const height = mg.top + mg.bottom + K * rowH;
  const lo = Math.min(Y, ...draws.map((r) => r.lo));
  const hi = Math.max(Y, ...draws.map((r) => r.hi));
  const pad = (hi - lo) * 0.04 || 1;
  const x = scaleLinear().domain([lo - pad, hi + pad]).range([mg.left, width - mg.right]).nice();
  if (!d || !id) return <p className="text-sm text-muted">No hay diseños válidos con V̂ para esta n.</p>;
  const meta = DESIGNS[id];
  const cov = metrics[id]?.coverage;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div role="radiogroup" aria-label="Diseño" className="flex flex-wrap gap-1.5">
          {available.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={k === id}
              onClick={() => setDesign(k)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                k === id ? 'border-transparent bg-ink text-surface' : 'border-line text-ink-2 hover:text-ink'
              }`}
            >
              <Swatch color={DESIGNS[k].color} />
              {DESIGNS[k].corto}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-60">
            <Segmented
              label="Orden de los intervalos"
              size="sm"
              value={order}
              onChange={setOrder}
              options={[
                { value: 'extraccion', label: 'Orden de extracción' },
                { value: 'estimacion', label: 'Ordenar por Ŷ' },
              ]}
            />
          </div>
          <Button label="Extraer 100 muestras nuevas" onClick={() => setRound((r) => r + 1)}>
            <Icon name="dice" />
            Nuevas 100
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <p className="text-[11px] text-muted">Cubren a Y en estas {draws.length}</p>
          <p className="tabular text-lg font-semibold text-ink">
            {draws.length - misses} <span className="text-sm font-normal text-muted">de {draws.length}</span>
          </p>
        </div>
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <p className="text-[11px] text-muted">No cubren</p>
          <p className="tabular flex items-center gap-1.5 text-lg font-semibold text-ink">
            <Icon name="x" size={16} className="text-critical" />
            {misses}
          </p>
        </div>
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <p className="text-[11px] text-muted">Cobertura en toda la distribución</p>
          <p className="tabular text-lg font-semibold text-ink">{cov != null ? fmtPct(cov) : '—'}</p>
        </div>
      </div>

      <div ref={ref} className="relative w-full">
        <svg width={width} height={height} role="img" aria-label={`${K} intervalos de confianza al 95 % para ${meta.nombre}`}>
          {shown.map((r, row) => {
            const yy = mg.top + row * rowH + rowH / 2;
            const c = r.covers ? 'var(--axis)' : 'var(--critical)';
            return (
              <g
                key={r.k}
                onPointerEnter={() => setHover(row)}
                onPointerLeave={() => setHover(null)}
                opacity={hover == null || hover === row ? 1 : 0.55}
              >
                <rect x={mg.left} width={Math.max(0, width - mg.left - mg.right)} y={yy - rowH / 2} height={rowH} fill="transparent" />
                <line x1={x(r.lo)} x2={x(r.hi)} y1={yy} y2={yy} stroke={c} strokeWidth={r.covers ? 1.6 : 2.2} strokeLinecap="round" />
                <circle cx={x(r.est)} cy={yy} r={1.6} fill={c} />
              </g>
            );
          })}
          <TruthLine x={x(Y)} top={mg.top} bottom={height - mg.bottom} Y={Y} label={false} />
          <XAxis scale={x} y={height - mg.bottom} ticks={width < 500 ? 3 : 7} label="Ŷ ± 1.96·√V̂" />
        </svg>
        {hover != null && shown[hover] && (
          <ChartTooltip x={x(shown[hover].est)} y={mg.top + hover * rowH} width={width}>
            <div className="font-semibold text-ink">Muestra {shown[hover].k}</div>
            <div className="tabular text-ink-2">Ŷ = {fmtInt(shown[hover].est)}</div>
            <div className="tabular text-ink-2">
              IC: {fmtInt(shown[hover].lo)} a {fmtInt(shown[hover].hi)}
            </div>
            <div className={shown[hover].covers ? 'text-ink-2' : 'font-semibold text-critical'}>
              {shown[hover].covers ? 'Cubre a Y' : 'No cubre a Y'}
            </div>
          </ChartTooltip>
        )}
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded" style={{ background: 'var(--axis)' }} /> Cubre a Y
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-5 rounded bg-critical" /> No cubre a Y
        </span>
        <span>Las muestras sin V̂ (por ejemplo, n_h = 1 en algún estrato) no generan intervalo.</span>
      </p>
    </div>
  );
}
