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
import { Activo } from '@/types/activo';

const COLLECTION = 'activos';
const DEFAULT_PAGE_SIZE = 24;

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

export async function obtenerTodosLosActivos(): Promise<Activo[]> {
    const snapshot = await getDocs(query(collection(db, COLLECTION), orderBy('codigo', 'asc')));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activo));
}

export async function obtenerActivosPorCustodio(custodioId: string): Promise<Activo[]> {
    const q = query(collection(db, COLLECTION), where('custodioId', '==', custodioId), orderBy('codigo', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activo));
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

    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activo));
    const nextCursor = items.length > 0 ? items[items.length - 1].codigo : null;

    return {
        items,
        nextCursor,
        hasMore: items.length === pageSize && nextCursor !== null,
        totalCount: countSnapshot.data().count,
    };
}

export async function obtenerActivo(id: string): Promise<Activo | null> {
    const docSnap = await getDoc(doc(db, COLLECTION, id));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Activo;
}

export async function crearActivo(data: Omit<Activo, 'id' | 'creadoEn' | 'actualizadoEn'>): Promise<string> {
    const payload = stripUndefined({
        ...data,
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