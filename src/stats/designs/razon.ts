import { binom, forEachCombination } from '../combinatorics';
import { ratioResidualVariance, type Population } from '../population';
import { sampleWOR } from '../rng';
import { finiteOrNull, invalid, type PreparedDesign } from './types';

/**
 * Estimador de razón del total bajo MAS/SR (formulario p. 3):
 *   Ŷ_T = X_T · ȳ/x̄ = X_T · R̂
 *   V(Ŷ_T) ≈ N²(1−n/N) S_R²/n,   S_R² = Σ(Y_i − R X_i)²/(N−1)
 *   V̂(Ŷ_T) ≈ N²(1−n/N) s_R²/n,   s_R² = Σ(y_i − R̂ x_i)²/(n−1)
 */
export function ratioEstimate(X: number, xs: ArrayLike<number>, ys: ArrayLike<number>) {
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < xs.length; i++) {
    sx += xs[i];
    sy += ys[i];
  }
  const Rhat = sy / sx;
  return { Rhat, est: X * Rhat };
}

export function ratioVhat(N: number, xs: ArrayLike<number>, ys: ArrayLike<number>, Rhat: number): number {
  const n = xs.length;
  if (n < 2) return NaN;
  return (N * N * (1 - n / N) * ratioResidualVariance(xs, ys, Rhat)) / n;
}

export function prepareRazon(pop: Population, n: number): PreparedDesign {
  const { N, x, y, X, Y } = pop;
  if (n < 1 || n > N) return invalid('razon', n, N, `n debe estar entre 1 y ${N}`);
  const R = Y / X;
  const SR2 = ratioResidualVariance(x, y, R);
  const total = binom(N, n);
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const evalSample = (idx: ArrayLike<number>) => {
    for (let k = 0; k < n; k++) {
      xs[k] = x[idx[k]];
      ys[k] = y[idx[k]];
    }
    const { Rhat, est } = ratioEstimate(X, xs, ys);
    return { est, vhat: ratioVhat(N, xs, ys, Rhat) };
  };
  return {
    id: 'razon',
    n,
    valid: true,
    theoreticalVar: (N * N * (1 - n / N) * SR2) / n,
    exactSize: total,
    inclusion: new Float64Array(N).fill(n / N),
    enumerate(cb) {
      const p = 1 / total;
      forEachCombination(N, n, (idx) => {
        const r = evalSample(idx);
        cb(r.est, r.vhat, p);
      });
    },
    draw(rng) {
      const units = sampleWOR(N, n, rng);
      const r = evalSample(units);
      return { units, est: r.est, vhat: finiteOrNull(r.vhat) };
    },
  };
}
