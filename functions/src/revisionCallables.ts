import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import {
  ActaWorkflowState,
  REGION,
  RevisionState,
  UploadedFilePayload,
  buildDocumentHash,
  db,
  ensureRole,
  ensureStoragePath,
  getClientMetadata,
  getContextRole,
  mapUploadedEvidence,
  serverTimestamp,
  stripUndefinedDeep,
  writeAuditLog,
} from './security';

interface RevisionDraftPayload {
  activoId: string;
  codigoActivo: string;
  descripcionActivo: string;
  ubicacionActivo: string;
  custodioId: string;
  custodioNombre: string;
  custodioCedula: string;
  custodioCargo: string;
  revisorNombre: string;
  revisorCedula: string;
  revisorCargo: string;
  fecha: string;
  estadoActivo: string;
  descripcion: string;
  observaciones?: string;
}

export const createRevisionDraft = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['admin', 'logistica']);
  const payload = data as RevisionDraftPayload;

  if (!payload.activoId || !payload.codigoActivo || !payload.custodioId || !payload.descripcion || !payload.fecha) {
    throw new functions.https.HttpsError('invalid-argument', 'La revisión no contiene los campos obligatorios.');
  }

  const activoSnapshot = await db.collection('activos').doc(payload.activoId).get();
  if (!activoSnapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'El activo seleccionado ya no existe.');
  }

  const activo = activoSnapshot.data() as {
    custodioId?: string;
    estadoAsignacionInicial?: 'no_requerida' | 'pendiente' | 'completada';
  };
  const estadoAsignacionInicial =
    activo.estadoAsignacionInicial ?? (activo.custodioId ? 'completada' : 'no_requerida');

  if (!activo.custodioId) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'El activo debe tener custodio asignado antes de iniciar una revisión.'
    );
  }

  if (estadoAsignacionInicial !== 'completada') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'La asignación inicial del activo debe estar completada antes de registrar revisiones.'
    );
  }

  if (activo.custodioId !== payload.custodioId) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'El custodio del activo cambió. Recargue el formulario antes de continuar.'
    );
  }

  const revisionRef = db.collection('revisiones').doc();
  const revisionDoc = stripUndefinedDeep({
    activoId: payload.activoId,
    codigoActivo: payload.codigoActivo,
    descripcionActivo: payload.descripcionActivo,
    ubicacionActivo: payload.ubicacionActivo,
    custodioId: payload.custodioId,
    custodioNombre: payload.custodioNombre,
    custodioCedula: payload.custodioCedula,
    custodioCargo: payload.custodioCargo,
    revisorId: actor.uid,
    revisorNombre: payload.revisorNombre,
    revisorCedula: payload.revisorCedula,
    revisorCargo: payload.revisorCargo,
    fecha: admin.firestore.Timestamp.fromDate(new Date(payload.fecha)),
    estadoActivo: payload.estadoActivo,
    descripcion: payload.descripcion,
    observaciones: payload.observaciones,
    evidencias: [],
    estado: 'borrador' as RevisionState,
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
    creadoPor: actor.uid,
    actualizadoPor: actor.uid,
  });

  await revisionRef.set(revisionDoc);

  return { id: revisionRef.id };
});

export const registerRevisionEvidence = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['admin', 'logistica']);
  const payload = data as { revisionId?: string; evidences?: UploadedFilePayload[] };

  if (!payload.revisionId || !Array.isArray(payload.evidences) || payload.evidences.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Debe indicar la revisión y las evidencias.');
  }

  const revisionRef = db.collection('revisiones').doc(payload.revisionId);
  const revisionSnapshot = await revisionRef.get();
  if (!revisionSnapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'La revisión ya no existe.');
  }

  const revision = revisionSnapshot.data() as { estado?: ActaWorkflowState; evidencias?: unknown[] };
  if (revision.estado !== 'borrador' && revision.estado !== 'pendiente_firma_custodio') {
    throw new functions.https.HttpsError('failed-precondition', 'La revisión no admite nuevas evidencias.');
  }

  payload.evidences.forEach((file) => ensureStoragePath(file.storagePath, `evidencias/${payload.revisionId}/`));

  const updatedEvidences = [...(revision.evidencias || []), ...mapUploadedEvidence(payload.evidences)];

  await revisionRef.update({
    evidencias: updatedEvidences,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: actor.uid,
  });

  return { count: updatedEvidences.length };
});

export const registerReviewerSignature = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['admin', 'logistica']);
  const payload = data as { revisionId?: string; storagePath?: string; url?: string };

  if (!payload.revisionId || !payload.storagePath || !payload.url) {
    throw new functions.https.HttpsError('invalid-argument', 'Faltan datos de la firma del revisor.');
  }

  ensureStoragePath(payload.storagePath, `firmas/${payload.revisionId}/`);

  const revisionRef = db.collection('revisiones').doc(payload.revisionId);
  const revisionSnapshot = await revisionRef.get();
  if (!revisionSnapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'La revisión ya no existe.');
  }

  const revision = revisionSnapshot.data() as Record<string, unknown>;
  if (revision.estado !== 'borrador') {
    throw new functions.https.HttpsError('failed-precondition', 'La revisión ya no está en borrador.');
  }

  if (revision.revisorId !== actor.uid && getContextRole(context) !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Solo el revisor asignado puede firmar este borrador.');
  }

  const { ipCliente, userAgent } = getClientMetadata(context);
  const firma = {
    url: payload.url,
    storagePath: payload.storagePath,
    fechaFirma: new Date().toISOString(),
    ipCliente,
    userAgent,
    hashDocumento: buildDocumentHash(revision),
    declaracionAceptada: true,
  };

  await revisionRef.update({
    firmaRevisor: firma,
    estado: 'pendiente_firma_custodio',
    actualizadoEn: serverTimestamp(),
    actualizadoPor: actor.uid,
  });

  return { ok: true };
});

export const registerCustodianSignature = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['custodio']);
  const payload = data as {
    revisionId?: string;
    storagePath?: string;
    url?: string;
    nombre?: string;
    cedula?: string;
  };

  if (!payload.revisionId || !payload.storagePath || !payload.url || !payload.nombre || !payload.cedula) {
    throw new functions.https.HttpsError('invalid-argument', 'Faltan datos de la firma del custodio.');
  }

  ensureStoragePath(payload.storagePath, `firmas/${payload.revisionId}/`);

  const revisionRef = db.collection('revisiones').doc(payload.revisionId);
  const revisionSnapshot = await revisionRef.get();
  if (!revisionSnapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'La revisión ya no existe.');
  }

  const revision = revisionSnapshot.data() as Record<string, unknown>;
  if (revision.estado !== 'pendiente_firma_custodio') {
    throw new functions.https.HttpsError('failed-precondition', 'La revisión no está esperando la firma del custodio.');
  }

  if (revision.custodioId !== actor.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Solo el custodio titular puede firmar esta revisión.');
  }

  const { ipCliente, userAgent } = getClientMetadata(context);
  const firma = {
    url: payload.url,
    storagePath: payload.storagePath,
    fechaFirma: new Date().toISOString(),
    ipCliente,
    userAgent,
    hashDocumento: buildDocumentHash(revision),
    declaracionAceptada: true,
  };

  await revisionRef.update({
    firmaCustodio: firma,
    custodioNombre: payload.nombre,
    custodioCedula: payload.cedula,
    estado: 'firmada_completa',
    actualizadoEn: serverTimestamp(),
    actualizadoPor: actor.uid,
  });

  await writeAuditLog({
    accion: 'firmar_revision_custodio',
    modulo: 'revisiones',
    documentoId: payload.revisionId,
    usuarioId: actor.uid,
    usuarioEmail: context.auth?.token.email as string | undefined,
    descripcion: 'La revisión fue firmada por el custodio titular.',
  });

  return { ok: true };
});
