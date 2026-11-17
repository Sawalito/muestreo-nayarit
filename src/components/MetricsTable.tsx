import { useState } from 'react';
import { DESIGNS } from '../lib/designs';
import { fmt2, fmt3, fmtInt, fmtPct, fmtSci, fmtSigned, fmtSignedPct } from '../lib/format';
import type { DesignId } from '../stats/designs/types';
import type { Metrics } from '../stats/summarize';
import type { DesignResult } from '../workers/protocol';
import { ExactBadge, Icon, Num } from './ui';

type Key = 'diseno' | 'mean' | 'bias' | 'relBias' | 'variance' | 'sd' | 'mse' | 'cv' | 'varRatio' | 'efficiency' | 'coverage';

interface Col {
  key: Key;
  label: string;
  title: string;
  fmt?: (v: number) => string;
}

const COLS: Col[] = [
  { key: 'diseno', label: 'Diseño', title: 'Diseño de muestreo' },
  { key: 'efficiency', label: 'Eficiencia', title: 'ECM(MAS/SR) / ECM(diseño)', fmt: (v) => fmt2(v) + '×' },
  { key: 'mean', label: 'E(Ŷ)', title: 'Esperanza del estimador', fmt: fmtInt },
  { key: 'bias', label: 'Sesgo', title: 'E(Ŷ) − Y', fmt: fmtSigned },
  { key: 'relBias', label: 'Sesgo rel.', title: '(E(Ŷ) − Y)/Y', fmt: (v) => fmtSignedPct(v, 2) },
  { key: 'sd', label: 'DE(Ŷ)', title: 'Desviación estándar', fmt: fmtInt },
  { key: 'variance', label: 'V(Ŷ)', title: 'Varianza de la distribución en el muestreo', fmt: (v) => fmtSci(v) },
  { key: 'mse', label: 'ECM', title: 'Error cuadrático medio = V + sesgo²', fmt: (v) => fmtSci(v) },
  { key: 'cv', label: 'CV', title: 'CV(Ŷ) = √V(Ŷ)/E(Ŷ)', fmt: (v) => fmtPct(v, 1) },
  { key: 'varRatio', label: 'ECM / V teór.', title: 'ECM obtenido entre la varianza del formulario (aproximada en la razón)', fmt: fmt3 },
  { key: 'coverage', label: 'Cobertura', title: 'Proporción de intervalos Ŷ ± 1.96·√V̂ que contienen a Y', fmt: (v) => fmtPct(v, 1) },
];

export function MetricsTable({ results, ids, Y }: { results: Partial<Record<DesignId, DesignResult>>; ids: DesignId[]; Y: number }) {
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: 'efficiency', dir: -1 });
  const valid = ids
    .map((id) => ({ id, r: results[id] }))
    .filter((x) => x.r?.valid && x.r.metrics) as { id: DesignId; r: DesignResult & { metrics: Metrics } }[];
  const invalid = ids.map((id) => ({ id, r: results[id] })).filter((x) => x.r && !x.r.valid);
  const maxEff = Math.max(2, ...valid.map((v) => v.r.metrics.efficiency));

  const sorted = [...valid].sort((a, b) => {
    if (sort.key === 'diseno') return sort.dir * DESIGNS[a.id].corto.localeCompare(DESIGNS[b.id].corto, 'es');
    const k = sort.key === 'bias' || sort.key === 'relBias' ? Math.abs : (v: number) => v;
    const va = k(a.r.metrics[sort.key] as number);
    const vb = k(b.r.metrics[sort.key] as number);
    return sort.dir * ((Number.isFinite(va) ? va : -Infinity) - (Number.isFinite(vb) ? vb : -Infinity));
  });

  return (
    <div>
      <div className="scroll-thin -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <table className="tabular w-full min-w-[960px] border-separate border-spacing-0 text-[13px]">
          <caption className="sr-only">Métricas de la distribución en el muestreo por diseño. Y = {fmtInt(Y)}</caption>
          <thead>
            <tr>
              {COLS.map((c) => {
                const active = sort.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                    className={`whitespace-nowrap border-b border-line pb-3 font-normal ${c.key === 'diseno' ? 'text-left' : 'text-right'} ${
                      c.key === 'efficiency' ? 'pl-1 pr-4' : 'px-2'
                    }`}
                  >
                    <button
                      type="button"
                      title={c.title}
                      onClick={() =>
                        setSort((s) => ({ key: c.key, dir: s.key === c.key ? ((-s.dir) as 1 | -1) : c.key === 'diseno' ? 1 : -1 }))
                      }
                      className={`label inline-flex items-center gap-1 transition-colors hover:text-ink ${active ? '!text-ink' : ''}`}
                    >
                      {c.label}
                      <Icon name="sort" size={11} className={`transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ id, r }) => {
              const m = r.metrics;
              const meta = DESIGNS[id];
              return (
                <tr key={id}>
                  <th scope="row" className="border-b border-line py-4 pr-4 text-left font-normal">
                    <div className="flex items-center gap-3">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: meta.color }} />
                      <span className="whitespace-nowrap text-[14px] text-ink">{meta.corto}</span>
                    </div>
                    <div className="mt-1 pl-5">
                      <ExactBadge exact={m.exact} />
                    </div>
                  </th>
                  <td className="border-b border-line py-4 pl-1 pr-4">
                    <div className="flex items-center justify-end gap-3">
                      <div className="relative hidden h-px w-14 bg-line xl:block" aria-hidden>
                        <div
                          className="absolute inset-y-[-1px] left-0 rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.65,0,0.35,1)]"
                          style={{ width: `${Math.min(100, (Math.log(Math.max(m.efficiency, 1)) / Math.log(maxEff)) * 100)}%`, background: meta.color }}
                        />
                      </div>
                      <span className="w-[4.5rem] text-right font-serif text-[19px] text-ink">
                        <Num value={m.efficiency} format={COLS[1].fmt!} />
                      </span>
                    </div>
                  </td>
                  {COLS.slice(2).map((c) => {
                    const v = m[c.key as keyof Metrics] as number;
                    const strong = (c.key === 'bias' || c.key === 'relBias') && id === 'razon';
                    const noV = c.key === 'coverage' && m.vhatAvailable < 0.999;
                    return (
                      <td
                        key={c.key}
                        className={`whitespace-nowrap border-b border-line px-2 py-4 text-right ${strong ? 'text-ink' : 'text-ink-2'}`}
                        title={noV ? `V̂ disponible en ${fmtPct(m.vhatAvailable)} de las muestras` : undefined}
                      >
                        {c.key === 'variance' || c.key === 'mse' ? c.fmt!(v) : <Num value={v} format={c.fmt!} />}
                        {noV && <sup className="text-muted">†</sup>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {invalid.length > 0 && (
        <ul className="mt-4 space-y-1 text-[13px] text-ink-2">
          {invalid.map(({ id, r }) => (
            <li key={id}>
              <span className="text-critical">●</span> {DESIGNS[id].corto} no está disponible con esta n: {r!.reason}.
            </li>
          ))}
        </ul>
      )}
      <dl className="mt-10 grid gap-x-12 gap-y-6 text-[13.5px] leading-relaxed text-ink-2 md:grid-cols-3">
        <div>
          <dt className="label mb-2">Eficiencia relativa</dt>
          <dd>
            ECM(MAS/SR) / ECM(diseño). Un valor de 25× quiere decir que MAS/SR tiene 25 veces más error cuadrático medio que el
            diseño, con la misma n.
          </dd>
        </div>
        <div>
          <dt className="label mb-2">ECM / V teórica</dt>
          <dd>
            Vale 1 en los diseños insesgados, porque ahí la fórmula del formulario es exacta. En la razón compara el ECM real con la
            aproximación N²(1−f)S²<sub>R</sub>/n: con n chica la aproximación se queda corta.
          </dd>
        </div>
        <div>
          <dt className="label mb-2">Cobertura</dt>
          <dd>
            Proporción de intervalos Ŷ ± 1.96·√V̂ que contienen a Y. Con n chica y distribuciones asimétricas suele quedar por debajo de
            95 %. † = solo cuenta las muestras donde existe V̂ (n<sub>h</sub> ≥ 2).
          </dd>
        </div>
      </dl>
    </div>
  );
}
