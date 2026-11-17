import type { DesignId, StratOptions } from '../stats/designs/types';
import type { Mode } from '../stats/engine';
import type { Unit } from '../stats/population';
import type { Metrics } from '../stats/summarize';

export interface RunRequest {
  type: 'run';
  job: number;
  units: Unit[];
  n: number;
  designs: DesignId[];
  strat: StratOptions;
  mode: Mode;
  reps: number;
  seed: number;
}

export interface SweepRequest {
  type: 'sweep';
  job: number;
  units: Unit[];
  strat: StratOptions;
  nMin: number;
  nMax: number;
}

export type WorkerRequest = RunRequest | SweepRequest;

export interface DesignResult {
  design: DesignId;
  valid: boolean;
  reason?: string;
  metrics?: Metrics;
  est?: Float64Array;
  prob?: Float64Array;
  vhat?: Float64Array;
  /** Cuantiles 0.1 % y 99.9 % (para el dominio común de las gráficas) */
  lo?: number;
  hi?: number;
}

export interface SweepRow {
  n: number;
  design: DesignId;
  rmse: number;
  bias: number;
  relBias: number;
  exact: boolean;
}

export type WorkerResponse =
  | { type: 'progress'; job: number; design: DesignId; done: number; total: number }
  | { type: 'result'; job: number; result: DesignResult }
  | { type: 'done'; job: number; ms: number }
  | { type: 'sweep'; job: number; rows: SweepRow[] }
  | { type: 'error'; job: number; message: string };
