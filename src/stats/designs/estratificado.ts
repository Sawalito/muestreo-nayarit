import { binom, forEachCombination } from '../combinatorics';
import { pick, variance, type Population } from '../population';
import { sampleWOR } from '../rng';
import { masEstimate, masTheoreticalVar, masVhat } from './mas';
import { invalid, type Allocation, type CutMethod, type DesignId, type PreparedDesign, type StratOptions } from './types';

/**
 * Muestreo estratificado con MAS/SR en cada estrato (formulario p. 6):
 *   Ŷ_T = Σ_h Ŷ_Th = Σ_h N_h ȳ_h
 *   V(Ŷ_T) = Σ_h N_h²(1−n_h/N_h) S_h²/n_h
 *   V̂(Ŷ_T) = Σ_h N_h²(1−n_h/N_h) s_h²/n_h
 * Afijación: proporcional n_h = n N_h/N; Neyman n_h = n N_h S_h / Σ N_k S_k; igual n_h = n/L.
 */
export interface Stratum {
  nombre: string;
  units: number[];
  certeza: boolean;
}

/** Cortes por tamaño (x₁₉₇₀) de las unidades `idx` en L estratos. */
export function sizeStrata(x: ArrayLike<number>, idx: number[], L: number, method: CutMethod): number[][] {
  const sorted = [...idx].sort((a, b) => x[a] - x[b]);
  const M = sorted.length;
  if (method === 'cuantiles') {
    const groups: number[][] = [];
    for (let h = 0; h < L; h++) {
      const a = Math.round((h * M) / L);
      const b = Math.round(((h + 1) * M) / L);
      groups.push(sorted.slice(a, b));
    }
    return groups;
  }
  // Regla de la raíz de la frecuencia acumulada (Dalenius–Hodges) con K clases de igual amplitud.
  const K = 10;
  const lo = x[sorted[0]];
  const hi = x[sorted[M - 1]];
  const w = (hi - lo) / K || 1;
  const cls = (v: number) => Math.min(K - 1, Math.floor((v - lo) / w));
  const f = new Array(K).fill(0);
  for (const i of sorted) f[cls(x[i])]++;
  const cum: number[] = [];
  let c = 0;
  for (let k = 0; k < K; k++) cum.push((c += Math.sqrt(f[k])));
  const bounds: number[] = []; // índice de la última clase de cada estrato (excepto el último)
  for (let h = 1; h < L; h++) {
    const target = (h * c) / L;
    let best = 0;
    for (let k = 0; k < K - 1; k++) if (Math.abs(cum[k] - target) < Math.abs(cum[best] - target)) best = k;
    bounds.push(best);
  }
  const groups: number[][] = Array.from({ length: L }, () => []);
  for (const i of sorted) {
    const k = cls(x[i]);
    let h = 0;
    while (h < bounds.length && k > bounds[h]) h++;
    groups[h].push(i);
  }
  // Si algún estrato queda con menos de 2 unidades, se recurre a cuantiles.
  if (groups.some((g) => g.length < 2) || new Set(bounds).size !== bounds.length) {
    return sizeStrata(x, idx, L, 'cuantiles');
  }
  return groups;
}

export function buildStrata(pop: Population, opts: Pick<StratOptions, 'L' | 'cuts'>): Stratum[] {
  const rest = pop.units.map((_, i) => i).filter((i) => i !== pop.tepic);
  const groups = sizeStrata(pop.x, rest, opts.L, opts.cuts);
  const nombres = opts.L === 2 ? ['Chicos', 'Grandes'] : ['Chicos', 'Medianos', 'Grandes'];
  return [
    { nombre: pop.units[pop.tepic].nombre, units: [pop.tepic], certeza: true },
    ...groups.map((g, h) => ({ nombre: nombres[h], units: g, certeza: false })),
  ];
}

/**
 * Reparte m unidades entre estratos con pesos w_h, respetando lo ≤ n_h ≤ N_h y Σn_h = m.
 * Se parte de n_h = lo y se asigna una unidad a la vez al estrato más alejado de su meta m·w_h/Σw.
 */
export function allocate(sizes: number[], weights: number[], m: number, lo: number): number[] {
  const L = sizes.length;
  const W = weights.reduce((a, b) => a + b, 0);
  const target = weights.map((w) => (m * w) / W);
  const nh = sizes.map((N) => Math.min(lo, N));
  let left = m - nh.reduce((a, b) => a + b, 0);
  while (left > 0) {
    let best = -1;
    for (let h = 0; h < L; h++) {
      if (nh[h] >= sizes[h]) continue;
      if (best < 0 || target[h] - nh[h] > target[best] - nh[best]) best = h;
    }
    if (best < 0) break;
    nh[best]++;
    left--;
  }
  return nh;
}

export function allocationWeights(pop: Population, strata: Stratum[], method: Allocation): number[] {
  return strata.map((s) => {
    if (method === 'igual') return 1;
    if (method === 'proporcional') return s.units.length;
    // Neyman con S_h de x₁₉₇₀ como aproximación de S_h de y.
    const Sh = Math.sqrt(variance(pick(pop.x, s.units)));
    return s.units.length * (Number.isFinite(Sh) ? Sh : 0);
  });
}

/** Tamaños de muestra por estrato: Tepic (certeza) lleva 1 y el resto, n−1, se reparte. */
export function stratumSizes(pop: Population, strata: Stratum[], n: number, method: Allocation): number[] {
  const free = strata.filter((s) => !s.certeza);
  const fixed = strata.filter((s) => s.certeza).reduce((a, s) => a + s.units.length, 0);
  const m = n - fixed;
  const lo = m >= 2 * free.length ? 2 : 1;
  const nh = allocate(
    free.map((s) => s.units.length),
    allocationWeights(pop, free, method),
    m,
    lo,
  );
  let k = 0;
  return strata.map((s) => (s.certeza ? s.units.length : nh[k++]));
}

/** Núcleo genérico: estratos con MAS/SR independiente de tamaño n_h en cada uno. */
export function prepareStratified(
  id: DesignId,
  pop: Population,
  strata: Stratum[],
  nh: number[],
): PreparedDesign {
  const { N, y } = pop;
  const n = nh.reduce((a, b) => a + b, 0);
  for (let h = 0; h < strata.length; h++)
    if (nh[h] < 1 || nh[h] > strata[h].units.length)
      return invalid(id, n, N, `n_h fuera de rango en el estrato ${strata[h].nombre}`);

  let V = 0;
  const inclusion = new Float64Array(N);
  let exactSize = 1;
  for (let h = 0; h < strata.length; h++) {
    const s = strata[h];
    const Nh = s.units.length;
    const yh = pick(y, s.units);
    if (Nh > 1) V += masTheoreticalVar(Nh, nh[h], variance(yh));
    for (const i of s.units) inclusion[i] = nh[h] / Nh;
    exactSize *= binom(Nh, nh[h]);
  }

  /** V̂ del estrato: 0 si se censa (n_h = N_h), NaN si n_h = 1 < N_h. */
  const vhatStratum = (Nh: number, ys: Float64Array) => (ys.length === Nh ? 0 : masVhat(Nh, ys));

  return {
    id,
    n,
    valid: true,
    theoreticalVar: V,
    exactSize,
    inclusion,
    enumerate(cb) {
      // Se enumera cada estrato por separado y luego el producto cartesiano.
      const per = strata.map((s, h) => {
        const Nh = s.units.length;
        const ests: number[] = [];
        const vhs: number[] = [];
        const ys = new Float64Array(nh[h]);
        forEachCombination(Nh, nh[h], (idx) => {
          for (let k = 0; k < nh[h]; k++) ys[k] = y[s.units[idx[k]]];
          ests.push(masEstimate(Nh, ys));
          vhs.push(vhatStratum(Nh, ys));
        });
        return { ests, vhs, p: 1 / ests.length };
      });
      const rec = (h: number, est: number, vh: number, p: number) => {
        if (h === per.length) {
          cb(est, vh, p);
          return;
        }
        const t = per[h];
        for (let k = 0; k < t.ests.length; k++) rec(h + 1, est + t.ests[k], vh + t.vhs[k], p * t.p);
      };
      rec(0, 0, 0, 1);
    },
    draw(rng) {
      const units: number[] = [];
      let est = 0;
      let vh = 0;
      for (let h = 0; h < strata.length; h++) {
        const s = strata[h];
        const Nh = s.units.length;
        const pickIdx = sampleWOR(Nh, nh[h], rng).map((k) => s.units[k]);
        units.push(...pickIdx);
        const ys = pick(y, pickIdx);
        est += masEstimate(Nh, ys);
        vh += vhatStratum(Nh, ys);
      }
      return { units, est, vhat: Number.isFinite(vh) ? vh : null };
    },
  };
}

export function prepareEstratificado(pop: Population, n: number, opts: StratOptions): PreparedDesign {
  const strata = buildStrata(pop, opts);
  const free = strata.length - 1;
  if (n < free + 1)
    return invalid('estrat', n, pop.N, `n debe ser al menos ${free + 1} (Tepic + 1 por estrato)`);
  return prepareStratified('estrat', pop, strata, stratumSizes(pop, strata, n, opts.allocation));
}
