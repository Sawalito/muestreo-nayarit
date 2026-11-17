/** Generador mulberry32: rápido, de 32 bits y reproducible con semilla. */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mezcla una semilla con una cadena (para que cada diseño tenga su propio flujo). */
export function deriveSeed(seed: number, label: string): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
  }
  return h >>> 0;
}

/** Muestra aleatoria simple sin reemplazo de tamaño n de {0..N-1} (Fisher–Yates parcial). */
export function sampleWOR(N: number, n: number, rng: Rng, scratch?: Int32Array): number[] {
  const a = scratch && scratch.length >= N ? scratch : new Int32Array(N);
  for (let i = 0; i < N; i++) a[i] = i;
  const out: number[] = new Array(n);
  for (let k = 0; k < n; k++) {
    const j = k + Math.floor(rng() * (N - k));
    const t = a[k];
    a[k] = a[j];
    a[j] = t;
    out[k] = a[k];
  }
  return out;
}

/** Tabla acumulada para extraer de una distribución discreta. */
export function cumulative(p: ArrayLike<number>): Float64Array {
  const c = new Float64Array(p.length);
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    s += p[i];
    c[i] = s;
  }
  for (let i = 0; i < c.length; i++) c[i] /= s;
  return c;
}

export function drawFromCumulative(cum: Float64Array, rng: Rng): number {
  const u = rng();
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (cum[mid] > u) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}
