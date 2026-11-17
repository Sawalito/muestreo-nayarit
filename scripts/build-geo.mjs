// Genera public/nayarit-1980.topo.json a partir del GeoJSON municipal de Nayarit
// (PhantomInsights/mexico-geojson, licencia MIT; datos de origen CONABIO/INEGI).
// Bahía de Banderas (020) se creó en 1989 a partir de Compostela (004),
// así que se fusiona con Compostela para reproducir los 19 municipios de 1980.
// Uso: npm run geo  (descarga el archivo; requiere red)
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { merge, feature } from 'topojson-client';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const URL =
  'https://raw.githubusercontent.com/PhantomInsights/mexico-geojson/main/2022/states/Nayarit.json';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gj = await (await fetch(URL)).json();

let topo = topology({ m: gj }, 1e5);
topo = presimplify(topo);
topo = simplify(topo, quantile(topo, 0.06));

const geoms = topo.objects.m.geometries;
const out = [];
for (const g of geoms) {
  const cve = g.properties.CVE_MUN;
  if (cve === '004' || cve === '020') continue;
  out.push({ type: 'Feature', properties: { clave: cve, nombre: g.properties.NOMGEO }, geometry: feature(topo, g).geometry });
}
const comp = merge(topo, geoms.filter((g) => ['004', '020'].includes(g.properties.CVE_MUN)));
out.push({ type: 'Feature', properties: { clave: '004', nombre: 'Compostela' }, geometry: comp });

const fc = { type: 'FeatureCollection', features: out };
const final = topology({ municipios: fc }, 1e4);
writeFileSync(join(root, 'public/nayarit-1980.topo.json'), JSON.stringify(final));
console.log('municipios:', out.length);
