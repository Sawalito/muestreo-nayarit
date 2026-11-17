import { describe, expect, it } from 'vitest';
import nayarit from '../data/nayarit.json';
import { binom, forEachCombination, multisetCount } from '../src/stats/combinatorics';
import { DESIGN_IDS, prepareDesign, UNBIASED, type DesignId, type StratOptions } from '../src/stats/designs';
import {
  allocate,
  buildStrata,
  stratumSizes,
} from '../src/stats/designs/estratificado';
import { masTheoreticalVar } from '../src/stats/designs/mas';
import { pptProbabilities } from '../src/stats/designs/pptcr';
import { inclusionProbabilities, preparePptSr } from '../src/stats/designs/pptsr';
import { enumerateDistribution, simulateDistribution } from '../src/stats/engine';
import { makePopulation, pick, variance } from '../src/stats/population';
import { summarize } from '../src/stats/summarize';

/** Población de juguete: 8 unidades, la más grande se llama "Tepic". */
const toy = makePopulation([
  { clave: '1', nombre: 'A', x: 10, y: 14 },
  { clave: '2', nombre: 'B', x: 4, y: 5 },
  { clave: '3', nombre: 'C', x: 25, y: 31 },
  { clave: '4', nombre: 'D', x: 7, y: 11 },
  { clave: '5', nombre: 'Tepic', x: 60, y: 95 },
  { clave: '6', nombre: 'E', x: 15, y: 17 },
  { clave: '7', nombre: 'F', x: 3, y: 6 },
  { clave: '8', nombre: 'G', x: 12, y: 13 },
]);
const nay = makePopulation(nayarit.municipios);

const strat: StratOptions = { L: 2, cuts: 'cuantiles', allocation: 'proporcional' };
const UNBIASED_IDS = DESIGN_IDS.filter((d) => UNBIASED[d]);

function exactMoments(id: DesignId, pop = toy, n = 4, opts = strat) {
  const d = prepareDesign(id, pop, n, opts);
  expect(d.valid).toBe(true);
  const dist = enumerateDistribution(d);
  let P = 0;
  let m = 0;
  for (let i = 0; i < dist.est.length; i++) {
    P += dist.prob[i];
    m += dist.prob[i] * dist.est[i];
  }
  let v = 0;
  for (let i = 0; i < dist.est.length; i++) v += dist.prob[i] * (dist.est[i] - m) ** 2;
  let ev = 0;
  for (let i = 0; i < dist.est.length; i++) ev += dist.prob[i] * dist.vhat[i];
  return { d, dist, P, mean: m, variance: v, meanVhat: ev };
}

describe('combinatoria', () => {
  it('enumera C(n,k) combinaciones distintas', () => {
    const seen = new Set<string>();
    forEachCombination(7, 3, (idx) => seen.add(Array.from(idx).join(',')));
    expect(seen.size).toBe(binom(7, 3));
    expect(multisetCount(19, 3)).toBe(binom(21, 3));
  });
});

describe('enumeración exhaustiva en la población de juguete', () => {
  for (const id of UNBIASED_IDS) {
    for (const n of [3, 4, 6]) {
      it(`${id}, n=${n}: probabilidades suman 1 y E(Ŷ) = Y`, () => {
        const r = exactMoments(id, toy, n, { ...strat, L: 2 });
        expect(r.P).toBeCloseTo(1, 12);
        expect(r.mean).toBeCloseTo(toy.Y, 8);
      });
      it(`${id}, n=${n}: la varianza exacta coincide con la fórmula del formulario`, () => {
        const r = exactMoments(id, toy, n, { ...strat, L: 2 });
        expect(r.variance / r.d.theoreticalVar).toBeCloseTo(1, 9);
      });
    }
  }

  it('MAS/SR: V(Ŷ) = N²(1−n/N)S²/n y E(V̂) = V(Ŷ)', () => {
    const r = exactMoments('mas', toy, 3);
    const V = masTheoreticalVar(toy.N, 3, variance(toy.y));
    expect(r.variance).toBeCloseTo(V, 6);
    expect(r.meanVhat).toBeCloseTo(V, 6);
  });

  it('PPT CR: V̂ = s_z²/n es insesgado', () => {
    const r = exactMoments('pptcr', toy, 3);
    expect(r.meanVhat / r.variance).toBeCloseTo(1, 9);
  });

  it('PPT SR (HT): V̂ de Sen–Yates–Grundy es insesgado', () => {
    const r = exactMoments('pptsr', toy, 3);
    expect(r.meanVhat / r.variance).toBeCloseTo(1, 9);
  });

  it('razón: el estimador es sesgado y su ECM se aproxima a la fórmula', () => {
    const r = exactMoments('razon', nay, 4);
    expect(Math.abs(r.mean - nay.Y)).toBeGreaterThan(1);
    const mse = r.variance + (r.mean - nay.Y) ** 2;
    expect(mse / r.d.theoreticalVar).toBeGreaterThan(0.7);
    expect(mse / r.d.theoreticalVar).toBeLessThan(1.5);
  });
});

describe('Nayarit (N = 19)', () => {
  it('totales del archivo', () => {
    expect(nay.N).toBe(19);
    expect(nay.X).toBe(544031);
    expect(nay.Y).toBe(726120);
    expect(nay.units[nay.tepic].nombre).toBe('Tepic');
  });

  for (const id of UNBIASED_IDS) {
    it(`${id}: E(Ŷ) = Y y V exacta = V del formulario con n = 4`, () => {
      const r = exactMoments(id, nay, 4, { L: 3, cuts: 'sqrtf', allocation: 'neyman' });
      expect(r.mean / nay.Y).toBeCloseTo(1, 10);
      expect(r.variance / r.d.theoreticalVar).toBeCloseTo(1, 8);
    });
  }

  it('el sesgo relativo de la razón disminuye al crecer n', () => {
    const bias = [2, 4, 8, 12].map((n) => Math.abs(exactMoments('razon', nay, n).mean - nay.Y));
    for (let k = 1; k < bias.length; k++) expect(bias[k]).toBeLessThan(bias[k - 1]);
  });

  it('razón y PPT tienen menor ECM que MAS/SR', () => {
    const n = 4;
    const mas = exactMoments('mas', nay, n);
    for (const id of ['razon', 'pptcr', 'pptsr'] as DesignId[]) {
      const r = exactMoments(id, nay, n);
      expect(r.variance + (r.mean - nay.Y) ** 2).toBeLessThan(mas.variance);
    }
  });
});

describe('Monte Carlo', () => {
  for (const id of DESIGN_IDS) {
    it(`${id}: la varianza simulada queda cerca de la teórica (±6%)`, () => {
      const d = prepareDesign(id, nay, 5, { L: 3, cuts: 'sqrtf', allocation: 'proporcional' });
      const dist = simulateDistribution(d, 60_000, 12345);
      const m = summarize(dist, nay.Y, d.theoreticalVar, 1);
      // La razón sólo tiene varianza aproximada en el formulario: se compara su ECM con el ECM exacto.
      const ref = id === 'razon' ? summarize(enumerateDistribution(d), nay.Y, 1, 1).mse : d.theoreticalVar;
      const ratio = (id === 'razon' ? m.mse : m.variance) / ref;
      expect(Math.abs(ratio - 1)).toBeLessThan(0.06);
    });
  }

  it('la misma semilla reproduce la misma simulación', () => {
    const d = prepareDesign('mas', nay, 4, strat);
    const a = simulateDistribution(d, 1000, 7);
    const b = simulateDistribution(d, 1000, 7);
    expect(Array.from(a.est)).toEqual(Array.from(b.est));
  });
});

describe('PPT: probabilidades', () => {
  it('p_i = M_i/M_T suma 1', () => {
    const p = pptProbabilities(nay.x);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  for (const n of [2, 4, 6, 10]) {
    it(`π_i suma n y la enumeración de Sampford reproduce π_i (n=${n})`, () => {
      const pi = inclusionProbabilities(nay.x, n);
      expect(pi.reduce((a, b) => a + b, 0)).toBeCloseTo(n, 10);
      for (const v of pi) expect(v).toBeLessThanOrEqual(1 + 1e-12);
      const d = preparePptSr(nay, n);
      const t = d.sampford!;
      expect(t.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
      const emp = new Float64Array(nay.N);
      for (let s = 0; s < t.count; s++)
        for (let k = 0; k < n; k++) emp[t.samples[s * n + k]] += t.probs[s];
      for (let i = 0; i < nay.N; i++) expect(emp[i]).toBeCloseTo(pi[i], 10);
    });
  }
});

describe('estratificación', () => {
  for (const L of [2, 3] as const)
    for (const cuts of ['sqrtf', 'cuantiles'] as const)
      for (const allocation of ['proporcional', 'neyman', 'igual'] as const)
        it(`L=${L}, ${cuts}, ${allocation}: los estratos particionan y Σn_h = n`, () => {
          const strata = buildStrata(nay, { L, cuts });
          const all = strata.flatMap((s) => s.units).sort((a, b) => a - b);
          expect(all).toEqual(Array.from({ length: nay.N }, (_, i) => i));
          expect(strata[0].certeza).toBe(true);
          for (let n = L + 1; n <= nay.N; n++) {
            const nh = stratumSizes(nay, strata, n, allocation);
            expect(nh.reduce((a, b) => a + b, 0)).toBe(n);
            expect(nh[0]).toBe(1);
            nh.forEach((v, h) => {
              expect(v).toBeGreaterThanOrEqual(1);
              expect(v).toBeLessThanOrEqual(strata[h].units.length);
            });
          }
        });

  it('allocate respeta límites y suma', () => {
    expect(allocate([3, 10], [1, 1], 8, 1)).toEqual([3, 5]);
    expect(allocate([5, 5, 5], [5, 5, 5], 7, 2).reduce((a, b) => a + b, 0)).toBe(7);
  });

  it('el estrato de Tepic tiene varianza 0 (certeza)', () => {
    const d = prepareDesign('tepic', nay, 3, strat);
    const rest = pick(nay.y, nay.units.map((_, i) => i).filter((i) => i !== nay.tepic));
    expect(d.theoreticalVar).toBeCloseTo(masTheoreticalVar(18, 2, variance(rest)), 4);
  });
});
