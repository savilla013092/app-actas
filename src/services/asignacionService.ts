import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  QueryConstraint,
  where,
} from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';

import { db, storage } from '@/lib/firebase/config';
import { callCallable } from '@/services/callableService';
import { resolveStorageDownloadUrl } from '@/services/storageFileService';
import { uploadEvidenceBatch } from '@/services/evidenceUploadService';
import { AsignacionInicial, Evidencia } from '@/types/asignacion';

const COLLECTION = 'asignaciones';

async function toUploadBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

const mapAsignacion = (docId: string, data: Record<string, unknown>) => ({
  id: docId,
  ...data,
}) as AsignacionInicial;

const hydrateAssignmentEvidence = async (evidencia: Evidencia): Promise<Evidencia> => ({
  ...evidencia,
  url: await resolveStorageDownloadUrl(evidencia.storagePath, evidencia.url),
});

const hydrateAssignmentMedia = async (
  assignment: AsignacionInicial
): Promise<AsignacionInicial> => ({
  ...assignment,
  evidencias: await Promise.all((assignment.evidencias || []).map(hydrateAssignmentEvidence)),
  firmaRevisor: assignment.firmaRevisor
    ? {
        ...assignment.firmaRevisor,
        url: await resolveStorageDownloadUrl(
          assignment.firmaRevisor.storagePath,
          assignment.firmaRevisor.url
        ),
      }
    : undefined,
  firmaCustodio: assignment.firmaCustodio
    ? {
        ...assignment.firmaCustodio,
        url: await resolveStorageDownloadUrl(
          assignment.firmaCustodio.storagePath,
          assignment.firmaCustodio.url
        ),
      }
    : undefined,
});

export async function crearAsignacionInicial(
  data: Omit<AsignacionInicial, 'id' | 'creadoEn' | 'actualizadoEn' | 'evidencias'>
): Promise<string> {
  const response = await callCallable<Record<string, unknown>, { id: string }>(
    'createInitialAssignmentDraft',
    {
      ...data,
      fecha: new Date(data.fecha).toISOString(),
    }
  );

  return response.id;
}

export async function subirEvidenciasAsignacion(
  assignmentId: string,
  archivos: File[]
): Promise<Evidencia[]> {
  return uploadEvidenceBatch({
    documentId: assignmentId,
    documentIdField: 'assignmentId',
    storagePrefix: 'asignaciones-evidencias',
    registerCallable: 'registerInitialAssignmentEvidence',
    files: archivos,
    buildNombre: (index) => `Evidencia ${index + 1}`,
    buildDescripcion: (index) => `Fotografía de asignación inicial ${index + 1}`,
  });
}

export async function firmarAsignacionComoRevisor(
  assignmentId: string,
  firmaDataUrl: string,
  _datosAsignacion: object
): Promise<void> {
  const blob = await (await fetch(firmaDataUrl)).blob();
  const storagePath = `asignaciones-firmas/${assignmentId}/revisor.png`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, await toUploadBytes(blob), { contentType: 'image/png' });
  await callCallable<{ assignmentId: string; storagePath: string }, { ok: boolean }>(
    'registerInitialAssignmentReviewerSignature',
    {
      assignmentId,
      storagePath,
    }
  );
}

export async function firmarAsignacionComoCustodio(
  assignmentId: string,
  firmaDataUrl: string,
  _datosAsignacion: object,
  datosFirmante?: { nombre: string; cedula: string }
): Promise<void> {
  if (!datosFirmante?.nombre?.trim() || !datosFirmante?.cedula?.trim()) {
    throw new Error('FIRMANTE_REQUIRED');
  }

  const blob = await (await fetch(firmaDataUrl)).blob();
  const storagePath = `asignaciones-firmas/${assignmentId}/custodio.png`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, await toUploadBytes(blob), { contentType: 'image/png' });
  await callCallable<
    { assignmentId: string; storagePath: string; nombre: string; cedula: string },
    { ok: boolean }
  >('registerInitialAssignmentCustodianSignature', {
    assignmentId,
    storagePath,
    nombre: datosFirmante.nombre.trim(),
    cedula: datosFirmante.cedula.trim(),
  });
}

export async function obtenerAsignacionInicial(id: string): Promise<AsignacionInicial | null> {
  const docSnap = await getDoc(doc(db, COLLECTION, id));
  if (!docSnap.exists()) return null;
  return hydrateAssignmentMedia(mapAsignacion(docSnap.id, docSnap.data()));
}

export async function obtenerAsignacionInicialPorActivo(
  activoId: string
): Promise<AsignacionInicial | null> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTION),
      where('activoId', '==', activoId),
      orderBy('fecha', 'desc'),
      limit(1)
    )
  );

  const [firstDoc] = snapshot.docs;
  return firstDoc ? hydrateAssignmentMedia(mapAsignacion(firstDoc.id, firstDoc.data())) : null;
}

export async function obtenerAsignacionesPendientesFirma(
  custodioId: string
): Promise<AsignacionInicial[]> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTION),
      where('custodioId', '==', custodioId),
      where('estado', '==', 'pendiente_firma_custodio'),
      orderBy('fecha', 'desc')
    )
  );

  return snapshot.docs.map((docSnapshot) => mapAsignacion(docSnapshot.id, docSnapshot.data()));
}

export async function obtenerTodasAsignacionesPendientes(
  limitItems?: number
): Promise<AsignacionInicial[]> {
  const constraints: QueryConstraint[] = [
    where('estado', '==', 'pendiente_firma_custodio'),
    orderBy('fecha', 'desc'),
  ];

  if (limitItems) {
    constraints.push(limit(limitItems));
  }

  const snapshot = await getDocs(query(collection(db, COLLECTION), ...constraints));
  return snapshot.docs.map((docSnapshot) => mapAsignacion(docSnapshot.id, docSnapshot.data()));
}
