/// <reference lib="webworker" />
import { DESIGN_IDS, prepareDesign, UNBIASED } from '../stats/designs';
import { canEnumerate, enumerateDistribution, samplingDistribution } from '../stats/engine';
import { makePopulation } from '../stats/population';
import { deriveSeed } from '../stats/rng';
import { summarize, weightedQuantiles } from '../stats/summarize';
import type { SweepRow, WorkerRequest, WorkerResponse } from './protocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (msg: WorkerResponse, transfer: Transferable[] = []) => ctx.postMessage(msg, transfer);

ctx.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  try {
    if (req.type === 'run') run(req);
    else sweep(req);
  } catch (e) {
    post({ type: 'error', job: req.job, message: e instanceof Error ? e.message : String(e) });
  }
};

function run(req: Extract<WorkerRequest, { type: 'run' }>) {
  const t0 = performance.now();
  const pop = makePopulation(req.units);
  const mseMas = prepareDesign('mas', pop, req.n, req.strat).theoreticalVar;
  for (const id of req.designs) {
    const d = prepareDesign(id, pop, req.n, req.strat);
    if (!d.valid) {
      post({ type: 'result', job: req.job, result: { design: id, valid: false, reason: d.reason } });
      continue;
    }
    const total = req.mode === 'exacto' && canEnumerate(d) ? d.exactSize : req.reps;
    const dist = samplingDistribution(d, req.mode, req.reps, deriveSeed(req.seed, id), (done) =>
      post({ type: 'progress', job: req.job, design: id, done, total }),
    );
    const metrics = summarize(dist, pop.Y, d.theoreticalVar, mseMas);
    const [lo, hi] = weightedQuantiles(dist.est, dist.prob, [0.001, 0.999]);
    const est = dist.est.slice();
    const prob = dist.prob.slice();
    const vhat = dist.vhat.slice();
    post(
      { type: 'result', job: req.job, result: { design: id, valid: true, metrics, est, prob, vhat, lo, hi } },
      [est.buffer, prob.buffer, vhat.buffer],
    );
  }
  post({ type: 'done', job: req.job, ms: performance.now() - t0 });
}

/** √ECM y sesgo de cada diseño para n = nMin..nMax (exacto o por la fórmula del formulario). */
function sweep(req: Extract<WorkerRequest, { type: 'sweep' }>) {
  const pop = makePopulation(req.units);
  const rows: SweepRow[] = [];
  for (let n = req.nMin; n <= req.nMax; n++) {
    for (const id of DESIGN_IDS) {
      const d = prepareDesign(id, pop, n, req.strat);
      if (!d.valid) continue;
      if (UNBIASED[id]) {
        // Insesgado: ECM = V, y la V del formulario es exacta (verificado en las pruebas).
        rows.push({ n, design: id, rmse: Math.sqrt(d.theoreticalVar), bias: 0, relBias: 0, exact: true });
      } else if (canEnumerate(d)) {
        const m = summarize(enumerateDistribution(d), pop.Y, d.theoreticalVar, 1);
        rows.push({ n, design: id, rmse: Math.sqrt(m.mse), bias: m.bias, relBias: m.relBias, exact: true });
      }
    }
  }
  post({ type: 'sweep', job: req.job, rows });
}
