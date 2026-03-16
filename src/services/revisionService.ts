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

import { db } from '@/lib/firebase/config';
import { callCallable } from '@/services/callableService';
import { resolveStorageDownloadUrl } from '@/services/storageFileService';
import { prepareEvidenceFilesForCallable } from '@/services/evidenceUploadService';
import { ensureOperationalSession } from '@/services/sessionService';
import { Evidencia, Revision } from '@/types/revision';

const COLLECTION = 'revisiones';
const DEFAULT_PAGE_SIZE = 50;

const mapRevision = (docId: string, data: Record<string, unknown>) => ({
  id: docId,
  ...data,
}) as Revision;

const hydrateEvidence = async (evidencia: Evidencia): Promise<Evidencia> => ({
  ...evidencia,
  url: await resolveStorageDownloadUrl(evidencia.storagePath, evidencia.url),
});

const hydrateRevisionMedia = async (revision: Revision): Promise<Revision> => ({
  ...revision,
  evidencias: await Promise.all((revision.evidencias || []).map(hydrateEvidence)),
  firmaRevisor: revision.firmaRevisor
    ? {
        ...revision.firmaRevisor,
        url: await resolveStorageDownloadUrl(
          revision.firmaRevisor.storagePath,
          revision.firmaRevisor.url
        ),
      }
    : undefined,
  firmaCustodio: revision.firmaCustodio
    ? {
        ...revision.firmaCustodio,
        url: await resolveStorageDownloadUrl(
          revision.firmaCustodio.storagePath,
          revision.firmaCustodio.url
        ),
      }
    : undefined,
});

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

export interface UpdateRevisionDraftPayload {
  activoId: string;
  codigoActivo: string;
  descripcionActivo: string;
  ubicacionActivo: string;
  custodioId: string;
  custodioNombre: string;
  custodioCedula: string;
  custodioCargo: string;
  fecha: Date;
  estadoActivo: Revision['estadoActivo'];
  descripcion: string;
  observaciones?: string;
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
  await ensureOperationalSession(['admin', 'logistica']);

  const inlineFiles = await prepareEvidenceFilesForCallable({
    files: archivos,
    buildNombre: (index) => `Evidencia ${index + 1}`,
    buildDescripcion: (index) => `Fotografía de revisión ${index + 1}`,
  });

  const response = await callCallable<
    {
      revisionId: string;
      inlineFiles: Array<{
        nombre: string;
        descripcion?: string;
        contentType: 'image/jpeg' | 'image/png';
        dataBase64: string;
      }>;
    },
    {
      evidences: Array<{
        id: string;
        nombre: string;
        descripcion?: string;
        storagePath: string;
        subidaEn: string;
      }>;
    }
  >('registerRevisionEvidence', {
    revisionId,
    inlineFiles,
  });

  return response.evidences.map((evidencia) => ({
    ...evidencia,
    subidaEn: new Date(evidencia.subidaEn),
  }));
}

export async function subirEvidencia(
  revisionId: string,
  archivo: File,
  nombre: string,
  descripcion?: string
): Promise<Evidencia> {
  await ensureOperationalSession(['admin', 'logistica']);

  const inlineFiles = await prepareEvidenceFilesForCallable({
    files: [archivo],
    buildNombre: () => nombre,
    buildDescripcion: () => descripcion,
  });

  const response = await callCallable<
    {
      revisionId: string;
      inlineFiles: Array<{
        nombre: string;
        descripcion?: string;
        contentType: 'image/jpeg' | 'image/png';
        dataBase64: string;
      }>;
    },
    {
      evidences: Array<{
        id: string;
        nombre: string;
        descripcion?: string;
        storagePath: string;
        subidaEn: string;
      }>;
    }
  >('registerRevisionEvidence', {
    revisionId,
    inlineFiles,
  });

  return {
    ...response.evidences[0],
    subidaEn: new Date(response.evidences[0].subidaEn),
  };
}

export async function firmarComoRevisor(
  revisionId: string,
  firmaDataUrl: string,
  _datosRevision: object
): Promise<void> {
  await ensureOperationalSession(['admin', 'logistica']);

  await callCallable<{ revisionId: string; signatureDataUrl: string }, { ok: boolean }>(
    'registerReviewerSignature',
    {
      revisionId,
      signatureDataUrl: firmaDataUrl,
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

  await ensureOperationalSession(['custodio']);

  await callCallable<
    { revisionId: string; signatureDataUrl: string; nombre: string; cedula: string },
    { ok: boolean }
  >('registerCustodianSignature', {
    revisionId,
    signatureDataUrl: firmaDataUrl,
    nombre: datosFirmante.nombre.trim(),
    cedula: datosFirmante.cedula.trim(),
  });
}

export async function actualizarBorradorRevision(
  revisionId: string,
  data: UpdateRevisionDraftPayload
): Promise<void> {
  await callCallable<Record<string, unknown>, { ok: boolean }>('updateRevisionDraft', {
    revisionId,
    ...data,
    fecha: new Date(data.fecha).toISOString(),
  });
}

export async function eliminarEvidenciaBorradorRevision(
  revisionId: string,
  evidenciaId: string
): Promise<void> {
  await callCallable<{ revisionId: string; evidenceId: string }, { ok: boolean }>(
    'deleteRevisionDraftEvidence',
    {
      revisionId,
      evidenceId: evidenciaId,
    }
  );
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
  return hydrateRevisionMedia(mapRevision(docSnap.id, docSnap.data()));
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
