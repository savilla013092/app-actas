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
    await setDoc(doc(db, COLLECTION, id), {
        ...data,
        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
    });
}

export async function actualizarUsuario(id: string, data: Partial<Usuario>): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), {
        ...data,
        actualizadoEn: serverTimestamp(),
    });
}
