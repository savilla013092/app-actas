export type EstadoActaFormal = 'borrador' | 'pendiente_firmas' | 'cerrada' | 'anulada';

export type MetodoFirmaActaFormal = 'firma_touch' | 'imagen' | 'clave';

export type TipoActaFormal = 'general' | 'entrega_dotacion';

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
  tipoFormato?: TipoActaFormal;
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
  entregaDotacion?: ActaEntregaDotacionData;
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

export interface ActaEntregaDotacionData {
  fecha: string;
  receptorNombre: string;
  receptorDocumento: string;
  tallaPantalon: string;
  tallaCamisa: string;
  tallaBota: string;
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

export type FormatoSolicitadoExtraccion = 'general' | 'entrega_dotacion' | 'auto';

export interface TerceroSugeridoExtraccion {
  nombre: string;
  documento: string;
  dv?: string;
  score: number;
}

export interface ExtraccionActaExitosa {
  disponible: true;
  ok: true;
  tipoDetectado: TipoActaFormal;
  draft: ActaFormalDraft;
  entregaDotacion?: ActaEntregaDotacionData;
  camposFaltantes: string[];
  terceroSugerido?: TerceroSugeridoExtraccion | null;
  modelo: string;
}

export interface ExtraccionActaNoDisponible {
  disponible: false;
  motivo: string;
}

export interface ExtraccionActaError {
  disponible: true;
  ok: false;
  motivo: string;
}

export type ResultadoExtraccionActa =
  | ExtraccionActaExitosa
  | ExtraccionActaNoDisponible
  | ExtraccionActaError;
