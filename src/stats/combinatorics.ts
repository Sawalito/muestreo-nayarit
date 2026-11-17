export function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** Recorre todas las combinaciones de k elementos de {0..n-1} en orden lexicográfico. */
export function forEachCombination(n: number, k: number, cb: (idx: Int32Array) => void): void {
  if (k < 0 || k > n) return;
  const idx = new Int32Array(k);
  for (let i = 0; i < k; i++) idx[i] = i;
  if (k === 0) {
    cb(idx);
    return;
  }
  for (;;) {
    cb(idx);
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}

/** Número de multiconjuntos de tamaño n tomados de N elementos: C(N+n−1, n). */
export function multisetCount(N: number, n: number): number {
  return binom(N + n - 1, n);
}
