import { DESIGNS } from '../lib/designs';
import { fmt2 } from '../lib/format';
import { DESIGN_IDS } from '../stats/designs';
import type { Metrics } from '../stats/summarize';
import type { DesignId } from '../stats/designs/types';
import { Badge, Tex } from './ui';

export function TheoryCards({ metrics }: { metrics: Partial<Record<DesignId, Metrics>> }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {DESIGN_IDS.map((id) => {
        const d = DESIGNS[id];
        const m = metrics[id];
        return (
          <article key={id} className="relative overflow-hidden rounded-xl border border-line bg-surface p-4 sm:p-5">
            <span className="absolute inset-y-0 left-0 w-1" style={{ background: d.color }} aria-hidden />
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-ink">{d.nombre}</h3>
              <div className="flex gap-1.5">
                {d.formulario ? (
                  <Badge>Formulario {d.formulario}</Badge>
                ) : (
                  <Badge tone="warn" title="Este diseño no aparece en el formulario del curso">
                    Fuera del formulario
                  </Badge>
                )}
                {m && <Badge title="Eficiencia relativa frente a MAS/SR con la n actual">ER {fmt2(m.efficiency)}×</Badge>}
              </div>
            </header>
            <div className="space-y-1 rounded-lg bg-surface-2 px-3 py-2 text-ink">
              <Tex display>{d.estimador}</Tex>
              <Tex display>{d.varianza}</Tex>
              <Tex display>{d.estimadorVarianza}</Tex>
            </div>
            {d.extra && <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{d.extra}</p>}
            <ul className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-ink-2">
              {d.intuicion.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: d.color }} aria-hidden />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
