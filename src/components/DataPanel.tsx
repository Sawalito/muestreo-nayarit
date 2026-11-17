import { scaleLinear } from 'd3';
import { useMemo, useState } from 'react';
import { fmt3, fmtAxis, fmtInt, fmtPct } from '../lib/format';
import { useWidth } from '../lib/hooks';
import type { Stratum } from '../stats/designs/estratificado';
import { pptProbabilities } from '../stats/designs/pptcr';
import { inclusionProbabilities } from '../stats/designs/pptsr';
import { pick, variance, type Population } from '../stats/population';
import { NayaritMap } from './NayaritMap';
import { ChartTooltip, Icon, Segmented } from './ui';

/** Tonos ordinales (rampa azul) para los estratos de tamaño; Tepic en tinta. */
const STRATUM_COLORS = ['var(--ink)', '#86b6ef', '#3987e5', '#1c5cab'];
const STRATUM_COLORS_2 = ['var(--ink)', '#86b6ef', '#1c5cab'];
export const stratumColor = (h: number, L: number) => (L === 2 ? STRATUM_COLORS_2 : STRATUM_COLORS)[h] ?? 'var(--muted)';

function Scatter({ pop }: { pop: Population }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const h = width < 520 ? 320 : 400;
  const mg = { top: 40, right: 12, bottom: 46, left: 52 };
  const R = pop.Y / pop.X;
  const xmax = Math.max(...pop.x) * 1.08;
  const ymax = Math.max(...pop.y) * 1.08;
  const x = scaleLinear().domain([0, xmax]).range([mg.left, width - mg.right]).nice();
  const y = scaleLinear().domain([0, ymax]).range([h - mg.bottom, mg.top]).nice();
  const [, x1] = x.domain();
  return (
    <div ref={ref} className="relative">
      <svg width={width} height={h} role="img" aria-label="Diagrama de dispersión de población 1970 contra 1980" className="overflow-visible">
        {y.ticks(4).map((t) => (
          <g key={t} className="axis">
            <line className="gridline" x1={mg.left} x2={width - mg.right} y1={y(t)} y2={y(t)} />
            <text x={mg.left - 10} y={y(t)} dy="0.32em" textAnchor="end">
              {fmtAxis(t)}
            </text>
          </g>
        ))}
        <g className="axis" transform={`translate(0,${h - mg.bottom})`}>
          {x.ticks(5).map((t) => (
            <text key={t} x={x(t)} y={18} textAnchor="middle">
              {fmtAxis(t)}
            </text>
          ))}
          <text x={width - mg.right} y={38} textAnchor="end" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 14 }}>
            x  población 1970
          </text>
        </g>
        <text x={mg.left - 44} y={mg.top - 24} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 14 }}>
          y  población 1980
        </text>
        <g style={{ color: 'var(--d-razon)' }} className="glow">
          <line
            x1={x(0)}
            y1={y(0)}
            x2={x(x1)}
            y2={y(R * x1)}
            stroke="var(--d-razon)"
            strokeWidth={1.5}
            pathLength={1}
            className="draw-in"
          />
        </g>
        <text x={x(x1 * 0.62) - 8} y={y(R * x1 * 0.62) - 12} textAnchor="end" style={{ fill: 'var(--ink-2)', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 15 }}>
          y = R x,  R = {fmt3(R)}
        </text>
        {pop.units.map((u, i) => (
          <g key={u.clave} style={{ color: 'var(--d-mas)' }} className="glow">
            <circle
              cx={x(u.x)}
              cy={y(u.y)}
              r={hover === i ? 7 : 4.5}
              fill="var(--d-mas)"
              className="fade-in"
              style={{ animationDelay: `${300 + i * 40}ms`, transition: 'r 200ms ease' }}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            />
          </g>
        ))}
        <text x={x(pop.x[pop.tepic]) - 12} y={y(pop.y[pop.tepic])} dy="0.32em" textAnchor="end" style={{ fill: 'var(--ink)', fontFamily: 'var(--font-serif)', fontSize: 15 }}>
          Tepic
        </text>
      </svg>
      {hover != null && (
        <ChartTooltip x={x(pop.x[hover])} y={y(pop.y[hover])} width={width}>
          <div className="font-serif text-[15px] text-ink">{pop.units[hover].nombre}</div>
          <div className="tabular mt-1 text-ink-2">x = {fmtInt(pop.x[hover])}</div>
          <div className="tabular text-ink-2">y = {fmtInt(pop.y[hover])}</div>
          <div className="tabular text-muted">y/x = {fmt3(pop.y[hover] / pop.x[hover])}</div>
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

  const rows = pop.units.map((u, i) => ({ i, clave: u.clave, nombre: u.nombre, x: u.x, y: u.y, ratio: u.y / u.x, p: p[i], pi: pi[i], estrato: stratumOf[i] }));
  rows.sort((a, b) => {
    const va = a[sort.key];
    const vb = b[sort.key];
    return sort.dir * (typeof va === 'string' ? va.localeCompare(vb as string, 'es') : (va as number) - (vb as number));
  });
  const maxP = Math.max(...p);
  const pColor = (v: number) => `color-mix(in oklab, var(--d-pptcr) ${Math.round(12 + (88 * v) / maxP)}%, var(--raise))`;

  const cols: { key: SortKey; label: string; right?: boolean }[] = [
    { key: 'clave', label: 'Clave' },
    { key: 'nombre', label: 'Municipio' },
    { key: 'x', label: 'x₁₉₇₀', right: true },
    { key: 'y', label: 'y₁₉₈₀', right: true },
    { key: 'ratio', label: 'y / x', right: true },
    { key: 'p', label: 'pᵢ  PPT CR', right: true },
    { key: 'pi', label: `πᵢ  HT, n=${n}`, right: true },
    { key: 'estrato', label: 'Estrato' },
  ];

  return (
    <div className="space-y-24">
      <div className="grid gap-16 xl:grid-cols-2">
        <figure>
          <figcaption className="mb-6">
            <h3 className="font-serif text-[22px] text-ink">x contra y</h3>
            <p className="mt-2 max-w-[56ch] text-[14px] leading-relaxed text-muted">
              Los 19 municipios casi caen sobre la recta que pasa por el origen. Por eso funcionan tan bien la razón y PPT: el cociente
              y/x apenas cambia de un municipio a otro.
            </p>
          </figcaption>
          <Scatter pop={pop} />
        </figure>
        <figure>
          <figcaption className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3 className="font-serif text-[22px] text-ink">Nayarit, 1980</h3>
              <p className="mt-2 max-w-[48ch] text-[14px] leading-relaxed text-muted">
                {mapMode === 'estratos'
                  ? 'Estratos formados según el tamaño en 1970.'
                  : 'Probabilidad de que cada municipio salga en una extracción de PPT, pᵢ = xᵢ/X.'}
              </p>
            </div>
            <Segmented
              label="Variable del mapa"
              value={mapMode}
              onChange={setMapMode}
              options={[
                { value: 'estratos', label: 'Estratos' },
                { value: 'p', label: 'pᵢ de PPT' },
              ]}
            />
          </figcaption>
          <NayaritMap
            units={pop.units}
            height={380}
            ariaLabel={mapMode === 'estratos' ? 'Mapa de estratos' : 'Mapa de probabilidades de PPT'}
            fills={(_, i) => (i < 0 ? 'var(--raise)' : mapMode === 'estratos' ? stratumColor(stratumOf[i], L) : pColor(p[i]))}
          />
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
            {mapMode === 'estratos' ? (
              strata.map((s, h) => (
                <span key={s.nombre} className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: stratumColor(h, L) }} />
                  {s.nombre} <span className="text-muted">{s.units.length}</span>
                </span>
              ))
            ) : (
              <span className="inline-flex items-center gap-3 tabular">
                {fmtPct(Math.min(...p))}
                <span className="h-1.5 w-32 rounded-full" style={{ background: `linear-gradient(90deg, ${pColor(0)}, ${pColor(maxP)})` }} />
                {fmtPct(maxP)}
              </span>
            )}
          </div>
        </figure>
      </div>

      <div>
        <h3 className="font-serif text-[22px] text-ink">Estratos y afijación con n = {n}</h3>
        <p className="mt-2 max-w-[64ch] text-[14px] leading-relaxed text-muted">
          Tepic forma un estrato de certeza. Los demás estratos se cortan según x₁₉₇₀ y la afijación reparte las n − 1 unidades
          restantes.
        </p>
        <div className="scroll-thin mt-8 overflow-x-auto">
          <table className="tabular w-full min-w-[640px] text-[14px]">
            <thead>
              <tr>
                {['Estrato', 'Nₕ', 'Rango de x₁₉₇₀', 'Sₕ(x)', 'Sₕ(y)', 'nₕ'].map((hd, k) => (
                  <th key={hd} className={`label border-b border-line pb-3 font-normal normal-case ${k === 0 ? 'text-left' : 'text-right'}`}>
                    {hd}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {strata.map((s, h) => {
                const xs = pick(pop.x, s.units);
                const ys = pick(pop.y, s.units);
                return (
                  <tr key={s.nombre}>
                    <td className="border-b border-line py-4 pr-6">
                      <span className="inline-flex items-center gap-2.5 text-ink">
                        <span className="h-2 w-2 rounded-full" style={{ background: stratumColor(h, L) }} />
                        <span className="font-serif text-[16px]">{s.nombre}</span>
                        {s.certeza && <span className="text-[12px] italic text-muted">certeza</span>}
                      </span>
                      <div className="mt-1 max-w-[60ch] pl-[18px] text-[12px] leading-relaxed text-muted">
                        {s.units.map((i) => pop.units[i].nombre).join(', ')}
                      </div>
                    </td>
                    <td className="border-b border-line py-4 text-right text-ink-2">{s.units.length}</td>
                    <td className="whitespace-nowrap border-b border-line py-4 text-right text-ink-2">
                      {fmtInt(Math.min(...xs))}
                      {s.units.length > 1 && ` – ${fmtInt(Math.max(...xs))}`}
                    </td>
                    <td className="border-b border-line py-4 text-right text-ink-2">{s.units.length > 1 ? fmtInt(Math.sqrt(variance(xs))) : '—'}</td>
                    <td className="border-b border-line py-4 text-right text-ink-2">{s.units.length > 1 ? fmtInt(Math.sqrt(variance(ys))) : '—'}</td>
                    <td className="border-b border-line py-4 text-right font-serif text-[20px] text-ink">{nh ? nh[h] : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {nh == null && <p className="mt-3 text-[13px] text-ink-2">Con n = {n} no alcanza para tomar un municipio de cada estrato.</p>}
      </div>

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 text-ink [&::-webkit-details-marker]:hidden">
          <Icon name="chevron" size={18} className="text-muted transition-transform duration-300 group-open:rotate-90" />
          <span className="font-serif text-[22px]">Los 19 municipios</span>
          <span className="text-[13px] text-muted">valores, probabilidades y estrato de cada uno</span>
        </summary>
        <div className="scroll-thin mt-8 overflow-x-auto">
          <table className="tabular w-full min-w-[820px] text-[14px]">
            <caption className="sr-only">Municipios de Nayarit con población 1970 y 1980 y probabilidades de selección</caption>
            <thead>
              <tr>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                    className={`border-b border-line pb-3 font-normal ${c.right ? 'pr-6 text-right' : 'pr-4 text-left'}`}
                  >
                    <button
                      type="button"
                      onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? ((-s.dir) as 1 | -1) : c.right ? -1 : 1 }))}
                      className={`label inline-flex items-center gap-1 hover:text-ink ${sort.key === c.key ? '!text-ink' : ''}`}
                    >
                      {c.label}
                      <Icon name="sort" size={11} className={sort.key === c.key ? '' : 'opacity-0'} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.clave} className="transition-colors hover:bg-raise">
                  <td className="border-b border-line py-2.5 pr-4 font-mono text-[12px] text-muted">{r.clave}</td>
                  <td className={`border-b border-line py-2.5 pr-4 ${r.i === pop.tepic ? 'font-serif text-[16px] text-ink' : 'text-ink'}`}>{r.nombre}</td>
                  <td className="border-b border-line py-2.5 pr-6 text-right text-ink-2">{fmtInt(r.x)}</td>
                  <td className="border-b border-line py-2.5 pr-6 text-right text-ink-2">{fmtInt(r.y)}</td>
                  <td className="border-b border-line py-2.5 pr-6 text-right text-ink-2">{fmt3(r.ratio)}</td>
                  <td className="border-b border-line py-2.5 pr-6 text-right text-ink-2">
                    <div className="flex items-center justify-end gap-3">
                      <span className="relative hidden h-px w-16 bg-line sm:block" aria-hidden>
                        <span className="absolute inset-y-[-0.5px] left-0 rounded-full" style={{ width: `${(r.p / maxP) * 100}%`, background: 'var(--d-pptcr)' }} />
                      </span>
                      {fmtPct(r.p, 2)}
                    </div>
                  </td>
                  <td className="border-b border-line py-2.5 pr-6 text-right text-ink-2">{fmt3(r.pi)}</td>
                  <td className="border-b border-line py-2.5 text-ink-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: stratumColor(r.estrato, L) }} />
                      {strata[r.estrato]?.nombre}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="text-ink">
                <td className="pt-4" />
                <td className="pt-4 font-serif text-[16px]">Total</td>
                <td className="pt-4 pr-6 text-right">{fmtInt(pop.X)}</td>
                <td className="pt-4 pr-6 text-right">{fmtInt(pop.Y)}</td>
                <td className="pt-4 pr-6 text-right">{fmt3(pop.Y / pop.X)}</td>
                <td className="pt-4 pr-6 text-right">{fmtPct(1, 0)}</td>
                <td className="pt-4 pr-6 text-right">{fmt3(pi.reduce((a, b) => a + b, 0))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-4 max-w-[72ch] text-[13px] leading-relaxed text-muted">
          pᵢ es la probabilidad de elegir al municipio en cada extracción de PPT con reemplazo (suma 1). πᵢ es la probabilidad de
          inclusión de PPT sin reemplazo (suma n). Si πᵢ = 1, el municipio entra con certeza.
        </p>
      </details>
    </div>
  );
}
