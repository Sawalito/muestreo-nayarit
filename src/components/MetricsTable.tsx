import { useState } from 'react';
import { DESIGNS } from '../lib/designs';
import { fmt2, fmt3, fmtInt, fmtPct, fmtSci, fmtSigned, fmtSignedPct } from '../lib/format';
import type { DesignId } from '../stats/designs/types';
import type { Metrics } from '../stats/summarize';
import type { DesignResult } from '../workers/protocol';
import { ExactBadge, Icon } from './ui';

type Key =
  | 'diseno'
  | 'mean'
  | 'bias'
  | 'relBias'
  | 'variance'
  | 'sd'
  | 'mse'
  | 'cv'
  | 'varRatio'
  | 'efficiency'
  | 'coverage';

interface Col {
  key: Key;
  label: string;
  title: string;
  fmt?: (m: Metrics) => string;
}

const COLS: Col[] = [
  { key: 'diseno', label: 'Diseño', title: 'Diseño de muestreo' },
  { key: 'mean', label: 'E(Ŷ)', title: 'Esperanza del estimador', fmt: (m) => fmtInt(m.mean) },
  { key: 'bias', label: 'Sesgo', title: 'E(Ŷ) − Y', fmt: (m) => fmtSigned(m.bias) },
  { key: 'relBias', label: 'Sesgo rel.', title: '(E(Ŷ) − Y)/Y', fmt: (m) => fmtSignedPct(m.relBias, 3) },
  { key: 'variance', label: 'V(Ŷ)', title: 'Varianza de la distribución en el muestreo', fmt: (m) => fmtSci(m.variance) },
  { key: 'sd', label: 'DE(Ŷ)', title: 'Desviación estándar', fmt: (m) => fmtInt(m.sd) },
  { key: 'mse', label: 'ECM', title: 'Error cuadrático medio = V + sesgo²', fmt: (m) => fmtSci(m.mse) },
  { key: 'cv', label: 'CV', title: 'CV(Ŷ) = √V(Ŷ)/E(Ŷ)', fmt: (m) => fmtPct(m.cv, 2) },
  {
    key: 'varRatio',
    label: 'ECM / V teór.',
    title: 'Varianza obtenida entre la varianza del formulario (para razón: ECM entre la aproximación)',
    fmt: (m) => fmt3(m.varRatio),
  },
  { key: 'efficiency', label: 'Eficiencia rel.', title: 'ECM(MAS/SR) / ECM(diseño)', fmt: (m) => fmt2(m.efficiency) + '×' },
  {
    key: 'coverage',
    label: 'Cobertura 95 %',
    title: 'Proporción de intervalos Ŷ ± 1.96·√V̂ que contienen a Y',
    fmt: (m) => fmtPct(m.coverage, 1),
  },
];

export function MetricsTable({ results, ids, Y }: { results: Partial<Record<DesignId, DesignResult>>; ids: DesignId[]; Y: number }) {
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: 'efficiency', dir: -1 });
  const rows = ids.map((id) => ({ id, r: results[id] }));
  const valid = rows.filter((x) => x.r?.valid && x.r.metrics) as { id: DesignId; r: DesignResult & { metrics: Metrics } }[];
  const invalid = rows.filter((x) => x.r && !x.r.valid);
  const maxEff = Math.max(1, ...valid.map((v) => v.r.metrics.efficiency));

  const sorted = [...valid].sort((a, b) => {
    if (sort.key === 'diseno') return sort.dir * DESIGNS[a.id].corto.localeCompare(DESIGNS[b.id].corto, 'es');
    const va = a.r.metrics[sort.key] as number;
    const vb = b.r.metrics[sort.key] as number;
    const k = sort.key === 'bias' || sort.key === 'relBias' ? Math.abs : (v: number) => v;
    return sort.dir * ((Number.isFinite(k(va)) ? k(va) : -Infinity) - (Number.isFinite(k(vb)) ? k(vb) : -Infinity));
  });

  // Recorte de la razón: aclarar que la "V teórica" es una aproximación del ECM.
  const ratioNote = valid.some((v) => v.id === 'razon');

  return (
    <div>
      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <table className="tabular w-full min-w-[1000px] border-separate border-spacing-0 text-[13px]">
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
                    className={`sticky top-0 whitespace-nowrap border-b border-line bg-surface px-3 py-2 text-xs font-semibold text-muted ${
                      c.key === 'diseno' ? 'left-0 z-10 text-left' : 'text-right'
                    } ${c.key === 'efficiency' ? 'text-ink' : ''}`}
                  >
                    <button
                      type="button"
                      title={c.title}
                      onClick={() =>
                        setSort((s) => ({ key: c.key, dir: s.key === c.key ? ((-s.dir) as 1 | -1) : c.key === 'diseno' ? 1 : -1 }))
                      }
                      className={`inline-flex items-center gap-1 rounded hover:text-ink ${active ? 'text-ink' : ''}`}
                    >
                      {c.label}
                      <Icon name="sort" size={12} className={active ? 'opacity-100' : 'opacity-30'} />
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
                <tr key={id} className="group">
                  <th
                    scope="row"
                    className="sticky left-0 z-[1] border-b border-line bg-surface px-3 py-2.5 text-left font-medium text-ink group-hover:bg-surface-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-1 shrink-0 rounded-full" style={{ background: meta.color }} />
                      <span className="whitespace-nowrap">{meta.corto}</span>
                    </div>
                    <div className="mt-1 pl-3">
                      <ExactBadge exact={m.exact} />
                    </div>
                  </th>
                  {COLS.slice(1).map((c) => {
                    if (c.key === 'efficiency') {
                      return (
                        <td key={c.key} className="border-b border-line px-3 py-2.5 text-right group-hover:bg-surface-2">
                          <div className="flex items-center justify-end gap-2">
                            <div className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-surface-2 2xl:block" aria-hidden>
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.min(100, (Math.log(Math.max(m.efficiency, 1)) / Math.log(maxEff || 2)) * 100)}%`, background: meta.color }}
                              />
                            </div>
                            <span className="text-[14px] font-bold text-ink">{c.fmt!(m)}</span>
                          </div>
                        </td>
                      );
                    }
                    const warnBias = (c.key === 'bias' || c.key === 'relBias') && id === 'razon';
                    return (
                      <td
                        key={c.key}
                        className={`whitespace-nowrap border-b border-line px-3 py-2.5 text-right group-hover:bg-surface-2 ${
                          warnBias ? 'font-semibold text-ink' : 'text-ink-2'
                        }`}
                        title={c.key === 'coverage' && m.vhatAvailable < 0.999 ? `V̂ disponible en ${fmtPct(m.vhatAvailable)} de las muestras` : undefined}
                      >
                        {c.fmt!(m)}
                        {c.key === 'coverage' && m.vhatAvailable < 0.999 && <sup className="text-muted">†</sup>}
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
        <ul className="mt-3 space-y-1 text-xs text-ink-2">
          {invalid.map(({ id, r }) => (
            <li key={id} className="flex items-center gap-1.5">
              <Icon name="warn" size={14} className="text-critical" />
              <strong>{DESIGNS[id].corto}:</strong> no disponible con esta n ({r!.reason}).
            </li>
          ))}
        </ul>
      )}
      <ul className="mt-3 space-y-1 text-xs leading-relaxed text-muted">
        <li>
          <strong className="text-ink-2">Eficiencia relativa</strong> = ECM(MAS/SR) / ECM(diseño). Por ejemplo, 25× significa
          que MAS/SR necesitaría unas 25 veces más varianza para lograr la misma precisión.
        </li>
        {ratioNote && (
          <li>
            En la razón, <em>ECM / V teór.</em> compara el ECM real con la aproximación N²(1−f)S²_R/n del formulario. Su sesgo
            es real y disminuye al crecer n (ver la pestaña «Efecto de n»).
          </li>
        )}
        <li>
          <strong className="text-ink-2">Cobertura</strong>: proporción de intervalos Ŷ ± 1.96·√V̂ que contienen a Y. Con n chica
          y distribuciones asimétricas suele quedar por debajo de 95 %. † = solo cuenta las muestras donde existe V̂ (n_h ≥ 2).
        </li>
      </ul>
    </div>
  );
}
