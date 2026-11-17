import type { Population } from '../population';
import { prepareEstratificado } from './estratificado';
import { prepareMas } from './mas';
import { preparePptCr } from './pptcr';
import { preparePptSr } from './pptsr';
import { prepareRazon } from './razon';
import { prepareTepic } from './tepic';
import type { DesignId, PreparedDesign, StratOptions } from './types';

export * from './types';

export const DESIGN_IDS: DesignId[] = ['mas', 'razon', 'pptcr', 'pptsr', 'tepic', 'estrat'];

/** Diseños insesgados (el de razón es el único sesgado). */
export const UNBIASED: Record<DesignId, boolean> = {
  mas: true,
  razon: false,
  pptcr: true,
  pptsr: true,
  tepic: true,
  estrat: true,
};

export function prepareDesign(id: DesignId, pop: Population, n: number, strat: StratOptions): PreparedDesign {
  switch (id) {
    case 'mas':
      return prepareMas(pop, n);
    case 'razon':
      return prepareRazon(pop, n);
    case 'pptcr':
      return preparePptCr(pop, n);
    case 'pptsr':
      return preparePptSr(pop, n);
    case 'tepic':
      return prepareTepic(pop, n);
    case 'estrat':
      return prepareEstratificado(pop, n, strat);
  }
}
