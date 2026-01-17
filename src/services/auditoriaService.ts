import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export async function registrarAuditoria(data: {
    accion: string;
    modulo: string;
    documentoId: string;
    usuarioId: string;
    usuarioEmail: string;
    usuarioNombre: string;
    descripcion: string;
    datosAntes?: any;
    datosDespues?: any;
}) {
    try {
        await addDoc(collection(db, 'auditoria'), {
            ...data,
            timestamp: serverTimestamp(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'system',
        });
    } catch (error) {
        console.error('Error al registrar auditoria:', error);
    }
}
