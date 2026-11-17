import type { SamplingDistribution } from './engine';

export const Z95 = 1.96;

export interface Metrics {
  /** E(Ŷ) */
  mean: number;
  bias: number;
  relBias: number;
  variance: number;
  sd: number;
  mse: number;
  /** CV(Ŷ) = √V(Ŷ)/E(Ŷ) (formulario p. 1) */
  cv: number;
  /** Varianza teórica del formulario */
  theoreticalVar: number;
  /** ECM obtenido / V teórica (en insesgados ECM = V) */
  varRatio: number;
  /** ECM(MAS/SR) / ECM(diseño) */
  efficiency: number;
  /** Proporción de intervalos Ŷ ± 1.96√V̂ que cubren a Y */
  coverage: number;
  /** Proporción (en probabilidad) de muestras donde V̂ existe */
  vhatAvailable: number;
  /** E(V̂) sobre las muestras donde existe */
  meanVhat: number;
  min: number;
  max: number;
  exact: boolean;
  /** Número de muestras (distintas si es exacta, réplicas si es Monte Carlo) */
  count: number;
}

export function summarize(
  dist: SamplingDistribution,
  Y: number,
  theoreticalVar: number,
  mseMas: number,
): Metrics {
  const { est, prob, vhat } = dist;
  let P = 0;
  let m = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < est.length; i++) {
    P += prob[i];
    m += prob[i] * est[i];
    if (est[i] < min) min = est[i];
    if (est[i] > max) max = est[i];
  }
  m /= P;
  let v = 0;
  let cov = 0;
  let pv = 0;
  let mv = 0;
  for (let i = 0; i < est.length; i++) {
    const p = prob[i] / P;
    v += p * (est[i] - m) ** 2;
    const vh = vhat[i];
    if (Number.isFinite(vh)) {
      pv += p;
      mv += p * vh;
      if (Math.abs(est[i] - Y) <= Z95 * Math.sqrt(Math.max(vh, 0))) cov += p;
    }
  }
  const bias = m - Y;
  const mse = v + bias * bias;
  const sd = Math.sqrt(v);
  return {
    mean: m,
    bias,
    relBias: bias / Y,
    variance: v,
    sd,
    mse,
    cv: sd / m,
    theoreticalVar,
    varRatio: mse / theoreticalVar,
    efficiency: mseMas / mse,
    coverage: pv > 0 ? cov / pv : NaN,
    vhatAvailable: pv,
    meanVhat: pv > 0 ? mv / pv : NaN,
    min,
    max,
    exact: dist.exact,
    count: est.length,
  };
}

/** Cuantil ponderado (valores y probabilidades no ordenados). */
export function weightedQuantiles(est: Float64Array, prob: Float64Array, qs: number[]): number[] {
  const order = Array.from(est.keys()).sort((a, b) => est[a] - est[b]);
  let P = 0;
  for (let i = 0; i < prob.length; i++) P += prob[i];
  const out: number[] = [];
  let c = 0;
  let k = 0;
  for (const q of [...qs].sort((a, b) => a - b)) {
    while (k < order.length - 1 && (c + prob[order[k]]) / P < q) c += prob[order[k++]];
    out.push(est[order[k]]);
  }
  return out;
}

/** Histograma ponderado sobre [lo, hi) con `bins` cubetas; devuelve densidades (área = masa en el rango). */
export function weightedHistogram(
  est: Float64Array,
  prob: Float64Array,
  lo: number,
  hi: number,
  bins: number,
): Float64Array {
  const h = new Float64Array(bins);
  const w = (hi - lo) / bins;
  let P = 0;
  for (let i = 0; i < est.length; i++) {
    P += prob[i];
    const b = Math.floor((est[i] - lo) / w);
    if (b >= 0 && b < bins) h[b] += prob[i];
    else if (est[i] === hi) h[bins - 1] += prob[i];
  }
  for (let b = 0; b < bins; b++) h[b] /= P * w;
  return h;
}

/** Suavizado gaussiano de un histograma (para dibujar curvas de densidad). */
export function smooth(h: Float64Array, sigmaBins: number): Float64Array {
  if (sigmaBins <= 0) return h;
  const r = Math.ceil(3 * sigmaBins);
  const k: number[] = [];
  for (let i = -r; i <= r; i++) k.push(Math.exp(-(i * i) / (2 * sigmaBins * sigmaBins)));
  const out = new Float64Array(h.length);
  for (let i = 0; i < h.length; i++) {
    let s = 0;
    let ws = 0;
    for (let j = -r; j <= r; j++) {
      const t = i + j;
      if (t < 0 || t >= h.length) continue;
      s += h[t] * k[j + r];
      ws += k[j + r];
    }
    out[i] = s / ws;
  }
  return out;
}
