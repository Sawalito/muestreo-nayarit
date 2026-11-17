import type { PreparedDesign } from './designs/types';
import { mulberry32, type Rng } from './rng';

/** Máximo de muestras distintas para enumerar exhaustivamente. */
export const EXACT_LIMIT = 600_000;

/** Distribución en el muestreo: valores del estimador con su probabilidad y su V̂ (NaN si no existe). */
export interface SamplingDistribution {
  est: Float64Array;
  prob: Float64Array;
  vhat: Float64Array;
  exact: boolean;
}

export type Mode = 'exacto' | 'montecarlo';

export function canEnumerate(d: PreparedDesign): boolean {
  return d.valid && d.exactSize > 0 && d.exactSize <= EXACT_LIMIT;
}

export function enumerateDistribution(d: PreparedDesign): SamplingDistribution {
  const size = d.exactSize;
  const est = new Float64Array(size);
  const prob = new Float64Array(size);
  const vhat = new Float64Array(size);
  let k = 0;
  d.enumerate((e, v, p) => {
    est[k] = e;
    vhat[k] = v;
    prob[k] = p;
    k++;
  });
  return { est: est.subarray(0, k), prob: prob.subarray(0, k), vhat: vhat.subarray(0, k), exact: true };
}

export function simulateDistribution(
  d: PreparedDesign,
  reps: number,
  rngOrSeed: Rng | number,
  onProgress?: (done: number) => void,
): SamplingDistribution {
  const rng = typeof rngOrSeed === 'number' ? mulberry32(rngOrSeed) : rngOrSeed;
  const est = new Float64Array(reps);
  const prob = new Float64Array(reps).fill(1 / reps);
  const vhat = new Float64Array(reps);
  for (let r = 0; r < reps; r++) {
    const s = d.draw(rng);
    est[r] = s.est;
    vhat[r] = s.vhat ?? NaN;
    if (onProgress && (r & 4095) === 4095) onProgress(r + 1);
  }
  return { est, prob, vhat, exact: false };
}

export function samplingDistribution(
  d: PreparedDesign,
  mode: Mode,
  reps: number,
  seed: number,
  onProgress?: (done: number) => void,
): SamplingDistribution {
  if (mode === 'exacto' && canEnumerate(d)) return enumerateDistribution(d);
  return simulateDistribution(d, reps, seed, onProgress);
}
