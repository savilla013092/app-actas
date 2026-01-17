export type EstadoActivoFisico = 'activo' | 'baja' | 'traslado' | 'mantenimiento';

export interface Activo {
    id: string;
    codigo: string;                // Código institucional único (ej: "AF-MOB-2024-0089")
    descripcion: string;
    categoria: string;             // "Mobiliario", "Equipo Cómputo", "Vehículos", etc.
    marca?: string;
    modelo?: string;
    serial?: string;
    ubicacion: string;
    dependencia: string;
    custodioId: string;            // Referencia a usuarios/
    custodioNombre: string;        // Desnormalizado para consultas
    estado: EstadoActivoFisico;
    valorAdquisicion?: number;
    fechaAdquisicion?: Date;
    observaciones?: string;
    creadoEn: Date;
    actualizadoEn: Date;
    creadoPor: string;
}
