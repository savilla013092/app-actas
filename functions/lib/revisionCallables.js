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
exports.registerCustodianSignature = exports.registerReviewerSignature = exports.deleteRevisionDraftEvidence = exports.registerRevisionEvidence = exports.updateRevisionDraft = exports.createRevisionDraft = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const security_1 = require("./security");
const SUPPORTED_INLINE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_INLINE_EVIDENCE_BYTES = 5 * 1024 * 1024;
const MAX_INLINE_SIGNATURE_BYTES = 500 * 1024;
function sanitizeStorageFileName(fileName, contentType) {
    const cleanedBaseName = fileName
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
    const extension = contentType === 'image/png' ? 'png' : 'jpg';
    return `${cleanedBaseName || 'evidencia'}.${extension}`;
}
function decodeBase64Payload(dataBase64, invalidMessage) {
    const normalized = dataBase64.trim();
    if (!normalized) {
        throw new functions.https.HttpsError('invalid-argument', invalidMessage);
    }
    try {
        const buffer = Buffer.from(normalized, 'base64');
        if (buffer.length === 0) {
            throw new Error('EMPTY_BUFFER');
        }
        return buffer;
    }
    catch (error) {
        throw new functions.https.HttpsError('invalid-argument', invalidMessage, String(error));
    }
}
function parseSignatureDataUrl(dataUrl) {
    const match = dataUrl.match(/^data:(image\/png);base64,(.+)$/);
    if (!match) {
        throw new functions.https.HttpsError('invalid-argument', 'La firma debe enviarse en formato PNG base64.');
    }
    const [, contentType, rawBase64] = match;
    const buffer = decodeBase64Payload(rawBase64, 'La firma suministrada no es valida.');
    if (buffer.length > MAX_INLINE_SIGNATURE_BYTES) {
        throw new functions.https.HttpsError('failed-precondition', 'La firma supera el tamano maximo permitido.');
    }
    return { buffer, contentType };
}
async function storeInlineRevisionEvidenceFiles(revisionId, evidences) {
    var _a, _b, _c;
    const bucket = admin.storage().bucket();
    const uploadedStoragePaths = [];
    const uploadedFiles = [];
    try {
        for (let index = 0; index < evidences.length; index += 1) {
            const evidence = evidences[index];
            const contentType = (_a = evidence.contentType) === null || _a === void 0 ? void 0 : _a.trim();
            if (!contentType || !SUPPORTED_INLINE_IMAGE_TYPES.has(contentType)) {
                throw new functions.https.HttpsError('invalid-argument', 'Las evidencias solo admiten imagenes JPG o PNG.');
            }
            if (!evidence.dataBase64) {
                throw new functions.https.HttpsError('invalid-argument', 'Falta el contenido de una de las evidencias.');
            }
            const buffer = decodeBase64Payload(evidence.dataBase64, 'No fue posible procesar una de las evidencias cargadas.');
            if (buffer.length > MAX_INLINE_EVIDENCE_BYTES) {
                throw new functions.https.HttpsError('failed-precondition', 'Una de las evidencias supera el tamano maximo permitido.');
            }
            const nombre = ((_b = evidence.nombre) === null || _b === void 0 ? void 0 : _b.trim()) || `Evidencia ${index + 1}`;
            const fileName = `${Date.now()}-${index + 1}-${sanitizeStorageFileName(nombre, contentType)}`;
            const storagePath = `evidencias/${revisionId}/${fileName}`;
            await bucket.file(storagePath).save(buffer, {
                metadata: {
                    contentType,
                },
            });
            uploadedStoragePaths.push(storagePath);
            uploadedFiles.push({
                id: fileName,
                storagePath,
                nombre,
                descripcion: (_c = evidence.descripcion) === null || _c === void 0 ? void 0 : _c.trim(),
            });
        }
        return uploadedFiles;
    }
    catch (error) {
        await Promise.allSettled(uploadedStoragePaths.map((storagePath) => bucket.file(storagePath).delete({ ignoreNotFound: true })));
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'No fue posible almacenar las evidencias de la revision.');
    }
}
async function storeRevisionSignatureFromDataUrl(revisionId, target, signatureDataUrl) {
    const { buffer, contentType } = parseSignatureDataUrl(signatureDataUrl);
    const storagePath = `firmas/${revisionId}/${target}.png`;
    try {
        await admin.storage().bucket().file(storagePath).save(buffer, {
            metadata: {
                contentType,
            },
        });
    }
    catch (error) {
        throw new functions.https.HttpsError('internal', 'No fue posible almacenar la firma de la revision.', String(error));
    }
    return storagePath;
}
exports.createRevisionDraft = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    var _a;
    const actor = (0, security_1.ensureRole)(context, ['admin', 'logistica']);
    const payload = data;
    if (!payload.activoId || !payload.codigoActivo || !payload.custodioId || !payload.descripcion || !payload.fecha) {
        throw new functions.https.HttpsError('invalid-argument', 'La revisión no contiene los campos obligatorios.');
    }
    const activoSnapshot = await security_1.db.collection('activos').doc(payload.activoId).get();
    if (!activoSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'El activo seleccionado ya no existe.');
    }
    const activo = activoSnapshot.data();
    const estadoAsignacionInicial = (_a = activo.estadoAsignacionInicial) !== null && _a !== void 0 ? _a : (activo.custodioId ? 'completada' : 'no_requerida');
    if (!activo.custodioId) {
        throw new functions.https.HttpsError('failed-precondition', 'El activo debe tener custodio asignado antes de iniciar una revisión.');
    }
    if (estadoAsignacionInicial !== 'completada') {
        throw new functions.https.HttpsError('failed-precondition', 'La asignación inicial del activo debe estar completada antes de registrar revisiones.');
    }
    if (activo.custodioId !== payload.custodioId) {
        throw new functions.https.HttpsError('failed-precondition', 'El custodio del activo cambió. Recargue el formulario antes de continuar.');
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
exports.updateRevisionDraft = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    var _a;
    const actor = (0, security_1.ensureRole)(context, ['admin', 'logistica']);
    const payload = data;
    if (!payload.revisionId ||
        !payload.activoId ||
        !payload.codigoActivo ||
        !payload.descripcionActivo ||
        !payload.ubicacionActivo ||
        !payload.custodioId ||
        !payload.custodioNombre ||
        !payload.custodioCedula ||
        !payload.custodioCargo ||
        !payload.fecha ||
        !payload.estadoActivo ||
        !payload.descripcion) {
        throw new functions.https.HttpsError('invalid-argument', 'La actualizacion del borrador no contiene los campos obligatorios.');
    }
    const revisionRef = security_1.db.collection('revisiones').doc(payload.revisionId);
    const revisionSnapshot = await revisionRef.get();
    if (!revisionSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'La revision ya no existe.');
    }
    const revision = revisionSnapshot.data();
    if (revision.estado !== 'borrador') {
        throw new functions.https.HttpsError('failed-precondition', 'Solo los borradores pueden editarse.');
    }
    if (revision.revisorId !== actor.uid && (0, security_1.getContextRole)(context) !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Solo el revisor asignado puede editar este borrador.');
    }
    if (revision.activoId !== payload.activoId) {
        throw new functions.https.HttpsError('failed-precondition', 'El borrador debe mantenerse asociado al mismo activo.');
    }
    const activoSnapshot = await security_1.db.collection('activos').doc(payload.activoId).get();
    if (!activoSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'El activo asociado ya no existe.');
    }
    const custodioSnapshot = await security_1.db.collection('usuarios').doc(payload.custodioId).get();
    if (!custodioSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'El custodio indicado ya no existe.');
    }
    const custodio = custodioSnapshot.data();
    if (custodio.rol !== 'custodio' || custodio.activo !== true) {
        throw new functions.https.HttpsError('failed-precondition', 'El custodio seleccionado debe estar activo y tener rol de custodio.');
    }
    await revisionRef.update((0, security_1.stripUndefinedDeep)({
        codigoActivo: payload.codigoActivo,
        descripcionActivo: payload.descripcionActivo,
        ubicacionActivo: payload.ubicacionActivo,
        custodioId: payload.custodioId,
        custodioNombre: payload.custodioNombre,
        custodioCedula: payload.custodioCedula,
        custodioCargo: payload.custodioCargo,
        fecha: admin.firestore.Timestamp.fromDate(new Date(payload.fecha)),
        estadoActivo: payload.estadoActivo,
        descripcion: payload.descripcion,
        observaciones: payload.observaciones,
        actualizadoEn: (0, security_1.serverTimestamp)(),
        actualizadoPor: actor.uid,
    }));
    await (0, security_1.writeAuditLog)({
        accion: 'actualizar_revision_borrador',
        modulo: 'revisiones',
        documentoId: payload.revisionId,
        usuarioId: actor.uid,
        usuarioEmail: (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token.email,
        descripcion: 'Se actualizo un borrador de revision.',
    });
    return { ok: true };
});
exports.registerRevisionEvidence = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    const actor = (0, security_1.ensureRole)(context, ['admin', 'logistica']);
    const payload = data;
    if (!payload.revisionId) {
        throw new functions.https.HttpsError('invalid-argument', 'Debe indicar la revision y las evidencias.');
    }
    const hasStoredFiles = Array.isArray(payload.evidences) && payload.evidences.length > 0;
    const hasInlineFiles = Array.isArray(payload.inlineFiles) && payload.inlineFiles.length > 0;
    if (!hasStoredFiles && !hasInlineFiles) {
        throw new functions.https.HttpsError('invalid-argument', 'Debe indicar la revision y las evidencias.');
    }
    const revisionRef = security_1.db.collection('revisiones').doc(payload.revisionId);
    const revisionSnapshot = await revisionRef.get();
    if (!revisionSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'La revision ya no existe.');
    }
    const revision = revisionSnapshot.data();
    if (revision.estado !== 'borrador' && revision.estado !== 'pendiente_firma_custodio') {
        throw new functions.https.HttpsError('failed-precondition', 'La revision no admite nuevas evidencias.');
    }
    const uploadedFiles = hasInlineFiles
        ? await storeInlineRevisionEvidenceFiles(payload.revisionId, payload.inlineFiles || [])
        : (payload.evidences || []);
    uploadedFiles.forEach((file) => (0, security_1.ensureStoragePath)(file.storagePath, `evidencias/${payload.revisionId}/`));
    const mappedEvidences = (0, security_1.mapUploadedEvidence)(uploadedFiles);
    const updatedEvidences = [...(revision.evidencias || []), ...mappedEvidences];
    try {
        await revisionRef.update({
            evidencias: updatedEvidences,
            actualizadoEn: (0, security_1.serverTimestamp)(),
            actualizadoPor: actor.uid,
        });
    }
    catch (error) {
        if (hasInlineFiles) {
            await Promise.allSettled(uploadedFiles.map((file) => admin.storage().bucket().file(file.storagePath).delete({ ignoreNotFound: true })));
        }
        throw error;
    }
    return {
        count: updatedEvidences.length,
        evidences: mappedEvidences,
    };
});
exports.deleteRevisionDraftEvidence = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    var _a;
    const actor = (0, security_1.ensureRole)(context, ['admin', 'logistica']);
    const payload = data;
    if (!payload.revisionId || !payload.evidenceId) {
        throw new functions.https.HttpsError('invalid-argument', 'Debe indicar la revision y la evidencia a eliminar.');
    }
    const revisionRef = security_1.db.collection('revisiones').doc(payload.revisionId);
    const revisionSnapshot = await revisionRef.get();
    if (!revisionSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'La revision ya no existe.');
    }
    const revision = revisionSnapshot.data();
    if (revision.estado !== 'borrador') {
        throw new functions.https.HttpsError('failed-precondition', 'Solo los borradores permiten eliminar evidencias.');
    }
    if (revision.revisorId !== actor.uid && (0, security_1.getContextRole)(context) !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Solo el revisor asignado puede modificar este borrador.');
    }
    const evidencias = revision.evidencias || [];
    const evidenceToDelete = evidencias.find((evidencia) => evidencia.id === payload.evidenceId);
    if (!evidenceToDelete) {
        throw new functions.https.HttpsError('not-found', 'La evidencia indicada no existe en este borrador.');
    }
    const updatedEvidences = evidencias.filter((evidencia) => evidencia.id !== payload.evidenceId);
    await revisionRef.update({
        evidencias: updatedEvidences,
        actualizadoEn: (0, security_1.serverTimestamp)(),
        actualizadoPor: actor.uid,
    });
    const storagePath = (0, security_1.resolveStoredFilePath)(evidenceToDelete, admin.storage().bucket().name);
    await admin.storage().bucket().file(storagePath).delete({ ignoreNotFound: true });
    await (0, security_1.writeAuditLog)({
        accion: 'eliminar_evidencia_revision_borrador',
        modulo: 'revisiones',
        documentoId: payload.revisionId,
        usuarioId: actor.uid,
        usuarioEmail: (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token.email,
        descripcion: 'Se elimino una evidencia de un borrador de revision.',
    });
    return { ok: true };
});
exports.registerReviewerSignature = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    const actor = (0, security_1.ensureRole)(context, ['admin', 'logistica']);
    const payload = data;
    if (!payload.revisionId || (!payload.storagePath && !payload.signatureDataUrl)) {
        throw new functions.https.HttpsError('invalid-argument', 'Faltan datos de la firma del revisor.');
    }
    const revisionRef = security_1.db.collection('revisiones').doc(payload.revisionId);
    const revisionSnapshot = await revisionRef.get();
    if (!revisionSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'La revision ya no existe.');
    }
    const revision = revisionSnapshot.data();
    if (revision.estado !== 'borrador') {
        throw new functions.https.HttpsError('failed-precondition', 'La revision ya no esta en borrador.');
    }
    if (revision.revisorId !== actor.uid && (0, security_1.getContextRole)(context) !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Solo el revisor asignado puede firmar este borrador.');
    }
    const storagePath = payload.storagePath
        ? payload.storagePath
        : await storeRevisionSignatureFromDataUrl(payload.revisionId, 'revisor', payload.signatureDataUrl || '');
    (0, security_1.ensureStoragePath)(storagePath, `firmas/${payload.revisionId}/`);
    const { ipCliente, userAgent } = (0, security_1.getClientMetadata)(context);
    const firma = (0, security_1.stripUndefinedDeep)({
        ...(payload.url ? { url: payload.url } : {}),
        storagePath,
        fechaFirma: new Date().toISOString(),
        ipCliente,
        userAgent,
        hashDocumento: (0, security_1.buildDocumentHash)(revision),
        declaracionAceptada: true,
    });
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
    if (!payload.revisionId || (!payload.storagePath && !payload.signatureDataUrl) || !payload.nombre || !payload.cedula) {
        throw new functions.https.HttpsError('invalid-argument', 'Faltan datos de la firma del custodio.');
    }
    const revisionRef = security_1.db.collection('revisiones').doc(payload.revisionId);
    const revisionSnapshot = await revisionRef.get();
    if (!revisionSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'La revision ya no existe.');
    }
    const revision = revisionSnapshot.data();
    if (revision.estado !== 'pendiente_firma_custodio') {
        throw new functions.https.HttpsError('failed-precondition', 'La revision no esta esperando la firma del custodio.');
    }
    if (revision.custodioId !== actor.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Solo el custodio titular puede firmar esta revision.');
    }
    const storagePath = payload.storagePath
        ? payload.storagePath
        : await storeRevisionSignatureFromDataUrl(payload.revisionId, 'custodio', payload.signatureDataUrl || '');
    (0, security_1.ensureStoragePath)(storagePath, `firmas/${payload.revisionId}/`);
    const { ipCliente, userAgent } = (0, security_1.getClientMetadata)(context);
    const firma = (0, security_1.stripUndefinedDeep)({
        ...(payload.url ? { url: payload.url } : {}),
        storagePath,
        fechaFirma: new Date().toISOString(),
        ipCliente,
        userAgent,
        hashDocumento: (0, security_1.buildDocumentHash)(revision),
        declaracionAceptada: true,
    });
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
        descripcion: 'La revision fue firmada por el custodio titular.',
    });
    return { ok: true };
});
//# sourceMappingURL=revisionCallables.js.map