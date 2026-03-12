import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from 'firebase/firestore';

import { db } from '@/lib/firebase/config';
import { callCallable } from '@/services/callableService';
import { RolUsuario, Usuario } from '@/types/usuario';

const COLLECTION = 'usuarios';

export interface CreateUsuarioPayload {
  email: string;
  password: string;
  nombre: string;
  cedula: string;
  cargo: string;
  dependencia: string;
  telefono?: string;
  rol: RolUsuario;
  activo?: boolean;
}

export interface UpdateUsuarioPayload {
  email?: string;
  nombre?: string;
  cedula?: string;
  cargo?: string;
  dependencia?: string;
  telefono?: string;
  rol?: RolUsuario;
  activo?: boolean;
}

export async function obtenerTodosLosUsuarios(): Promise<Usuario[]> {
  const snapshot = await getDocs(query(collection(db, COLLECTION), orderBy('nombre', 'asc')));
  return snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() } as Usuario));
}

export async function obtenerUsuario(id: string): Promise<Usuario | null> {
  const docSnap = await getDoc(doc(db, COLLECTION, id));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as Usuario;
}

export async function crearUsuario(payload: CreateUsuarioPayload): Promise<string> {
  const response = await callCallable<
    { email: string; password: string; profile: UpdateUsuarioPayload },
    { uid: string }
  >('adminCreateUser', {
    email: payload.email,
    password: payload.password,
    profile: {
      nombre: payload.nombre,
      cedula: payload.cedula,
      cargo: payload.cargo,
      dependencia: payload.dependencia,
      telefono: payload.telefono,
      rol: payload.rol,
      activo: payload.activo ?? true,
    },
  });

  return response.uid;
}

export async function actualizarUsuario(id: string, data: UpdateUsuarioPayload): Promise<void> {
  await callCallable<{ uid: string; profile: UpdateUsuarioPayload }, { ok: boolean }>('adminUpdateUser', {
    uid: id,
    profile: data,
  });
}

export async function cambiarEstadoUsuario(id: string, active: boolean): Promise<void> {
  await callCallable<{ uid: string; active: boolean }, { ok: boolean }>('adminSetUserActive', {
    uid: id,
    active,
  });
}

export async function resetearContrasenaUsuario(id: string): Promise<string> {
  const response = await callCallable<{ uid: string }, { link: string }>('adminResetPassword', {
    uid: id,
  });
  return response.link;
}
