import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { getAssetClassification } from '@/lib/utils/assetClassification';

export interface ExportColumn {
    key: string;
    header: string;
    transform?: (value: any, row: any) => string | number;
}

export function exportToExcel<T extends Record<string, any>>(
    data: T[],
    columns: ExportColumn[],
    filename: string,
    sheetName: string = 'Datos'
) {
    const headers = columns.map(col => col.header);
    
    const rows = data.map(row => {
        const newRow: Record<string, string | number> = {};
        columns.forEach(col => {
            const value = row[col.key];
            newRow[col.header] = col.transform ? col.transform(value, row) : (value ?? '');
        });
        return newRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    
    const colWidths = columns.map(col => ({
        wch: Math.max(col.header.length, 15)
    }));
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const timestamp = new Date().toISOString().split('T')[0];
    saveAs(blob, `${filename}_${timestamp}.xlsx`);
}

export const activosExportColumns: ExportColumn[] = [
    { key: 'codigo', header: 'Codigo' },
    { key: 'descripcion', header: 'Descripcion' },
    {
        key: 'categoria',
        header: 'Categoria',
        transform: (_value, row) => getAssetClassification(row.codigo, row.categoria).classificationName,
    },
    { key: 'marca', header: 'Marca' },
    { key: 'modelo', header: 'Modelo' },
    { key: 'serial', header: 'Serial' },
    { key: 'ubicacion', header: 'Ubicacion' },
    { key: 'dependencia', header: 'Dependencia' },
    { key: 'custodioNombre', header: 'Custodio' },
    { key: 'estado', header: 'Estado', transform: (v) => v?.toUpperCase() || 'N/A' },
    { 
        key: 'creadoEn', 
        header: 'Fecha Registro',
        transform: (v) => v ? new Date(v).toLocaleDateString('es-CO') : 'N/A'
    },
];

export const revisionesExportColumns: ExportColumn[] = [
    { key: 'numeroActa', header: 'Numero Acta', transform: (v) => v || 'Pendiente' },
    { key: 'codigoActivo', header: 'Codigo Activo' },
    { key: 'descripcionActivo', header: 'Descripcion Activo' },
    { key: 'ubicacionActivo', header: 'Ubicacion' },
    { key: 'custodioNombre', header: 'Custodio' },
    { key: 'revisorNombre', header: 'Revisor' },
    { key: 'estadoActivo', header: 'Estado Activo', transform: (v) => v?.toUpperCase() || 'N/A' },
    { key: 'descripcion', header: 'Hallazgos' },
    { key: 'observaciones', header: 'Observaciones' },
    { 
        key: 'fecha', 
        header: 'Fecha Revision',
        transform: (v) => {
            if (!v) return 'N/A';
            if (typeof v === 'object' && 'seconds' in v) {
                return new Date(v.seconds * 1000).toLocaleDateString('es-CO');
            }
            return new Date(v).toLocaleDateString('es-CO');
        }
    },
    { 
        key: 'estado', 
        header: 'Estado Proceso',
        transform: (v) => {
            const estados: Record<string, string> = {
                'borrador': 'Borrador',
                'pendiente_firma_custodio': 'Pendiente Firma',
                'firmada_completa': 'Generando PDF',
                'completada': 'Completada',
                'error_generacion': 'Error',
            };
            return estados[v] || v || 'N/A';
        }
    },
];