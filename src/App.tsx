import { useEffect, useMemo, useState } from 'react';
import nayarit from '../data/nayarit.json';
import { Dock, type Settings } from './components/Controls';
import { DataPanel } from './components/DataPanel';
import { buildCurves, DensityOverlay } from './components/DensityOverlay';
import { HeroAnimation } from './components/HeroAnimation';
import { IntervalsChart } from './components/IntervalsChart';
import { MetricsTable } from './components/MetricsTable';
import { SamplingAnimation } from './components/SamplingAnimation';
import { SmallMultiples } from './components/SmallMultiples';
import { SweepChart } from './components/SweepChart';
import { TheoryCards } from './components/TheoryCards';
import { Icon, Num, Section, Tex } from './components/ui';
import { DESIGNS } from './lib/designs';
import { fmt2, fmt3, fmtInt } from './lib/format';
import { useDebounced, useTheme } from './lib/hooks';
import { useSampling } from './lib/useSampling';
import { binom } from './stats/combinatorics';
import { DESIGN_IDS, prepareDesign } from './stats/designs';
import { buildStrata, stratumSizes } from './stats/designs/estratificado';
import type { DesignId, PreparedDesign } from './stats/designs/types';
import { correlation, makePopulation } from './stats/population';
import type { Metrics } from './stats/summarize';
import type { DesignResult } from './workers/protocol';

const REPO_URL = 'https://github.com/Sawalito/muestreo-nayarit';

const NAV = [
  { id: 'poblacion', n: '01', label: 'La población' },
  { id: 'disenos', n: '02', label: 'Seis diseños' },
  { id: 'distribuciones', n: '03', label: 'Distribuciones' },
  { id: 'comparacion', n: '04', label: 'Lado a lado' },
  { id: 'animacion', n: '05', label: 'Muestreo en vivo' },
  { id: 'intervalos', n: '06', label: 'Intervalos' },
  { id: 'tamano', n: '07', label: 'Tamaño de muestra' },
];

function SectionRail() {
  const [active, setActive] = useState<string>('');
  useEffect(() => {
    const els = NAV.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <nav aria-label="Secciones" className="fixed left-8 top-1/2 z-30 hidden -translate-y-1/2 2xl:block">
      <ol className="space-y-3">
        {NAV.map((s) => {
          const on = active === s.id;
          return (
            <li key={s.id}>
              <a href={`#${s.id}`} className="group flex items-center gap-3" aria-current={on ? 'true' : undefined}>
                <span className={`h-px transition-all duration-500 ${on ? 'w-8 bg-ink' : 'w-4 bg-faint group-hover:w-6 group-hover:bg-muted'}`} />
                <span className={`font-mono text-[10.5px] tracking-[0.12em] transition-colors ${on ? 'text-ink' : 'text-muted opacity-0 group-hover:opacity-100'}`}>
                  {s.n} {s.label.toUpperCase()}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function App() {
  const pop = useMemo(() => makePopulation(nayarit.municipios), []);
  const [themePref, setThemePref, dark] = useTheme();
  const [s, setS] = useState<Settings>({
    n: 5,
    mode: 'exacto',
    reps: 10000,
    seed: 2024,
    active: [...DESIGN_IDS],
    strat: { L: 2, cuts: 'sqrtf', allocation: 'neyman' },
  });
  const set = (patch: Partial<Settings>) => setS((p) => ({ ...p, ...patch }));

  const params = useDebounced({ units: pop.units, n: s.n, designs: s.active, strat: s.strat, mode: s.mode, reps: s.reps, seed: s.seed }, 120);
  const sampling = useSampling(params);

  // Resultados "estables": se actualizan cuando el worker termina, para que las gráficas se transformen de un estado completo al siguiente.
  const [stable, setStable] = useState<{ results: Partial<Record<DesignId, DesignResult>>; key: string }>({ results: {}, key: '0' });
  useEffect(() => {
    if (!sampling.running && !sampling.error) setStable({ results: sampling.results, key: JSON.stringify({ ...params, units: 0 }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampling.running, sampling.results]);
  const results = stable.results;

  const prepared = useMemo(() => {
    const out: Partial<Record<DesignId, PreparedDesign>> = {};
    for (const id of s.active) out[id] = prepareDesign(id, pop, s.n, s.strat);
    return out;
  }, [pop, s.n, s.strat, s.active]);

  const heroLanes = useMemo(
    () => [
      { design: prepareDesign('mas', pop, 5, s.strat), colorVar: 'var(--d-mas)', label: 'Muestreo aleatorio simple  ·  n = 5' },
      { design: prepareDesign('pptcr', pop, 5, s.strat), colorVar: 'var(--d-pptcr)', label: 'PPT con reemplazo  ·  n = 5' },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pop],
  );
  const heroDomain = useMemo<[number, number]>(() => [150000, 1650000], []);

  const strata = useMemo(() => buildStrata(pop, s.strat), [pop, s.strat]);
  const nh = useMemo(() => (s.n >= strata.length ? stratumSizes(pop, strata, s.n, s.strat.allocation) : null), [pop, strata, s.n, s.strat.allocation]);

  const shownIds = s.active.filter((id) => results[id]?.valid && results[id]?.metrics);

  const domain = useMemo<[number, number]>(() => {
    let lo = pop.Y;
    let hi = pop.Y;
    for (const id of shownIds) {
      lo = Math.min(lo, results[id]!.lo!);
      hi = Math.max(hi, results[id]!.hi!);
    }
    const pad = (hi - lo) * 0.05 || pop.Y * 0.1;
    return [Math.max(0, lo - pad), hi + pad];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, shownIds.join(), pop.Y]);

  const curves = useMemo(() => buildCurves(results, shownIds, domain[0], domain[1]), [results, shownIds.join(), domain]); // eslint-disable-line react-hooks/exhaustive-deps

  const metrics: Partial<Record<DesignId, Metrics>> = {};
  for (const id of shownIds) metrics[id] = results[id]!.metrics!;
  const best = shownIds.filter((id) => id !== 'mas').sort((a, b) => metrics[b]!.efficiency - metrics[a]!.efficiency)[0];
  const rho = correlation(pop.x, pop.y);
  const toggle = (id: DesignId) =>
    set({ active: s.active.includes(id) ? s.active.filter((x) => x !== id) : DESIGN_IDS.filter((x) => x === id || s.active.includes(x)) });

  const razon = metrics.razon;
  const mas = metrics.mas;

  return (
    <div className="min-h-screen overflow-x-clip">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-page">
        Saltar al contenido
      </a>

      <header className="mx-auto flex max-w-[1180px] items-center justify-between px-5 pt-7 sm:px-8">
        <a href="#" className="font-mono text-[12px] tracking-[0.16em] text-ink-2 hover:text-ink">
          NAYARIT <span className="text-faint">/</span> 1980
        </a>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setThemePref(dark ? 'claro' : 'oscuro')}
            className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:text-ink"
            aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            title={dark ? 'Tema claro' : 'Tema oscuro'}
          >
            <Icon name={dark ? 'sun' : 'moon'} size={17} />
          </button>
          <a href={REPO_URL} className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:text-ink" aria-label="Código fuente en GitHub" title="Código fuente">
            <Icon name="github" size={17} />
          </a>
        </div>
      </header>

      <SectionRail />

      <main id="contenido" className="mx-auto max-w-[1180px] px-5 pb-40 sm:px-8">
        {/* ——— Portada ——— */}
        <section className="pb-16 pt-20 sm:pt-28" aria-labelledby="titulo">
          <p className="kicker fade-in">Estadística Aplicada I · Distribución en el muestreo</p>
          <h1
            id="titulo"
            className="fade-in mt-6 max-w-[16ch] text-balance font-serif text-[clamp(2.6rem,1.6rem+4.4vw,5.4rem)] font-normal leading-[1.02] tracking-[-0.025em] text-ink"
            style={{ animationDelay: '120ms' }}
          >
            ¿Cuántas personas vivían en Nayarit en 1980?
          </h1>
          <div className="fade-in prose-lead mt-8 space-y-4" style={{ animationDelay: '260ms' }}>
            <p>
              Imagina que solo puedes visitar <em>cinco</em> de sus diecinueve municipios. El total que estimes dependerá de cuáles te
              toquen. Si repites el ejercicio con todas las muestras posibles, los resultados forman una distribución: la{' '}
              <strong>distribución en el muestreo</strong> del estimador.
            </p>
            <p>
              Los puntos de abajo son eso: muestras de cinco municipios. Arriba se eligen al azar; abajo, con probabilidad proporcional a
              la población de 1970. Mismo tamaño de muestra, y una precisión completamente distinta.
            </p>
          </div>

          <div className="fade-in mt-14" style={{ animationDelay: '420ms' }}>
            <HeroAnimation lanes={heroLanes} Y={pop.Y} domain={heroDomain} />
          </div>

          <dl className="mt-14 grid grid-cols-2 gap-x-8 gap-y-10 border-t border-line pt-10 md:grid-cols-4">
            {[
              ['Total verdadero Y₁₉₈₀', fmtInt(pop.Y), 'lo que queremos estimar'],
              ['Auxiliar X₁₉₇₀', fmtInt(pop.X), `razón R = Y/X = ${fmt3(pop.Y / pop.X)}`],
              ['Correlación ρ(x, y)', fmt3(rho), 'y es casi proporcional a x'],
              [
                `Mejor diseño con n = ${s.n}`,
                best ? DESIGNS[best].corto : '—',
                best ? `${fmt2(metrics[best]!.efficiency)}× más eficiente que MAS/SR` : '',
              ],
            ].map(([k, v, sub]) => (
              <div key={k}>
                <dt className="label">{k}</dt>
                <dd className="tabular mt-2 font-serif text-[clamp(1.6rem,1.2rem+1.2vw,2.3rem)] leading-none text-ink">{v}</dd>
                <dd className="mt-2 text-[13px] text-muted">{sub}</dd>
              </div>
            ))}
          </dl>

          <a href="#poblacion" className="mt-16 inline-flex items-center gap-3 text-[13px] text-muted transition hover:text-ink">
            <span className="grid h-9 w-9 place-items-center rounded-full ring-1 ring-line">
              <Icon name="arrowDown" size={15} />
            </span>
            Recorrer la explicación
          </a>
        </section>

        {/* ——— 01 ——— */}
        <Section
          id="poblacion"
          index="01"
          kicker="La población"
          title="Diecinueve municipios, uno muy grande"
          lead={
            <>
              <p>
                Conocemos la población de cada municipio en 1970 (<span className="font-serif italic">x</span>) y en 1980 (
                <span className="font-serif italic">y</span>). En la práctica no tendríamos <span className="font-serif italic">y</span>:
                lo vamos a estimar con una muestra y a compararlo con el valor verdadero.
              </p>
              <p>
                Hay dos rasgos que lo deciden casi todo. <strong>Tepic</strong> concentra la cuarta parte de la población. Y la relación
                entre 1970 y 1980 es casi una recta que pasa por el origen: quien sabe <span className="font-serif italic">x</span> casi
                sabe <span className="font-serif italic">y</span>.
              </p>
            </>
          }
        >
          <DataPanel pop={pop} n={s.n} strata={strata} nh={nh} />
        </Section>

        {/* ——— 02 ——— */}
        <Section
          id="disenos"
          index="02"
          kicker="Los diseños"
          title="Seis maneras de elegir la muestra"
          lead={
            <p>
              Cada diseño combina una forma de elegir municipios con un estimador del total. Las fórmulas siguen la notación del formulario
              del curso. En cada diseño, el símbolo <span className="font-serif italic">Ŷ</span> lleva el color que lo identifica en las
              gráficas de la página.
            </p>
          }
        >
          <TheoryCards metrics={metrics} />
        </Section>

        {/* ——— 03 ——— */}
        <Section
          id="distribuciones"
          index="03"
          kicker="Distribuciones"
          title="Todas las muestras posibles, en una sola imagen"
          lead={
            <>
              <p>
                Con N = 19 se pueden enumerar <em>todas</em> las muestras: con n = {s.n} son {fmtInt(binom(pop.N, s.n))} en MAS/SR. Cada curva es la
                distribución exacta de un estimador. Mientras más angosta y más centrada en{' '}
                <span className="font-serif italic">Y</span>, mejor el estimador.
              </p>
              <p>
                Usa el control flotante de abajo para cambiar <span className="font-serif italic">n</span> y observa cómo se transforman las
                curvas. Toca un diseño para quitarlo o volver a agregarlo.
              </p>
            </>
          }
          aside={
            razon && mas ? (
              <p className="max-w-[40ch] border-l border-line pl-6 text-[14px] leading-relaxed text-muted">
                Con n = {s.n}, la razón se aleja de Y en promedio{' '}
                <span className="font-serif text-[17px] text-ink">
                  <Num value={Math.abs(razon.bias)} format={fmtInt} />
                </span>{' '}
                habitantes, un sesgo pequeño. A cambio, su error cuadrático medio es{' '}
                <span className="font-serif text-[17px] text-ink">
                  <Num value={razon.efficiency} format={(v) => fmt2(v) + '×'} />
                </span>{' '}
                menor que el de MAS/SR.
              </p>
            ) : undefined
          }
        >
          <DensityOverlay curves={curves} domain={domain} Y={pop.Y} allIds={DESIGN_IDS} active={s.active} onToggle={toggle} stateKey={stable.key} />
          <div className="mt-20">
            <MetricsTable results={results} ids={s.active} Y={pop.Y} />
          </div>
        </Section>

        {/* ——— 04 ——— */}
        <Section
          id="comparacion"
          index="04"
          kicker="Lado a lado"
          title="La misma escala para todos"
          lead={
            <p>
              Separadas, las distribuciones se leen mejor. Fíjate en la doble joroba de MAS/SR, que depende de si Tepic cae o no en la
              muestra, y en cómo desaparece al incluir a Tepic con certeza o al estratificar.
            </p>
          }
        >
          <SmallMultiples results={results} ids={shownIds} domain={domain} Y={pop.Y} stateKey={stable.key} />
        </Section>

        {/* ——— 05 ——— */}
        <Section
          id="animacion"
          index="05"
          kicker="Muestreo en vivo"
          title="Una muestra a la vez"
          lead={
            <p>
              La distribución en el muestreo no es una abstracción: es lo que verías si repitieras el muestreo una y otra vez. Elige un
              diseño, pulsa reproducir y mira cómo el histograma se acerca a la curva teórica.
            </p>
          }
        >
          <SamplingAnimation pop={pop} prepared={prepared} ids={s.active} domain={domain} seed={s.seed} />
        </Section>

        {/* ——— 06 ——— */}
        <Section
          id="intervalos"
          index="06"
          kicker="Intervalos de confianza"
          title="¿Cuántos intervalos atrapan a Y?"
          lead={
            <p>
              Cada línea es un intervalo <Tex>{String.raw`\hat Y \pm 1.96\sqrt{\hat V}`}</Tex> calculado con una muestra distinta. Si la teoría normal funcionara perfecto, unos 95
              de cada 100 cruzarían la línea punteada. Con n chica y poblaciones sesgadas, suelen ser menos, porque <Tex>{String.raw`\hat V`}</Tex> subestima la
              varianza justo en las muestras que más se equivocan.
            </p>
          }
        >
          <IntervalsChart prepared={prepared} ids={s.active} Y={pop.Y} seed={s.seed} metrics={metrics} />
        </Section>

        {/* ——— 07 ——— */}
        <Section
          id="tamano"
          index="07"
          kicker="Tamaño de muestra"
          title="Más muestra, menos error"
          lead={
            <p>
              Al crecer <span className="font-serif italic">n</span>, el error de todos los diseños cae, aproximadamente como 1/√n, y el
              factor de corrección (1 − n/N) lo hace caer todavía más rápido. El orden entre diseños casi no cambia: la información de 1970
              vale lo mismo con muestras chicas que grandes.
            </p>
          }
        >
          <SweepChart rows={sampling.sweep} ids={s.active} n={s.n} />
        </Section>

        <footer className="border-t border-line pt-12 text-[13px] leading-relaxed text-muted">
          <div className="grid gap-8 md:grid-cols-3">
            <p>
              <span className="label mb-2 block">Datos</span>
              Población por municipio de Nayarit, 1970 y 1980 (archivo del curso). Fórmulas: formulario de Estadística Aplicada I.
            </p>
            <p>
              <span className="label mb-2 block">Mapa</span>
              Límites municipales CONABIO/INEGI vía{' '}
              <a className="underline decoration-faint underline-offset-4 hover:text-ink" href="https://github.com/PhantomInsights/mexico-geojson">
                PhantomInsights/mexico-geojson
              </a>{' '}
              (MIT). Bahía de Banderas aparece unido a Compostela, como en 1980.
            </p>
            <p>
              <span className="label mb-2 block">Cálculo</span>
              Enumeración exhaustiva o Monte Carlo con semilla, en un Web Worker. Código en{' '}
              <a className="underline decoration-faint underline-offset-4 hover:text-ink" href={REPO_URL}>
                GitHub
              </a>
              .
            </p>
          </div>
        </footer>
      </main>

      <Dock
        s={s}
        set={set}
        N={pop.N}
        running={sampling.running}
        progress={sampling.progress}
        ms={sampling.ms}
        theme={themePref}
        setTheme={setThemePref}
      />
    </div>
  );
}
