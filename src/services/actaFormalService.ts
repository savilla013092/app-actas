import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type FirestoreError,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { db } from '@/lib/firebase/config';
import {
  ActaFormal,
  ActaFormalDraft,
  AsistenteActaFormal,
  FirmanteActaFormal,
  MetodoFirmaActaFormal,
} from '@/types/actaFormal';

const COLLECTION = 'actas_formales';
const SIGNERS_COLLECTION = 'firmantes';

export interface ActaFormalActor {
  uid: string;
  email?: string | null;
  nombre: string;
}

export interface FirmaPublicaPayload {
  metodoFirma: MetodoFirmaActaFormal;
  firmaDataUrl?: string;
  claveFirma?: string;
  declaracionAceptada: boolean;
}

const asDate = (value: unknown): Date => {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }

  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date();
};

const mapActa = (snapshot: QueryDocumentSnapshot<DocumentData> | { id: string; data: () => DocumentData }) => {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    creadoEn: asDate(data.creadoEn),
    actualizadoEn: asDate(data.actualizadoEn),
    publicadoEn: data.publicadoEn ? asDate(data.publicadoEn) : undefined,
    cerradoEn: data.cerradoEn ? asDate(data.cerradoEn) : undefined,
  } as ActaFormal;
};

const mapFirmante = (snapshot: QueryDocumentSnapshot<DocumentData> | { id: string; data: () => DocumentData }) => {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    fechaFirma: data.fechaFirma ? asDate(data.fechaFirma) : undefined,
    actualizadoEn: data.actualizadoEn ? asDate(data.actualizadoEn) : undefined,
  } as FirmanteActaFormal;
};

const buildToken = () => {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  return `${Date.now()}${Math.random().toString(16).slice(2)}`;
};

const ensureAssistantIds = (asistentes: AsistenteActaFormal[]) =>
  asistentes.map((asistente) => ({
    ...asistente,
    id: asistente.id || `asistente-${buildToken().slice(0, 10)}`,
  }));

export async function guardarBorradorActaFormal({
  actaId,
  draft,
  titulo,
  actor,
}: {
  actaId?: string;
  draft: ActaFormalDraft;
  titulo: string;
  actor: ActaFormalActor;
}) {
  const asistentes = ensureAssistantIds(draft.asistentes);
  const payload = {
    ...draft,
    asistentes,
    titulo,
    creadoPor: actor.uid,
    creadoPorNombre: actor.nombre,
    creadoPorEmail: actor.email ?? null,
    estado: 'borrador',
    actualizadoEn: serverTimestamp(),
  };

  if (actaId) {
    await setDoc(doc(db, COLLECTION, actaId), payload, { merge: true });
    return actaId;
  }

  const newRef = doc(collection(db, COLLECTION));
  await setDoc(newRef, {
    ...payload,
    creadoEn: serverTimestamp(),
  });

  return newRef.id;
}

export async function publicarActaFormalParaFirmas(acta: ActaFormal) {
  const actaRef = doc(db, COLLECTION, acta.id);
  const asistentes = ensureAssistantIds(acta.asistentes).map((asistente) => ({
    ...asistente,
    token: asistente.token || buildToken(),
  }));

  const signerRefs = asistentes.map((asistente) => ({
    asistente,
    ref: doc(db, COLLECTION, acta.id, SIGNERS_COLLECTION, asistente.token || ''),
  }));

  const existingSigners = await Promise.all(signerRefs.map(({ ref }) => getDoc(ref)));
  const batch = writeBatch(db);

  batch.update(actaRef, {
    asistentes,
    estado: 'pendiente_firmas',
    publicadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  });

  signerRefs.forEach(({ asistente, ref }, index) => {
    const basePayload = {
      actaId: acta.id,
      asistenteId: asistente.id,
      tituloActa: acta.titulo,
      fechaActa: acta.fecha,
      tipoReunion: acta.tipoReunion,
      nombre: asistente.nombre,
      cargo: asistente.cargo,
      actualizadoEn: serverTimestamp(),
    };

    if (existingSigners[index].exists()) {
      batch.set(ref, basePayload, { merge: true });
      return;
    }

    batch.set(ref, {
      ...basePayload,
      estado: 'pendiente',
      declaracionAceptada: false,
    });
  });

  await batch.commit();

  return asistentes;
}

export function escucharMisActasFormales(
  userId: string,
  onData: (actas: ActaFormal[]) => void,
  onError?: (error: FirestoreError) => void
) {
  const actasQuery = query(collection(db, COLLECTION), where('creadoPor', '==', userId));

  return onSnapshot(
    actasQuery,
    (snapshot) => {
      const items = snapshot.docs
        .map(mapActa)
        .sort((a, b) => b.actualizadoEn.getTime() - a.actualizadoEn.getTime());
      onData(items);
    },
    onError
  );
}

export function escucharActaFormal(
  actaId: string,
  onData: (acta: ActaFormal | null) => void,
  onError?: (error: FirestoreError) => void
) {
  return onSnapshot(
    doc(db, COLLECTION, actaId),
    (snapshot) => {
      onData(snapshot.exists() ? mapActa({ id: snapshot.id, data: () => snapshot.data() || {} }) : null);
    },
    onError
  );
}

export function escucharFirmantesActaFormal(
  actaId: string,
  onData: (firmantes: FirmanteActaFormal[]) => void,
  onError?: (error: FirestoreError) => void
) {
  return onSnapshot(
    collection(db, COLLECTION, actaId, SIGNERS_COLLECTION),
    (snapshot) => {
      const items = snapshot.docs
        .map(mapFirmante)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      onData(items);
    },
    onError
  );
}

export async function obtenerFirmantePublico(actaId: string, token: string) {
  const signerRef = doc(db, COLLECTION, actaId, SIGNERS_COLLECTION, token);
  const snapshot = await getDoc(signerRef);
  return snapshot.exists() ? mapFirmante({ id: snapshot.id, data: () => snapshot.data() }) : null;
}

export async function registrarFirmaPublica(
  actaId: string,
  token: string,
  payload: FirmaPublicaPayload
) {
  const signerRef = doc(db, COLLECTION, actaId, SIGNERS_COLLECTION, token);

  await updateDoc(signerRef, {
    estado: 'firmada',
    metodoFirma: payload.metodoFirma,
    firmaDataUrl: payload.firmaDataUrl ?? null,
    claveFirma: payload.claveFirma ?? null,
    declaracionAceptada: payload.declaracionAceptada,
    fechaFirma: serverTimestamp(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    actualizadoEn: serverTimestamp(),
  });
}

export async function marcarActaFormalCerrada(actaId: string) {
  await updateDoc(doc(db, COLLECTION, actaId), {
    estado: 'cerrada',
    cerradoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  });
}

export function construirEnlaceFirma(actaId: string, token: string) {
  if (typeof window === 'undefined') {
    return `/firmar-acta/${actaId}/${token}`;
  }

  return `${window.location.origin}/firmar-acta/${actaId}/${token}`;
}
