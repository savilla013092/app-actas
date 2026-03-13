import { ActaOperativaBase, EstadoActaProceso, Evidencia, FirmaDigital } from '@/types/acta';

export type EstadoActivo = 'excelente' | 'bueno' | 'regular' | 'malo' | 'para_baja';
export type EstadoRevision = EstadoActaProceso;

export interface Revision extends ActaOperativaBase {
  estadoActivo: EstadoActivo;
}

export type { Evidencia, FirmaDigital };
