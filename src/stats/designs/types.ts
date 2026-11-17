import type { Rng } from '../rng';

export type DesignId = 'mas' | 'razon' | 'pptcr' | 'pptsr' | 'tepic' | 'estrat';

export type Allocation = 'proporcional' | 'neyman' | 'igual';
export type CutMethod = 'sqrtf' | 'cuantiles';

export interface StratOptions {
  /** Número de estratos por tamaño (además del estrato de certeza de Tepic) */
  L: 2 | 3;
  cuts: CutMethod;
  allocation: Allocation;
}

export interface Draw {
  /** Índices de las unidades extraídas (con repeticiones en PPT con reemplazo) */
  units: number[];
  est: number;
  /** Estimador de varianza V̂(Ŷ); null si no se puede calcular con esta muestra */
  vhat: number | null;
}

/** Callback de enumeración: valor del estimador, V̂ (NaN si no existe) y probabilidad de la muestra. */
export type EnumCallback = (est: number, vhat: number, prob: number) => void;

export interface PreparedDesign {
  id: DesignId;
  n: number;
  valid: boolean;
  reason?: string;
  /** Varianza teórica según el formulario (aproximada en el caso de razón) */
  theoreticalVar: number;
  /** Número de muestras distintas (para decidir si se enumera) */
  exactSize: number;
  enumerate: (cb: EnumCallback) => void;
  draw: (rng: Rng) => Draw;
  /** Probabilidad de que cada unidad aparezca en la muestra */
  inclusion: Float64Array;
}

export function invalid(id: DesignId, n: number, N: number, reason: string): PreparedDesign {
  return {
    id,
    n,
    valid: false,
    reason,
    theoreticalVar: NaN,
    exactSize: 0,
    enumerate: () => {},
    draw: () => ({ units: [], est: NaN, vhat: null }),
    inclusion: new Float64Array(N),
  };
}

export const finiteOrNull = (v: number): number | null => (Number.isFinite(v) ? v : null);
