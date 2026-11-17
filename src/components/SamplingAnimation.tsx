import { scaleLinear } from 'd3';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DESIGNS } from '../lib/designs';
import { fmt3, fmtInt } from '../lib/format';
import { usePrefersReducedMotion, useWidth } from '../lib/hooks';
import type { Draw, DesignId, PreparedDesign } from '../stats/designs/types';
import type { Population } from '../stats/population';
import { deriveSeed, mulberry32, type Rng } from '../stats/rng';
import { TruthLine, XAxis } from './chartParts';
import { NayaritMap } from './NayaritMap';
import { Button, Icon, Slider, Swatch } from './ui';

const BINS = 48;

interface Falling {
  key: number;
  est: number;
  bin: number;
  start: number;
  dur: number;
}

function explain(d: PreparedDesign, draw: Draw, pop: Population): string {
  const n = draw.units.length;
  const ys = draw.units.map((i) => pop.y[i]);
  const ybar = ys.reduce((a, b) => a + b, 0) / n;
  switch (d.id) {
    case 'mas':
      return `Ŷ = N·ȳ = ${pop.N} × ${fmtInt(ybar)} = ${fmtInt(draw.est)}`;
    case 'razon': {
      const xbar = draw.units.reduce((a, i) => a + pop.x[i], 0) / n;
      return `R̂ = ȳ/x̄ = ${fmtInt(ybar)} / ${fmtInt(xbar)} = ${fmt3(ybar / xbar)}  ⇒  Ŷ = X·R̂ = ${fmtInt(pop.X)} × ${fmt3(ybar / xbar)} = ${fmtInt(draw.est)}`;
    }
    case 'pptcr':
      return `z̄ = (1/n) Σ y_j/p_j = (1/${n}) × ${fmtInt(draw.est * n)} = ${fmtInt(draw.est)}`;
    case 'pptsr':
      return `Ŷ = Σ y_i/π_i = ${fmtInt(draw.est)}`;
    case 'tepic': {
      const rest = draw.units.filter((i) => i !== pop.tepic).map((i) => pop.y[i]);
      const m = rest.reduce((a, b) => a + b, 0) / rest.length;
      return `Ŷ = Y_Tepic + (N−1)·ȳ_resto = ${fmtInt(pop.y[pop.tepic])} + ${pop.N - 1} × ${fmtInt(m)} = ${fmtInt(draw.est)}`;
    }
    case 'estrat':
      return `Ŷ = Σ_h N_h·ȳ_h = ${fmtInt(draw.est)}`;
  }
}

export function SamplingAnimation({
  pop,
  prepared,
  ids,
  domain,
  seed,
}: {
  pop: Population;
  prepared: Partial<Record<DesignId, PreparedDesign>>;
  ids: DesignId[];
  domain: [number, number];
  seed: number;
}) {
  const available = ids.filter((id) => prepared[id]?.valid);
  const [design, setDesign] = useState<DesignId>(available[0] ?? 'mas');
  const d = prepared[available.includes(design) ? design : available[0]];
  const reduced = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4); // muestras por segundo
  const [, setFrame] = useState(0);

  const rngRef = useRef<Rng>(mulberry32(1));
  const binsRef = useRef(new Float64Array(BINS));
  const stats = useRef({ k: 0, sum: 0, sumsq: 0, cover: 0, withV: 0 });
  const fallingRef = useRef<Falling[]>([]);
  const lastRef = useRef<Draw | null>(null);
  const keyRef = useRef(0);
  const accRef = useRef(0);

  const [ref, width] = useWidth<HTMLDivElement>(560);
  const height = 260;
  const mg = { top: 24, right: 12, bottom: 38, left: 12 };
  const x = useMemo(() => scaleLinear().domain(domain).range([mg.left, width - mg.right]), [domain, width, mg.left, mg.right]);
  const bw = (domain[1] - domain[0]) / BINS;

  const reset = useCallback(() => {
    rngRef.current = mulberry32(deriveSeed(seed, 'anim-' + (d?.id ?? '')));
    binsRef.current = new Float64Array(BINS);
    stats.current = { k: 0, sum: 0, sumsq: 0, cover: 0, withV: 0 };
    fallingRef.current = [];
    lastRef.current = null;
    accRef.current = 0;
    setFrame((f) => f + 1);
  }, [seed, d]);

  useEffect(() => {
    reset();
    setPlaying(false);
  }, [reset, domain[0], domain[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  const land = (f: Falling) => {
    if (f.bin >= 0 && f.bin < BINS) binsRef.current[f.bin]++;
  };

  const drawOne = useCallback(
    (now: number) => {
      if (!d) return;
      const s = d.draw(rngRef.current);
      lastRef.current = s;
      const st = stats.current;
      st.k++;
      st.sum += s.est;
      st.sumsq += s.est * s.est;
      if (s.vhat != null) {
        st.withV++;
        if (Math.abs(s.est - pop.Y) <= 1.96 * Math.sqrt(s.vhat)) st.cover++;
      }
      const bin = Math.floor((s.est - domain[0]) / bw);
      const dur = reduced ? 0 : Math.min(650, Math.max(160, 900 / speed));
      const f = { key: keyRef.current++, est: s.est, bin, start: now, dur };
      if (dur === 0 || speed > 40) land(f);
      else fallingRef.current.push(f);
    },
    [d, domain, bw, speed, reduced, pop.Y],
  );

  // Bucle de animación
  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.25, (now - prev) / 1000);
      prev = now;
      if (playing) {
        accRef.current += dt * speed;
        let guard = 0;
        while (accRef.current >= 1 && guard++ < 200) {
          accRef.current -= 1;
          drawOne(now);
        }
      }
      const still: Falling[] = [];
      for (const f of fallingRef.current) {
        if (now - f.start >= f.dur) land(f);
        else still.push(f);
      }
      fallingRef.current = still;
      setFrame((k) => (k + 1) % 1e9);
      if (playing || still.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, drawOne]);

  if (!d) return <p className="text-sm text-muted">Activa al menos un diseño válido.</p>;
  const meta = DESIGNS[d.id];
  const st = stats.current;
  const mean = st.k ? st.sum / st.k : NaN;
  const sd = st.k > 1 ? Math.sqrt((st.sumsq - st.k * mean * mean) / (st.k - 1)) : NaN;
  const ymax = Math.max(4, ...binsRef.current) * 1.15;
  const y = scaleLinear().domain([0, ymax]).range([height - mg.bottom, mg.top]);
  const last = lastRef.current;
  const counts = new Map<number, number>();
  last?.units.forEach((i) => counts.set(i, (counts.get(i) ?? 0) + 1));
  const now = performance.now();
  const px = (width - mg.left - mg.right) / BINS;
  const lastBin = last ? Math.floor((last.est - domain[0]) / bw) : -1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Diseño</p>
          <div role="radiogroup" aria-label="Diseño a animar" className="flex flex-wrap gap-1.5">
            {available.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={id === d.id}
                onClick={() => setDesign(id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  id === d.id ? 'border-transparent bg-ink text-surface' : 'border-line text-ink-2 hover:text-ink'
                }`}
              >
                <Swatch color={DESIGNS[id].color} />
                {DESIGNS[id].corto}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" label={playing ? 'Pausa' : 'Reproducir'} onClick={() => setPlaying((p) => !p)} className="w-28">
            <Icon name={playing ? 'pause' : 'play'} />
            {playing ? 'Pausa' : 'Reproducir'}
          </Button>
          <Button label="Extraer una muestra" onClick={() => drawOne(performance.now())} disabled={playing}>
            <Icon name="step" />
            Paso
          </Button>
          <Button label="Reiniciar" variant="ghost" onClick={reset}>
            <Icon name="reset" />
          </Button>
        </div>
      </div>
      <div className="max-w-md">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Velocidad (muestras por segundo)</p>
        <Slider
          label="Velocidad en muestras por segundo"
          value={Math.round(Math.log2(speed) * 2)}
          min={0}
          max={14}
          onChange={(v) => setSpeed(Math.round(2 ** (v / 2) * 10) / 10)}
          format={() => (speed >= 10 ? fmtInt(speed) : String(speed).replace(',', '.'))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(240px,320px)_1fr]">
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Muestra extraída</p>
          <NayaritMap
            units={pop.units}
            ariaLabel="Mapa de Nayarit con los municipios de la última muestra resaltados"
            counts={counts}
            fills={(_, i) => (counts.has(i) ? meta.color : 'var(--surface-2)')}
          />
          <p className="mt-1 text-[11px] text-muted">
            Límites municipales de 1980 (Bahía de Banderas se fusiona con Compostela). Se omiten las Islas Marías.
          </p>
        </div>

        <div className="min-w-0 space-y-3">
          <div ref={ref} className="relative w-full rounded-xl border border-line bg-surface">
            <svg width={width} height={height} role="img" aria-label={`Histograma en construcción de Ŷ para ${meta.nombre}`}>
              {Array.from(binsRef.current).map((c, b) =>
                c > 0 ? (
                  <rect
                    key={b}
                    x={x(domain[0] + b * bw) + 1}
                    width={Math.max(px - 2, 1)}
                    y={y(c)}
                    height={y(0) - y(c)}
                    rx={Math.min(3, px / 4)}
                    fill={meta.color}
                    fillOpacity={b === lastBin ? 1 : 0.55}
                  />
                ) : null,
              )}
              {fallingRef.current.map((f) => {
                const t = Math.min(1, (now - f.start) / f.dur);
                const e = t * t; // caída acelerada
                const target = f.bin >= 0 && f.bin < BINS ? y(binsRef.current[f.bin] + 0.5) : y(0);
                const cy = mg.top + (target - mg.top) * e;
                return (
                  <circle key={f.key} cx={x(f.est)} cy={cy} r={5} fill={meta.color} stroke="var(--surface)" strokeWidth={2} />
                );
              })}
              {Number.isFinite(mean) && (
                <g>
                  <line x1={x(mean)} x2={x(mean)} y1={mg.top} y2={height - mg.bottom} stroke={meta.color} strokeWidth={2} />
                  <text
                    x={x(mean)}
                    y={mg.top - 8}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    style={{ fill: 'var(--ink-2)' }}
                  >
                    media de Ŷ
                  </text>
                </g>
              )}
              <TruthLine x={x(pop.Y)} top={mg.top} bottom={height - mg.bottom} Y={pop.Y} />
              <XAxis scale={x} y={height - mg.bottom} ticks={width < 500 ? 3 : 7} />
            </svg>
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Muestras', fmtInt(st.k)],
              ['Media de Ŷ', fmtInt(mean)],
              ['DE de Ŷ', fmtInt(sd)],
              ['DE teórica', fmtInt(Math.sqrt(d.theoreticalVar)) + (d.id === 'razon' ? ' (aprox.)' : '')],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-surface-2 px-3 py-2">
                <dt className="text-[11px] text-muted">{k}</dt>
                <dd className="tabular text-[15px] font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="rounded-xl border border-line bg-surface p-3" aria-live="polite">
            {last ? (
              <>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Última muestra</p>
                <ul className="mb-2 flex flex-wrap gap-1.5">
                  {[...counts.entries()]
                    .sort((a, b) => pop.x[b[0]] - pop.x[a[0]])
                    .map(([i, c]) => (
                      <li key={i} className="tabular rounded-md bg-surface-2 px-2 py-1 text-xs text-ink-2">
                        <span className="font-medium text-ink">{pop.units[i].nombre}</span>
                        {c > 1 && <span className="font-bold text-ink"> ×{c}</span>} · y = {fmtInt(pop.y[i])}
                      </li>
                    ))}
                </ul>
                <p className="tabular font-mono text-[12.5px] leading-relaxed text-ink">{explain(d, last, pop)}</p>
                <p className="tabular mt-1 text-xs text-muted">
                  Error: {fmtInt(last.est - pop.Y)} ·{' '}
                  {last.vhat != null
                    ? `IC 95 %: ${fmtInt(last.est - 1.96 * Math.sqrt(last.vhat))} a ${fmtInt(last.est + 1.96 * Math.sqrt(last.vhat))}`
                    : 'V̂ no disponible con esta muestra'}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">
                Presiona <strong className="text-ink">Reproducir</strong> o <strong className="text-ink">Paso</strong> para
                extraer muestras. Cada punto cae en el histograma, que poco a poco toma la forma de la distribución en el
                muestreo.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

