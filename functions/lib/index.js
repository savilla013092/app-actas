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
exports.onDocumentoModificado = exports.onRevisionFirmadaCompleta = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const generarActaPDF_1 = require("./generarActaPDF");
const consecutivos_1 = require("./consecutivos");
admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();
exports.onRevisionFirmadaCompleta = functions.firestore
    .document('revisiones/{revisionId}')
    .onUpdate(async (change, context) => {
    var _a, _b;
    const antes = change.before.data();
    const despues = change.after.data();
    const revisionId = context.params.revisionId;
    if (antes.estado !== 'firmada_completa' && despues.estado === 'firmada_completa') {
        if (!((_a = despues.firmaRevisor) === null || _a === void 0 ? void 0 : _a.url) || !((_b = despues.firmaCustodio) === null || _b === void 0 ? void 0 : _b.url)) {
            console.error('Faltan firmas en la revisión', revisionId);
            return null;
        }
        try {
            const numeroActa = await (0, consecutivos_1.generarConsecutivo)(db);
            const pdfBuffer = await (0, generarActaPDF_1.generarActaPDF)({
                numeroActa,
                revision: despues,
                storage,
            });
            const bucket = storage.bucket();
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
                actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
            });
            await db.collection('auditoria').add({
                accion: 'completar',
                modulo: 'revisiones',
                documentoId: revisionId,
                usuarioId: 'system',
                usuarioEmail: 'system@serviciudad.gov.co',
                usuarioNombre: 'Sistema',
                descripcion: `Acta ${numeroActa} generada automáticamente`,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`Acta ${numeroActa} generada exitosamente para revisión ${revisionId}`);
            return { success: true, numeroActa };
        }
        catch (error) {
            console.error('Error al generar acta PDF:', error);
            await change.after.ref.update({
                estado: 'error_generacion',
                errorMensaje: String(error),
                actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { success: false, error: String(error) };
        }
    }
    return null;
});
exports.onDocumentoModificado = functions.firestore
    .document('{coleccion}/{docId}')
    .onWrite(async (change, context) => {
    const coleccion = context.params.coleccion;
    if (!['usuarios', 'activos', 'revisiones'].includes(coleccion)) {
        return null;
    }
    if (coleccion === 'auditoria') {
        return null;
    }
    const antes = change.before.exists ? change.before.data() : null;
    const despues = change.after.exists ? change.after.data() : null;
    let accion;
    if (!antes && despues) {
        accion = 'crear';
    }
    else if (antes && !despues) {
        accion = 'eliminar';
    }
    else {
        accion = 'modificar';
    }
    const usuarioId = (despues === null || despues === void 0 ? void 0 : despues.actualizadoPor) || (despues === null || despues === void 0 ? void 0 : despues.creadoPor) || 'unknown';
    await db.collection('auditoria').add({
        accion,
        modulo: coleccion,
        documentoId: context.params.docId,
        usuarioId,
        datosAntes: antes,
        datosDespues: despues,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return null;
});
//# sourceMappingURL=index.js.map