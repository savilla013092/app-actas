export type EstadoActaProceso =
  | 'borrador'
  | 'pendiente_firma_custodio'
  | 'firmada_completa'
  | 'completada'
  | 'anulada';

export interface Evidencia {
  id: string;
  url?: string;
  nombre: string;
  descripcion?: string;
  storagePath: string;
  subidaEn: Date;
}

export interface FirmaDigital {
  url?: string;
  storagePath: string;
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

export interface ActaOperativaBase {
  id: string;
  numeroActa?: string;
  activoId: string;
  codigoActivo: string;
  descripcionActivo: string;
  ubicacionActivo: string;
  custodioId: string;
  custodioNombre: string;
  custodioCedula: string;
  custodioCargo: string;
  revisorId: string;
  revisorNombre: string;
  revisorCedula: string;
  revisorCargo: string;
  fecha: Date;
  descripcion: string;
  observaciones?: string;
  evidencias: Evidencia[];
  firmaRevisor?: FirmaDigital;
  firmaCustodio?: FirmaDigital;
  estado: EstadoActaProceso;
  actaPdfUrl?: string;
  creadoEn: Date;
  actualizadoEn: Date;
  creadoPor: string;
}
