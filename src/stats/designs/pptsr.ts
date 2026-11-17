import { binom, forEachCombination } from '../combinatorics';
import type { Population } from '../population';
import { cumulative, drawFromCumulative } from '../rng';
import { finiteOrNull, invalid, type PreparedDesign } from './types';

/**
 * PPT sin reemplazo con estimador de Horvitz–Thompson.
 * NOTA: este diseño NO está en el formulario del curso; se incluye como extensión.
 *
 * Probabilidades de inclusión π_i = n·x_i/X (las que exceden 1 se fijan en 1 y el
 * resto se reparte de nuevo). La selección usa el método de Sampford, que da
 * exactamente esas π_i:  p(s) ∝ (n' − Σ_{i∈s} π_i) Π_{i∈s} π_i/(1−π_i).
 *
 *   Ŷ_HT = Σ_{i∈s} y_i/π_i
 *   V(Ŷ_HT) = ½ ΣΣ_{i≠j} (π_iπ_j − π_ij)(Y_i/π_i − Y_j/π_j)²         (Sen–Yates–Grundy)
 *   V̂(Ŷ_HT) = ½ ΣΣ_{i≠j∈s} (π_iπ_j − π_ij)/π_ij · (y_i/π_i − y_j/π_j)²
 */
export function inclusionProbabilities(sizes: ArrayLike<number>, n: number): Float64Array {
  const N = sizes.length;
  const pi = new Float64Array(N);
  const certain = new Uint8Array(N);
  for (;;) {
    let rest = 0;
    let k = 0;
    for (let i = 0; i < N; i++) {
      if (certain[i]) k++;
      else rest += sizes[i];
    }
    let changed = false;
    for (let i = 0; i < N; i++) {
      if (certain[i]) {
        pi[i] = 1;
        continue;
      }
      pi[i] = ((n - k) * sizes[i]) / rest;
      if (pi[i] >= 1 - 1e-12) {
        certain[i] = 1;
        changed = true;
      }
    }
    if (!changed) return pi;
  }
}

export const MAX_HT_SAMPLES = 200_000;

export interface SampfordTable {
  /** count × n índices de unidades */
  samples: Int32Array;
  probs: Float64Array;
  count: number;
  /** Matriz N×N de π_ij */
  pij: Float64Array;
}

export function preparePptSr(pop: Population, n: number): PreparedDesign & { sampford?: SampfordTable } {
  const { N, x, y } = pop;
  if (n < 2 || n > N) return invalid('pptsr', n, N, `n debe estar entre 2 y ${N}`);
  const pi = inclusionProbabilities(x, n);
  const certain: number[] = [];
  const free: number[] = [];
  for (let i = 0; i < N; i++) (pi[i] >= 1 - 1e-12 ? certain : free).push(i);
  const m = n - certain.length;
  const count = binom(free.length, m);
  if (count > MAX_HT_SAMPLES) return invalid('pptsr', n, N, 'demasiadas muestras posibles');

  // Enumeración de Sampford sobre las unidades no ciertas.
  const samples = new Int32Array(count * n);
  const probs = new Float64Array(count);
  const odds = free.map((i) => pi[i] / (1 - pi[i]));
  let s = 0;
  let total = 0;
  forEachCombination(free.length, m, (idx) => {
    let sumPi = 0;
    let prod = 1;
    for (let k = 0; k < m; k++) {
      const u = free[idx[k]];
      sumPi += pi[u];
      prod *= odds[idx[k]];
      samples[s * n + k] = u;
    }
    for (let k = 0; k < certain.length; k++) samples[s * n + m + k] = certain[k];
    const w = m === 0 ? 1 : (m - sumPi) * prod;
    probs[s] = w;
    total += w;
    s++;
  });
  for (let i = 0; i < count; i++) probs[i] /= total;

  // Probabilidades de inclusión conjuntas π_ij (exactas, por enumeración).
  const pij = new Float64Array(N * N);
  for (let t = 0; t < count; t++) {
    const p = probs[t];
    const off = t * n;
    for (let a = 0; a < n; a++) {
      const i = samples[off + a];
      for (let b = a + 1; b < n; b++) {
        const j = samples[off + b];
        pij[i * N + j] += p;
        pij[j * N + i] += p;
      }
    }
  }

  let V = 0;
  for (let i = 0; i < N; i++)
    for (let j = i + 1; j < N; j++) V += (pi[i] * pi[j] - pij[i * N + j]) * (y[i] / pi[i] - y[j] / pi[j]) ** 2;

  const evalSample = (off: number) => {
    let est = 0;
    let vh = 0;
    for (let a = 0; a < n; a++) {
      const i = samples[off + a];
      est += y[i] / pi[i];
      for (let b = a + 1; b < n; b++) {
        const j = samples[off + b];
        const pp = pij[i * N + j];
        vh += ((pi[i] * pi[j] - pp) / pp) * (y[i] / pi[i] - y[j] / pi[j]) ** 2;
      }
    }
    return { est, vhat: vh };
  };

  const cum = cumulative(probs);
  return {
    sampford: { samples, probs, count, pij },
    id: 'pptsr',
    n,
    valid: true,
    theoreticalVar: V,
    exactSize: count,
    inclusion: pi,
    enumerate(cb) {
      for (let t = 0; t < count; t++) {
        const r = evalSample(t * n);
        cb(r.est, r.vhat, probs[t]);
      }
    },
    draw(rng) {
      const t = drawFromCumulative(cum, rng);
      const r = evalSample(t * n);
      return { units: Array.from(samples.subarray(t * n, t * n + n)), est: r.est, vhat: finiteOrNull(r.vhat) };
    },
  };
}
