import type { Population } from '../population';
import { prepareStratified, type Stratum } from './estratificado';
import { invalid, type PreparedDesign } from './types';

/**
 * MAS/SR con Tepic incluido con certeza.
 * Es un estratificado con dos estratos: {Tepic} censado (n_h = N_h = 1, varianza 0)
 * y los N−1 municipios restantes con MAS/SR de tamaño n−1 (formulario pp. 2 y 6):
 *   Ŷ_T = Y_Tepic + (N−1)·ȳ_resto
 *   V(Ŷ_T) = (N−1)²(1 − (n−1)/(N−1)) S²_resto/(n−1)
 */
export function prepareTepic(pop: Population, n: number): PreparedDesign {
  if (n < 2 || n > pop.N) return invalid('tepic', n, pop.N, `n debe estar entre 2 y ${pop.N}`);
  const rest = pop.units.map((_, i) => i).filter((i) => i !== pop.tepic);
  const strata: Stratum[] = [
    { nombre: pop.units[pop.tepic].nombre, units: [pop.tepic], certeza: true },
    { nombre: 'Resto', units: rest, certeza: false },
  ];
  return prepareStratified('tepic', pop, strata, [1, n - 1]);
}
