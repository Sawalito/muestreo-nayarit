import { scaleLinear } from 'd3';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DESIGNS } from '../lib/designs';
import { fmt3, fmtInt } from '../lib/format';
import { usePrefersReducedMotion, useWidth } from '../lib/hooks';
import { easeInQuad } from '../lib/motion';
import type { Draw, DesignId, PreparedDesign } from '../stats/designs/types';
import type { Population } from '../stats/population';
import { deriveSeed, mulberry32, type Rng } from '../stats/rng';
import { TruthLine, XAxis } from './chartParts';
import { NayaritMap } from './NayaritMap';
import { DesignChip, Icon, IconButton, Slider } from './ui';

const BINS = 56;

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
      return `R̂ = ȳ/x̄ = ${fmt3(ybar / xbar)}   ⇒   Ŷ = X·R̂ = ${fmtInt(pop.X)} × ${fmt3(ybar / xbar)} = ${fmtInt(draw.est)}`;
    }
    case 'pptcr':
      return `Ŷ = z̄ = (1/n) Σ yⱼ/pⱼ = ${fmtInt(draw.est)}`;
    case 'pptsr':
      return `Ŷ = Σ yᵢ/πᵢ = ${fmtInt(draw.est)}`;
    case 'tepic': {
      const rest = draw.units.filter((i) => i !== pop.tepic).map((i) => pop.y[i]);
      const m = rest.reduce((a, b) => a + b, 0) / rest.length;
      return `Ŷ = Y_Tepic + (N−1)·ȳ_resto = ${fmtInt(pop.y[pop.tepic])} + ${pop.N - 1} × ${fmtInt(m)} = ${fmtInt(draw.est)}`;
    }
    case 'estrat':
      return `Ŷ = Σ N_h·ȳ_h = ${fmtInt(draw.est)}`;
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
  const [speed, setSpeed] = useState(4);
  const [, setFrame] = useState(0);

  const rngRef = useRef<Rng>(mulberry32(1));
  const binsRef = useRef(new Float64Array(BINS));
  const stats = useRef({ k: 0, sum: 0, sumsq: 0 });
  const fallingRef = useRef<Falling[]>([]);
  const lastRef = useRef<Draw | null>(null);
  const keyRef = useRef(0);
  const accRef = useRef(0);

  const [ref, width] = useWidth<HTMLDivElement>(560);
  const height = width < 520 ? 260 : 320;
  const mg = { top: 30, right: 6, bottom: 42, left: 6 };
  const x = useMemo(() => scaleLinear().domain(domain).range([mg.left, width - mg.right]), [domain, width, mg.left, mg.right]);
  const bw = (domain[1] - domain[0]) / BINS;

  const reset = useCallback(() => {
    rngRef.current = mulberry32(deriveSeed(seed, 'anim-' + (d?.id ?? '')));
    binsRef.current = new Float64Array(BINS);
    stats.current = { k: 0, sum: 0, sumsq: 0 };
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
      const bin = Math.floor((s.est - domain[0]) / bw);
      const dur = reduced ? 0 : Math.min(900, Math.max(180, 1100 / speed));
      const f = { key: keyRef.current++, est: s.est, bin, start: now, dur };
      if (dur === 0 || speed > 40) land(f);
      else fallingRef.current.push(f);
    },
    [d, domain, bw, speed, reduced],
  );

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
  const sd = st.k > 1 ? Math.sqrt(Math.max(0, st.sumsq - st.k * mean * mean) / (st.k - 1)) : NaN;
  const ymax = Math.max(5, ...binsRef.current) * 1.12;
  const y = scaleLinear().domain([0, ymax]).range([height - mg.bottom, mg.top]);
  const last = lastRef.current;
  const counts = new Map<number, number>();
  last?.units.forEach((i) => counts.set(i, (counts.get(i) ?? 0) + 1));
  const now = performance.now();
  const px = (width - mg.left - mg.right) / BINS;
  const lastBin = last ? Math.floor((last.est - domain[0]) / bw) : -1;

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-center justify-between gap-x-10 gap-y-6">
        <div role="radiogroup" aria-label="Diseño a animar" className="flex flex-wrap gap-x-6 gap-y-2">
          {available.map((id) => (
            <DesignChip key={id} role="radio" color={DESIGNS[id].color} label={DESIGNS[id].corto} on={id === d.id} onClick={() => setDesign(id)} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <IconButton primary label={playing ? 'Pausa' : 'Reproducir'} onClick={() => setPlaying((p) => !p)} className="w-32">
            <Icon name={playing ? 'pause' : 'play'} />
            {playing ? 'Pausa' : 'Reproducir'}
          </IconButton>
          <IconButton label="Extraer una muestra" onClick={() => drawOne(performance.now())} disabled={playing}>
            <Icon name="step" />
            Paso
          </IconButton>
          <IconButton label="Reiniciar" onClick={reset} className="w-10 !px-0">
            <Icon name="reset" />
          </IconButton>
          <div className="flex w-52 items-center gap-2">
            <span className="label shrink-0">Velocidad</span>
            <Slider
              label="Velocidad en muestras por segundo"
              value={Math.round(Math.log2(speed) * 2)}
              min={0}
              max={14}
              onChange={(v) => setSpeed(Math.round(2 ** (v / 2) * 10) / 10)}
              format={() => `${speed >= 10 ? Math.round(speed) : speed}/s`}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-12 lg:grid-cols-[minmax(240px,340px)_1fr]">
        <div>
          <p className="label mb-3">Muestra extraída</p>
          <NayaritMap
            units={pop.units}
            ariaLabel="Mapa de Nayarit con los municipios de la última muestra resaltados"
            counts={counts}
            highlight={meta.color}
            fills={(_, i) => (counts.has(i) ? meta.color : 'var(--raise)')}
          />
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            Municipios de 1980: Bahía de Banderas aparece unido a Compostela. No se muestran las Islas Marías.
          </p>
        </div>

        <div className="min-w-0">
          <div ref={ref} className="relative w-full">
            <svg width={width} height={height} role="img" aria-label={`Histograma en construcción de Ŷ para ${meta.nombre}`} className="overflow-visible">
              {Array.from(binsRef.current).map((c, b) =>
                c > 0 ? (
                  <rect
                    key={b}
                    x={x(domain[0] + b * bw) + 0.75}
                    width={Math.max(px - 1.5, 1)}
                    y={y(c)}
                    height={y(0) - y(c)}
                    rx={Math.min(2, px / 4)}
                    fill={meta.color}
                    fillOpacity={b === lastBin ? 0.95 : 0.38}
                    style={{ transition: 'y 220ms ease, height 220ms ease, fill-opacity 600ms ease' }}
                  />
                ) : null,
              )}
              {fallingRef.current.map((f) => {
                const t = Math.min(1, (now - f.start) / f.dur);
                const e = easeInQuad(t);
                const target = f.bin >= 0 && f.bin < BINS ? y(binsRef.current[f.bin] + 0.5) : y(0);
                const cy = mg.top - 10 + (target - mg.top + 10) * e;
                return (
                  <g key={f.key} style={{ color: meta.color }} className="glow">
                    <line x1={x(f.est)} x2={x(f.est)} y1={Math.max(mg.top - 10, cy - 26 * e)} y2={cy} stroke={meta.color} strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" />
                    <circle cx={x(f.est)} cy={cy} r={4.5} fill={meta.color} />
                  </g>
                );
              })}
              {Number.isFinite(mean) && (
                <g style={{ transition: 'transform 300ms ease' }}>
                  <line x1={x(mean)} x2={x(mean)} y1={mg.top} y2={height - mg.bottom} stroke={meta.color} strokeWidth={1.5} />
                  <text x={x(mean)} y={mg.top - 14} textAnchor="middle" style={{ fill: 'var(--ink-2)', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 14 }}>
                    promedio de Ŷ
                  </text>
                </g>
              )}
              <TruthLine x={x(pop.Y)} top={mg.top} bottom={height - mg.bottom} Y={pop.Y} />
              <XAxis scale={x} y={height - mg.bottom} ticks={width < 520 ? 3 : 7} />
            </svg>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
            {[
              ['Muestras', fmtInt(st.k)],
              ['Promedio de Ŷ', fmtInt(mean)],
              ['DE observada', fmtInt(sd)],
              [d.id === 'razon' ? 'DE teórica (aprox.)' : 'DE teórica', fmtInt(Math.sqrt(d.theoreticalVar))],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="label">{k}</dt>
                <dd className="tabular mt-1 font-serif text-[24px] leading-none text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 border-t border-line pt-6" aria-live="polite">
            {last ? (
              <>
                <p className="label mb-3">Última muestra</p>
                <p className="text-[14px] leading-relaxed text-ink-2">
                  {[...counts.entries()]
                    .sort((a, b) => pop.x[b[0]] - pop.x[a[0]])
                    .map(([i, c], k) => (
                      <span key={i}>
                        {k > 0 && <span className="text-faint"> · </span>}
                        <span className="text-ink">{pop.units[i].nombre}</span>
                        {c > 1 && <span className="text-ink"> ×{c}</span>}
                        <span className="tabular text-muted"> {fmtInt(pop.y[i])}</span>
                      </span>
                    ))}
                </p>
                <p className="tabular mt-4 overflow-x-auto whitespace-nowrap font-mono text-[13px] text-ink">{explain(d, last, pop)}</p>
                <p className="tabular mt-2 text-[13px] text-muted">
                  Error {fmtInt(last.est - pop.Y)}
                  {last.vhat != null
                    ? ` · IC 95 %: ${fmtInt(last.est - 1.96 * Math.sqrt(last.vhat))} a ${fmtInt(last.est + 1.96 * Math.sqrt(last.vhat))}`
                    : ' · V̂ no disponible con esta muestra'}
                </p>
              </>
            ) : (
              <p className="font-serif text-[17px] italic leading-relaxed text-muted">
                Presiona «Reproducir». Cada muestra produce un valor de Ŷ que cae al histograma; con muchas muestras, el histograma dibuja
                la distribución en el muestreo.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
