export interface Unit {
  clave: string;
  nombre: string;
  /** Población 1970 (variable auxiliar / medida de tamaño) */
  x: number;
  /** Población 1980 (variable de interés) */
  y: number;
}

export interface Population {
  units: Unit[];
  N: number;
  /** Total de la variable auxiliar X_T */
  X: number;
  /** Total poblacional Y_T (lo que se estima) */
  Y: number;
  x: Float64Array;
  y: Float64Array;
  /** Índice de Tepic (o -1 si no existe) */
  tepic: number;
}

export function makePopulation(units: Unit[], certaintyName = 'Tepic'): Population {
  const x = Float64Array.from(units.map((u) => u.x));
  const y = Float64Array.from(units.map((u) => u.y));
  let tepic = units.findIndex((u) => u.nombre === certaintyName);
  if (tepic < 0) {
    // Respaldo: la unidad más grande en x
    tepic = 0;
    for (let i = 1; i < units.length; i++) if (x[i] > x[tepic]) tepic = i;
  }
  return { units, N: units.length, X: sum(x), Y: sum(y), x, y, tepic };
}

export function sum(a: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s;
}

export function mean(a: ArrayLike<number>): number {
  return sum(a) / a.length;
}

/** Cuasivarianza S² = Σ(a−ā)²/(n−1) (formulario p. 1). */
export function variance(a: ArrayLike<number>): number {
  const n = a.length;
  if (n < 2) return NaN;
  const m = mean(a);
  let s = 0;
  for (let i = 0; i < n; i++) s += (a[i] - m) ** 2;
  return s / (n - 1);
}

export function covariance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = a.length;
  const ma = mean(a);
  const mb = mean(b);
  let s = 0;
  for (let i = 0; i < n; i++) s += (a[i] - ma) * (b[i] - mb);
  return s / (n - 1);
}

export function correlation(a: ArrayLike<number>, b: ArrayLike<number>): number {
  return covariance(a, b) / Math.sqrt(variance(a) * variance(b));
}

/** S_R² = Σ(Y_i − R X_i)²/(N−1) (formulario p. 1 y 3). */
export function ratioResidualVariance(x: ArrayLike<number>, y: ArrayLike<number>, R: number): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += (y[i] - R * x[i]) ** 2;
  return s / (x.length - 1);
}

export function pick(a: ArrayLike<number>, idx: ArrayLike<number>): Float64Array {
  const out = new Float64Array(idx.length);
  for (let i = 0; i < idx.length; i++) out[i] = a[idx[i]];
  return out;
}
