import { binom, forEachCombination } from '../combinatorics';
import { pick, variance, type Population } from '../population';
import { sampleWOR } from '../rng';
import { finiteOrNull, invalid, type PreparedDesign } from './types';

/**
 * MAS/SR para el total (formulario p. 2):
 *   Ŷ_T = N·ȳ
 *   V(Ŷ_T) = N²(1−n/N)S²/n
 *   V̂(Ŷ_T) = N²(1−n/N)s²/n
 */
export function masEstimate(N: number, ys: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < ys.length; i++) s += ys[i];
  return (N * s) / ys.length;
}

export function masVhat(N: number, ys: ArrayLike<number>): number {
  const n = ys.length;
  if (n < 2) return NaN;
  return (N * N * (1 - n / N) * variance(ys)) / n;
}

export function masTheoreticalVar(N: number, n: number, S2: number): number {
  return (N * N * (1 - n / N) * S2) / n;
}

export function prepareMas(pop: Population, n: number): PreparedDesign {
  const { N, y } = pop;
  if (n < 1 || n > N) return invalid('mas', n, N, `n debe estar entre 1 y ${N}`);
  const total = binom(N, n);
  const ys = new Float64Array(n);
  return {
    id: 'mas',
    n,
    valid: true,
    theoreticalVar: masTheoreticalVar(N, n, variance(y)),
    exactSize: total,
    inclusion: new Float64Array(N).fill(n / N),
    enumerate(cb) {
      const p = 1 / total;
      forEachCombination(N, n, (idx) => {
        for (let k = 0; k < n; k++) ys[k] = y[idx[k]];
        cb(masEstimate(N, ys), masVhat(N, ys), p);
      });
    },
    draw(rng) {
      const units = sampleWOR(N, n, rng);
      const s = pick(y, units);
      return { units, est: masEstimate(N, s), vhat: finiteOrNull(masVhat(N, s)) };
    },
  };
}
