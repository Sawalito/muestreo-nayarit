import { DESIGNS, type DesignMeta } from '../lib/designs';
import { fmt2 } from '../lib/format';
import { useReveal } from '../lib/motion';
import { DESIGN_IDS } from '../stats/designs';
import type { DesignId } from '../stats/designs/types';
import type { Metrics } from '../stats/summarize';
import { Num, Tex } from './ui';

/** Colorea el símbolo del estimador con el color del diseño (como en los videos de 3Blue1Brown). */
const tint = (tex: string, color: string) => tex.replace(/\\hat Y_(\{HT\}|T)/g, (m) => `\\htmlStyle{color: ${color}}{${m}}`);

function TheoryItem({ d, m, i }: { d: DesignMeta; m?: Metrics; i: number }) {
  const ref = useReveal<HTMLElement>(0.2);
  return (
    <article ref={ref} className="reveal grid gap-8 border-t border-line py-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
      <div>
        <p className="kicker flex items-center gap-3">
          <span style={{ color: d.color }}>●</span>
          {String(i + 1).padStart(2, '0')}
          {d.formulario ? <span>· formulario {d.formulario}</span> : <span className="text-critical">· fuera del formulario</span>}
        </p>
        <h3 className="mt-4 font-serif text-[28px] leading-tight text-ink">{d.nombre}</h3>
        {m && (
          <p className="mt-3 text-[14px] text-muted">
            Con la n actual es{' '}
            <span className="font-serif text-[18px] text-ink">
              <Num value={m.efficiency} format={(v) => fmt2(v) + '×'} />
            </span>{' '}
            más eficiente que MAS/SR.
          </p>
        )}
        <div className="prose-body mt-6 space-y-4">
          {d.intuicion.map((t, k) => (
            <p key={k}>{t}</p>
          ))}
          {d.extra && <p className="text-[14px] text-muted">{d.extra}</p>}
        </div>
      </div>
      <div className="space-y-5 text-ink lg:pt-10">
        <div>
          <p className="label mb-1">Estimador</p>
          <Tex display>{tint(d.estimador, d.color)}</Tex>
        </div>
        <div>
          <p className="label mb-1">Varianza</p>
          <Tex display>{tint(d.varianza, d.color)}</Tex>
        </div>
        <div>
          <p className="label mb-1">Estimador de la varianza</p>
          <Tex display>{tint(d.estimadorVarianza, d.color)}</Tex>
        </div>
      </div>
    </article>
  );
}

export function TheoryCards({ metrics }: { metrics: Partial<Record<DesignId, Metrics>> }) {
  return (
    <div className="border-b border-line">
      {DESIGN_IDS.map((id, i) => (
        <TheoryItem key={id} d={DESIGNS[id]} m={metrics[id]} i={i} />
      ))}
    </div>
  );
}
