# Distribución en el muestreo · Nayarit 1980

Aplicación web para visualizar la **distribución en el muestreo** de varios estimadores del total de población de Nayarit en 1980 (Y = 726,120), usando la población de 1970 (X = 544,031) como variable auxiliar. Se hizo para Estadística Aplicada I (muestreo), ITAM.

**Sitio:** https://__USUARIO__.github.io/muestreo-nayarit/

![Captura de la aplicación](docs/captura.png)

## Qué muestra

| Diseño | Estimador | Referencia |
|---|---|---|
| MAS sin reemplazo | Ŷ = N·ȳ | Formulario p. 2 |
| Razón (MAS/SR) | Ŷ = X·ȳ/x̄ | Formulario p. 3 |
| PPT con reemplazo (Hansen–Hurwitz) | Ŷ = z̄, z = y/p, p = x/X | Formulario p. 4 |
| PPT sin reemplazo (Horvitz–Thompson, Sampford) | Ŷ = Σ y/π | *Fuera del formulario* |
| MAS/SR con Tepic incluido con certeza | Ŷ = Y_Tepic + (N−1)·ȳ_resto | Formulario pp. 2 y 6 |
| Estratificado por tamaño (Tepic + 2 o 3 estratos) | Ŷ = Σ N_h ȳ_h | Formulario p. 6 |

Para cada diseño la app calcula E(Ŷ), el sesgo, el sesgo relativo, V(Ŷ), la DE, el ECM, el CV y la **eficiencia relativa frente a MAS/SR**. También compara la varianza obtenida con la del formulario y calcula la cobertura empírica del intervalo Ŷ ± 1.96√V̂.

Vistas disponibles:
- Densidades superpuestas.
- Small multiples con el mismo eje X.
- Animación de muestreo con mapa.
- 100 intervalos de confianza.
- Efecto de n: √ECM y sesgo de la razón contra n.
- Datos, dispersión x–y, probabilidades de PPT y estratos.
- Tarjetas de teoría con KaTeX.

### ¿Exacta o Monte Carlo?

Como N = 19, casi todas las distribuciones se obtienen por **enumeración exhaustiva**. Por ejemplo, C(19, 9) = 92,378 muestras. En PPT con reemplazo se enumeran los multiconjuntos con su probabilidad multinomial, lo que es factible hasta n ≈ 7. Cuando hay más de 600,000 muestras posibles, o si se elige el modo Monte Carlo, se simula con un generador con semilla (mulberry32). Todo el cálculo corre en un Web Worker y la interfaz indica en cada caso si la distribución es exacta o Monte Carlo.

## Estructura

```
data/raw/Nayarit.xlsx         datos originales
data/nayarit.json             datos convertidos (npm run data)
public/nayarit-1980.topo.json límites municipales de 1980 (npm run geo)
scripts/                      conversión de datos y mapa
src/stats/                    lógica estadística (funciones puras, un módulo por diseño)
src/workers/                  Web Worker de enumeración / simulación
src/components/               interfaz (React + D3)
tests/                        pruebas (Vitest)
```

## Correr localmente

Requiere Node 20 o más reciente.

```bash
npm install
npm run dev        # servidor de desarrollo
npm test           # pruebas
npm run build      # build de producción en dist/
```

## Actualizar los datos

1. Reemplaza `data/raw/Nayarit.xlsx`. Debe tener una hoja `Datos` con las columnas `Num`, `Municipio`, `P1970` y `P1980`; las filas sin `Num` se ignoran.
2. Corre `npm run data` para regenerar `data/nayarit.json`.
3. Corre `npm test` y haz push a `main`. El workflow de GitHub Actions ejecuta pruebas, build y despliegue.

Para regenerar el mapa corre `npm run geo`. Descarga el GeoJSON de [PhantomInsights/mexico-geojson](https://github.com/PhantomInsights/mexico-geojson) (licencia MIT, datos CONABIO/INEGI), fusiona Bahía de Banderas con Compostela (de la que se separó en 1989) y lo simplifica a TopoJSON.

## Pruebas

`tests/stats.test.ts` verifica lo siguiente:
- En una población de juguete y en Nayarit, la enumeración exhaustiva da E(Ŷ) = Y para MAS, PPT HH, PPT HT, estratificado y Tepic con certeza.
- La varianza exacta coincide con la fórmula del formulario. En HT se compara contra Sen–Yates–Grundy.
- V̂ es insesgado en MAS, PPT HH y HT.
- La varianza Monte Carlo queda a menos de 6 % de la teórica. En la razón se compara con el ECM exacto.
- Las p_i de PPT suman 1, las π_i suman n, y la enumeración de Sampford reproduce las π_i.
- Los estratos particionan la población y Σn_h = n con 1 ≤ n_h ≤ N_h para todas las combinaciones de cortes y afijación.
- El sesgo de la razón disminuye al crecer n, y la razón y PPT tienen menor ECM que MAS/SR.
