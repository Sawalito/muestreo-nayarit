import { useMemo, useRef, useState, type ReactNode } from 'react';
import nayarit from '../data/nayarit.json';
import { Controls, type Settings } from './components/Controls';
import { DataPanel } from './components/DataPanel';
import { buildCurves, DensityOverlay } from './components/DensityOverlay';
import { IntervalsChart } from './components/IntervalsChart';
import { MetricsTable } from './components/MetricsTable';
import { SamplingAnimation } from './components/SamplingAnimation';
import { SmallMultiples } from './components/SmallMultiples';
import { SweepChart } from './components/SweepChart';
import { TheoryCards } from './components/TheoryCards';
import { Card, Icon } from './components/ui';
import { DESIGNS } from './lib/designs';
import { fmt2, fmt3, fmtInt } from './lib/format';
import { useDebounced, useTheme, type ThemePref } from './lib/hooks';
import { useSampling } from './lib/useSampling';
import { DESIGN_IDS, prepareDesign } from './stats/designs';
import { buildStrata, stratumSizes } from './stats/designs/estratificado';
import type { DesignId, PreparedDesign } from './stats/designs/types';
import { correlation, makePopulation, variance } from './stats/population';
import type { Metrics } from './stats/summarize';

const REPO_URL = 'https://github.com/Sawalito/muestreo-nayarit';

const TABS = [
  { id: 'resumen', label: 'Distribuciones' },
  { id: 'lado', label: 'Lado a lado' },
  { id: 'anim', label: 'Animación' },
  { id: 'ic', label: 'Intervalos' },
  { id: 'n', label: 'Efecto de n' },
  { id: 'datos', label: 'Datos y estratos' },
  { id: 'teoria', label: 'Teoría' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function ThemeToggle({ pref, setPref }: { pref: ThemePref; setPref: (t: ThemePref) => void }) {
  const opts: { v: ThemePref; icon: string; label: string }[] = [
    { v: 'claro', icon: 'sun', label: 'Tema claro' },
    { v: 'sistema', icon: 'monitor', label: 'Tema del sistema' },
    { v: 'oscuro', icon: 'moon', label: 'Tema oscuro' },
  ];
  return (
    <div role="radiogroup" aria-label="Tema de color" className="flex rounded-lg border border-line bg-surface p-0.5">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={pref === o.v}
          aria-label={o.label}
          title={o.label}
          onClick={() => setPref(o.v)}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition ${
            pref === o.v ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'
          }`}
        >
          <Icon name={o.icon} size={15} />
        </button>
      ))}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="tabular mt-0.5 truncate text-xl font-semibold tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-muted">{sub}</p>}
    </div>
  );
}

export default function App() {
  const pop = useMemo(() => makePopulation(nayarit.municipios), []);
  const [themePref, setThemePref] = useTheme();
  const [s, setS] = useState<Settings>({
    n: 5,
    mode: 'exacto',
    reps: 10000,
    seed: 2024,
    active: [...DESIGN_IDS],
    strat: { L: 2, cuts: 'sqrtf', allocation: 'neyman' },
  });
  const set = (patch: Partial<Settings>) => setS((p) => ({ ...p, ...patch }));
  const [tab, setTab] = useState<TabId>('resumen');
  const [hidden, setHidden] = useState<Set<DesignId>>(new Set());
  const [showControls, setShowControls] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const params = useDebounced(
    { units: pop.units, n: s.n, designs: s.active, strat: s.strat, mode: s.mode, reps: s.reps, seed: s.seed },
    120,
  );
  const sampling = useSampling(params);
  const { results } = sampling;

  // Diseños preparados en el hilo principal (para la animación y los intervalos: extraer una muestra es barato).
  const prepared = useMemo(() => {
    const out: Partial<Record<DesignId, PreparedDesign>> = {};
    for (const id of s.active) out[id] = prepareDesign(id, pop, s.n, s.strat);
    return out;
  }, [pop, s.n, s.strat, s.active]);

  const strata = useMemo(() => buildStrata(pop, s.strat), [pop, s.strat]);
  const nh = useMemo(
    () => (s.n >= strata.length ? stratumSizes(pop, strata, s.n, s.strat.allocation) : null),
    [pop, strata, s.n, s.strat.allocation],
  );

  const shownIds = s.active.filter((id) => results[id]?.valid && results[id]?.metrics);
  const visibleIds = shownIds.filter((id) => !hidden.has(id));

  // Dominio común del eje X: cuantiles 0.1 % – 99.9 % de los diseños visibles, incluyendo Y.
  const domain = useMemo<[number, number]>(() => {
    const ids = visibleIds.length ? visibleIds : shownIds;
    let lo = pop.Y;
    let hi = pop.Y;
    for (const id of ids) {
      const r = results[id]!;
      lo = Math.min(lo, r.lo!);
      hi = Math.max(hi, r.hi!);
    }
    const pad = (hi - lo) * 0.06 || pop.Y * 0.1;
    return [Math.max(0, lo - pad), hi + pad];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, visibleIds.join(), shownIds.join(), pop.Y]);

  const allDomain = useMemo<[number, number]>(() => {
    let lo = pop.Y;
    let hi = pop.Y;
    for (const id of shownIds) {
      lo = Math.min(lo, results[id]!.lo!);
      hi = Math.max(hi, results[id]!.hi!);
    }
    const pad = (hi - lo) * 0.06 || pop.Y * 0.1;
    return [Math.max(0, lo - pad), hi + pad];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, shownIds.join(), pop.Y]);

  const curves = useMemo(() => buildCurves(results, shownIds, domain[0], domain[1]), [results, shownIds.join(), domain]); // eslint-disable-line react-hooks/exhaustive-deps

  const metrics: Partial<Record<DesignId, Metrics>> = {};
  for (const id of shownIds) metrics[id] = results[id]!.metrics!;

  const best = shownIds.filter((id) => id !== 'mas').sort((a, b) => metrics[b]!.efficiency - metrics[a]!.efficiency)[0];
  const rho = correlation(pop.x, pop.y);
  const cvY = Math.sqrt(variance(pop.y)) / (pop.Y / pop.N);

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    let j = -1;
    if (e.key === 'ArrowRight') j = (i + 1) % TABS.length;
    if (e.key === 'ArrowLeft') j = (i - 1 + TABS.length) % TABS.length;
    if (e.key === 'Home') j = 0;
    if (e.key === 'End') j = TABS.length - 1;
    if (j >= 0) {
      e.preventDefault();
      setTab(TABS[j].id);
      tabRefs.current[j]?.focus();
    }
  };

  return (
    <div className="min-h-screen">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-page/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 sm:px-6">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-8 w-8 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-ink sm:text-base">
              Distribución en el muestreo · Nayarit 1980
            </h1>
            <p className="hidden truncate text-xs text-muted sm:block">
              Estimadores del total de población con distintos diseños de muestreo · Estadística Aplicada I
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowControls((v) => !v)}
            aria-expanded={showControls}
            aria-controls="panel-controles"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink lg:hidden"
          >
            <Icon name="sliders" /> Parámetros
          </button>
          <ThemeToggle pref={themePref} setPref={setThemePref} />
          <a
            href={REPO_URL}
            className="hidden h-9 w-9 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink sm:inline-flex"
            aria-label="Código fuente en GitHub"
            title="Código fuente en GitHub"
          >
            <Icon name="github" size={18} />
          </a>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside
          id="panel-controles"
          aria-label="Parámetros"
          className={`${showControls ? 'block' : 'hidden'} lg:block`}
        >
          <div className="rounded-2xl border border-line bg-surface p-4 lg:sticky lg:top-[76px] lg:max-h-[calc(100vh-92px)] lg:overflow-y-auto">
            <Controls
              s={s}
              set={set}
              N={pop.N}
              results={results}
              running={sampling.running}
              progress={sampling.progress}
              ms={sampling.ms}
            />
          </div>
        </aside>

        <main id="contenido" className="min-w-0 space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Valor verdadero Y₁₉₈₀" value={fmtInt(pop.Y)} sub={`N = ${pop.N} municipios · CV = ${fmt2(cvY)}`} />
            <Kpi label="Auxiliar X₁₉₇₀" value={fmtInt(pop.X)} sub={`R = Y/X = ${fmt3(pop.Y / pop.X)}`} />
            <Kpi label="Correlación ρ(x, y)" value={fmt3(rho)} sub="y casi proporcional a x" />
            <Kpi
              label={`Más eficiente con n = ${s.n}`}
              value={best ? <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: DESIGNS[best].color }} />{DESIGNS[best].corto}</span> : '—'}
              sub={best ? `${fmt2(metrics[best]!.efficiency)}× más eficiente que MAS/SR` : undefined}
            />
          </div>

          {sampling.error && (
            <p role="alert" className="rounded-lg border border-critical px-3 py-2 text-sm text-ink">
              Error al calcular: {sampling.error}
            </p>
          )}

          <div className="rounded-2xl border border-line bg-surface">
            <div role="tablist" aria-label="Vistas" className="flex gap-1 overflow-x-auto border-b border-line px-2 pt-2 sm:px-3">
              {TABS.map((t, i) => (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  id={`tab-${t.id}`}
                  role="tab"
                  type="button"
                  aria-selected={tab === t.id}
                  aria-controls={`panel-${t.id}`}
                  tabIndex={tab === t.id ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  onKeyDown={(e) => onTabKey(e, i)}
                  className={`relative whitespace-nowrap rounded-t-lg px-3 py-2.5 text-[13px] font-medium transition ${
                    tab === t.id ? 'text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  {t.label}
                  {tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
                </button>
              ))}
            </div>

            <div
              role="tabpanel"
              id={`panel-${tab}`}
              aria-labelledby={`tab-${tab}`}
              className={`p-4 transition-opacity sm:p-5 ${sampling.running && !shownIds.length ? 'opacity-50' : ''}`}
            >
              {tab === 'resumen' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-[15px] font-semibold text-ink">Distribuciones superpuestas de Ŷ</h2>
                    <p className="mb-3 text-[13px] text-muted">
                      Cada curva es la distribución en el muestreo de un estimador con n = {s.n}. Mientras más angosta y
                      centrada en Y, mejor es el estimador. Pasa el cursor para ver P(Ŷ ≤ x).
                    </p>
                    <DensityOverlay
                      curves={curves}
                      domain={domain}
                      Y={pop.Y}
                      hidden={hidden}
                      onToggle={(id) =>
                        setHidden((h) => {
                          const nx = new Set(h);
                          if (nx.has(id)) nx.delete(id);
                          else nx.add(id);
                          return nx;
                        })
                      }
                    />
                  </div>
                  <div>
                    <h2 className="mb-3 text-[15px] font-semibold text-ink">Métricas comparativas</h2>
                    <MetricsTable results={results} ids={s.active} Y={pop.Y} />
                  </div>
                </div>
              )}
              {tab === 'lado' && <SmallMultiples results={results} ids={shownIds} domain={allDomain} Y={pop.Y} />}
              {tab === 'anim' && (
                <SamplingAnimation pop={pop} prepared={prepared} ids={s.active} domain={allDomain} seed={s.seed} />
              )}
              {tab === 'ic' && <IntervalsChart prepared={prepared} ids={s.active} Y={pop.Y} seed={s.seed} metrics={metrics} />}
              {tab === 'n' && <SweepChart rows={sampling.sweep} ids={s.active} n={s.n} />}
              {tab === 'datos' && <DataPanel pop={pop} n={s.n} strata={strata} nh={nh} />}
              {tab === 'teoria' && <TheoryCards metrics={metrics} />}
            </div>
          </div>

          <Card title="¿Cómo leer esto?">
            <div className="grid gap-4 text-[13.5px] leading-relaxed text-ink-2 md:grid-cols-3">
              <p>
                <strong className="text-ink">Sesgo</strong>: distancia entre el centro de la distribución, E(Ŷ), y el valor
                verdadero Y. Solo el estimador de razón es sesgado, y su sesgo es pequeño.
              </p>
              <p>
                <strong className="text-ink">Varianza</strong>: qué tan dispersa es la distribución. El ECM = V + sesgo² junta
                las dos cosas y permite comparar estimadores sesgados con insesgados.
              </p>
              <p>
                <strong className="text-ink">Eficiencia relativa</strong>: ECM(MAS/SR)/ECM(diseño). Usar x₁₉₇₀ (razón, PPT,
                estratos) o fijar a Tepic reduce la varianza porque elimina la parte de la variación de y que x ya explica.
              </p>
            </div>
          </Card>
        </main>
      </div>

      <footer className="mx-auto max-w-[1500px] px-4 pb-8 pt-2 text-xs leading-relaxed text-muted sm:px-6">
        <p>
          Datos: población por municipio de Nayarit, 1970 y 1980 (archivo del curso). Fórmulas: formulario de Estadística
          Aplicada I. Límites municipales: CONABIO/INEGI vía{' '}
          <a className="underline hover:text-ink" href="https://github.com/PhantomInsights/mexico-geojson">
            PhantomInsights/mexico-geojson
          </a>{' '}
          (MIT), con Bahía de Banderas fusionado con Compostela para reproducir los 19 municipios de 1980.
        </p>
      </footer>
    </div>
  );
}
