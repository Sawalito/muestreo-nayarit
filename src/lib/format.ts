// Formato numérico mexicano: coma como separador de miles y punto decimal.
const nf = (min: number, max: number) =>
  new Intl.NumberFormat('es-MX', { minimumFractionDigits: min, maximumFractionDigits: max });

const f0 = nf(0, 0);
const f1 = nf(1, 1);
const f2 = nf(2, 2);
const f3 = nf(3, 3);
const f4 = nf(4, 4);

export const fmtInt = (v: number) => (Number.isFinite(v) ? f0.format(v) : '—');
export const fmt1 = (v: number) => (Number.isFinite(v) ? f1.format(v) : '—');
export const fmt2 = (v: number) => (Number.isFinite(v) ? f2.format(v) : '—');
export const fmt3 = (v: number) => (Number.isFinite(v) ? f3.format(v) : '—');
export const fmt4 = (v: number) => (Number.isFinite(v) ? f4.format(v) : '—');
export const fmtPct = (v: number, d = 1) => (Number.isFinite(v) ? nf(d, d).format(v * 100) + ' %' : '—');
export const fmtSigned = (v: number) => {
  if (!Number.isFinite(v)) return '—';
  const r = Math.round(v);
  return (r > 0 ? '+' : r < 0 ? '−' : '') + f0.format(Math.abs(r));
};
export const fmtSignedPct = (v: number, d = 2) => {
  if (!Number.isFinite(v)) return '—';
  const r = Math.abs(v * 100) < 0.5 * 10 ** -d ? 0 : v;
  return (r > 0 ? '+' : r < 0 ? '−' : '') + nf(d, d).format(Math.abs(r * 100)) + ' %';
};

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

/** Notación científica legible: 1.236 × 10¹¹ */
export function fmtSci(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(v)));
  if (e >= -2 && e < 5) return nf(0, digits).format(v);
  const m = v / 10 ** e;
  return `${nf(digits, digits).format(m)} × 10${String(e).split('').map((c) => SUP[c]).join('')}`;
}

/** Abreviatura para ejes: 726 mil, 1.2 M */
export function fmtAxis(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return nf(0, 2).format(v / 1e6) + ' M';
  if (a >= 1e3) return nf(0, 0).format(v / 1e3) + ' mil';
  return nf(0, 2).format(v);
}
