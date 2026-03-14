import { createHash } from 'crypto';

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import { normalizeClassificationCode, resolveClassificationName, resolveLocationName } from './assetCatalogs';

export const db = admin.firestore();
export const storage = admin.storage();
export const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
export const REGION = 'us-central1';
export const UNKNOWN_LOCATION = 'Sin asignar';
export const VALID_ROLES = new Set(['admin', 'logistica', 'custodio']);

export type Role = 'admin' | 'logistica' | 'custodio';

export type ActaWorkflowState =
  | 'borrador'
  | 'pendiente_firma_custodio'
  | 'firmada_completa'
  | 'completada'
  | 'anulada';

export type RevisionState = ActaWorkflowState;

export interface ManagedUserProfile {
  email: string;
  nombre: string;
  cedula: string;
  cargo: string;
  dependencia: string;
  telefono?: string;
  rol: Role;
  activo: boolean;
}

export interface AuditLogPayload {
  accion: string;
  modulo: string;
  documentoId?: string;
  usuarioId?: string;
  usuarioEmail?: string | null;
  descripcion: string;
  datosAntes?: unknown;
  datosDespues?: unknown;
  metadata?: Record<string, unknown>;
}

export interface UploadedFilePayload {
  id: string;
  storagePath: string;
  url?: string;
  nombre: string;
  descripcion?: string;
}

export interface ExpressLoanAssetSnapshot {
  codigo: string;
  descripcion: string;
  categoria: string;
  marca?: string;
  modelo?: string;
  serial?: string;
  ubicacion: string;
  dependencia: string;
  custodioNombre: string;
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function tokenizeSearchParts(parts: Array<string | undefined>): string[] {
  const tokenSet = new Set<string>();

  for (const part of parts) {
    if (!part) {
      continue;
    }

    const normalized = normalizeText(part).replace(/[^a-z0-9]+/g, ' ');
    for (const token of normalized.split(/\s+/)) {
      if (token.length >= 2) {
        tokenSet.add(token);
      }
    }
  }

  return Array.from(tokenSet).slice(0, 40);
}

export function buildAssetSearchPayload(asset: Record<string, unknown>) {
  const codigo = typeof asset.codigo === 'string' ? asset.codigo : '';
  const serial = typeof asset.serial === 'string' ? asset.serial : '';
  const classificationCode = normalizeClassificationCode(codigo);
  const classificationName = resolveClassificationName(
    codigo,
    typeof asset.categoria === 'string' ? asset.categoria : undefined
  );
  const locationName = resolveLocationName(
    typeof asset.ubicacion === 'string' || typeof asset.ubicacion === 'number'
      ? asset.ubicacion
      : undefined
  );

  return {
    codigo: normalizeText(codigo),
    ...(serial ? { serial: normalizeText(serial) } : {}),
    ...(classificationCode ? { classificationCode } : {}),
    classificationName,
    locationName,
    tokens: tokenizeSearchParts([
      codigo,
      typeof asset.descripcion === 'string' ? asset.descripcion : undefined,
      serial,
      typeof asset.marca === 'string' ? asset.marca : undefined,
      typeof asset.modelo === 'string' ? asset.modelo : undefined,
      classificationName,
      locationName,
    ]),
  };
}

export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T;
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefinedDeep(entryValue)])
    ) as T;
  }

  return value;
}

export function getContextRole(context: functions.https.CallableContext): Role | undefined {
  const role = context.auth?.token.role;
  return role === 'admin' || role === 'logistica' || role === 'custodio' ? role : undefined;
}

type CallableAuth = NonNullable<functions.https.CallableContext['auth']>;

export function ensureAuthenticated(
  context: functions.https.CallableContext
): CallableAuth {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debe iniciar sesiÃ³n para continuar.');
  }
  return context.auth;
}

export function ensureRole(
  context: functions.https.CallableContext,
  allowedRoles: Role[]
): CallableAuth {
  const authData = ensureAuthenticated(context);
  const role = getContextRole(context);

  if (!role || !allowedRoles.includes(role) || context.auth?.token.active !== true) {
    throw new functions.https.HttpsError('permission-denied', 'No tiene permisos para esta operaciÃ³n.');
  }

  return authData;
}

export async function getUserProfile(uid: string): Promise<ManagedUserProfile | null> {
  const snapshot = await db.collection('usuarios').doc(uid).get();
  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() as ManagedUserProfile;
}

export async function syncUserClaims(uid: string, profile: ManagedUserProfile | null): Promise<void> {
  if (!profile || profile.activo !== true || !VALID_ROLES.has(profile.rol)) {
    await admin.auth().setCustomUserClaims(uid, null);
    return;
  }

  await admin.auth().setCustomUserClaims(uid, {
    role: profile.rol,
    active: true,
  });
}

export async function writeAuditLog(payload: AuditLogPayload): Promise<void> {
  await db.collection('auditoria').add({
    ...payload,
    timestamp: serverTimestamp(),
  });
}

export function ensureStoragePath(storagePath: string, expectedPrefix: string): void {
  if (!storagePath.startsWith(expectedPrefix)) {
    throw new functions.https.HttpsError('invalid-argument', 'La ruta del archivo no es vÃ¡lida.');
  }
}

export function resolveStoredFilePath(
  file: { storagePath?: string; url?: string } | undefined,
  bucketName: string
): string {
  if (file?.storagePath) {
    return file.storagePath;
  }

  const url = file?.url;
  if (!url) {
    throw new Error('STORAGE_PATH_REQUIRED');
  }

  if (url.includes('firebasestorage.googleapis.com')) {
    const match = url.match(/\/o\/([^?]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }

  if (url.includes('storage.googleapis.com')) {
    const withoutBucket = url.replace(`https://storage.googleapis.com/${bucketName}/`, '');
    return decodeURIComponent(withoutBucket.split('?')[0]);
  }

  return decodeURIComponent(url.split('?')[0]);
}

export function getClientMetadata(context: functions.https.CallableContext) {
  const request = context.rawRequest;
  const forwardedFor = request.headers['x-forwarded-for'];
  const ipCliente = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : typeof forwardedFor === 'string'
    ? forwardedFor.split(',')[0]?.trim()
    : request.ip || 'IP no disponible';

  return {
    ipCliente,
    userAgent: request.get('user-agent') || 'User-Agent no disponible',
  };
}

export function buildDocumentHash(data: unknown): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

export function toIsoDateString(value?: string): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new functions.https.HttpsError('invalid-argument', 'La fecha suministrada no es vÃ¡lida.');
  }

  return date.toISOString();
}

export function mapUploadedEvidence(files: UploadedFilePayload[]) {
  return files.map((file) => ({
    id: file.id,
    ...(file.url ? { url: file.url } : {}),
    nombre: file.nombre,
    descripcion: file.descripcion,
    storagePath: file.storagePath,
    subidaEn: new Date().toISOString(),
  }));
}

export function parseExcelDate(value: unknown): Date | null {
  if (!value || value === '30/12/1899') {
    return null;
  }

  if (typeof value === 'number') {
    return new Date((value - 25569) * 86400 * 1000);
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeLocation(value: unknown): string {
  return resolveLocationName(
    value === undefined || value === null ? undefined : (value as string | number)
  );
}


