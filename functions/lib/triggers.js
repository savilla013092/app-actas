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
exports.onDocumentoModificado = exports.onAsignacionFirmadaCompleta = exports.onRevisionFirmadaCompleta = exports.onActivoWriteSyncSearch = exports.onUsuarioWriteSyncClaims = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const consecutivos_1 = require("./consecutivos");
const generarActaAsignacionPDF_1 = require("./generarActaAsignacionPDF");
const generarActaPDF_1 = require("./generarActaPDF");
const security_1 = require("./security");
function hasStoredFileReference(file) {
    return Boolean((file === null || file === void 0 ? void 0 : file.storagePath) || (file === null || file === void 0 ? void 0 : file.url));
}
exports.onUsuarioWriteSyncClaims = functions.region(security_1.REGION).firestore
    .document('usuarios/{userId}')
    .onWrite(async (change, context) => {
    if (!change.after.exists) {
        await admin.auth().setCustomUserClaims(context.params.userId, null).catch(() => undefined);
        return null;
    }
    const profile = change.after.data();
    await (0, security_1.syncUserClaims)(context.params.userId, profile);
    return null;
});
exports.onActivoWriteSyncSearch = functions.region(security_1.REGION).firestore
    .document('activos/{activoId}')
    .onWrite(async (change) => {
    if (!change.after.exists) {
        return null;
    }
    const afterData = change.after.data();
    const nextSearch = (0, security_1.buildAssetSearchPayload)(afterData);
    const currentSearch = afterData.search;
    const currentSignature = JSON.stringify((0, security_1.stripUndefinedDeep)(currentSearch || {}));
    const nextSignature = JSON.stringify((0, security_1.stripUndefinedDeep)(nextSearch));
    if (currentSignature === nextSignature) {
        return null;
    }
    await change.after.ref.set({ search: nextSearch }, { merge: true });
    return null;
});
exports.onRevisionFirmadaCompleta = functions.region(security_1.REGION).firestore
    .document('revisiones/{revisionId}')
    .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const revisionId = context.params.revisionId;
    if (beforeData.estado === 'firmada_completa' || afterData.estado !== 'firmada_completa') {
        return null;
    }
    if (!hasStoredFileReference(afterData.firmaRevisor) ||
        !hasStoredFileReference(afterData.firmaCustodio)) {
        console.error('La revisión firmada no tiene ambas firmas.', revisionId);
        return null;
    }
    try {
        const numeroActa = await (0, consecutivos_1.generarConsecutivo)(security_1.db);
        const pdfBuffer = await (0, generarActaPDF_1.generarActaPDF)({
            numeroActa,
            revision: afterData,
            storage: security_1.storage,
        });
        const bucket = security_1.storage.bucket();
        const pdfPath = `actas/${revisionId}.pdf`;
        const file = bucket.file(pdfPath);
        await file.save(pdfBuffer, {
            metadata: {
                contentType: 'application/pdf',
            },
        });
        await file.makePublic();
        const pdfUrl = `https://storage.googleapis.com/${bucket.name}/${pdfPath}`;
        await change.after.ref.update({
            numeroActa,
            actaPdfUrl: pdfUrl,
            estado: 'completada',
            actualizadoEn: (0, security_1.serverTimestamp)(),
        });
        await (0, security_1.writeAuditLog)({
            accion: 'completar_revision',
            modulo: 'revisiones',
            documentoId: revisionId,
            usuarioId: 'system',
            usuarioEmail: 'system@serviciudad.gov.co',
            descripcion: `Acta ${numeroActa} generada automáticamente.`,
        });
        return { success: true, numeroActa };
    }
    catch (error) {
        console.error('Error al generar el acta PDF:', error);
        await change.after.ref.update({
            estado: 'anulada',
            errorMensaje: String(error),
            actualizadoEn: (0, security_1.serverTimestamp)(),
        });
        return { success: false, error: String(error) };
    }
});
exports.onAsignacionFirmadaCompleta = functions.region(security_1.REGION).firestore
    .document('asignaciones/{assignmentId}')
    .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const assignmentId = context.params.assignmentId;
    if (beforeData.estado === 'firmada_completa' || afterData.estado !== 'firmada_completa') {
        return null;
    }
    if (!hasStoredFileReference(afterData.firmaRevisor) ||
        !hasStoredFileReference(afterData.firmaCustodio)) {
        console.error('La asignación firmada no tiene ambas firmas.', assignmentId);
        return null;
    }
    try {
        const numeroActa = await (0, consecutivos_1.generarConsecutivo)(security_1.db);
        const pdfBuffer = await (0, generarActaAsignacionPDF_1.generarActaAsignacionPDF)({
            numeroActa,
            asignacion: afterData,
            storage: security_1.storage,
        });
        const bucket = security_1.storage.bucket();
        const pdfPath = `actas/asignacion-${assignmentId}.pdf`;
        const file = bucket.file(pdfPath);
        await file.save(pdfBuffer, {
            metadata: {
                contentType: 'application/pdf',
            },
        });
        await file.makePublic();
        const pdfUrl = `https://storage.googleapis.com/${bucket.name}/${pdfPath}`;
        await Promise.all([
            change.after.ref.update({
                numeroActa,
                actaPdfUrl: pdfUrl,
                estado: 'completada',
                actualizadoEn: (0, security_1.serverTimestamp)(),
            }),
            security_1.db.collection('activos').doc(afterData.activoId).set({
                estadoAsignacionInicial: 'completada',
                asignacionInicialId: assignmentId,
                asignacionInicialCompletadaEn: (0, security_1.serverTimestamp)(),
                actualizadoEn: (0, security_1.serverTimestamp)(),
                actualizadoPor: 'system',
            }, { merge: true }),
        ]);
        await (0, security_1.writeAuditLog)({
            accion: 'completar_asignacion_inicial',
            modulo: 'asignaciones',
            documentoId: assignmentId,
            usuarioId: 'system',
            usuarioEmail: 'system@serviciudad.gov.co',
            descripcion: `Acta ${numeroActa} de asignación inicial generada automáticamente.`,
        });
        return { success: true, numeroActa };
    }
    catch (error) {
        console.error('Error al generar el acta PDF de asignación inicial:', error);
        await change.after.ref.update({
            estado: 'anulada',
            errorMensaje: String(error),
            actualizadoEn: (0, security_1.serverTimestamp)(),
        });
        return { success: false, error: String(error) };
    }
});
exports.onDocumentoModificado = functions.region(security_1.REGION).firestore
    .document('{coleccion}/{docId}')
    .onWrite(async (change, context) => {
    const collectionName = context.params.coleccion;
    if (!['usuarios', 'activos', 'revisiones', 'asignaciones', 'express_loans'].includes(collectionName)) {
        return null;
    }
    const beforeData = change.before.exists ? change.before.data() : null;
    const afterData = change.after.exists ? change.after.data() : null;
    let action = 'modificar';
    if (!beforeData && afterData) {
        action = 'crear';
    }
    else if (beforeData && !afterData) {
        action = 'eliminar';
    }
    const userId = ((afterData === null || afterData === void 0 ? void 0 : afterData.actualizadoPor) || (afterData === null || afterData === void 0 ? void 0 : afterData.creadoPor) || 'desconocido');
    await security_1.db.collection('auditoria').add({
        accion: action,
        modulo: collectionName,
        documentoId: context.params.docId,
        usuarioId: userId,
        datosAntes: beforeData,
        datosDespues: afterData,
        timestamp: (0, security_1.serverTimestamp)(),
    });
    return null;
});
//# sourceMappingURL=triggers.js.map