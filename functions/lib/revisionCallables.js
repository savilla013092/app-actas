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
exports.registerCustodianSignature = exports.registerReviewerSignature = exports.registerRevisionEvidence = exports.createRevisionDraft = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const security_1 = require("./security");
exports.createRevisionDraft = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    const actor = (0, security_1.ensureRole)(context, ['admin', 'logistica']);
    const payload = data;
    if (!payload.activoId || !payload.codigoActivo || !payload.custodioId || !payload.descripcion || !payload.fecha) {
        throw new functions.https.HttpsError('invalid-argument', 'La revisión no contiene los campos obligatorios.');
    }
    const activoSnapshot = await security_1.db.collection('activos').doc(payload.activoId).get();
    if (!activoSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'El activo seleccionado ya no existe.');
    }
    const revisionRef = security_1.db.collection('revisiones').doc();
    const revisionDoc = (0, security_1.stripUndefinedDeep)({
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
        estadoActivo: payload.estadoActivo,
        descripcion: payload.descripcion,
        observaciones: payload.observaciones,
        evidencias: [],
        estado: 'borrador',
        creadoEn: (0, security_1.serverTimestamp)(),
        actualizadoEn: (0, security_1.serverTimestamp)(),
        creadoPor: actor.uid,
        actualizadoPor: actor.uid,
    });
    await revisionRef.set(revisionDoc);
    return { id: revisionRef.id };
});
exports.registerRevisionEvidence = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    const actor = (0, security_1.ensureRole)(context, ['admin', 'logistica']);
    const payload = data;
    if (!payload.revisionId || !Array.isArray(payload.evidences) || payload.evidences.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Debe indicar la revisión y las evidencias.');
    }
    const revisionRef = security_1.db.collection('revisiones').doc(payload.revisionId);
    const revisionSnapshot = await revisionRef.get();
    if (!revisionSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'La revisión ya no existe.');
    }
    const revision = revisionSnapshot.data();
    if (revision.estado !== 'borrador' && revision.estado !== 'pendiente_firma_custodio') {
        throw new functions.https.HttpsError('failed-precondition', 'La revisión no admite nuevas evidencias.');
    }
    payload.evidences.forEach((file) => (0, security_1.ensureStoragePath)(file.storagePath, `evidencias/${payload.revisionId}/`));
    const updatedEvidences = [...(revision.evidencias || []), ...(0, security_1.mapUploadedEvidence)(payload.evidences)];
    await revisionRef.update({
        evidencias: updatedEvidences,
        actualizadoEn: (0, security_1.serverTimestamp)(),
        actualizadoPor: actor.uid,
    });
    return { count: updatedEvidences.length };
});
exports.registerReviewerSignature = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    const actor = (0, security_1.ensureRole)(context, ['admin', 'logistica']);
    const payload = data;
    if (!payload.revisionId || !payload.storagePath || !payload.url) {
        throw new functions.https.HttpsError('invalid-argument', 'Faltan datos de la firma del revisor.');
    }
    (0, security_1.ensureStoragePath)(payload.storagePath, `firmas/${payload.revisionId}/`);
    const revisionRef = security_1.db.collection('revisiones').doc(payload.revisionId);
    const revisionSnapshot = await revisionRef.get();
    if (!revisionSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'La revisión ya no existe.');
    }
    const revision = revisionSnapshot.data();
    if (revision.estado !== 'borrador') {
        throw new functions.https.HttpsError('failed-precondition', 'La revisión ya no está en borrador.');
    }
    if (revision.revisorId !== actor.uid && (0, security_1.getContextRole)(context) !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Solo el revisor asignado puede firmar este borrador.');
    }
    const { ipCliente, userAgent } = (0, security_1.getClientMetadata)(context);
    const firma = {
        url: payload.url,
        storagePath: payload.storagePath,
        fechaFirma: new Date().toISOString(),
        ipCliente,
        userAgent,
        hashDocumento: (0, security_1.buildDocumentHash)(revision),
        declaracionAceptada: true,
    };
    await revisionRef.update({
        firmaRevisor: firma,
        estado: 'pendiente_firma_custodio',
        actualizadoEn: (0, security_1.serverTimestamp)(),
        actualizadoPor: actor.uid,
    });
    return { ok: true };
});
exports.registerCustodianSignature = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    var _a;
    const actor = (0, security_1.ensureRole)(context, ['custodio']);
    const payload = data;
    if (!payload.revisionId || !payload.storagePath || !payload.url || !payload.nombre || !payload.cedula) {
        throw new functions.https.HttpsError('invalid-argument', 'Faltan datos de la firma del custodio.');
    }
    (0, security_1.ensureStoragePath)(payload.storagePath, `firmas/${payload.revisionId}/`);
    const revisionRef = security_1.db.collection('revisiones').doc(payload.revisionId);
    const revisionSnapshot = await revisionRef.get();
    if (!revisionSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'La revisión ya no existe.');
    }
    const revision = revisionSnapshot.data();
    if (revision.estado !== 'pendiente_firma_custodio') {
        throw new functions.https.HttpsError('failed-precondition', 'La revisión no está esperando la firma del custodio.');
    }
    if (revision.custodioId !== actor.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Solo el custodio titular puede firmar esta revisión.');
    }
    const { ipCliente, userAgent } = (0, security_1.getClientMetadata)(context);
    const firma = {
        url: payload.url,
        storagePath: payload.storagePath,
        fechaFirma: new Date().toISOString(),
        ipCliente,
        userAgent,
        hashDocumento: (0, security_1.buildDocumentHash)(revision),
        declaracionAceptada: true,
    };
    await revisionRef.update({
        firmaCustodio: firma,
        custodioNombre: payload.nombre,
        custodioCedula: payload.cedula,
        estado: 'firmada_completa',
        actualizadoEn: (0, security_1.serverTimestamp)(),
        actualizadoPor: actor.uid,
    });
    await (0, security_1.writeAuditLog)({
        accion: 'firmar_revision_custodio',
        modulo: 'revisiones',
        documentoId: payload.revisionId,
        usuarioId: actor.uid,
        usuarioEmail: (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token.email,
        descripcion: 'La revisión fue firmada por el custodio titular.',
    });
    return { ok: true };
});
//# sourceMappingURL=revisionCallables.js.map