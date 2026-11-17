import type { DesignId } from '../stats/designs/types';

export interface DesignMeta {
  id: DesignId;
  nombre: string;
  corto: string;
  /** Color categórico (variable CSS, cambia con el tema) */
  color: string;
  /** Referencia al formulario, o null si no está en él */
  formulario: string | null;
  estimador: string;
  varianza: string;
  estimadorVarianza: string;
  extra?: string;
  intuicion: string[];
}

export const DESIGNS: Record<DesignId, DesignMeta> = {
  mas: {
    id: 'mas',
    nombre: 'MAS sin reemplazo',
    corto: 'MAS/SR',
    color: 'var(--d-mas)',
    formulario: 'p. 2',
    estimador: String.raw`\hat Y_T = \sum_{j=1}^{n}\frac{N}{n}y_j = N\bar y`,
    varianza: String.raw`V(\hat Y_T) = N^2\left(1-\frac{n}{N}\right)\frac{S^2}{n}`,
    estimadorVarianza: String.raw`\hat V(\hat Y_T) = N^2\left(1-\frac{n}{N}\right)\frac{s^2}{n}`,
    intuicion: [
      'Todas las muestras de tamaño n tienen la misma probabilidad. Es el punto de referencia: la eficiencia relativa de los demás diseños se mide contra él.',
      'En Nayarit los municipios son muy desiguales (CV ≈ 1.09). Que la muestra incluya o no a Tepic mueve mucho a N·ȳ, y por eso su distribución es ancha y asimétrica.',
    ],
  },
  razon: {
    id: 'razon',
    nombre: 'Estimador de razón (MAS/SR)',
    corto: 'Razón',
    color: 'var(--d-razon)',
    formulario: 'p. 3',
    estimador: String.raw`\hat Y_T = X_T\,\frac{\bar y}{\bar x} = X_T\,\hat R`,
    varianza: String.raw`V(\hat Y_T) \approx N^2\left(1-\frac{n}{N}\right)\frac{S_R^2}{n},\quad S_R^2=\frac{1}{N-1}\sum^N (Y_i-RX_i)^2`,
    estimadorVarianza: String.raw`\hat V(\hat Y_T) \approx N^2\left(1-\frac{n}{N}\right)\frac{s_R^2}{n}`,
    intuicion: [
      'Usa la población de 1970, cuyo total X_T sí se conoce. Si y ≈ R·x, la razón ȳ/x̄ casi no cambia de una muestra a otra aunque cambien los municipios. Por eso la varianza depende de los residuos y − Rx y no de la variabilidad de y.',
      'Es sesgado: E(ȳ/x̄) ≠ Ȳ/X̄. El sesgo es de orden 1/n y se nota con n chica. Además, la varianza del formulario es una aproximación, y aquí se compara contra el ECM exacto.',
    ],
  },
  pptcr: {
    id: 'pptcr',
    nombre: 'PPT con reemplazo (Hansen–Hurwitz)',
    corto: 'PPT CR',
    color: 'var(--d-pptcr)',
    formulario: 'p. 4',
    estimador: String.raw`p_i=\frac{M_i}{M_T},\quad \hat Y_T = \frac{1}{n}\sum_{j=1}^{n}\frac{y_j}{p_j} = \bar z`,
    varianza: String.raw`V(\hat Y_T) = \frac{1}{n}\sum_{i=1}^{N} p_i\left(\frac{Y_i}{p_i}-Y_T\right)^2`,
    estimadorVarianza: String.raw`\hat V(\hat Y_T) = \frac{1}{n(n-1)}\sum_{j=1}^{n}\left(\frac{y_j}{p_j}-\hat Y_T\right)^2 = \frac{s_z^2}{n}`,
    intuicion: [
      'Cada extracción elige al municipio i con probabilidad proporcional a su población de 1970 (M_i = x_i). Si y_i/p_i casi no cambia entre municipios, cualquier muestra da casi el mismo Ŷ.',
      'Aquí y/x va de 1.13 a 1.78. Las z_i = y_i/p_i son muy parecidas y la varianza cae drásticamente. Como es con reemplazo, un municipio grande puede salir dos veces.',
    ],
  },
  pptsr: {
    id: 'pptsr',
    nombre: 'PPT sin reemplazo (Horvitz–Thompson)',
    corto: 'PPT SR (HT)',
    color: 'var(--d-pptsr)',
    formulario: null,
    estimador: String.raw`\pi_i = n\frac{x_i}{X_T},\quad \hat Y_{HT} = \sum_{i\in s}\frac{y_i}{\pi_i}`,
    varianza: String.raw`V(\hat Y_{HT}) = \tfrac12\sum_{i\ne j}^{N}(\pi_i\pi_j-\pi_{ij})\left(\frac{Y_i}{\pi_i}-\frac{Y_j}{\pi_j}\right)^2`,
    estimadorVarianza: String.raw`\hat V(\hat Y_{HT}) = \tfrac12\sum_{i\ne j\in s}\frac{\pi_i\pi_j-\pi_{ij}}{\pi_{ij}}\left(\frac{y_i}{\pi_i}-\frac{y_j}{\pi_j}\right)^2`,
    extra: 'Selección por el método de Sampford, que da exactamente las π_i. Las π_i mayores que 1 se fijan en 1 (inclusión con certeza). La varianza usa la forma de Sen–Yates–Grundy.',
    intuicion: [
      'Es la versión sin reemplazo de PPT: no repite municipios, así que aprovecha mejor la muestra y suele tener menos varianza que Hansen–Hurwitz.',
      'Con n ≥ 5, Tepic tiene π_i = 1 y entra con certeza. En la práctica el diseño combina "Tepic con certeza" y PPT.',
    ],
  },
  tepic: {
    id: 'tepic',
    nombre: 'MAS/SR con Tepic incluido con certeza',
    corto: 'Tepic + MAS',
    color: 'var(--d-tepic)',
    formulario: 'pp. 2 y 6',
    estimador: String.raw`\hat Y_T = Y_{\text{Tepic}} + (N-1)\,\bar y_{\text{resto}}`,
    varianza: String.raw`V(\hat Y_T) = (N-1)^2\left(1-\frac{n-1}{N-1}\right)\frac{S^2_{\text{resto}}}{n-1}`,
    estimadorVarianza: String.raw`\hat V(\hat Y_T) = (N-1)^2\left(1-\frac{n-1}{N-1}\right)\frac{s^2_{\text{resto}}}{n-1}`,
    extra: 'Es un estratificado de dos estratos: {Tepic}, que se censa y aporta varianza 0, y los 18 municipios restantes con MAS/SR de tamaño n−1.',
    intuicion: [
      'Tepic es el 24 % de la población del estado. Bajo MAS/SR, que salga o no en la muestra produce los "dos jorobas" de la distribución.',
      'Si se incluye siempre, esa fuente de variación desaparece y S² se calcula solo sobre municipios más parecidos entre sí. Se gana eficiencia sin usar x en el estimador.',
    ],
  },
  estrat: {
    id: 'estrat',
    nombre: 'Muestreo estratificado por tamaño',
    corto: 'Estratificado',
    color: 'var(--d-estrat)',
    formulario: 'p. 6',
    estimador: String.raw`\hat Y_T = \sum_{h=1}^{L}\hat Y_{Th} = \sum_{h=1}^{L} N_h\bar y_h`,
    varianza: String.raw`V(\hat Y_T) = \sum_{h=1}^{L} N_h^2\left(1-\frac{n_h}{N_h}\right)\frac{S_h^2}{n_h}`,
    estimadorVarianza: String.raw`\hat V(\hat Y_T) = \sum_{h=1}^{L} N_h^2\left(1-\frac{n_h}{N_h}\right)\frac{s_h^2}{n_h}`,
    extra: String.raw`Afijación: proporcional n_h = nN_h/N; Neyman n_h = n N_hS_h/ΣN_kS_k (con S_h de x₁₉₇₀); igual n_h = n/L. Tepic forma su propio estrato de certeza y la afijación reparte las n−1 unidades restantes.`,
    intuicion: [
      'Los estratos se forman con la población de 1970, así que los municipios de un mismo estrato son parecidos. La varianza solo toma en cuenta la variación dentro de cada estrato.',
      'La afijación de Neyman pone más muestra donde hay más dispersión, que es en los estratos grandes. Como cada estrato aporta al menos 1 municipio, el diseño no puede "olvidar" a los municipios grandes.',
    ],
  },
};
