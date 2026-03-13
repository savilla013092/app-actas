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
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { db, storage } from '@/lib/firebase/config';
import { callCallable } from '@/services/callableService';
import { uploadEvidenceBatch } from '@/services/evidenceUploadService';
import { AsignacionInicial, Evidencia } from '@/types/asignacion';

const COLLECTION = 'asignaciones';

const mapAsignacion = (docId: string, data: Record<string, unknown>) => ({
  id: docId,
  ...data,
}) as AsignacionInicial;

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

  await uploadBytes(storageRef, blob, { contentType: 'image/png' });
  const url = await getDownloadURL(storageRef);

  await callCallable<{ assignmentId: string; storagePath: string; url: string }, { ok: boolean }>(
    'registerInitialAssignmentReviewerSignature',
    {
      assignmentId,
      storagePath,
      url,
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

  await uploadBytes(storageRef, blob, { contentType: 'image/png' });
  const url = await getDownloadURL(storageRef);

  await callCallable<
    { assignmentId: string; storagePath: string; url: string; nombre: string; cedula: string },
    { ok: boolean }
  >('registerInitialAssignmentCustodianSignature', {
    assignmentId,
    storagePath,
    url,
    nombre: datosFirmante.nombre.trim(),
    cedula: datosFirmante.cedula.trim(),
  });
}

export async function obtenerAsignacionInicial(id: string): Promise<AsignacionInicial | null> {
  const docSnap = await getDoc(doc(db, COLLECTION, id));
  if (!docSnap.exists()) return null;
  return mapAsignacion(docSnap.id, docSnap.data());
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
  return firstDoc ? mapAsignacion(firstDoc.id, firstDoc.data()) : null;
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
