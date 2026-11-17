import { scaleLinear } from 'd3';
import { useMemo, useState } from 'react';
import { fmt3, fmtAxis, fmtInt, fmtPct } from '../lib/format';
import { useWidth } from '../lib/hooks';
import type { Stratum } from '../stats/designs/estratificado';
import { pptProbabilities } from '../stats/designs/pptcr';
import { inclusionProbabilities } from '../stats/designs/pptsr';
import { pick, variance, type Population } from '../stats/population';
import { NayaritMap } from './NayaritMap';
import { ChartTooltip, Icon, Segmented, Swatch } from './ui';

/** Tonos ordinales (rampa azul) para los estratos de tamaño; Tepic en tinta. */
const STRATUM_COLORS = ['var(--ink)', '#86b6ef', '#3987e5', '#1c5cab'];
const STRATUM_COLORS_2 = ['var(--ink)', '#86b6ef', '#1c5cab'];
export const stratumColor = (h: number, L: number) => (L === 2 ? STRATUM_COLORS_2 : STRATUM_COLORS)[h] ?? 'var(--muted)';

function Scatter({ pop }: { pop: Population }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const h = 320;
  const mg = { top: 14, right: 18, bottom: 42, left: 58 };
  const R = pop.Y / pop.X;
  const xmax = Math.max(...pop.x) * 1.06;
  const ymax = Math.max(...pop.y) * 1.06;
  const x = scaleLinear().domain([0, xmax]).range([mg.left, width - mg.right]).nice();
  const y = scaleLinear().domain([0, ymax]).range([h - mg.bottom, mg.top]).nice();
  return (
    <div ref={ref} className="relative">
      <svg width={width} height={h} role="img" aria-label="Diagrama de dispersión de población 1970 contra 1980">
        {y.ticks(5).map((t) => (
          <g key={t} className="axis">
            <line className="gridline" x1={mg.left} x2={width - mg.right} y1={y(t)} y2={y(t)} />
            <text x={mg.left - 6} y={y(t)} dy="0.32em" textAnchor="end">
              {fmtAxis(t)}
            </text>
          </g>
        ))}
        <g className="axis" transform={`translate(0,${h - mg.bottom})`}>
          <line x1={mg.left} x2={width - mg.right} />
          {x.ticks(5).map((t) => (
            <text key={t} x={x(t)} y={16} textAnchor="middle">
              {fmtAxis(t)}
            </text>
          ))}
          <text x={width - mg.right} y={34} textAnchor="end">
            x = población 1970
          </text>
        </g>
        <text x={mg.left} y={mg.top - 2} className="axis" style={{ fill: 'var(--muted)', fontSize: 11 }}>
          y = población 1980
        </text>
        <line
          x1={x(0)}
          y1={y(0)}
          x2={x(xmax)}
          y2={y(R * xmax)}
          stroke="var(--d-razon)"
          strokeWidth={2}
          strokeDasharray="6 4"
        />
        <text x={x(xmax) - 4} y={y(R * xmax) + 16} textAnchor="end" fontSize={11} fontWeight={600} style={{ fill: 'var(--ink-2)' }}>
          y = R·x, R = {fmt3(R)}
        </text>
        {pop.units.map((u, i) => (
          <circle
            key={u.clave}
            cx={x(u.x)}
            cy={y(u.y)}
            r={hover === i ? 7 : 5}
            fill="var(--d-mas)"
            stroke="var(--surface)"
            strokeWidth={2}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          />
        ))}
        <text x={x(pop.x[pop.tepic]) - 9} y={y(pop.y[pop.tepic])} dy="0.32em" textAnchor="end" fontSize={11.5} fontWeight={600} style={{ fill: 'var(--ink)' }}>
          Tepic
        </text>
      </svg>
      {hover != null && (
        <ChartTooltip x={x(pop.x[hover])} y={y(pop.y[hover])} width={width}>
          <div className="font-semibold text-ink">{pop.units[hover].nombre}</div>
          <div className="tabular text-ink-2">x = {fmtInt(pop.x[hover])}</div>
          <div className="tabular text-ink-2">y = {fmtInt(pop.y[hover])}</div>
          <div className="tabular text-ink-2">y/x = {fmt3(pop.y[hover] / pop.x[hover])}</div>
        </ChartTooltip>
      )}
    </div>
  );
}

type SortKey = 'clave' | 'nombre' | 'x' | 'y' | 'ratio' | 'p' | 'pi' | 'estrato';

export function DataPanel({ pop, n, strata, nh }: { pop: Population; n: number; strata: Stratum[]; nh: number[] | null }) {
  const p = useMemo(() => pptProbabilities(pop.x), [pop]);
  const pi = useMemo(() => inclusionProbabilities(pop.x, n), [pop, n]);
  const stratumOf = useMemo(() => {
    const a = new Array<number>(pop.N).fill(-1);
    strata.forEach((s, h) => s.units.forEach((i) => (a[i] = h)));
    return a;
  }, [strata, pop.N]);
  const L = strata.length - 1;
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'x', dir: -1 });
  const [mapMode, setMapMode] = useState<'estratos' | 'p'>('estratos');

  const rows = pop.units.map((u, i) => ({
    i,
    clave: u.clave,
    nombre: u.nombre,
    x: u.x,
    y: u.y,
    ratio: u.y / u.x,
    p: p[i],
    pi: pi[i],
    estrato: stratumOf[i],
  }));
  rows.sort((a, b) => {
    const va = a[sort.key];
    const vb = b[sort.key];
    return sort.dir * (typeof va === 'string' ? va.localeCompare(vb as string, 'es') : (va as number) - (vb as number));
  });
  const maxP = Math.max(...p);

  const cols: { key: SortKey; label: string; right?: boolean }[] = [
    { key: 'clave', label: 'Clave' },
    { key: 'nombre', label: 'Municipio' },
    { key: 'x', label: 'x₁₉₇₀', right: true },
    { key: 'y', label: 'y₁₉₈₀', right: true },
    { key: 'ratio', label: 'y/x', right: true },
    { key: 'p', label: 'p_i (PPT CR)', right: true },
    { key: 'pi', label: `π_i (HT, n=${n})`, right: true },
    { key: 'estrato', label: 'Estrato' },
  ];

  const pColor = (v: number) => `color-mix(in oklab, var(--d-pptcr) ${Math.round(15 + (85 * v) / maxP)}%, var(--surface-2))`;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-3">
          <h3 className="text-sm font-semibold text-ink">Población 1970 contra 1980</h3>
          <p className="mb-2 text-xs text-muted">
            Los puntos casi caen sobre la recta y = R·x (ρ = {fmt3(corr(pop))}). Por eso la razón y PPT funcionan tan bien: el
            cociente y/x casi no varía de un municipio a otro.
          </p>
          <Scatter pop={pop} />
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">Mapa de Nayarit (municipios de 1980)</h3>
              <p className="text-xs text-muted">
                {mapMode === 'estratos' ? 'Estratos por tamaño de x₁₉₇₀.' : 'Probabilidad de selección por extracción en PPT, p_i = x_i/X.'}
              </p>
            </div>
            <div className="w-56">
              <Segmented
                label="Variable del mapa"
                size="sm"
                value={mapMode}
                onChange={setMapMode}
                options={[
                  { value: 'estratos', label: 'Estratos' },
                  { value: 'p', label: 'p_i de PPT' },
                ]}
              />
            </div>
          </div>
          <NayaritMap
            units={pop.units}
            height={300}
            ariaLabel={mapMode === 'estratos' ? 'Mapa de estratos' : 'Mapa de probabilidades de PPT'}
            fills={(_, i) => (i < 0 ? 'var(--surface-2)' : mapMode === 'estratos' ? stratumColor(stratumOf[i], L) : pColor(p[i]))}
          />
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
            {mapMode === 'estratos' ? (
              strata.map((s, h) => (
                <span key={s.nombre} className="inline-flex items-center gap-1.5">
                  <Swatch color={stratumColor(h, L)} />
                  {s.nombre} ({s.units.length})
                </span>
              ))
            ) : (
              <span className="inline-flex items-center gap-2">
                {fmtPct(Math.min(...p))}
                <span className="h-2 w-28 rounded" style={{ background: `linear-gradient(90deg, ${pColor(0)}, ${pColor(maxP)})` }} />
                {fmtPct(maxP)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-3">
        <h3 className="text-sm font-semibold text-ink">Estratos y afijación (n = {n})</h3>
        <p className="mb-3 text-xs text-muted">
          Tepic forma un estrato de certeza. Los demás estratos se cortan según x₁₉₇₀ y la afijación reparte las n − 1 unidades
          restantes.
        </p>
        <div className="overflow-x-auto">
          <table className="tabular w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-1.5 text-left font-semibold">Estrato</th>
                <th className="py-1.5 text-right font-semibold">N_h</th>
                <th className="py-1.5 text-right font-semibold">Rango de x₁₉₇₀</th>
                <th className="py-1.5 text-right font-semibold">S_h(x)</th>
                <th className="py-1.5 text-right font-semibold">S_h(y)</th>
                <th className="py-1.5 text-right font-semibold">n_h</th>
              </tr>
            </thead>
            <tbody>
              {strata.map((s, h) => {
                const xs = pick(pop.x, s.units);
                const ys = pick(pop.y, s.units);
                return (
                  <tr key={s.nombre} className="border-t border-line">
                    <td className="py-2">
                      <span className="inline-flex items-center gap-2 font-medium text-ink">
                        <Swatch color={stratumColor(h, L)} />
                        {s.nombre}
                        {s.certeza && <span className="text-xs font-normal text-muted">(certeza)</span>}
                      </span>
                      <div className="mt-0.5 text-[11px] text-muted">{s.units.map((i) => pop.units[i].nombre).join(', ')}</div>
                    </td>
                    <td className="py-2 text-right text-ink-2">{s.units.length}</td>
                    <td className="py-2 text-right text-ink-2">
                      {fmtInt(Math.min(...xs))}
                      {s.units.length > 1 && ` – ${fmtInt(Math.max(...xs))}`}
                    </td>
                    <td className="py-2 text-right text-ink-2">{s.units.length > 1 ? fmtInt(Math.sqrt(variance(xs))) : '—'}</td>
                    <td className="py-2 text-right text-ink-2">{s.units.length > 1 ? fmtInt(Math.sqrt(variance(ys))) : '—'}</td>
                    <td className="py-2 text-right font-semibold text-ink">{nh ? nh[h] : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {nh == null && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-2">
            <Icon name="warn" size={14} className="text-critical" /> Con n = {n} no alcanza para un municipio por estrato.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-line bg-surface p-3">
        <h3 className="mb-2 text-sm font-semibold text-ink">Municipios</h3>
        <div className="-mx-3 overflow-x-auto px-3">
          <table className="tabular w-full min-w-[760px] text-[13px]">
            <caption className="sr-only">Tabla de municipios de Nayarit con población 1970 y 1980 y probabilidades de selección</caption>
            <thead>
              <tr>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                    className={`border-b border-line py-2 text-xs font-semibold text-muted ${c.right ? 'pr-4 text-right' : 'text-left'}`}
                  >
                    <button
                      type="button"
                      onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? ((-s.dir) as 1 | -1) : c.right ? -1 : 1 }))}
                      className={`inline-flex items-center gap-1 hover:text-ink ${sort.key === c.key ? 'text-ink' : ''}`}
                    >
                      {c.label}
                      <Icon name="sort" size={12} className={sort.key === c.key ? '' : 'opacity-30'} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.clave} className={`border-b border-line hover:bg-surface-2 ${r.i === pop.tepic ? 'font-semibold' : ''}`}>
                  <td className="py-1.5 text-muted">{r.clave}</td>
                  <td className="py-1.5 text-ink">{r.nombre}</td>
                  <td className="py-1.5 pr-4 text-right text-ink-2">{fmtInt(r.x)}</td>
                  <td className="py-1.5 pr-4 text-right text-ink-2">{fmtInt(r.y)}</td>
                  <td className="py-1.5 pr-4 text-right text-ink-2">{fmt3(r.ratio)}</td>
                  <td className="py-1.5 pr-4 text-right text-ink-2">
                    <div className="flex items-center justify-end gap-2">
                      <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-2 sm:block" aria-hidden>
                        <span className="block h-full rounded-full" style={{ width: `${(r.p / maxP) * 100}%`, background: 'var(--d-pptcr)' }} />
                      </span>
                      {fmtPct(r.p, 2)}
                    </div>
                  </td>
                  <td className="py-1.5 pr-4 text-right text-ink-2">{fmt3(r.pi)}</td>
                  <td className="py-1.5 text-ink-2">
                    <span className="inline-flex items-center gap-1.5">
                      <Swatch color={stratumColor(r.estrato, L)} />
                      {strata[r.estrato]?.nombre}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-ink">
                <td className="pt-2" />
                <td className="pt-2">Total (N = {pop.N})</td>
                <td className="pt-2 text-right">{fmtInt(pop.X)}</td>
                <td className="pt-2 text-right">{fmtInt(pop.Y)}</td>
                <td className="pt-2 text-right">{fmt3(pop.Y / pop.X)}</td>
                <td className="pt-2 text-right">{fmtPct(1, 0)}</td>
                <td className="pt-2 text-right">{fmt3(pi.reduce((a, b) => a + b, 0))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          p_i es la probabilidad de elegir al municipio en cada extracción de PPT con reemplazo (suma 1). π_i es la probabilidad de
          inclusión de PPT sin reemplazo (suma n). Si π_i = 1, el municipio entra con certeza.
        </p>
      </div>
    </div>
  );
}

function corr(pop: Population) {
  const mx = pop.X / pop.N;
  const my = pop.Y / pop.N;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < pop.N; i++) {
    sxy += (pop.x[i] - mx) * (pop.y[i] - my);
    sxx += (pop.x[i] - mx) ** 2;
    syy += (pop.y[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}
