import { ActaOperativaBase, Evidencia, EstadoActaProceso, FirmaDigital } from '@/types/acta';

export type EstadoAsignacionInicial = 'no_requerida' | 'pendiente' | 'completada';
export type EstadoAsignacion = EstadoActaProceso;

export interface AsignacionInicial extends ActaOperativaBase {}

export type { Evidencia, FirmaDigital };
