import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    addDoc,
    updateDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Activo } from '@/types/activo';

const COLLECTION = 'activos';

const stripUndefined = <T extends Record<string, unknown>>(data: T): T =>
    Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T;

export async function obtenerTodosLosActivos(): Promise<Activo[]> {
    const snapshot = await getDocs(collection(db, COLLECTION));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activo));
}

export async function obtenerActivosPorCustodio(custodioId: string): Promise<Activo[]> {
    const q = query(collection(db, COLLECTION), where('custodioId', '==', custodioId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activo));
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
