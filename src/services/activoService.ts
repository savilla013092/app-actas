import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  QueryConstraint,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore';

import { db } from '@/lib/firebase/config';
import { buildAssetSearchIndex } from '@/lib/utils/assetSearch';
import { callCallable } from '@/services/callableService';
import { Activo } from '@/types/activo';

const COLLECTION = 'activos';
const DEFAULT_PAGE_SIZE = 50;

const stripUndefined = <T extends Record<string, unknown>>(data: T): T =>
  Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T;

const buildActivosQuery = (
  custodioId?: string,
  cursor?: string | null,
  pageSize?: number
): QueryConstraint[] => {
  const constraints: QueryConstraint[] = [];

  if (custodioId) {
    constraints.push(where('custodioId', '==', custodioId));
  }

  constraints.push(orderBy('codigo', 'asc'));

  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  if (pageSize) {
    constraints.push(limit(pageSize));
  }

  return constraints;
};

export interface PaginatedActivosOptions {
  custodioId?: string;
  cursor?: string | null;
  pageSize?: number;
}

export interface PaginatedActivosResult {
  items: Activo[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

export interface SearchActiveAssetsCursor {
  codigo: string;
  id: string;
}

export interface SearchActiveAssetsOptions {
  search?: string;
  classificationCode?: string;
  locationName?: string;
  limit?: number;
  cursor?: SearchActiveAssetsCursor | null;
}

export interface SearchActiveAssetsResult {
  items: Activo[];
  nextCursor: SearchActiveAssetsCursor | null;
  hasMore: boolean;
}

export async function obtenerActivosPorCustodio(custodioId: string): Promise<Activo[]> {
  const q = query(
    collection(db, COLLECTION),
    where('custodioId', '==', custodioId),
    orderBy('codigo', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() } as Activo));
}

export async function obtenerActivosPaginados({
  custodioId,
  cursor = null,
  pageSize = DEFAULT_PAGE_SIZE,
}: PaginatedActivosOptions = {}): Promise<PaginatedActivosResult> {
  const collectionRef = collection(db, COLLECTION);
  const pageQuery = query(collectionRef, ...buildActivosQuery(custodioId, cursor, pageSize));
  const countQuery = custodioId
    ? query(collectionRef, where('custodioId', '==', custodioId))
    : query(collectionRef);

  const [snapshot, countSnapshot] = await Promise.all([
    getDocs(pageQuery),
    getCountFromServer(countQuery),
  ]);

  const items = snapshot.docs.map((docSnapshot) => ({
    id: docSnapshot.id,
    ...docSnapshot.data(),
  } as Activo));
  const nextCursor = items.length > 0 ? items[items.length - 1].codigo : null;

  return {
    items,
    nextCursor,
    hasMore: items.length === pageSize && nextCursor !== null,
    totalCount: countSnapshot.data().count,
  };
}

export async function buscarActivosDisponibles({
  search = '',
  classificationCode,
  locationName,
  limit: resultLimit = 50,
  cursor = null,
}: SearchActiveAssetsOptions = {}): Promise<SearchActiveAssetsResult> {
  return callCallable<SearchActiveAssetsOptions, SearchActiveAssetsResult>('searchActiveAssets', {
    search,
    classificationCode,
    locationName,
    limit: resultLimit,
    cursor,
  });
}

export async function obtenerActivo(id: string): Promise<Activo | null> {
  const docSnap = await getDoc(doc(db, COLLECTION, id));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as Activo;
}

export async function crearActivo(
  data: Omit<Activo, 'id' | 'creadoEn' | 'actualizadoEn'>
): Promise<string> {
  const payload = stripUndefined({
    ...data,
    search: buildAssetSearchIndex({
      codigo: data.codigo,
      descripcion: data.descripcion,
      serial: data.serial,
      marca: data.marca,
      modelo: data.modelo,
      categoria: data.categoria,
      ubicacion: data.ubicacion,
    }),
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  });
  const docRef = await addDoc(collection(db, COLLECTION), payload);
  return docRef.id;
}

export async function actualizarActivo(id: string, data: Partial<Activo>): Promise<void> {
  const payload = stripUndefined({
    ...data,
    actualizadoEn: serverTimestamp(),
  });
  await updateDoc(doc(db, COLLECTION, id), payload);
}

export async function contarActivosPorEstado(estado: Activo['estado']): Promise<number> {
  const snapshot = await getCountFromServer(query(collection(db, COLLECTION), where('estado', '==', estado)));
  return snapshot.data().count;
}

export async function contarActivosPorCategoria(categoria: string): Promise<number> {
  const snapshot = await getCountFromServer(query(collection(db, COLLECTION), where('categoria', '==', categoria)));
  return snapshot.data().count;
}
