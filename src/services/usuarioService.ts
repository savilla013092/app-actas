import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Usuario } from '@/types/usuario';

const COLLECTION = 'usuarios';

const stripUndefined = <T extends Record<string, unknown>>(data: T): T =>
    Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T;

export async function obtenerTodosLosUsuarios(): Promise<Usuario[]> {
    const snapshot = await getDocs(collection(db, COLLECTION));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Usuario));
}

export async function obtenerUsuario(id: string): Promise<Usuario | null> {
    const docSnap = await getDoc(doc(db, COLLECTION, id));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Usuario;
}

export async function crearUsuario(id: string, data: Omit<Usuario, 'id' | 'creadoEn' | 'actualizadoEn'>): Promise<void> {
    const payload = stripUndefined({
        ...data,
        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
    });
    await setDoc(doc(db, COLLECTION, id), payload);
}

export async function actualizarUsuario(id: string, data: Partial<Usuario>): Promise<void> {
    const payload = stripUndefined({
        ...data,
        actualizadoEn: serverTimestamp(),
    });
    await updateDoc(doc(db, COLLECTION, id), payload);
}
