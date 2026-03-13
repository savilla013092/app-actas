import { Activo } from '@/types/activo';
import { EstadoAsignacionInicial } from '@/types/asignacion';

type AssetLike = Partial<Pick<Activo, 'custodioId' | 'estadoAsignacionInicial'>>;

export function resolveInitialAssignmentStatus(activo?: AssetLike | null): EstadoAsignacionInicial {
  if (activo?.estadoAsignacionInicial) {
    return activo.estadoAsignacionInicial;
  }

  return activo?.custodioId ? 'completada' : 'no_requerida';
}

export function canCreateRevision(activo?: AssetLike | null): boolean {
  return Boolean(activo?.custodioId) && resolveInitialAssignmentStatus(activo) === 'completada';
}

export function requiresInitialAssignment(activo?: AssetLike | null): boolean {
  return Boolean(activo?.custodioId) && resolveInitialAssignmentStatus(activo) === 'pendiente';
}
