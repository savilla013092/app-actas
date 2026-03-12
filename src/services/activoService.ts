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
import { Activo } from '@/types/activo';
import { callCallable } from '@/services/callableService';

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

export interface SearchActiveAssetsResult {
  items: Activo[];
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

export async function buscarActivosDisponibles(
  search: string,
  resultLimit = 25
): Promise<Activo[]> {
  const response = await callCallable<{ search: string; limit: number }, SearchActiveAssetsResult>(
    'searchActiveAssets',
    { search, limit: resultLimit }
  );
  return response.items;
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
    search:
      data.codigo || data.descripcion || data.serial || data.marca || data.modelo
        ? buildAssetSearchIndex({
            codigo: String(data.codigo || ''),
            descripcion: data.descripcion,
            serial: data.serial,
            marca: data.marca,
            modelo: data.modelo,
          })
        : undefined,
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

