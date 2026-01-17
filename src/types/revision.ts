export type EstadoActivo = 'excelente' | 'bueno' | 'regular' | 'malo' | 'para_baja';
export type EstadoRevision = 'borrador' | 'pendiente_firma_custodio' | 'firmada_completa' | 'completada' | 'anulada';

export interface Evidencia {
    id: string;
    url: string;
    nombre: string;
    descripcion?: string;
    subidaEn: Date;
}

export interface FirmaDigital {
    url: string;
    fechaFirma: Date;
    ipCliente: string;
    userAgent: string;
    hashDocumento: string;
    declaracionAceptada: boolean;
    geolocalizacion?: {
        latitud: number;
        longitud: number;
    };
}

export interface Revision {
    id: string;
    numeroActa?: string;

    // Activo
    activoId: string;
    codigoActivo: string;
    descripcionActivo: string;
    ubicacionActivo: string;

    // Custodio
    custodioId: string;
    custodioNombre: string;
    custodioCedula: string;
    custodioCargo: string;

    // Revisor (Profesional de Logística)
    revisorId: string;
    revisorNombre: string;
    revisorCedula: string;
    revisorCargo: string;

    // Datos revisión
    fecha: Date;
    estadoActivo: EstadoActivo;
    descripcion: string;
    observaciones?: string;

    // Evidencias y firmas
    evidencias: Evidencia[];
    firmaRevisor?: FirmaDigital;
    firmaCustodio?: FirmaDigital;

    // Estado y PDF
    estado: EstadoRevision;
    actaPdfUrl?: string;

    // Auditoría
    creadoEn: Date;
    actualizadoEn: Date;
    creadoPor: string;
}
