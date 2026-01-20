import {
    collection,
    doc,
    addDoc,
    updateDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
    serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import { Revision, Evidencia, FirmaDigital } from '@/types/revision';
import { calcularHash } from '@/lib/utils/hash';
import { obtenerIPCliente } from '@/lib/utils/ip';
import imageCompression from 'browser-image-compression';

const COLLECTION = 'revisiones';

// Crear nueva revisión (borrador)
export async function crearRevision(data: Omit<Revision, 'id' | 'creadoEn' | 'actualizadoEn' | 'evidencias'>): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION), {
        ...data,
        estado: 'borrador',
        evidencias: [],
        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
    });
    return docRef.id;
}

// Subir evidencia fotográfica
export async function subirEvidencia(
    revisionId: string,
    archivo: File,
    nombre: string,
    descripcion?: string
): Promise<Evidencia> {
    // Comprimir imagen
    const opciones = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
    };
    const archivoComprimido = await imageCompression(archivo, opciones);

    // Subir a Storage
    const nombreArchivo = `${Date.now()}_${archivo.name}`;
    const storageRef = ref(storage, `evidencias/${revisionId}/${nombreArchivo}`);
    await uploadBytes(storageRef, archivoComprimido);
    const url = await getDownloadURL(storageRef);

    const evidencia: Evidencia = {
        id: nombreArchivo,
        url,
        nombre,
        descripcion,
        subidaEn: new Date(),
    };

    // Actualizar documento con nueva evidencia
    const revisionRef = doc(db, COLLECTION, revisionId);
    const revisionDoc = await getDoc(revisionRef);
    const evidenciasActuales = revisionDoc.data()?.evidencias || [];

    await updateDoc(revisionRef, {
        evidencias: [...evidenciasActuales, evidencia],
        actualizadoEn: serverTimestamp(),
    });

    return evidencia;
}

// Firmar como revisor (Profesional de Logística)
export async function firmarComoRevisor(
    revisionId: string,
    firmaDataUrl: string,
    datosRevision: object
): Promise<void> {
    // Calcular hash del documento
    const hashDocumento = await calcularHash(JSON.stringify(datosRevision));

    // Obtener IP del cliente
    const ipCliente = await obtenerIPCliente();

    // Subir imagen de firma
    const blob = await (await fetch(firmaDataUrl)).blob();
    const storageRef = ref(storage, `firmas/${revisionId}/revisor.png`);
    await uploadBytes(storageRef, blob);
    const urlFirma = await getDownloadURL(storageRef);

    const firma: FirmaDigital = {
        url: urlFirma,
        fechaFirma: new Date(),
        ipCliente,
        userAgent: navigator.userAgent,
        hashDocumento,
        declaracionAceptada: true,
    };

    await updateDoc(doc(db, COLLECTION, revisionId), {
        firmaRevisor: firma,
        estado: 'pendiente_firma_custodio',
        actualizadoEn: serverTimestamp(),
    });
}

// Firmar como custodio
export async function firmarComoCustodio(
    revisionId: string,
    firmaDataUrl: string,
    datosRevision: object,
    datosFirmante?: { nombre: string; cedula: string }
): Promise<void> {
    const hashDocumento = await calcularHash(JSON.stringify(datosRevision));

    // Obtener IP del cliente
    const ipCliente = await obtenerIPCliente();

    const blob = await (await fetch(firmaDataUrl)).blob();
    const storageRef = ref(storage, `firmas/${revisionId}/custodio.png`);
    await uploadBytes(storageRef, blob);
    const urlFirma = await getDownloadURL(storageRef);

    const firma: FirmaDigital = {
        url: urlFirma,
        fechaFirma: new Date(),
        ipCliente,
        userAgent: navigator.userAgent,
        hashDocumento,
        declaracionAceptada: true,
    };

    // Preparar datos de actualización
    const updateData: Record<string, unknown> = {
        firmaCustodio: firma,
        estado: 'firmada_completa', // Cloud Function detectará esto y generará el PDF
        actualizadoEn: serverTimestamp(),
    };

    // Si se proporcionan datos del firmante, actualizar nombre y cédula del custodio
    if (datosFirmante) {
        updateData.custodioNombre = datosFirmante.nombre;
        updateData.custodioCedula = datosFirmante.cedula;
    }

    await updateDoc(doc(db, COLLECTION, revisionId), updateData);
}

// Obtener revisiones por custodio (para que firme) - Sin índice compuesto
export async function obtenerRevisionesPendientesFirma(custodioId: string): Promise<Revision[]> {
    try {
        const snapshot = await getDocs(collection(db, COLLECTION));
        const revisiones = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Revision))
            .filter(r => r.custodioId === custodioId && r.estado === 'pendiente_firma_custodio')
            .sort((a, b) => {
                const fechaA = a.fecha && typeof a.fecha === 'object' && 'seconds' in a.fecha
                    ? (a.fecha as { seconds: number }).seconds : 0;
                const fechaB = b.fecha && typeof b.fecha === 'object' && 'seconds' in b.fecha
                    ? (b.fecha as { seconds: number }).seconds : 0;
                return fechaB - fechaA;
            });

        return revisiones;
    } catch (error) {
        console.error('Error obteniendo revisiones pendientes de firma:', error);
        return [];
    }
}

// Obtener revisiones creadas por el revisor - Sin índice compuesto
export async function obtenerRevisionesPorRevisor(revisorId: string): Promise<Revision[]> {
    try {
        const snapshot = await getDocs(collection(db, COLLECTION));
        const revisiones = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Revision))
            .filter(r => r.revisorId === revisorId)
            .sort((a, b) => {
                const fechaA = a.fecha && typeof a.fecha === 'object' && 'seconds' in a.fecha
                    ? (a.fecha as { seconds: number }).seconds : 0;
                const fechaB = b.fecha && typeof b.fecha === 'object' && 'seconds' in b.fecha
                    ? (b.fecha as { seconds: number }).seconds : 0;
                return fechaB - fechaA;
            });

        return revisiones;
    } catch (error) {
        console.error('Error obteniendo revisiones por revisor:', error);
        return [];
    }
}

// Obtener revisión por ID
export async function obtenerRevision(id: string): Promise<Revision | null> {
    const docSnap = await getDoc(doc(db, COLLECTION, id));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Revision;
}

// Obtener revisiones por activo - Sin índice compuesto
export async function obtenerRevisionesPorActivo(activoId: string): Promise<Revision[]> {
    try {
        const snapshot = await getDocs(collection(db, COLLECTION));
        const revisiones = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Revision))
            .filter(r => r.activoId === activoId)
            .sort((a, b) => {
                const fechaA = a.fecha && typeof a.fecha === 'object' && 'seconds' in a.fecha
                    ? (a.fecha as { seconds: number }).seconds : 0;
                const fechaB = b.fecha && typeof b.fecha === 'object' && 'seconds' in b.fecha
                    ? (b.fecha as { seconds: number }).seconds : 0;
                return fechaB - fechaA;
            });

        return revisiones;
    } catch (error) {
        console.error('Error obteniendo revisiones por activo:', error);
        return [];
    }
}

// Obtener todas las revisiones (ordenadas por fecha, más recientes primero)
export async function obtenerTodasLasRevisiones(): Promise<Revision[]> {
    try {
        console.log('Obteniendo todas las revisiones...');
        const snapshot = await getDocs(collection(db, COLLECTION));
        console.log(`Se encontraron ${snapshot.docs.length} revisiones en Firestore`);

        const revisiones = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Revision))
            .sort((a, b) => {
                const fechaA = a.fecha && typeof a.fecha === 'object' && 'seconds' in a.fecha
                    ? (a.fecha as { seconds: number }).seconds : 0;
                const fechaB = b.fecha && typeof b.fecha === 'object' && 'seconds' in b.fecha
                    ? (b.fecha as { seconds: number }).seconds : 0;
                return fechaB - fechaA;
            });
        return revisiones;
    } catch (error) {
        console.error('Error obteniendo todas las revisiones:', error);
        return [];
    }
}

// Obtener estadísticas del dashboard
export async function obtenerEstadisticasRevisiones(): Promise<{
    totalRevisiones: number;
    pendientesFirma: number;
    actasMalEstado: number;
    actasCompletadas: number;
}> {
    try {
        const snapshot = await getDocs(collection(db, COLLECTION));
        const revisiones = snapshot.docs.map(doc => doc.data());

        return {
            totalRevisiones: revisiones.length,
            pendientesFirma: revisiones.filter(r => r.estado === 'pendiente_firma_custodio').length,
            actasMalEstado: revisiones.filter(r => r.estadoActivo === 'malo' || r.estadoActivo === 'para_baja').length,
            actasCompletadas: revisiones.filter(r => r.estado === 'completada').length,
        };
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        return {
            totalRevisiones: 0,
            pendientesFirma: 0,
            actasMalEstado: 0,
            actasCompletadas: 0,
        };
    }
}

// Obtener revisiones recientes (últimas 5) - Sin índice compuesto
export async function obtenerRevisionesRecientes(limite: number = 5): Promise<Revision[]> {
    try {
        // Obtener todas y filtrar en cliente para evitar índice compuesto
        const snapshot = await getDocs(collection(db, COLLECTION));
        const revisiones = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Revision))
            .filter(r => r.estado === 'completada')
            .sort((a, b) => {
                const fechaA = a.fecha && typeof a.fecha === 'object' && 'seconds' in a.fecha
                    ? (a.fecha as { seconds: number }).seconds : 0;
                const fechaB = b.fecha && typeof b.fecha === 'object' && 'seconds' in b.fecha
                    ? (b.fecha as { seconds: number }).seconds : 0;
                return fechaB - fechaA;
            })
            .slice(0, limite);

        return revisiones;
    } catch (error) {
        console.error('Error obteniendo revisiones recientes:', error);
        return [];
    }
}

// Obtener revisiones pendientes de firma (para todos los custodios) - Sin índice compuesto
export async function obtenerTodasPendientesFirma(): Promise<Revision[]> {
    try {
        // Obtener todas y filtrar en cliente para evitar índice compuesto
        const snapshot = await getDocs(collection(db, COLLECTION));
        const revisiones = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Revision))
            .filter(r => r.estado === 'pendiente_firma_custodio')
            .sort((a, b) => {
                const fechaA = a.fecha && typeof a.fecha === 'object' && 'seconds' in a.fecha
                    ? (a.fecha as { seconds: number }).seconds : 0;
                const fechaB = b.fecha && typeof b.fecha === 'object' && 'seconds' in b.fecha
                    ? (b.fecha as { seconds: number }).seconds : 0;
                return fechaB - fechaA;
            });

        return revisiones;
    } catch (error) {
        console.error('Error obteniendo revisiones pendientes:', error);
        return [];
    }
}
