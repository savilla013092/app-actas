"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminResetPassword = exports.adminSetUserActive = exports.adminUpdateUser = exports.adminCreateUser = exports.refreshSessionClaims = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const security_1 = require("./security");
exports.refreshSessionClaims = functions.region(security_1.REGION).https.onCall(async (_data, context) => {
    const authData = (0, security_1.ensureAuthenticated)(context);
    const profile = await (0, security_1.getUserProfile)(authData.uid);
    if (!profile) {
        await admin.auth().setCustomUserClaims(authData.uid, null);
        return {
            active: false,
            status: 'no_profile',
        };
    }
    if (profile.activo !== true || !security_1.VALID_ROLES.has(profile.rol)) {
        await admin.auth().setCustomUserClaims(authData.uid, null);
        return {
            active: false,
            status: 'inactive',
        };
    }
    await (0, security_1.syncUserClaims)(authData.uid, profile);
    return {
        role: profile.rol,
        active: true,
        status: 'ready',
    };
});
exports.adminCreateUser = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    var _a, _b, _c;
    const actor = (0, security_1.ensureRole)(context, ['admin']);
    const payload = data;
    const email = (_a = payload.email) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase();
    const password = (_b = payload.password) === null || _b === void 0 ? void 0 : _b.trim();
    const profile = payload.profile;
    if (!email || !password || !profile) {
        throw new functions.https.HttpsError('invalid-argument', 'Debe suministrar email, contraseña y perfil.');
    }
    if (!profile.nombre || !profile.cedula || !profile.cargo || !profile.dependencia || !profile.rol) {
        throw new functions.https.HttpsError('invalid-argument', 'El perfil del usuario está incompleto.');
    }
    if (!security_1.VALID_ROLES.has(profile.rol)) {
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
        creadoEn: (0, security_1.serverTimestamp)(),
        actualizadoEn: (0, security_1.serverTimestamp)(),
        creadoPor: actor.uid,
        actualizadoPor: actor.uid,
    };
    await security_1.db.collection('usuarios').doc(userRecord.uid).set((0, security_1.stripUndefinedDeep)(profileDoc));
    await (0, security_1.syncUserClaims)(userRecord.uid, profileDoc);
    await (0, security_1.writeAuditLog)({
        accion: 'crear_usuario',
        modulo: 'usuarios',
        documentoId: userRecord.uid,
        usuarioId: actor.uid,
        usuarioEmail: (_c = context.auth) === null || _c === void 0 ? void 0 : _c.token.email,
        descripcion: `Usuario ${email} creado por administrador.`,
        metadata: { rol: profile.rol },
    });
    return { uid: userRecord.uid };
});
exports.adminUpdateUser = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    var _a, _b, _c;
    const actor = (0, security_1.ensureRole)(context, ['admin']);
    const payload = data;
    if (!payload.uid || !payload.profile) {
        throw new functions.https.HttpsError('invalid-argument', 'Debe indicar el usuario y los cambios del perfil.');
    }
    const userRef = security_1.db.collection('usuarios').doc(payload.uid);
    const beforeSnapshot = await userRef.get();
    if (!beforeSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'No se encontró el usuario solicitado.');
    }
    const beforeProfile = beforeSnapshot.data();
    const nextRole = (_a = payload.profile.rol) !== null && _a !== void 0 ? _a : beforeProfile.rol;
    if (!security_1.VALID_ROLES.has(nextRole)) {
        throw new functions.https.HttpsError('invalid-argument', 'El rol suministrado no es válido.');
    }
    const email = (_b = payload.profile.email) === null || _b === void 0 ? void 0 : _b.trim().toLowerCase();
    const authUpdates = {};
    if (email && email !== beforeProfile.email) {
        authUpdates.email = email;
    }
    if (payload.profile.nombre && payload.profile.nombre !== beforeProfile.nombre) {
        authUpdates.displayName = payload.profile.nombre;
    }
    if (Object.keys(authUpdates).length > 0) {
        await admin.auth().updateUser(payload.uid, authUpdates);
    }
    const updates = (0, security_1.stripUndefinedDeep)({
        ...payload.profile,
        email: email !== null && email !== void 0 ? email : undefined,
        actualizadoEn: (0, security_1.serverTimestamp)(),
        actualizadoPor: actor.uid,
    });
    await userRef.update(updates);
    const afterProfile = {
        ...beforeProfile,
        ...payload.profile,
        email: email !== null && email !== void 0 ? email : beforeProfile.email,
    };
    await (0, security_1.syncUserClaims)(payload.uid, afterProfile);
    await (0, security_1.writeAuditLog)({
        accion: 'actualizar_usuario',
        modulo: 'usuarios',
        documentoId: payload.uid,
        usuarioId: actor.uid,
        usuarioEmail: (_c = context.auth) === null || _c === void 0 ? void 0 : _c.token.email,
        descripcion: `Perfil del usuario ${afterProfile.email} actualizado.`,
        datosAntes: beforeProfile,
        datosDespues: afterProfile,
    });
    return { ok: true };
});
exports.adminSetUserActive = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    var _a;
    const actor = (0, security_1.ensureRole)(context, ['admin']);
    const payload = data;
    if (!payload.uid || typeof payload.active !== 'boolean') {
        throw new functions.https.HttpsError('invalid-argument', 'Debe indicar el usuario y el estado.');
    }
    const userRef = security_1.db.collection('usuarios').doc(payload.uid);
    const snapshot = await userRef.get();
    if (!snapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'No se encontró el usuario solicitado.');
    }
    const beforeProfile = snapshot.data();
    const afterProfile = { ...beforeProfile, activo: payload.active };
    await userRef.update({
        activo: payload.active,
        actualizadoEn: (0, security_1.serverTimestamp)(),
        actualizadoPor: actor.uid,
    });
    await admin.auth().updateUser(payload.uid, { disabled: !payload.active });
    await (0, security_1.syncUserClaims)(payload.uid, afterProfile);
    await (0, security_1.writeAuditLog)({
        accion: payload.active ? 'activar_usuario' : 'desactivar_usuario',
        modulo: 'usuarios',
        documentoId: payload.uid,
        usuarioId: actor.uid,
        usuarioEmail: (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token.email,
        descripcion: `Usuario ${afterProfile.email} ${payload.active ? 'activado' : 'desactivado'}.`,
    });
    return { ok: true };
});
exports.adminResetPassword = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    var _a;
    const actor = (0, security_1.ensureRole)(context, ['admin']);
    const payload = data;
    if (!payload.uid) {
        throw new functions.https.HttpsError('invalid-argument', 'Debe indicar el usuario a resetear.');
    }
    const profile = await (0, security_1.getUserProfile)(payload.uid);
    if (!profile) {
        throw new functions.https.HttpsError('not-found', 'No se encontró el usuario solicitado.');
    }
    const link = await admin.auth().generatePasswordResetLink(profile.email);
    await (0, security_1.writeAuditLog)({
        accion: 'reset_password',
        modulo: 'usuarios',
        documentoId: payload.uid,
        usuarioId: actor.uid,
        usuarioEmail: (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token.email,
        descripcion: `Se generó enlace de restablecimiento para ${profile.email}.`,
    });
    return { link };
});
//# sourceMappingURL=userCallables.js.map