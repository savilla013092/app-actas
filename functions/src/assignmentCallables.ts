import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import {
  ActaWorkflowState,
  REGION,
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

interface InitialAssignmentDraftPayload {
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
  descripcion: string;
  observaciones?: string;
}

async function ensureNoExistingAssignment(activoId: string): Promise<void> {
  const snapshot = await db.collection('asignaciones').where('activoId', '==', activoId).limit(10).get();
  const existingAssignment = snapshot.docs.find((doc) => doc.data().estado !== 'anulada');

  if (existingAssignment) {
    throw new functions.https.HttpsError(
      'already-exists',
      'El activo ya tiene una asignación inicial registrada o en proceso.'
    );
  }
}

export const createInitialAssignmentDraft = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['admin', 'logistica']);
  const payload = data as InitialAssignmentDraftPayload;

  if (!payload.activoId || !payload.codigoActivo || !payload.custodioId || !payload.descripcion || !payload.fecha) {
    throw new functions.https.HttpsError('invalid-argument', 'La asignación inicial no contiene los campos obligatorios.');
  }

  const activoRef = db.collection('activos').doc(payload.activoId);
  const activoSnapshot = await activoRef.get();
  if (!activoSnapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'El activo seleccionado ya no existe.');
  }

  const activo = activoSnapshot.data() as {
    custodioId?: string;
    estadoAsignacionInicial?: 'no_requerida' | 'pendiente' | 'completada';
    asignacionInicialId?: string;
  };

  if (!activo.custodioId) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'El activo debe tener custodio asignado antes de registrar su asignación inicial.'
    );
  }

  if (activo.custodioId !== payload.custodioId) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'El custodio del activo cambió. Recargue el formulario antes de continuar.'
    );
  }

  if (activo.estadoAsignacionInicial === 'completada' || activo.asignacionInicialId) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'El activo ya cuenta con una asignación inicial completada.'
    );
  }

  await ensureNoExistingAssignment(payload.activoId);

  const assignmentRef = db.collection('asignaciones').doc();
  const assignmentDoc = stripUndefinedDeep({
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
    descripcion: payload.descripcion,
    observaciones: payload.observaciones,
    evidencias: [],
    estado: 'borrador' as ActaWorkflowState,
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
    creadoPor: actor.uid,
    actualizadoPor: actor.uid,
  });

  await assignmentRef.set(assignmentDoc);
  await activoRef.set(
    {
      estadoAsignacionInicial: 'pendiente',
      actualizadoEn: serverTimestamp(),
      actualizadoPor: actor.uid,
    },
    { merge: true }
  );

  return { id: assignmentRef.id };
});

export const registerInitialAssignmentEvidence = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['admin', 'logistica']);
  const payload = data as { assignmentId?: string; evidences?: UploadedFilePayload[] };

  if (!payload.assignmentId || !Array.isArray(payload.evidences) || payload.evidences.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Debe indicar la asignación y las evidencias.');
  }

  const assignmentRef = db.collection('asignaciones').doc(payload.assignmentId);
  const assignmentSnapshot = await assignmentRef.get();
  if (!assignmentSnapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'La asignación inicial ya no existe.');
  }

  const assignment = assignmentSnapshot.data() as { estado?: ActaWorkflowState; evidencias?: unknown[] };
  if (assignment.estado !== 'borrador' && assignment.estado !== 'pendiente_firma_custodio') {
    throw new functions.https.HttpsError('failed-precondition', 'La asignación no admite nuevas evidencias.');
  }

  payload.evidences.forEach((file) =>
    ensureStoragePath(file.storagePath, `asignaciones-evidencias/${payload.assignmentId}/`)
  );

  const updatedEvidences = [...(assignment.evidencias || []), ...mapUploadedEvidence(payload.evidences)];

  await assignmentRef.update({
    evidencias: updatedEvidences,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: actor.uid,
  });

  return { count: updatedEvidences.length };
});

export const registerInitialAssignmentReviewerSignature = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['admin', 'logistica']);
  const payload = data as { assignmentId?: string; storagePath?: string; url?: string };

  if (!payload.assignmentId || !payload.storagePath || !payload.url) {
    throw new functions.https.HttpsError('invalid-argument', 'Faltan datos de la firma del revisor.');
  }

  ensureStoragePath(payload.storagePath, `asignaciones-firmas/${payload.assignmentId}/`);

  const assignmentRef = db.collection('asignaciones').doc(payload.assignmentId);
  const assignmentSnapshot = await assignmentRef.get();
  if (!assignmentSnapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'La asignación inicial ya no existe.');
  }

  const assignment = assignmentSnapshot.data() as Record<string, unknown>;
  if (assignment.estado !== 'borrador') {
    throw new functions.https.HttpsError('failed-precondition', 'La asignación inicial ya no está en borrador.');
  }

  if (assignment.revisorId !== actor.uid && getContextRole(context) !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Solo el revisor asignado puede firmar este borrador.');
  }

  const { ipCliente, userAgent } = getClientMetadata(context);
  const firma = {
    url: payload.url,
    storagePath: payload.storagePath,
    fechaFirma: new Date().toISOString(),
    ipCliente,
    userAgent,
    hashDocumento: buildDocumentHash(assignment),
    declaracionAceptada: true,
  };

  await assignmentRef.update({
    firmaRevisor: firma,
    estado: 'pendiente_firma_custodio',
    actualizadoEn: serverTimestamp(),
    actualizadoPor: actor.uid,
  });

  return { ok: true };
});

export const registerInitialAssignmentCustodianSignature = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['custodio']);
  const payload = data as {
    assignmentId?: string;
    storagePath?: string;
    url?: string;
    nombre?: string;
    cedula?: string;
  };

  if (!payload.assignmentId || !payload.storagePath || !payload.url || !payload.nombre || !payload.cedula) {
    throw new functions.https.HttpsError('invalid-argument', 'Faltan datos de la firma del custodio.');
  }

  ensureStoragePath(payload.storagePath, `asignaciones-firmas/${payload.assignmentId}/`);

  const assignmentRef = db.collection('asignaciones').doc(payload.assignmentId);
  const assignmentSnapshot = await assignmentRef.get();
  if (!assignmentSnapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'La asignación inicial ya no existe.');
  }

  const assignment = assignmentSnapshot.data() as Record<string, unknown>;
  if (assignment.estado !== 'pendiente_firma_custodio') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'La asignación inicial no está esperando la firma del custodio.'
    );
  }

  if (assignment.custodioId !== actor.uid) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Solo el custodio titular puede firmar esta asignación inicial.'
    );
  }

  const { ipCliente, userAgent } = getClientMetadata(context);
  const firma = {
    url: payload.url,
    storagePath: payload.storagePath,
    fechaFirma: new Date().toISOString(),
    ipCliente,
    userAgent,
    hashDocumento: buildDocumentHash(assignment),
    declaracionAceptada: true,
  };

  await assignmentRef.update({
    firmaCustodio: firma,
    custodioNombre: payload.nombre,
    custodioCedula: payload.cedula,
    estado: 'firmada_completa',
    actualizadoEn: serverTimestamp(),
    actualizadoPor: actor.uid,
  });

  await writeAuditLog({
    accion: 'firmar_asignacion_inicial_custodio',
    modulo: 'asignaciones',
    documentoId: payload.assignmentId,
    usuarioId: actor.uid,
    usuarioEmail: context.auth?.token.email as string | undefined,
    descripcion: 'La asignación inicial fue firmada por el custodio titular.',
  });

  return { ok: true };
});
