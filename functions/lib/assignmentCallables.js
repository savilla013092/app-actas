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
exports.registerInitialAssignmentCustodianSignature = exports.registerInitialAssignmentReviewerSignature = exports.registerInitialAssignmentEvidence = exports.createInitialAssignmentDraft = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const security_1 = require("./security");
async function ensureNoExistingAssignment(activoId) {
    const snapshot = await security_1.db.collection('asignaciones').where('activoId', '==', activoId).limit(10).get();
    const existingAssignment = snapshot.docs.find((doc) => doc.data().estado !== 'anulada');
    if (existingAssignment) {
        throw new functions.https.HttpsError('already-exists', 'El activo ya tiene una asignación inicial registrada o en proceso.');
    }
}
exports.createInitialAssignmentDraft = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    const actor = (0, security_1.ensureRole)(context, ['admin', 'logistica']);
    const payload = data;
    if (!payload.activoId || !payload.codigoActivo || !payload.custodioId || !payload.descripcion || !payload.fecha) {
        throw new functions.https.HttpsError('invalid-argument', 'La asignación inicial no contiene los campos obligatorios.');
    }
    const activoRef = security_1.db.collection('activos').doc(payload.activoId);
    const activoSnapshot = await activoRef.get();
    if (!activoSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'El activo seleccionado ya no existe.');
    }
    const activo = activoSnapshot.data();
    if (!activo.custodioId) {
        throw new functions.https.HttpsError('failed-precondition', 'El activo debe tener custodio asignado antes de registrar su asignación inicial.');
    }
    if (activo.custodioId !== payload.custodioId) {
        throw new functions.https.HttpsError('failed-precondition', 'El custodio del activo cambió. Recargue el formulario antes de continuar.');
    }
    if (activo.estadoAsignacionInicial === 'completada' || activo.asignacionInicialId) {
        throw new functions.https.HttpsError('failed-precondition', 'El activo ya cuenta con una asignación inicial completada.');
    }
    await ensureNoExistingAssignment(payload.activoId);
    const assignmentRef = security_1.db.collection('asignaciones').doc();
    const assignmentDoc = (0, security_1.stripUndefinedDeep)({
        activoId: payload.activoId,
        codigoActivo: payload.codigoActivo,
        descripcionActivo: payload.descripcionActivo,
        ubicacionActivo: payload.ubicacionActivo,
        custodioId: payload.custodioId,
        custodioNombre: payload.custodioNombre,
        custodioCedula: payload.custodioCedula,
        custodioCargo: payload.custodioCargo,
        revisorId: actor.uid,
        revisorNombre: payload.revisorNombre,
        revisorCedula: payload.revisorCedula,
        revisorCargo: payload.revisorCargo,
        fecha: admin.firestore.Timestamp.fromDate(new Date(payload.fecha)),
        descripcion: payload.descripcion,
        observaciones: payload.observaciones,
        evidencias: [],
        estado: 'borrador',
        creadoEn: (0, security_1.serverTimestamp)(),
        actualizadoEn: (0, security_1.serverTimestamp)(),
        creadoPor: actor.uid,
        actualizadoPor: actor.uid,
    });
    await assignmentRef.set(assignmentDoc);
    await activoRef.set({
        estadoAsignacionInicial: 'pendiente',
        actualizadoEn: (0, security_1.serverTimestamp)(),
        actualizadoPor: actor.uid,
    }, { merge: true });
    return { id: assignmentRef.id };
});
exports.registerInitialAssignmentEvidence = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    const actor = (0, security_1.ensureRole)(context, ['admin', 'logistica']);
    const payload = data;
    if (!payload.assignmentId || !Array.isArray(payload.evidences) || payload.evidences.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Debe indicar la asignación y las evidencias.');
    }
    const assignmentRef = security_1.db.collection('asignaciones').doc(payload.assignmentId);
    const assignmentSnapshot = await assignmentRef.get();
    if (!assignmentSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'La asignación inicial ya no existe.');
    }
    const assignment = assignmentSnapshot.data();
    if (assignment.estado !== 'borrador' && assignment.estado !== 'pendiente_firma_custodio') {
        throw new functions.https.HttpsError('failed-precondition', 'La asignación no admite nuevas evidencias.');
    }
    payload.evidences.forEach((file) => (0, security_1.ensureStoragePath)(file.storagePath, `asignaciones-evidencias/${payload.assignmentId}/`));
    const updatedEvidences = [...(assignment.evidencias || []), ...(0, security_1.mapUploadedEvidence)(payload.evidences)];
    await assignmentRef.update({
        evidencias: updatedEvidences,
        actualizadoEn: (0, security_1.serverTimestamp)(),
        actualizadoPor: actor.uid,
    });
    return { count: updatedEvidences.length };
});
exports.registerInitialAssignmentReviewerSignature = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    const actor = (0, security_1.ensureRole)(context, ['admin', 'logistica']);
    const payload = data;
    if (!payload.assignmentId || !payload.storagePath || !payload.url) {
        throw new functions.https.HttpsError('invalid-argument', 'Faltan datos de la firma del revisor.');
    }
    (0, security_1.ensureStoragePath)(payload.storagePath, `asignaciones-firmas/${payload.assignmentId}/`);
    const assignmentRef = security_1.db.collection('asignaciones').doc(payload.assignmentId);
    const assignmentSnapshot = await assignmentRef.get();
    if (!assignmentSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'La asignación inicial ya no existe.');
    }
    const assignment = assignmentSnapshot.data();
    if (assignment.estado !== 'borrador') {
        throw new functions.https.HttpsError('failed-precondition', 'La asignación inicial ya no está en borrador.');
    }
    if (assignment.revisorId !== actor.uid && (0, security_1.getContextRole)(context) !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Solo el revisor asignado puede firmar este borrador.');
    }
    const { ipCliente, userAgent } = (0, security_1.getClientMetadata)(context);
    const firma = {
        url: payload.url,
        storagePath: payload.storagePath,
        fechaFirma: new Date().toISOString(),
        ipCliente,
        userAgent,
        hashDocumento: (0, security_1.buildDocumentHash)(assignment),
        declaracionAceptada: true,
    };
    await assignmentRef.update({
        firmaRevisor: firma,
        estado: 'pendiente_firma_custodio',
        actualizadoEn: (0, security_1.serverTimestamp)(),
        actualizadoPor: actor.uid,
    });
    return { ok: true };
});
exports.registerInitialAssignmentCustodianSignature = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    var _a;
    const actor = (0, security_1.ensureRole)(context, ['custodio']);
    const payload = data;
    if (!payload.assignmentId || !payload.storagePath || !payload.url || !payload.nombre || !payload.cedula) {
        throw new functions.https.HttpsError('invalid-argument', 'Faltan datos de la firma del custodio.');
    }
    (0, security_1.ensureStoragePath)(payload.storagePath, `asignaciones-firmas/${payload.assignmentId}/`);
    const assignmentRef = security_1.db.collection('asignaciones').doc(payload.assignmentId);
    const assignmentSnapshot = await assignmentRef.get();
    if (!assignmentSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'La asignación inicial ya no existe.');
    }
    const assignment = assignmentSnapshot.data();
    if (assignment.estado !== 'pendiente_firma_custodio') {
        throw new functions.https.HttpsError('failed-precondition', 'La asignación inicial no está esperando la firma del custodio.');
    }
    if (assignment.custodioId !== actor.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Solo el custodio titular puede firmar esta asignación inicial.');
    }
    const { ipCliente, userAgent } = (0, security_1.getClientMetadata)(context);
    const firma = {
        url: payload.url,
        storagePath: payload.storagePath,
        fechaFirma: new Date().toISOString(),
        ipCliente,
        userAgent,
        hashDocumento: (0, security_1.buildDocumentHash)(assignment),
        declaracionAceptada: true,
    };
    await assignmentRef.update({
        firmaCustodio: firma,
        custodioNombre: payload.nombre,
        custodioCedula: payload.cedula,
        estado: 'firmada_completa',
        actualizadoEn: (0, security_1.serverTimestamp)(),
        actualizadoPor: actor.uid,
    });
    await (0, security_1.writeAuditLog)({
        accion: 'firmar_asignacion_inicial_custodio',
        modulo: 'asignaciones',
        documentoId: payload.assignmentId,
        usuarioId: actor.uid,
        usuarioEmail: (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token.email,
        descripcion: 'La asignación inicial fue firmada por el custodio titular.',
    });
    return { ok: true };
});
//# sourceMappingURL=assignmentCallables.js.map