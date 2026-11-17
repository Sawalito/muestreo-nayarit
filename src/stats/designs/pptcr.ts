import { multisetCount } from '../combinatorics';
import type { Population } from '../population';
import { cumulative, drawFromCumulative } from '../rng';
import { finiteOrNull, invalid, type PreparedDesign } from './types';

/**
 * PPT con reemplazo, estimador de Hansen–Hurwitz (formulario p. 4, "PPT CR"):
 *   p_i = M_i/M_T (M = población 1970),  z_i = y_i/p_i
 *   Ŷ_T = (1/n) Σ z_j = z̄
 *   V(Ŷ_T) = (1/n) Σ_{i=1}^N p_i (Y_i/p_i − Y_T)²
 *   V̂(Ŷ_T) = Σ (z_j − Ŷ_T)² / (n(n−1)) = s_z²/n
 */
export function pptProbabilities(sizes: ArrayLike<number>): Float64Array {
  let M = 0;
  for (let i = 0; i < sizes.length; i++) M += sizes[i];
  const p = new Float64Array(sizes.length);
  for (let i = 0; i < sizes.length; i++) p[i] = sizes[i] / M;
  return p;
}

export function pptTheoreticalVar(p: ArrayLike<number>, y: ArrayLike<number>, n: number): number {
  let Y = 0;
  for (let i = 0; i < y.length; i++) Y += y[i];
  let s = 0;
  for (let i = 0; i < y.length; i++) s += p[i] * (y[i] / p[i] - Y) ** 2;
  return s / n;
}

/** Ŷ y V̂ a partir de los z_j de la muestra. */
export function hhFromZ(zs: ArrayLike<number>): { est: number; vhat: number } {
  const n = zs.length;
  let s = 0;
  for (let i = 0; i < n; i++) s += zs[i];
  const est = s / n;
  if (n < 2) return { est, vhat: NaN };
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (zs[i] - est) ** 2;
  return { est, vhat: ss / (n * (n - 1)) };
}

export function preparePptCr(pop: Population, n: number): PreparedDesign {
  const { N, x, y } = pop;
  if (n < 1) return invalid('pptcr', n, N, 'n debe ser al menos 1');
  const p = pptProbabilities(x);
  const z = new Float64Array(N);
  for (let i = 0; i < N; i++) z[i] = y[i] / p[i];
  const cum = cumulative(p);
  const inclusion = new Float64Array(N);
  for (let i = 0; i < N; i++) inclusion[i] = 1 - (1 - p[i]) ** n;

  return {
    id: 'pptcr',
    n,
    valid: true,
    theoreticalVar: pptTheoreticalVar(p, y, n),
    exactSize: multisetCount(N, n),
    inclusion,
    enumerate(cb) {
      // Multiconjuntos (secuencias no decrecientes) con probabilidad multinomial
      // n!/Π m_i! · Π p_i^{m_i}, construida paso a paso: al agregar la k-ésima
      // extracción (unidad i, que queda con multiplicidad m) se multiplica por p_i·k/m.
      const zs = new Float64Array(n);
      const rec = (start: number, depth: number, prob: number, prev: number, mult: number) => {
        if (depth === n) {
          const r = hhFromZ(zs);
          cb(r.est, r.vhat, prob);
          return;
        }
        for (let i = start; i < N; i++) {
          const m = i === prev ? mult + 1 : 1;
          zs[depth] = z[i];
          rec(i, depth + 1, (prob * p[i] * (depth + 1)) / m, i, m);
        }
      };
      rec(0, 0, 1, -1, 0);
    },
    draw(rng) {
      const units: number[] = new Array(n);
      const zs = new Float64Array(n);
      for (let k = 0; k < n; k++) {
        units[k] = drawFromCumulative(cum, rng);
        zs[k] = z[units[k]];
      }
      const r = hhFromZ(zs);
      return { units, est: r.est, vhat: finiteOrNull(r.vhat) };
    },
  };
}
