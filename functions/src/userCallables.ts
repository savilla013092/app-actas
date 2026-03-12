import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import {
  ManagedUserProfile,
  REGION,
  VALID_ROLES,
  db,
  ensureAuthenticated,
  ensureRole,
  getUserProfile,
  serverTimestamp,
  stripUndefinedDeep,
  syncUserClaims,
  writeAuditLog,
} from './security';

export const refreshSessionClaims = functions.region(REGION).https.onCall(async (_data, context) => {
  const authData = ensureAuthenticated(context);
  const profile = await getUserProfile(authData.uid);

  if (!profile) {
    await admin.auth().setCustomUserClaims(authData.uid, null);
    return {
      active: false,
      status: 'no_profile' as const,
    };
  }

  if (profile.activo !== true || !VALID_ROLES.has(profile.rol)) {
    await admin.auth().setCustomUserClaims(authData.uid, null);
    return {
      active: false,
      status: 'inactive' as const,
    };
  }

  await syncUserClaims(authData.uid, profile);

  return {
    role: profile.rol,
    active: true,
    status: 'ready' as const,
  };
});

export const adminCreateUser = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['admin']);
  const payload = data as {
    email?: string;
    password?: string;
    profile?: Partial<ManagedUserProfile>;
  };

  const email = payload.email?.trim().toLowerCase();
  const password = payload.password?.trim();
  const profile = payload.profile;

  if (!email || !password || !profile) {
    throw new functions.https.HttpsError('invalid-argument', 'Debe suministrar email, contraseña y perfil.');
  }

  if (!profile.nombre || !profile.cedula || !profile.cargo || !profile.dependencia || !profile.rol) {
    throw new functions.https.HttpsError('invalid-argument', 'El perfil del usuario está incompleto.');
  }

  if (!VALID_ROLES.has(profile.rol)) {
    throw new functions.https.HttpsError('invalid-argument', 'El rol suministrado no es válido.');
  }

  const userRecord = await admin.auth().createUser({
    email,
    password,
    displayName: profile.nombre,
    disabled: profile.activo === false,
  });

  const profileDoc = {
    email,
    nombre: profile.nombre,
    cedula: profile.cedula,
    cargo: profile.cargo,
    dependencia: profile.dependencia,
    telefono: profile.telefono,
    rol: profile.rol,
    activo: profile.activo !== false,
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
    creadoPor: actor.uid,
    actualizadoPor: actor.uid,
  };

  await db.collection('usuarios').doc(userRecord.uid).set(stripUndefinedDeep(profileDoc));
  await syncUserClaims(userRecord.uid, profileDoc as ManagedUserProfile);

  await writeAuditLog({
    accion: 'crear_usuario',
    modulo: 'usuarios',
    documentoId: userRecord.uid,
    usuarioId: actor.uid,
    usuarioEmail: context.auth?.token.email as string | undefined,
    descripcion: `Usuario ${email} creado por administrador.`,
    metadata: { rol: profile.rol },
  });

  return { uid: userRecord.uid };
});

export const adminUpdateUser = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['admin']);
  const payload = data as {
    uid?: string;
    profile?: Partial<ManagedUserProfile>;
  };

  if (!payload.uid || !payload.profile) {
    throw new functions.https.HttpsError('invalid-argument', 'Debe indicar el usuario y los cambios del perfil.');
  }

  const userRef = db.collection('usuarios').doc(payload.uid);
  const beforeSnapshot = await userRef.get();
  if (!beforeSnapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'No se encontró el usuario solicitado.');
  }

  const beforeProfile = beforeSnapshot.data() as ManagedUserProfile;
  const nextRole = payload.profile.rol ?? beforeProfile.rol;
  if (!VALID_ROLES.has(nextRole)) {
    throw new functions.https.HttpsError('invalid-argument', 'El rol suministrado no es válido.');
  }

  const email = payload.profile.email?.trim().toLowerCase();
  const authUpdates: admin.auth.UpdateRequest = {};
  if (email && email !== beforeProfile.email) {
    authUpdates.email = email;
  }
  if (payload.profile.nombre && payload.profile.nombre !== beforeProfile.nombre) {
    authUpdates.displayName = payload.profile.nombre;
  }
  if (Object.keys(authUpdates).length > 0) {
    await admin.auth().updateUser(payload.uid, authUpdates);
  }

  const updates = stripUndefinedDeep({
    ...payload.profile,
    email: email ?? undefined,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: actor.uid,
  });

  await userRef.update(updates);

  const afterProfile = {
    ...beforeProfile,
    ...payload.profile,
    email: email ?? beforeProfile.email,
  } as ManagedUserProfile;

  await syncUserClaims(payload.uid, afterProfile);

  await writeAuditLog({
    accion: 'actualizar_usuario',
    modulo: 'usuarios',
    documentoId: payload.uid,
    usuarioId: actor.uid,
    usuarioEmail: context.auth?.token.email as string | undefined,
    descripcion: `Perfil del usuario ${afterProfile.email} actualizado.`,
    datosAntes: beforeProfile,
    datosDespues: afterProfile,
  });

  return { ok: true };
});

export const adminSetUserActive = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['admin']);
  const payload = data as { uid?: string; active?: boolean };

  if (!payload.uid || typeof payload.active !== 'boolean') {
    throw new functions.https.HttpsError('invalid-argument', 'Debe indicar el usuario y el estado.');
  }

  const userRef = db.collection('usuarios').doc(payload.uid);
  const snapshot = await userRef.get();
  if (!snapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'No se encontró el usuario solicitado.');
  }

  const beforeProfile = snapshot.data() as ManagedUserProfile;
  const afterProfile = { ...beforeProfile, activo: payload.active };

  await userRef.update({
    activo: payload.active,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: actor.uid,
  });

  await admin.auth().updateUser(payload.uid, { disabled: !payload.active });
  await syncUserClaims(payload.uid, afterProfile);

  await writeAuditLog({
    accion: payload.active ? 'activar_usuario' : 'desactivar_usuario',
    modulo: 'usuarios',
    documentoId: payload.uid,
    usuarioId: actor.uid,
    usuarioEmail: context.auth?.token.email as string | undefined,
    descripcion: `Usuario ${afterProfile.email} ${payload.active ? 'activado' : 'desactivado'}.`,
  });

  return { ok: true };
});

export const adminResetPassword = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['admin']);
  const payload = data as { uid?: string };

  if (!payload.uid) {
    throw new functions.https.HttpsError('invalid-argument', 'Debe indicar el usuario a resetear.');
  }

  const profile = await getUserProfile(payload.uid);
  if (!profile) {
    throw new functions.https.HttpsError('not-found', 'No se encontró el usuario solicitado.');
  }

  const link = await admin.auth().generatePasswordResetLink(profile.email);

  await writeAuditLog({
    accion: 'reset_password',
    modulo: 'usuarios',
    documentoId: payload.uid,
    usuarioId: actor.uid,
    usuarioEmail: context.auth?.token.email as string | undefined,
    descripcion: `Se generó enlace de restablecimiento para ${profile.email}.`,
  });

  return { link };
});
