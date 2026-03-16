import { getIdToken, getIdTokenResult } from 'firebase/auth';

import { auth } from '@/lib/firebase/config';
import { callCallable } from '@/services/callableService';
import { RolUsuario } from '@/types/usuario';

export interface RefreshSessionClaimsResponse {
  role?: RolUsuario;
  active: boolean;
  status: 'ready' | 'no_profile' | 'inactive';
}

export type OperationalSessionErrorCode =
  | 'session_required'
  | 'session_inactive'
  | 'session_no_profile'
  | 'session_role_invalid';

export interface OperationalSessionState {
  role: RolUsuario;
  active: true;
  status: 'ready';
}

export class OperationalSessionError extends Error {
  code: OperationalSessionErrorCode;

  constructor(code: OperationalSessionErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
  }
}

const VALID_ROLES: RolUsuario[] = ['admin', 'logistica', 'custodio'];

function normalizeRole(value: unknown): RolUsuario | undefined {
  return typeof value === 'string' && VALID_ROLES.includes(value as RolUsuario)
    ? (value as RolUsuario)
    : undefined;
}

function buildOperationalSessionError(
  code: OperationalSessionErrorCode,
  cause?: unknown
): OperationalSessionError {
  switch (code) {
    case 'session_required':
      return new OperationalSessionError(
        code,
        'Debe iniciar sesion nuevamente antes de continuar.',
        { cause }
      );
    case 'session_no_profile':
      return new OperationalSessionError(
        code,
        'Tu sesion no tiene un perfil operativo asignado. Cierra sesion e ingresa otra vez.',
        { cause }
      );
    case 'session_role_invalid':
      return new OperationalSessionError(
        code,
        'Tu sesion no tiene el rol requerido para esta operacion. Cierra sesion e ingresa otra vez.',
        { cause }
      );
    case 'session_inactive':
    default:
      return new OperationalSessionError(
        'session_inactive',
        'Tu sesion no esta habilitada para esta operacion. Cierra sesion e ingresa otra vez.',
        { cause }
      );
  }
}

export async function refreshSessionClaims(): Promise<RefreshSessionClaimsResponse> {
  return callCallable<Record<string, never>, RefreshSessionClaimsResponse>(
    'refreshSessionClaims',
    {}
  );
}

export function getOperationalSessionErrorDescription(error: unknown): string | null {
  if (error instanceof OperationalSessionError) {
    return error.message;
  }

  return null;
}

export async function ensureOperationalSession(
  allowedRoles?: RolUsuario[]
): Promise<OperationalSessionState> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw buildOperationalSessionError('session_required');
  }

  let refreshResult: RefreshSessionClaimsResponse | null = null;
  try {
    refreshResult = await refreshSessionClaims();
  } catch (error) {
    console.warn('No fue posible refrescar los claims operativos de la sesion.', error);
  }

  if (refreshResult?.status === 'no_profile') {
    throw buildOperationalSessionError('session_no_profile');
  }

  if (refreshResult?.status === 'inactive' || refreshResult?.active === false) {
    throw buildOperationalSessionError('session_inactive');
  }

  await getIdToken(currentUser, true);
  const tokenResult = await getIdTokenResult(currentUser, true);
  const role = normalizeRole(tokenResult.claims.role);
  const active = tokenResult.claims.active === true;

  if (!active) {
    throw buildOperationalSessionError('session_inactive');
  }

  if (!role || (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role))) {
    throw buildOperationalSessionError('session_role_invalid');
  }

  return {
    role,
    active: true,
    status: 'ready',
  };
}
