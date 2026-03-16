import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import { generarConsecutivo } from './consecutivos';
import { generarActaAsignacionPDF } from './generarActaAsignacionPDF';
import { generarActaPDF } from './generarActaPDF';
import {
  ManagedUserProfile,
  REGION,
  buildAssetSearchPayload,
  db,
  serverTimestamp,
  storage,
  stripUndefinedDeep,
  syncUserClaims,
  writeAuditLog,
} from './security';

function hasStoredFileReference(file: { storagePath?: string; url?: string } | undefined) {
  return Boolean(file?.storagePath || file?.url);
}

export const onUsuarioWriteSyncClaims = functions.region(REGION).firestore
  .document('usuarios/{userId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) {
      await admin.auth().setCustomUserClaims(context.params.userId, null).catch((): undefined => undefined);
      return null;
    }

    const profile = change.after.data() as ManagedUserProfile;
    await syncUserClaims(context.params.userId, profile);
    return null;
  });

export const onActivoWriteSyncSearch = functions.region(REGION).firestore
  .document('activos/{activoId}')
  .onWrite(async (change) => {
    if (!change.after.exists) {
      return null;
    }

    const afterData = change.after.data() as Record<string, unknown>;
    const nextSearch = buildAssetSearchPayload(afterData);
    const currentSearch = afterData.search as Record<string, unknown> | undefined;

    const currentSignature = JSON.stringify(stripUndefinedDeep(currentSearch || {}));
    const nextSignature = JSON.stringify(stripUndefinedDeep(nextSearch));

    if (currentSignature === nextSignature) {
      return null;
    }

    await change.after.ref.set({ search: nextSearch }, { merge: true });
    return null;
  });

export const onRevisionFirmadaCompleta = functions.region(REGION).firestore
  .document('revisiones/{revisionId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const revisionId = context.params.revisionId;

    if (beforeData.estado === 'firmada_completa' || afterData.estado !== 'firmada_completa') {
      return null;
    }

    if (
      !hasStoredFileReference(afterData.firmaRevisor) ||
      !hasStoredFileReference(afterData.firmaCustodio)
    ) {
      console.error('La revisión firmada no tiene ambas firmas.', revisionId);
      return null;
    }

    try {
      const numeroActa = await generarConsecutivo(db);
      const pdfBuffer = await generarActaPDF({
        numeroActa,
        revision: afterData,
        storage,
      });

      const bucket = storage.bucket();
      const pdfPath = `actas/${revisionId}.pdf`;
      const file = bucket.file(pdfPath);

      await file.save(pdfBuffer, {
        metadata: {
          contentType: 'application/pdf',
        },
      });

      await file.makePublic();
      const pdfUrl = `https://storage.googleapis.com/${bucket.name}/${pdfPath}`;

      await change.after.ref.update({
        numeroActa,
        actaPdfUrl: pdfUrl,
        estado: 'completada',
        actualizadoEn: serverTimestamp(),
      });

      await writeAuditLog({
        accion: 'completar_revision',
        modulo: 'revisiones',
        documentoId: revisionId,
        usuarioId: 'system',
        usuarioEmail: 'system@serviciudad.gov.co',
        descripcion: `Acta ${numeroActa} generada automáticamente.`,
      });

      return { success: true, numeroActa };
    } catch (error) {
      console.error('Error al generar el acta PDF:', error);
      await change.after.ref.update({
        estado: 'anulada',
        errorMensaje: String(error),
        actualizadoEn: serverTimestamp(),
      });
      return { success: false, error: String(error) };
    }
  });

export const onAsignacionFirmadaCompleta = functions.region(REGION).firestore
  .document('asignaciones/{assignmentId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const assignmentId = context.params.assignmentId;

    if (beforeData.estado === 'firmada_completa' || afterData.estado !== 'firmada_completa') {
      return null;
    }

    if (
      !hasStoredFileReference(afterData.firmaRevisor) ||
      !hasStoredFileReference(afterData.firmaCustodio)
    ) {
      console.error('La asignación firmada no tiene ambas firmas.', assignmentId);
      return null;
    }

    try {
      const numeroActa = await generarConsecutivo(db);
      const pdfBuffer = await generarActaAsignacionPDF({
        numeroActa,
        asignacion: afterData,
        storage,
      });

      const bucket = storage.bucket();
      const pdfPath = `actas/asignacion-${assignmentId}.pdf`;
      const file = bucket.file(pdfPath);

      await file.save(pdfBuffer, {
        metadata: {
          contentType: 'application/pdf',
        },
      });

      await file.makePublic();
      const pdfUrl = `https://storage.googleapis.com/${bucket.name}/${pdfPath}`;

      await Promise.all([
        change.after.ref.update({
          numeroActa,
          actaPdfUrl: pdfUrl,
          estado: 'completada',
          actualizadoEn: serverTimestamp(),
        }),
        db.collection('activos').doc(afterData.activoId).set(
          {
            estadoAsignacionInicial: 'completada',
            asignacionInicialId: assignmentId,
            asignacionInicialCompletadaEn: serverTimestamp(),
            actualizadoEn: serverTimestamp(),
            actualizadoPor: 'system',
          },
          { merge: true }
        ),
      ]);

      await writeAuditLog({
        accion: 'completar_asignacion_inicial',
        modulo: 'asignaciones',
        documentoId: assignmentId,
        usuarioId: 'system',
        usuarioEmail: 'system@serviciudad.gov.co',
        descripcion: `Acta ${numeroActa} de asignación inicial generada automáticamente.`,
      });

      return { success: true, numeroActa };
    } catch (error) {
      console.error('Error al generar el acta PDF de asignación inicial:', error);
      await change.after.ref.update({
        estado: 'anulada',
        errorMensaje: String(error),
        actualizadoEn: serverTimestamp(),
      });
      return { success: false, error: String(error) };
    }
  });

export const onDocumentoModificado = functions.region(REGION).firestore
  .document('{coleccion}/{docId}')
  .onWrite(async (change, context) => {
    const collectionName = context.params.coleccion;
    if (!['usuarios', 'activos', 'revisiones', 'asignaciones', 'express_loans'].includes(collectionName)) {
      return null;
    }

    const beforeData = change.before.exists ? change.before.data() : null;
    const afterData = change.after.exists ? change.after.data() : null;

    let action = 'modificar';
    if (!beforeData && afterData) {
      action = 'crear';
    } else if (beforeData && !afterData) {
      action = 'eliminar';
    }

    const userId = (afterData?.actualizadoPor || afterData?.creadoPor || 'desconocido') as string;

    await db.collection('auditoria').add({
      accion: action,
      modulo: collectionName,
      documentoId: context.params.docId,
      usuarioId: userId,
      datosAntes: beforeData,
      datosDespues: afterData,
      timestamp: serverTimestamp(),
    });

    return null;
  });
