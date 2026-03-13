import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  QueryConstraint,
  startAfter,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { db, storage } from '@/lib/firebase/config';
import { callCallable } from '@/services/callableService';
import { uploadEvidenceBatch } from '@/services/evidenceUploadService';
import { Evidencia, Revision } from '@/types/revision';

const COLLECTION = 'revisiones';
const DEFAULT_PAGE_SIZE = 50;

const mapRevision = (docId: string, data: Record<string, unknown>) => ({
  id: docId,
  ...data,
}) as Revision;

const buildRevisionFilters = ({
  custodioId,
  onlyPendingCustodian,
}: {
  custodioId?: string;
  onlyPendingCustodian?: boolean;
}): QueryConstraint[] => {
  const constraints: QueryConstraint[] = [];

  if (custodioId) {
    constraints.push(where('custodioId', '==', custodioId));
  }

  if (onlyPendingCustodian) {
    constraints.push(where('estado', '==', 'pendiente_firma_custodio'));
  }

  return constraints;
};

export interface PaginatedRevisionesOptions {
  custodioId?: string;
  onlyPendingCustodian?: boolean;
  cursor?: Revision['fecha'] | null;
  pageSize?: number;
}

export interface PaginatedRevisionesResult {
  items: Revision[];
  nextCursor: Revision['fecha'] | null;
  hasMore: boolean;
  totalCount: number;
}

export async function crearRevision(
  data: Omit<Revision, 'id' | 'creadoEn' | 'actualizadoEn' | 'evidencias'>
): Promise<string> {
  const response = await callCallable<Record<string, unknown>, { id: string }>('createRevisionDraft', {
    ...data,
    fecha: new Date(data.fecha).toISOString(),
  });

  return response.id;
}

export async function subirEvidencias(
  revisionId: string,
  archivos: File[]
): Promise<Evidencia[]> {
  return uploadEvidenceBatch({
    documentId: revisionId,
    documentIdField: 'revisionId',
    storagePrefix: 'evidencias',
    registerCallable: 'registerRevisionEvidence',
    files: archivos,
    buildNombre: (index) => `Evidencia ${index + 1}`,
    buildDescripcion: (index) => `Fotografía de revisión ${index + 1}`,
  });
}

export async function subirEvidencia(
  revisionId: string,
  archivo: File,
  nombre: string,
  descripcion?: string
): Promise<Evidencia> {
  const evidencias = await uploadEvidenceBatch({
    documentId: revisionId,
    documentIdField: 'revisionId',
    storagePrefix: 'evidencias',
    registerCallable: 'registerRevisionEvidence',
    files: [archivo],
    buildNombre: () => nombre,
    buildDescripcion: () => descripcion,
  });

  return evidencias[0];
}

export async function firmarComoRevisor(
  revisionId: string,
  firmaDataUrl: string,
  _datosRevision: object
): Promise<void> {
  const blob = await (await fetch(firmaDataUrl)).blob();
  const storagePath = `firmas/${revisionId}/revisor.png`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, blob, { contentType: 'image/png' });
  const url = await getDownloadURL(storageRef);

  await callCallable<{ revisionId: string; storagePath: string; url: string }, { ok: boolean }>(
    'registerReviewerSignature',
    {
      revisionId,
      storagePath,
      url,
    }
  );
}

export async function firmarComoCustodio(
  revisionId: string,
  firmaDataUrl: string,
  _datosRevision: object,
  datosFirmante?: { nombre: string; cedula: string }
): Promise<void> {
  if (!datosFirmante?.nombre?.trim() || !datosFirmante?.cedula?.trim()) {
    throw new Error('FIRMANTE_REQUIRED');
  }

  const blob = await (await fetch(firmaDataUrl)).blob();
  const storagePath = `firmas/${revisionId}/custodio.png`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, blob, { contentType: 'image/png' });
  const url = await getDownloadURL(storageRef);

  await callCallable<
    { revisionId: string; storagePath: string; url: string; nombre: string; cedula: string },
    { ok: boolean }
  >('registerCustodianSignature', {
    revisionId,
    storagePath,
    url,
    nombre: datosFirmante.nombre.trim(),
    cedula: datosFirmante.cedula.trim(),
  });
}

export async function obtenerRevisionesPendientesFirma(custodioId: string): Promise<Revision[]> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTION),
      where('custodioId', '==', custodioId),
      where('estado', '==', 'pendiente_firma_custodio'),
      orderBy('fecha', 'desc')
    )
  );

  return snapshot.docs.map((docSnapshot) => mapRevision(docSnapshot.id, docSnapshot.data()));
}

export async function obtenerRevisionesPorRevisor(revisorId: string): Promise<Revision[]> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTION),
      where('revisorId', '==', revisorId),
      orderBy('fecha', 'desc')
    )
  );

  return snapshot.docs.map((docSnapshot) => mapRevision(docSnapshot.id, docSnapshot.data()));
}

export async function obtenerRevision(id: string): Promise<Revision | null> {
  const docSnap = await getDoc(doc(db, COLLECTION, id));
  if (!docSnap.exists()) return null;
  return mapRevision(docSnap.id, docSnap.data());
}

export async function obtenerRevisionesPorActivo(activoId: string): Promise<Revision[]> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTION),
      where('activoId', '==', activoId),
      orderBy('fecha', 'desc')
    )
  );

  return snapshot.docs.map((docSnapshot) => mapRevision(docSnapshot.id, docSnapshot.data()));
}

export async function obtenerRevisionesPaginadas({
  custodioId,
  onlyPendingCustodian = false,
  cursor = null,
  pageSize = DEFAULT_PAGE_SIZE,
}: PaginatedRevisionesOptions = {}): Promise<PaginatedRevisionesResult> {
  const collectionRef = collection(db, COLLECTION);
  const filterConstraints = buildRevisionFilters({ custodioId, onlyPendingCustodian });
  const pageConstraints: QueryConstraint[] = [...filterConstraints, orderBy('fecha', 'desc')];

  if (cursor) {
    pageConstraints.push(startAfter(cursor));
  }

  pageConstraints.push(limit(pageSize));

  const [snapshot, countSnapshot] = await Promise.all([
    getDocs(query(collectionRef, ...pageConstraints)),
    getCountFromServer(query(collectionRef, ...filterConstraints)),
  ]);

  const items = snapshot.docs.map((docSnapshot) => mapRevision(docSnapshot.id, docSnapshot.data()));
  const nextCursor = items.length > 0 ? items[items.length - 1].fecha ?? null : null;

  return {
    items,
    nextCursor,
    hasMore: items.length === pageSize && nextCursor !== null,
    totalCount: countSnapshot.data().count,
  };
}

export async function obtenerEstadisticasRevisiones(): Promise<{
  totalRevisiones: number;
  pendientesFirma: number;
  actasMalEstado: number;
  actasCompletadas: number;
}> {
  const collectionRef = collection(db, COLLECTION);
  const [totalSnapshot, pendientesSnapshot, malEstadoSnapshot, completadasSnapshot] =
    await Promise.all([
      getCountFromServer(query(collectionRef)),
      getCountFromServer(query(collectionRef, where('estado', '==', 'pendiente_firma_custodio'))),
      getCountFromServer(query(collectionRef, where('estadoActivo', 'in', ['malo', 'para_baja']))),
      getCountFromServer(query(collectionRef, where('estado', '==', 'completada'))),
    ]);

  return {
    totalRevisiones: totalSnapshot.data().count,
    pendientesFirma: pendientesSnapshot.data().count,
    actasMalEstado: malEstadoSnapshot.data().count,
    actasCompletadas: completadasSnapshot.data().count,
  };
}

export async function obtenerRevisionesRecientes(itemLimit = 5): Promise<Revision[]> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTION),
      where('estado', '==', 'completada'),
      orderBy('fecha', 'desc'),
      limit(itemLimit)
    )
  );

  return snapshot.docs.map((docSnapshot) => mapRevision(docSnapshot.id, docSnapshot.data()));
}

export async function obtenerTodasPendientesFirma(limitItems?: number): Promise<Revision[]> {
  const constraints: QueryConstraint[] = [
    where('estado', '==', 'pendiente_firma_custodio'),
    orderBy('fecha', 'desc'),
  ];

  if (limitItems) {
    constraints.push(limit(limitItems));
  }

  const snapshot = await getDocs(query(collection(db, COLLECTION), ...constraints));
  return snapshot.docs.map((docSnapshot) => mapRevision(docSnapshot.id, docSnapshot.data()));
}

export async function contarRevisionesPorEstadoProceso(estado: string): Promise<number> {
  const snapshot = await getCountFromServer(
    query(collection(db, COLLECTION), where('estado', '==', estado))
  );
  return snapshot.data().count;
}

export async function contarRevisionesPorMes(inicio: Date, fin: Date): Promise<number> {
  const snapshot = await getCountFromServer(
    query(
      collection(db, COLLECTION),
      where('fecha', '>=', inicio),
      where('fecha', '<', fin)
    )
  );
  return snapshot.data().count;
}
