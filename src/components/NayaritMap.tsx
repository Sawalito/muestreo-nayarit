import { geoMercator, geoPath } from 'd3';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import { useEffect, useMemo, useState } from 'react';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { fmtInt } from '../lib/format';
import { useWidth } from '../lib/hooks';
import type { Unit } from '../stats/population';
import { ChartTooltip } from './ui';

type Props = { clave: string; nombre: string };
let cache: Promise<FeatureCollection<Geometry, Props>> | null = null;

/** Quita las islas lejanas (Islas Marías, Isla Isabel) para que el mapa no se encoja. */
function mainland(f: Feature<Geometry, Props>): Feature<Geometry, Props> {
  const g = f.geometry;
  if (g.type !== 'MultiPolygon') return f;
  const keep = (g as MultiPolygon).coordinates.filter((poly) => Math.min(...poly[0].map((c) => c[0])) > -105.8);
  return { ...f, geometry: keep.length === 1 ? ({ type: 'Polygon', coordinates: keep[0] } as Polygon) : { type: 'MultiPolygon', coordinates: keep } };
}

function loadMap() {
  if (!cache) {
    cache = fetch(`${import.meta.env.BASE_URL}nayarit-1980.topo.json`)
      .then((r) => {
        if (!r.ok) throw new Error('No se pudo cargar el mapa');
        return r.json();
      })
      .then((t: Topology) => {
        const fc = feature(t, t.objects.municipios) as unknown as FeatureCollection<Geometry, Props>;
        return { ...fc, features: fc.features.map(mainland) };
      });
  }
  return cache;
}

export function NayaritMap({
  units,
  fills,
  counts,
  ariaLabel,
  height: fixedHeight,
  highlight,
}: {
  units: Unit[];
  /** Color de relleno por clave de municipio */
  fills: (clave: string, index: number) => string;
  /** Veces que cada municipio salió en la muestra (para el distintivo ×2) */
  counts?: Map<number, number>;
  ariaLabel: string;
  height?: number;
  /** Si se da, los municipios con conteo > 0 brillan con este color */
  highlight?: string;
}) {
  const [fc, setFc] = useState<FeatureCollection<Geometry, Props> | null>(null);
  const [failed, setFailed] = useState(false);
  const [ref, width] = useWidth<HTMLDivElement>(360);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  useEffect(() => {
    loadMap().then(setFc, () => setFailed(true));
  }, []);

  const height = fixedHeight ?? Math.round(width * 1.05);
  const index = useMemo(() => new Map(units.map((u, i) => [u.clave, i])), [units]);
  const { path, centroids } = useMemo(() => {
    if (!fc) return { path: null, centroids: [] as [number, number][] };
    const proj = geoMercator().fitExtent(
      [
        [6, 6],
        [width - 6, height - 6],
      ],
      fc,
    );
    const p = geoPath(proj);
    return { path: p, centroids: fc.features.map((f) => p.centroid(f)) };
  }, [fc, width, height]);

  if (failed) return <p className="text-sm text-muted">No se pudo cargar el mapa.</p>;

  return (
    <div ref={ref} className="relative w-full">
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {fc &&
          path &&
          fc.features.map((f, k) => {
            const i = index.get(f.properties.clave) ?? -1;
            return (
              <path
                key={f.properties.clave}
                d={path(f) ?? ''}
                fill={fills(f.properties.clave, i)}
                stroke="var(--page)"
                strokeWidth={1.2}
                strokeLinejoin="round"
                className={highlight && counts?.has(i) ? 'glow' : undefined}
                onPointerEnter={() => setHover({ i, x: centroids[k][0], y: centroids[k][1] })}
                onPointerLeave={() => setHover(null)}
                style={{ transition: 'fill 450ms cubic-bezier(0.65,0,0.35,1)', color: highlight }}
              />
            );
          })}
        {fc &&
          counts &&
          fc.features.map((f, k) => {
            const i = index.get(f.properties.clave) ?? -1;
            const c = counts.get(i) ?? 0;
            if (c < 2) return null;
            const [cx, cy] = centroids[k];
            return (
              <g key={'c' + f.properties.clave} transform={`translate(${cx},${cy})`} aria-hidden>
                <circle r={9} fill="var(--page)" stroke="var(--ink)" strokeWidth={1} />
                <text textAnchor="middle" dy="0.35em" fontSize={10} fontWeight={700} style={{ fill: 'var(--ink)' }}>
                  ×{c}
                </text>
              </g>
            );
          })}
      </svg>
      {hover && hover.i >= 0 && (
        <ChartTooltip x={hover.x} y={hover.y} width={width}>
          <div className="font-semibold text-ink">{units[hover.i].nombre}</div>
          <div className="tabular text-ink-2">x₁₉₇₀ = {fmtInt(units[hover.i].x)}</div>
          <div className="tabular text-ink-2">y₁₉₈₀ = {fmtInt(units[hover.i].y)}</div>
          {counts && <div className="text-muted">{(counts.get(hover.i) ?? 0) > 0 ? 'En la muestra' : 'Fuera de la muestra'}</div>}
        </ChartTooltip>
      )}
    </div>
  );
}
