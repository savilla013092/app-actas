import fs from 'node:fs';
import path from 'node:path';
import xlsx from 'xlsx';

const SOURCE_FILE = path.resolve('TERCEROS.xlsx');
const OUTPUT_FILE = path.resolve('src/lib/actas-formales/tercerosCatalog.json');

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

if (!fs.existsSync(SOURCE_FILE)) {
  throw new Error(`No se encontro ${SOURCE_FILE}`);
}

const workbook = xlsx.readFile(SOURCE_FILE);
const [sheetName] = workbook.SheetNames;
const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
  defval: '',
  raw: false,
});

const catalog = rows
  .map((row) => {
    const nombre = String(row.DESCRIPCION || '').replace(/\s+/g, ' ').trim().toUpperCase();
    const documento = String(row.NITCC || '').replace(/[^\dA-Za-z-]/g, '').trim();
    const dv = String(row.DV || '').trim();
    const normalizado = normalizeText(nombre);

    return {
      nombre,
      documento,
      dv,
      normalizado,
    };
  })
  .filter((item) => item.nombre && item.documento && item.normalizado);

const compactCatalog = catalog.map(({ nombre, documento, dv }) => ({
  nombre,
  documento,
  dv,
}));

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(compactCatalog, null, 2)}\n`);

console.log(`Catalogo de terceros generado: ${compactCatalog.length} registros`);
