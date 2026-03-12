import { getAssetClassification } from '@/lib/utils/assetClassification';
import { getAssetLocation } from '@/lib/utils/assetLocation';

export interface ExportColumn {
  key: string;
  header: string;
  transform?: (value: unknown, row: Record<string, unknown>) => string | number;
}

export async function exportToExcel<T extends object>(
  data: T[],
  columns: ExportColumn[],
  filename: string,
  sheetName = 'Datos'
) {
  const [{ saveAs }, XLSX] = await Promise.all([import('file-saver'), import('xlsx')]);

  const rows = data.map((row) => {
    const source = row as Record<string, unknown>;
    const newRow: Record<string, string | number> = {};

    columns.forEach((column) => {
      const value = source[column.key];
      newRow[column.header] = column.transform ? column.transform(value, source) : (value as string | number) ?? '';
    });

    return newRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns.map((column) => column.header) });
  worksheet['!cols'] = columns.map((column) => ({ wch: Math.max(column.header.length, 15) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const timestamp = new Date().toISOString().split('T')[0];
  saveAs(blob, `${filename}_${timestamp}.xlsx`);
}

export const activosExportColumns: ExportColumn[] = [
  { key: 'codigo', header: 'Codigo' },
  { key: 'descripcion', header: 'Descripcion' },
  {
    key: 'categoria',
    header: 'Categoria',
    transform: (_value, row) => getAssetClassification(String(row.codigo || ''), row.categoria as string).classificationName,
  },
  { key: 'marca', header: 'Marca' },
  { key: 'modelo', header: 'Modelo' },
  { key: 'serial', header: 'Serial' },
  {
    key: 'ubicacion',
    header: 'Ubicacion',
    transform: (value) => getAssetLocation(value as string | number | null | undefined).locationName,
  },
  { key: 'dependencia', header: 'Dependencia' },
  { key: 'custodioNombre', header: 'Custodio' },
  { key: 'estado', header: 'Estado', transform: (value) => String(value || 'N/A').toUpperCase() },
  {
    key: 'creadoEn',
    header: 'Fecha Registro',
    transform: (value) => (value ? new Date(String(value)).toLocaleDateString('es-CO') : 'N/A'),
  },
];

export const revisionesExportColumns: ExportColumn[] = [
  { key: 'numeroActa', header: 'Numero Acta', transform: (value) => String(value || 'Pendiente') },
  { key: 'codigoActivo', header: 'Codigo Activo' },
  { key: 'descripcionActivo', header: 'Descripcion Activo' },
  { key: 'ubicacionActivo', header: 'Ubicacion' },
  { key: 'custodioNombre', header: 'Custodio' },
  { key: 'revisorNombre', header: 'Revisor' },
  { key: 'estadoActivo', header: 'Estado Activo', transform: (value) => String(value || 'N/A').toUpperCase() },
  { key: 'descripcion', header: 'Hallazgos' },
  { key: 'observaciones', header: 'Observaciones' },
  {
    key: 'fecha',
    header: 'Fecha Revision',
    transform: (value) => {
      if (!value) return 'N/A';
      if (typeof value === 'object' && value !== null && 'seconds' in value) {
        return new Date((value as { seconds: number }).seconds * 1000).toLocaleDateString('es-CO');
      }
      return new Date(String(value)).toLocaleDateString('es-CO');
    },
  },
  {
    key: 'estado',
    header: 'Estado Proceso',
    transform: (value) => {
      const estados: Record<string, string> = {
        borrador: 'Borrador',
        pendiente_firma_custodio: 'Pendiente Firma',
        firmada_completa: 'Generando PDF',
        completada: 'Completada',
        error_generacion: 'Error',
      };
      return estados[String(value)] || String(value || 'N/A');
    },
  },
];
