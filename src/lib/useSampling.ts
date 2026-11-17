import { useEffect, useRef, useState } from 'react';
import type { DesignId, StratOptions } from '../stats/designs/types';
import type { Mode } from '../stats/engine';
import type { Unit } from '../stats/population';
import type { DesignResult, SweepRow, WorkerRequest, WorkerResponse } from '../workers/protocol';

export interface RunParams {
  units: Unit[];
  n: number;
  designs: DesignId[];
  strat: StratOptions;
  mode: Mode;
  reps: number;
  seed: number;
}

export interface SamplingState {
  results: Partial<Record<DesignId, DesignResult>>;
  running: boolean;
  progress: number;
  ms: number | null;
  error: string | null;
  sweep: SweepRow[] | null;
}

function newWorker() {
  return new Worker(new URL('../workers/sampling.worker.ts', import.meta.url), { type: 'module' });
}

/** Lanza el cálculo de las distribuciones en un Web Worker; cancela el trabajo anterior si cambian los parámetros. */
export function useSampling(params: RunParams): SamplingState {
  const workerRef = useRef<Worker | null>(null);
  const jobRef = useRef(0);
  const [state, setState] = useState<SamplingState>({
    results: {},
    running: true,
    progress: 0,
    ms: null,
    error: null,
    sweep: null,
  });

  const key = JSON.stringify({ ...params, units: params.units.length });

  useEffect(() => {
    // Un trabajo en curso se cancela terminando el worker (la enumeración es síncrona).
    workerRef.current?.terminate();
    const w = newWorker();
    workerRef.current = w;
    const job = ++jobRef.current;
    const total = params.designs.length || 1;
    let finished = 0;
    setState((s) => ({ ...s, running: true, progress: 0, error: null }));
    const fresh: Partial<Record<DesignId, DesignResult>> = {};
    w.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const m = ev.data;
      if (m.job !== job) return;
      if (m.type === 'progress') {
        setState((s) => ({ ...s, progress: (finished + m.done / m.total) / total }));
      } else if (m.type === 'result') {
        finished++;
        fresh[m.result.design] = m.result;
        // Se mezcla con lo anterior para evitar parpadeos; al terminar se queda solo lo nuevo.
        setState((s) => ({ ...s, results: { ...s.results, [m.result.design]: m.result }, progress: finished / total }));
      } else if (m.type === 'done') {
        setState((s) => ({ ...s, results: { ...fresh }, running: false, progress: 1, ms: m.ms }));
      } else if (m.type === 'error') {
        setState((s) => ({ ...s, running: false, error: m.message }));
      }
    };
    const req: WorkerRequest = { type: 'run', job, ...params };
    w.postMessage(req);
    return () => {
      w.terminate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Barrido en n (efecto del tamaño de muestra): depende solo de la estratificación.
  const sweepKey = JSON.stringify(params.strat);
  useEffect(() => {
    const w = newWorker();
    w.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      if (ev.data.type === 'sweep') {
        const rows = ev.data.rows;
        setState((s) => ({ ...s, sweep: rows }));
        w.terminate();
      }
    };
    const req: WorkerRequest = { type: 'sweep', job: 0, units: params.units, strat: params.strat, nMin: 2, nMax: 15 };
    w.postMessage(req);
    return () => w.terminate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sweepKey]);

  return state;
}
