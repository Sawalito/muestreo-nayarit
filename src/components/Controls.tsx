import { DESIGNS } from '../lib/designs';
import { fmtInt } from '../lib/format';
import { DESIGN_IDS } from '../stats/designs';
import type { DesignId, StratOptions } from '../stats/designs/types';
import type { Mode } from '../stats/engine';
import type { DesignResult } from '../workers/protocol';
import { Badge, Field, Icon, Segmented, Slider } from './ui';

export const REPS = [1000, 2000, 5000, 10000, 20000, 50000, 100000];

export interface Settings {
  n: number;
  mode: Mode;
  reps: number;
  seed: number;
  active: DesignId[];
  strat: StratOptions;
}

export function Controls({
  s,
  set,
  N,
  results,
  running,
  progress,
  ms,
}: {
  s: Settings;
  set: (patch: Partial<Settings>) => void;
  N: number;
  results: Partial<Record<DesignId, DesignResult>>;
  running: boolean;
  progress: number;
  ms: number | null;
}) {
  const anyMc = s.active.some((id) => results[id]?.metrics && !results[id]!.metrics!.exact);
  return (
    <div className="space-y-5">
      <Field label="Tamaño de muestra n" hint={`De ${N} municipios. Con n = ${s.n}, f = n/N = ${(s.n / N).toFixed(3)}.`}>
        <Slider label="Tamaño de muestra" value={s.n} min={2} max={15} onChange={(n) => set({ n })} />
      </Field>

      <Field
        label="Distribución"
        hint={
          s.mode === 'exacto'
            ? 'Se enumeran todas las muestras posibles cuando son 600,000 o menos. Si hay más, se usa Monte Carlo automáticamente.'
            : 'Se simulan muestras con un generador con semilla (mulberry32).'
        }
      >
        <Segmented
          label="Método para obtener la distribución"
          value={s.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: 'exacto', label: 'Exacta' },
            { value: 'montecarlo', label: 'Monte Carlo' },
          ]}
        />
      </Field>

      <Field label="Réplicas Monte Carlo" hint={s.mode === 'exacto' && !anyMc ? 'Sin uso: todas las distribuciones son exactas.' : undefined}>
        <Slider
          label="Número de réplicas"
          value={Math.max(0, REPS.indexOf(s.reps))}
          min={0}
          max={REPS.length - 1}
          onChange={(i) => set({ reps: REPS[i] })}
          format={(i) => fmtInt(REPS[i])}
        />
      </Field>

      <Field label="Semilla" htmlFor="seed">
        <div className="flex gap-2">
          <input
            id="seed"
            type="number"
            inputMode="numeric"
            value={s.seed}
            onChange={(e) => set({ seed: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            className="tabular h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink"
          />
          <button
            type="button"
            onClick={() => set({ seed: Math.floor(Math.random() * 1e6) })}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink-2 hover:bg-surface-2 hover:text-ink"
            aria-label="Semilla aleatoria"
            title="Semilla aleatoria"
          >
            <Icon name="dice" />
          </button>
        </div>
      </Field>

      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Diseños activos</legend>
        {DESIGN_IDS.map((id) => {
          const on = s.active.includes(id);
          const r = results[id];
          return (
            <label
              key={id}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 text-[13px] transition ${
                on ? 'border-line bg-surface' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() =>
                  set({ active: on ? s.active.filter((x) => x !== id) : DESIGN_IDS.filter((x) => x === id || s.active.includes(x)) })
                }
                className="h-4 w-4 rounded"
                style={{ accentColor: DESIGNS[id].color }}
              />
              <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: DESIGNS[id].color }} aria-hidden />
              <span className="min-w-0 flex-1 font-medium text-ink">{DESIGNS[id].corto}</span>
              {on && r?.metrics && (
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted">{r.metrics.exact ? 'exacta' : 'MC'}</span>
              )}
              {on && r && !r.valid && <Badge tone="warn">n inválida</Badge>}
            </label>
          );
        })}
      </fieldset>

      <div className="space-y-3 rounded-xl bg-surface-2 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Estratificación (x₁₉₇₀)</p>
        <Field label="Estratos por tamaño (más Tepic)">
          <Segmented
            label="Número de estratos por tamaño"
            size="sm"
            value={s.strat.L}
            onChange={(L) => set({ strat: { ...s.strat, L } })}
            options={[
              { value: 2, label: '2 + Tepic' },
              { value: 3, label: '3 + Tepic' },
            ]}
          />
        </Field>
        <Field label="Cortes">
          <Segmented
            label="Método de cortes"
            size="sm"
            value={s.strat.cuts}
            onChange={(cuts) => set({ strat: { ...s.strat, cuts } })}
            options={[
              { value: 'sqrtf', label: '√f acumulada' },
              { value: 'cuantiles', label: 'Cuantiles' },
            ]}
          />
        </Field>
        <Field label="Afijación">
          <Segmented
            label="Tipo de afijación"
            size="sm"
            value={s.strat.allocation}
            onChange={(allocation) => set({ strat: { ...s.strat, allocation } })}
            options={[
              { value: 'proporcional', label: 'Proporcional' },
              { value: 'neyman', label: 'Neyman' },
              { value: 'igual', label: 'Igual' },
            ]}
          />
        </Field>
      </div>

      <div aria-live="polite" className="text-xs text-muted">
        {running ? (
          <div>
            <div className="mb-1 flex justify-between">
              <span>Calculando distribuciones…</span>
              <span className="tabular">{Math.round(progress * 100)} %</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        ) : (
          ms != null && <span>Listo en {fmtInt(ms)} ms (Web Worker).</span>
        )}
      </div>
    </div>
  );
}
