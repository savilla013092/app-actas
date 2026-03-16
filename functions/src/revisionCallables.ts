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
  resolveStoredFilePath,
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

interface UpdateRevisionDraftPayload {
  revisionId?: string;
  activoId?: string;
  codigoActivo?: string;
  descripcionActivo?: string;
  ubicacionActivo?: string;
  custodioId?: string;
  custodioNombre?: string;
  custodioCedula?: string;
  custodioCargo?: string;
  fecha?: string;
  estadoActivo?: string;
  descripcion?: string;
  observaciones?: string;
}

interface InlineRevisionEvidencePayload {
  nombre?: string;
  descripcion?: string;
  contentType?: string;
  dataBase64?: string;
}

const SUPPORTED_INLINE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_INLINE_EVIDENCE_BYTES = 5 * 1024 * 1024;
const MAX_INLINE_SIGNATURE_BYTES = 500 * 1024;

function sanitizeStorageFileName(fileName: string, contentType: string): string {
  const cleanedBaseName = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  const extension = contentType === 'image/png' ? 'png' : 'jpg';

  return `${cleanedBaseName || 'evidencia'}.${extension}`;
}

function decodeBase64Payload(dataBase64: string, invalidMessage: string): Buffer {
  const normalized = dataBase64.trim();

  if (!normalized) {
    throw new functions.https.HttpsError('invalid-argument', invalidMessage);
  }

  try {
    const buffer = Buffer.from(normalized, 'base64');
    if (buffer.length === 0) {
      throw new Error('EMPTY_BUFFER');
    }

    return buffer;
  } catch (error) {
    throw new functions.https.HttpsError('invalid-argument', invalidMessage, String(error));
  }
}

function parseSignatureDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = dataUrl.match(/^data:(image\/png);base64,(.+)$/);
  if (!match) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'La firma debe enviarse en formato PNG base64.'
    );
  }

  const [, contentType, rawBase64] = match;
  const buffer = decodeBase64Payload(rawBase64, 'La firma suministrada no es valida.');
  if (buffer.length > MAX_INLINE_SIGNATURE_BYTES) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'La firma supera el tamano maximo permitido.'
    );
  }

  return { buffer, contentType };
}

async function storeInlineRevisionEvidenceFiles(
  revisionId: string,
  evidences: InlineRevisionEvidencePayload[]
): Promise<UploadedFilePayload[]> {
  const bucket = admin.storage().bucket();
  const uploadedStoragePaths: string[] = [];
  const uploadedFiles: UploadedFilePayload[] = [];

  try {
    for (let index = 0; index < evidences.length; index += 1) {
      const evidence = evidences[index];
      const contentType = evidence.contentType?.trim();

      if (!contentType || !SUPPORTED_INLINE_IMAGE_TYPES.has(contentType)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Las evidencias solo admiten imagenes JPG o PNG.'
        );
      }

      if (!evidence.dataBase64) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Falta el contenido de una de las evidencias.'
        );
      }

      const buffer = decodeBase64Payload(
        evidence.dataBase64,
        'No fue posible procesar una de las evidencias cargadas.'
      );

      if (buffer.length > MAX_INLINE_EVIDENCE_BYTES) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Una de las evidencias supera el tamano maximo permitido.'
        );
      }

      const nombre = evidence.nombre?.trim() || `Evidencia ${index + 1}`;
      const fileName = `${Date.now()}-${index + 1}-${sanitizeStorageFileName(nombre, contentType)}`;
      const storagePath = `evidencias/${revisionId}/${fileName}`;

      await bucket.file(storagePath).save(buffer, {
        metadata: {
          contentType,
        },
      });

      uploadedStoragePaths.push(storagePath);
      uploadedFiles.push({
        id: fileName,
        storagePath,
        nombre,
        descripcion: evidence.descripcion?.trim(),
      });
    }

    return uploadedFiles;
  } catch (error) {
    await Promise.allSettled(
      uploadedStoragePaths.map((storagePath) =>
        bucket.file(storagePath).delete({ ignoreNotFound: true })
      )
    );

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      'No fue posible almacenar las evidencias de la revision.'
    );
  }
}

async function storeRevisionSignatureFromDataUrl(
  revisionId: string,
  target: 'revisor' | 'custodio',
  signatureDataUrl: string
): Promise<string> {
  const { buffer, contentType } = parseSignatureDataUrl(signatureDataUrl);
  const storagePath = `firmas/${revisionId}/${target}.png`;

  try {
    await admin.storage().bucket().file(storagePath).save(buffer, {
      metadata: {
        contentType,
      },
    });
  } catch (error) {
    throw new functions.https.HttpsError(
      'internal',
      'No fue posible almacenar la firma de la revision.',
      String(error)
    );
  }

  return storagePath;
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

export const updateRevisionDraft = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['admin', 'logistica']);
  const payload = data as UpdateRevisionDraftPayload;

  if (
    !payload.revisionId ||
    !payload.activoId ||
    !payload.codigoActivo ||
    !payload.descripcionActivo ||
    !payload.ubicacionActivo ||
    !payload.custodioId ||
    !payload.custodioNombre ||
    !payload.custodioCedula ||
    !payload.custodioCargo ||
    !payload.fecha ||
    !payload.estadoActivo ||
    !payload.descripcion
  ) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'La actualizacion del borrador no contiene los campos obligatorios.'
    );
  }

  const revisionRef = db.collection('revisiones').doc(payload.revisionId);
  const revisionSnapshot = await revisionRef.get();
  if (!revisionSnapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'La revision ya no existe.');
  }

  const revision = revisionSnapshot.data() as Record<string, unknown>;
  if (revision.estado !== 'borrador') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Solo los borradores pueden editarse.'
    );
  }

  if (revision.revisorId !== actor.uid && getContextRole(context) !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Solo el revisor asignado puede editar este borrador.'
    );
  }

  if (revision.activoId !== payload.activoId) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'El borrador debe mantenerse asociado al mismo activo.'
    );
  }

  const activoSnapshot = await db.collection('activos').doc(payload.activoId).get();
  if (!activoSnapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'El activo asociado ya no existe.');
  }

  const custodioSnapshot = await db.collection('usuarios').doc(payload.custodioId).get();
  if (!custodioSnapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'El custodio indicado ya no existe.');
  }

  const custodio = custodioSnapshot.data() as { rol?: string; activo?: boolean };
  if (custodio.rol !== 'custodio' || custodio.activo !== true) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'El custodio seleccionado debe estar activo y tener rol de custodio.'
    );
  }

  await revisionRef.update(
    stripUndefinedDeep({
      codigoActivo: payload.codigoActivo,
      descripcionActivo: payload.descripcionActivo,
      ubicacionActivo: payload.ubicacionActivo,
      custodioId: payload.custodioId,
      custodioNombre: payload.custodioNombre,
      custodioCedula: payload.custodioCedula,
      custodioCargo: payload.custodioCargo,
      fecha: admin.firestore.Timestamp.fromDate(new Date(payload.fecha)),
      estadoActivo: payload.estadoActivo,
      descripcion: payload.descripcion,
      observaciones: payload.observaciones,
      actualizadoEn: serverTimestamp(),
      actualizadoPor: actor.uid,
    })
  );

  await writeAuditLog({
    accion: 'actualizar_revision_borrador',
    modulo: 'revisiones',
    documentoId: payload.revisionId,
    usuarioId: actor.uid,
    usuarioEmail: context.auth?.token.email as string | undefined,
    descripcion: 'Se actualizo un borrador de revision.',
  });

  return { ok: true };
});

export const registerRevisionEvidence = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['admin', 'logistica']);
  const payload = data as {
    revisionId?: string;
    evidences?: UploadedFilePayload[];
    inlineFiles?: InlineRevisionEvidencePayload[];
  };

  if (!payload.revisionId) {
    throw new functions.https.HttpsError('invalid-argument', 'Debe indicar la revision y las evidencias.');
  }

  const hasStoredFiles = Array.isArray(payload.evidences) && payload.evidences.length > 0;
  const hasInlineFiles = Array.isArray(payload.inlineFiles) && payload.inlineFiles.length > 0;

  if (!hasStoredFiles && !hasInlineFiles) {
    throw new functions.https.HttpsError('invalid-argument', 'Debe indicar la revision y las evidencias.');
  }

  const revisionRef = db.collection('revisiones').doc(payload.revisionId);
  const revisionSnapshot = await revisionRef.get();
  if (!revisionSnapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'La revision ya no existe.');
  }

  const revision = revisionSnapshot.data() as { estado?: ActaWorkflowState; evidencias?: unknown[] };
  if (revision.estado !== 'borrador' && revision.estado !== 'pendiente_firma_custodio') {
    throw new functions.https.HttpsError('failed-precondition', 'La revision no admite nuevas evidencias.');
  }

  const uploadedFiles = hasInlineFiles
    ? await storeInlineRevisionEvidenceFiles(payload.revisionId, payload.inlineFiles || [])
    : (payload.evidences || []);

  uploadedFiles.forEach((file) => ensureStoragePath(file.storagePath, `evidencias/${payload.revisionId}/`));

  const mappedEvidences = mapUploadedEvidence(uploadedFiles);
  const updatedEvidences = [...(revision.evidencias || []), ...mappedEvidences];

  try {
    await revisionRef.update({
      evidencias: updatedEvidences,
      actualizadoEn: serverTimestamp(),
      actualizadoPor: actor.uid,
    });
  } catch (error) {
    if (hasInlineFiles) {
      await Promise.allSettled(
        uploadedFiles.map((file) =>
          admin.storage().bucket().file(file.storagePath).delete({ ignoreNotFound: true })
        )
      );
    }

    throw error;
  }

  return {
    count: updatedEvidences.length,
    evidences: mappedEvidences,
  };
});

export const deleteRevisionDraftEvidence = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['admin', 'logistica']);
  const payload = data as { revisionId?: string; evidenceId?: string };

  if (!payload.revisionId || !payload.evidenceId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Debe indicar la revision y la evidencia a eliminar.'
    );
  }

  const revisionRef = db.collection('revisiones').doc(payload.revisionId);
  const revisionSnapshot = await revisionRef.get();
  if (!revisionSnapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'La revision ya no existe.');
  }

  const revision = revisionSnapshot.data() as {
    estado?: ActaWorkflowState;
    revisorId?: string;
    evidencias?: Array<{ id?: string; storagePath?: string; url?: string }>;
  };

  if (revision.estado !== 'borrador') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Solo los borradores permiten eliminar evidencias.'
    );
  }

  if (revision.revisorId !== actor.uid && getContextRole(context) !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Solo el revisor asignado puede modificar este borrador.'
    );
  }

  const evidencias = revision.evidencias || [];
  const evidenceToDelete = evidencias.find((evidencia) => evidencia.id === payload.evidenceId);
  if (!evidenceToDelete) {
    throw new functions.https.HttpsError('not-found', 'La evidencia indicada no existe en este borrador.');
  }

  const updatedEvidences = evidencias.filter((evidencia) => evidencia.id !== payload.evidenceId);
  await revisionRef.update({
    evidencias: updatedEvidences,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: actor.uid,
  });

  const storagePath = resolveStoredFilePath(evidenceToDelete, admin.storage().bucket().name);
  await admin.storage().bucket().file(storagePath).delete({ ignoreNotFound: true });

  await writeAuditLog({
    accion: 'eliminar_evidencia_revision_borrador',
    modulo: 'revisiones',
    documentoId: payload.revisionId,
    usuarioId: actor.uid,
    usuarioEmail: context.auth?.token.email as string | undefined,
    descripcion: 'Se elimino una evidencia de un borrador de revision.',
  });

  return { ok: true };
});

export const registerReviewerSignature = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['admin', 'logistica']);
  const payload = data as {
    revisionId?: string;
    storagePath?: string;
    signatureDataUrl?: string;
    url?: string;
  };

  if (!payload.revisionId || (!payload.storagePath && !payload.signatureDataUrl)) {
    throw new functions.https.HttpsError('invalid-argument', 'Faltan datos de la firma del revisor.');
  }

  const revisionRef = db.collection('revisiones').doc(payload.revisionId);
  const revisionSnapshot = await revisionRef.get();
  if (!revisionSnapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'La revision ya no existe.');
  }

  const revision = revisionSnapshot.data() as Record<string, unknown>;
  if (revision.estado !== 'borrador') {
    throw new functions.https.HttpsError('failed-precondition', 'La revision ya no esta en borrador.');
  }

  if (revision.revisorId !== actor.uid && getContextRole(context) !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Solo el revisor asignado puede firmar este borrador.');
  }

  const storagePath = payload.storagePath
    ? payload.storagePath
    : await storeRevisionSignatureFromDataUrl(
        payload.revisionId,
        'revisor',
        payload.signatureDataUrl || ''
      );

  ensureStoragePath(storagePath, `firmas/${payload.revisionId}/`);

  const { ipCliente, userAgent } = getClientMetadata(context);
  const firma = stripUndefinedDeep({
    ...(payload.url ? { url: payload.url } : {}),
    storagePath,
    fechaFirma: new Date().toISOString(),
    ipCliente,
    userAgent,
    hashDocumento: buildDocumentHash(revision),
    declaracionAceptada: true,
  });

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
    signatureDataUrl?: string;
    url?: string;
    nombre?: string;
    cedula?: string;
  };

  if (!payload.revisionId || (!payload.storagePath && !payload.signatureDataUrl) || !payload.nombre || !payload.cedula) {
    throw new functions.https.HttpsError('invalid-argument', 'Faltan datos de la firma del custodio.');
  }

  const revisionRef = db.collection('revisiones').doc(payload.revisionId);
  const revisionSnapshot = await revisionRef.get();
  if (!revisionSnapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'La revision ya no existe.');
  }

  const revision = revisionSnapshot.data() as Record<string, unknown>;
  if (revision.estado !== 'pendiente_firma_custodio') {
    throw new functions.https.HttpsError('failed-precondition', 'La revision no esta esperando la firma del custodio.');
  }

  if (revision.custodioId !== actor.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Solo el custodio titular puede firmar esta revision.');
  }

  const storagePath = payload.storagePath
    ? payload.storagePath
    : await storeRevisionSignatureFromDataUrl(
        payload.revisionId,
        'custodio',
        payload.signatureDataUrl || ''
      );

  ensureStoragePath(storagePath, `firmas/${payload.revisionId}/`);

  const { ipCliente, userAgent } = getClientMetadata(context);
  const firma = stripUndefinedDeep({
    ...(payload.url ? { url: payload.url } : {}),
    storagePath,
    fechaFirma: new Date().toISOString(),
    ipCliente,
    userAgent,
    hashDocumento: buildDocumentHash(revision),
    declaracionAceptada: true,
  });

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
    descripcion: 'La revision fue firmada por el custodio titular.',
  });

  return { ok: true };
});

