export type EstadoActaFormal = 'borrador' | 'pendiente_firmas' | 'cerrada' | 'anulada';

export type MetodoFirmaActaFormal = 'firma_touch' | 'imagen' | 'clave';

export interface AsistenteActaFormal {
  id: string;
  nombre: string;
  cargo: string;
  token?: string;
}

export interface CompromisoActaFormal {
  id: string;
  descripcion: string;
  responsable: string;
  fechaLimite: string;
}

export interface ActaFormalDraft {
  fecha: string;
  hora: string;
  lugar: string;
  tipoReunion: string;
  asistentes: AsistenteActaFormal[];
  objetivo: string;
  ordenDia: string[];
  desarrollo: string[];
  conclusiones: string[];
  compromisos: CompromisoActaFormal[];
}

export interface ActaFormal extends ActaFormalDraft {
  id: string;
  titulo: string;
  estado: EstadoActaFormal;
  creadoPor: string;
  creadoPorNombre: string;
  creadoPorEmail?: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
  publicadoEn?: Date;
  cerradoEn?: Date;
}

export interface FirmanteActaFormal {
  id: string;
  actaId: string;
  asistenteId: string;
  tituloActa?: string;
  fechaActa?: string;
  tipoReunion?: string;
  nombre: string;
  cargo: string;
  estado: 'pendiente' | 'firmada';
  metodoFirma?: MetodoFirmaActaFormal;
  firmaDataUrl?: string;
  claveFirma?: string;
  declaracionAceptada?: boolean;
  fechaFirma?: Date;
  userAgent?: string;
  actualizadoEn?: Date;
}

export interface MensajeAsistenteActaFormal {
  id: string;
  autor: 'agente' | 'usuario';
  texto: string;
  creadoEn: Date;
}
