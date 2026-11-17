import { useEffect, useRef, useState } from 'react';
import { DESIGNS } from '../lib/designs';
import { fmtInt } from '../lib/format';
import type { ThemePref } from '../lib/hooks';
import { DESIGN_IDS } from '../stats/designs';
import type { DesignId, StratOptions } from '../stats/designs/types';
import type { Mode } from '../stats/engine';
import { DesignChip, Icon, Segmented, Slider } from './ui';

export const REPS = [1000, 2000, 5000, 10000, 20000, 50000, 100000];

export interface Settings {
  n: number;
  mode: Mode;
  reps: number;
  seed: number;
  active: DesignId[];
  strat: StratOptions;
}

function ProgressRing({ running, progress }: { running: boolean; progress: number }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className={running ? 'animate-spin [animation-duration:1.6s]' : ''}>
      <circle cx="9" cy="9" r={r} fill="none" stroke="var(--faint)" strokeWidth="1.5" opacity={0.5} />
      <circle
        cx="9"
        cy="9"
        r={r}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={running ? c * (1 - Math.max(0.15, progress)) : 0}
        transform="rotate(-90 9 9)"
        style={{ transition: 'stroke-dashoffset 400ms ease' }}
      />
    </svg>
  );
}

/** Barra flotante con los controles principales + panel de ajustes. */
export function Dock({
  s,
  set,
  N,
  running,
  progress,
  ms,
  theme,
  setTheme,
}: {
  s: Settings;
  set: (patch: Partial<Settings>) => void;
  N: number;
  running: boolean;
  progress: number;
  ms: number | null;
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    panelRef.current?.querySelector<HTMLElement>('input,button')?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const stepN = (d: number) => set({ n: Math.min(15, Math.max(2, s.n + d)) });

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto relative">
        {/* Panel de ajustes */}
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Ajustes"
          aria-hidden={!open}
          className={`absolute bottom-[calc(100%+12px)] left-1/2 w-[min(92vw,420px)] -translate-x-1/2 origin-bottom rounded-3xl bg-[var(--dock)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] ring-1 ring-line backdrop-blur-2xl transition-all duration-500 ease-[cubic-bezier(0.2,0.7,0.1,1)] ${
            open ? 'visible translate-y-0 scale-100 opacity-100' : 'invisible translate-y-3 scale-[0.97] opacity-0'
          }`}
        >
          <div className="max-h-[62vh] space-y-7 overflow-y-auto pr-1 scroll-thin">
            <div>
              <p className="label mb-3">Diseños</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {DESIGN_IDS.map((id) => (
                  <DesignChip
                    key={id}
                    color={DESIGNS[id].color}
                    label={DESIGNS[id].corto}
                    on={s.active.includes(id)}
                    onClick={() =>
                      set({
                        active: s.active.includes(id) ? s.active.filter((x) => x !== id) : DESIGN_IDS.filter((x) => x === id || s.active.includes(x)),
                      })
                    }
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="label mb-2">Réplicas Monte Carlo</p>
              <Slider
                label="Número de réplicas"
                value={Math.max(0, REPS.indexOf(s.reps))}
                min={0}
                max={REPS.length - 1}
                onChange={(i) => set({ reps: REPS[i] })}
                format={(i) => fmtInt(REPS[i])}
                className="[&_output]:w-20"
              />
              <p className="mt-1 text-[12px] text-muted">
                Se usan en modo Monte Carlo, y en el exacto cuando hay más de 600,000 muestras posibles.
              </p>
            </div>

            <div>
              <label htmlFor="seed" className="label mb-2 block">
                Semilla
              </label>
              <div className="flex items-center gap-3 border-b border-line focus-within:border-ink">
                <input
                  id="seed"
                  type="number"
                  inputMode="numeric"
                  value={s.seed}
                  onChange={(e) => set({ seed: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                  className="tabular h-9 w-full bg-transparent font-mono text-[14px] text-ink outline-none"
                />
                <button
                  type="button"
                  onClick={() => set({ seed: Math.floor(Math.random() * 1e6) })}
                  className="text-muted transition-colors hover:text-ink"
                  aria-label="Semilla aleatoria"
                  title="Semilla aleatoria"
                >
                  <Icon name="dice" size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <p className="label">Estratificación por x₁₉₇₀</p>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[13px] text-ink-2">Estratos</span>
                <Segmented
                  label="Número de estratos por tamaño"
                  value={s.strat.L}
                  onChange={(L) => set({ strat: { ...s.strat, L } })}
                  options={[
                    { value: 2, label: 'Tepic + 2' },
                    { value: 3, label: 'Tepic + 3' },
                  ]}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[13px] text-ink-2">Cortes</span>
                <Segmented
                  label="Método de cortes"
                  value={s.strat.cuts}
                  onChange={(cuts) => set({ strat: { ...s.strat, cuts } })}
                  options={[
                    { value: 'sqrtf', label: '√f acumulada' },
                    { value: 'cuantiles', label: 'Cuantiles' },
                  ]}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[13px] text-ink-2">Afijación</span>
                <Segmented
                  label="Tipo de afijación"
                  value={s.strat.allocation}
                  onChange={(allocation) => set({ strat: { ...s.strat, allocation } })}
                  options={[
                    { value: 'proporcional', label: 'Proporcional' },
                    { value: 'neyman', label: 'Neyman' },
                    { value: 'igual', label: 'Igual' },
                  ]}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="label">Tema</span>
              <Segmented
                label="Tema de color"
                value={theme}
                onChange={setTheme}
                options={[
                  { value: 'oscuro', label: 'Oscuro' },
                  { value: 'claro', label: 'Claro' },
                  { value: 'sistema', label: 'Sistema' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Dock */}
        <div className="flex items-center gap-1 rounded-full bg-[var(--dock)] py-1.5 pl-4 pr-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.28)] ring-1 ring-line backdrop-blur-2xl sm:gap-2">
          <span className="font-serif text-[17px] italic text-muted" aria-hidden>
            n
          </span>
          <button
            type="button"
            onClick={() => stepN(-1)}
            disabled={s.n <= 2}
            className="grid h-8 w-8 place-items-center rounded-full text-ink-2 transition hover:bg-raise hover:text-ink disabled:opacity-30"
            aria-label="Disminuir n"
          >
            <Icon name="minus" size={14} />
          </button>
          <span className="tabular w-6 text-center font-serif text-[20px] text-ink" aria-live="polite" aria-label={`n = ${s.n}`}>
            {s.n}
          </span>
          <button
            type="button"
            onClick={() => stepN(1)}
            disabled={s.n >= 15}
            className="grid h-8 w-8 place-items-center rounded-full text-ink-2 transition hover:bg-raise hover:text-ink disabled:opacity-30"
            aria-label="Aumentar n"
          >
            <Icon name="plus" size={14} />
          </button>
          <div className="hidden w-28 md:block">
            <Slider label="Tamaño de muestra n" value={s.n} min={2} max={15} onChange={(n) => set({ n })} className="[&_output]:hidden" />
          </div>
          <span className="mx-1 h-5 w-px bg-line sm:mx-2" aria-hidden />
          <Segmented
            label="Método para obtener la distribución"
            value={s.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { value: 'exacto', label: 'Exacta' },
              {
                value: 'montecarlo',
                label: (
                  <>
                    <span className="sm:hidden">MC</span>
                    <span className="hidden sm:inline">Monte Carlo</span>
                  </>
                ),
                title: 'Monte Carlo',
              },
            ]}
          />
          <span className="mx-1 h-5 w-px bg-line sm:mx-2" aria-hidden />
          <span
            className="grid h-8 w-8 place-items-center"
            role="status"
            aria-label={running ? `Calculando, ${Math.round(progress * 100)} %` : ms != null ? `Listo en ${fmtInt(ms)} ms` : 'Listo'}
            title={running ? `Calculando… ${Math.round(progress * 100)} %` : ms != null ? `Calculado en ${fmtInt(ms)} ms (Web Worker)` : ''}
          >
            <ProgressRing running={running} progress={progress} />
          </span>
          <button
            ref={btnRef}
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="Ajustes"
            title={`Ajustes (de ${N} municipios)`}
            className={`grid h-9 w-9 place-items-center rounded-full transition ${open ? 'bg-ink text-page' : 'text-ink-2 hover:bg-raise hover:text-ink'}`}
          >
            <Icon name={open ? 'x' : 'sliders'} size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
