// Convierte data/raw/Nayarit.xlsx → data/nayarit.json
// Uso: npm run data
import XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wb = XLSX.readFile(join(root, 'data/raw/Nayarit.xlsx'));
const ws = wb.Sheets['Datos'] ?? wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { raw: true });

// Solo filas de municipio (las de resumen no traen clave "Num").
const municipios = rows
  .filter((r) => r.Num != null && r.Municipio && Number.isFinite(r.P1970) && Number.isFinite(r.P1980))
  .map((r) => ({
    clave: String(r.Num).padStart(3, '0'),
    nombre: String(r.Municipio).trim(),
    x: Number(r.P1970),
    y: Number(r.P1980),
  }));

const X = municipios.reduce((s, m) => s + m.x, 0);
const Y = municipios.reduce((s, m) => s + m.y, 0);
const out = {
  fuente: 'data/raw/Nayarit.xlsx (hoja Datos)',
  descripcion: 'Población por municipio de Nayarit: x = 1970, y = 1980',
  N: municipios.length,
  X,
  Y,
  municipios,
};
writeFileSync(join(root, 'data/nayarit.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`N=${out.N}  X=${X}  Y=${Y}`);
