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
exports.startAssetImport = exports.markExpressLoanReturned = exports.createExpressLoan = exports.searchActiveAssets = void 0;
const functions = __importStar(require("firebase-functions"));
const XLSX = __importStar(require("xlsx"));
const security_1 = require("./security");
exports.searchActiveAssets = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    var _a, _b;
    (0, security_1.ensureRole)(context, ['admin', 'logistica']);
    const payload = data;
    const rawSearch = ((_a = payload.search) === null || _a === void 0 ? void 0 : _a.trim()) || '';
    const normalizedSearch = (0, security_1.normalizeText)(rawSearch);
    const maxResults = Math.min(Math.max((_b = payload.limit) !== null && _b !== void 0 ? _b : 25, 5), 50);
    const results = new Map();
    const baseCollection = security_1.db.collection('activos');
    const collectSnapshot = (snapshot) => {
        snapshot.docs.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            if (data.estado !== 'activo') {
                return;
            }
            results.set(docSnapshot.id, { id: docSnapshot.id, ...data });
        });
    };
    if (!normalizedSearch) {
        const snapshot = await baseCollection
            .where('estado', '==', 'activo')
            .orderBy('search.codigo')
            .limit(maxResults)
            .get();
        collectSnapshot(snapshot);
    }
    else {
        const queries = [
            baseCollection
                .where('estado', '==', 'activo')
                .orderBy('search.codigo')
                .startAt(normalizedSearch)
                .endAt(`${normalizedSearch}\uf8ff`)
                .limit(maxResults)
                .get(),
            baseCollection
                .where('estado', '==', 'activo')
                .orderBy('search.serial')
                .startAt(normalizedSearch)
                .endAt(`${normalizedSearch}\uf8ff`)
                .limit(maxResults)
                .get(),
        ];
        const tokens = (0, security_1.tokenizeSearchParts)([rawSearch]);
        if (tokens.length > 0) {
            queries.push(baseCollection
                .where('search.tokens', 'array-contains-any', tokens.slice(0, 10))
                .limit(maxResults)
                .get());
        }
        const snapshots = await Promise.all(queries);
        snapshots.forEach(collectSnapshot);
    }
    return {
        items: Array.from(results.values())
            .sort((a, b) => String(a.codigo || '').localeCompare(String(b.codigo || '')))
            .slice(0, maxResults),
    };
});
exports.createExpressLoan = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e, _f;
    const actor = (0, security_1.ensureRole)(context, ['admin', 'logistica']);
    const payload = data;
    if (!((_a = payload.borrower_name) === null || _a === void 0 ? void 0 : _a.trim()) || !payload.item_type || !((_b = payload.element_description) === null || _b === void 0 ? void 0 : _b.trim())) {
        throw new functions.https.HttpsError('invalid-argument', 'El préstamo no contiene los campos obligatorios.');
    }
    if (payload.item_type === 'comodin' && (!payload.evidences || payload.evidences.length === 0)) {
        throw new functions.https.HttpsError('invalid-argument', 'El item comodín requiere evidencia fotográfica.');
    }
    if (payload.item_type === 'activo_registrado' && payload.asset_id) {
        const activeLoanSnapshot = await security_1.db
            .collection('express_loans')
            .where('asset_id', '==', payload.asset_id)
            .where('status', '==', 'activo')
            .limit(1)
            .get();
        if (!activeLoanSnapshot.empty) {
            throw new functions.https.HttpsError('already-exists', 'El activo ya tiene un préstamo express activo.');
        }
    }
    (payload.evidences || []).forEach((file) => (0, security_1.ensureStoragePath)(file.storagePath, 'express_loans/'));
    const loanRef = payload.loanId ? security_1.db.collection('express_loans').doc(payload.loanId) : security_1.db.collection('express_loans').doc();
    const now = (0, security_1.toIsoDateString)(payload.loan_date);
    const loanDoc = (0, security_1.stripUndefinedDeep)({
        borrower_name: payload.borrower_name.trim(),
        borrower_document: (_c = payload.borrower_document) === null || _c === void 0 ? void 0 : _c.trim(),
        item_type: payload.item_type,
        asset_id: payload.asset_id,
        asset_code: payload.asset_code,
        asset_snapshot: payload.asset_snapshot,
        element_description: payload.element_description.trim(),
        evidences: (0, security_1.mapUploadedEvidence)(payload.evidences || []),
        notes: (_d = payload.notes) === null || _d === void 0 ? void 0 : _d.trim(),
        loan_date: now,
        status: 'activo',
        lender_id: actor.uid,
        lender_name: (_e = payload.lender_name) === null || _e === void 0 ? void 0 : _e.trim(),
        created_at: now,
        updated_at: now,
        created_by: actor.uid,
        updated_by: actor.uid,
    });
    await loanRef.set(loanDoc);
    await (0, security_1.writeAuditLog)({
        accion: 'crear_prestamo_express',
        modulo: 'express_loans',
        documentoId: loanRef.id,
        usuarioId: actor.uid,
        usuarioEmail: (_f = context.auth) === null || _f === void 0 ? void 0 : _f.token.email,
        descripcion: `Préstamo express creado para ${payload.borrower_name.trim()}.`,
    });
    return { id: loanRef.id };
});
exports.markExpressLoanReturned = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    var _a;
    const actor = (0, security_1.ensureRole)(context, ['admin', 'logistica']);
    const payload = data;
    if (!payload.loanId) {
        throw new functions.https.HttpsError('invalid-argument', 'Debe indicar el préstamo a devolver.');
    }
    const loanRef = security_1.db.collection('express_loans').doc(payload.loanId);
    const snapshot = await loanRef.get();
    if (!snapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'El préstamo indicado no existe.');
    }
    const loan = snapshot.data();
    if (loan.status !== 'activo') {
        throw new functions.https.HttpsError('failed-precondition', 'El préstamo ya no está activo.');
    }
    const now = new Date().toISOString();
    await loanRef.update({
        status: 'devuelto',
        return_date: now,
        updated_at: now,
        updated_by: actor.uid,
    });
    await (0, security_1.writeAuditLog)({
        accion: 'devolver_prestamo_express',
        modulo: 'express_loans',
        documentoId: payload.loanId,
        usuarioId: actor.uid,
        usuarioEmail: (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token.email,
        descripcion: 'Préstamo express marcado como devuelto.',
    });
    return { ok: true };
});
exports.startAssetImport = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    var _a;
    const actor = (0, security_1.ensureRole)(context, ['admin']);
    const payload = data;
    if (!payload.storagePath) {
        throw new functions.https.HttpsError('invalid-argument', 'Debe suministrar la ruta del archivo a importar.');
    }
    (0, security_1.ensureStoragePath)(payload.storagePath, `imports/asset-imports/${actor.uid}/`);
    const bucket = security_1.storage.bucket();
    const file = bucket.file(payload.storagePath);
    const [buffer] = await file.download();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const COL = {
        CODIGO: 0,
        DESCRIPCION: 2,
        UBICACION: 7,
        SERIAL: 9,
        DESC_TECNICA: 10,
        MARCA: 48,
        MODELO: 50,
        FECHA_ADQ: 63,
        VALOR: 64,
        RETIRADO: 76,
    };
    let imported = 0;
    let skipped = 0;
    let batch = security_1.db.batch();
    let batchSize = 0;
    for (let index = 1; index < rows.length; index += 1) {
        const row = rows[index];
        if (!row || !row[COL.CODIGO]) {
            skipped += 1;
            continue;
        }
        const codigo = `AF-${String(row[COL.CODIGO]).trim()}`;
        const assetData = (0, security_1.stripUndefinedDeep)({
            codigo,
            descripcion: String(row[COL.DESCRIPCION] || 'Sin descripcion').trim(),
            categoria: 'Sin clasificacion',
            marca: row[COL.MARCA] ? String(row[COL.MARCA]).trim() : undefined,
            modelo: row[COL.MODELO] ? String(row[COL.MODELO]).trim() : undefined,
            serial: row[COL.SERIAL] ? String(row[COL.SERIAL]).trim() : undefined,
            ubicacion: (0, security_1.normalizeLocation)(row[COL.UBICACION]),
            dependencia: 'Sin asignar',
            custodioId: '',
            custodioNombre: 'Sin asignar',
            estado: row[COL.RETIRADO] === true ? 'baja' : 'activo',
            valorAdquisicion: typeof row[COL.VALOR] === 'number' ? row[COL.VALOR] : undefined,
            fechaAdquisicion: (0, security_1.parseExcelDate)(row[COL.FECHA_ADQ]),
            observaciones: row[COL.DESC_TECNICA] ? String(row[COL.DESC_TECNICA]).trim() : undefined,
            search: (0, security_1.buildAssetSearchPayload)({
                codigo,
                descripcion: row[COL.DESCRIPCION],
                serial: row[COL.SERIAL],
                marca: row[COL.MARCA],
                modelo: row[COL.MODELO],
            }),
            creadoEn: (0, security_1.serverTimestamp)(),
            actualizadoEn: (0, security_1.serverTimestamp)(),
            creadoPor: actor.uid,
            actualizadoPor: actor.uid,
        });
        const docRef = security_1.db.collection('activos').doc();
        batch.set(docRef, assetData);
        batchSize += 1;
        imported += 1;
        if (batchSize >= 350) {
            await batch.commit();
            batch = security_1.db.batch();
            batchSize = 0;
        }
    }
    if (batchSize > 0) {
        await batch.commit();
    }
    await file.delete().catch(() => undefined);
    await (0, security_1.writeAuditLog)({
        accion: 'importar_activos',
        modulo: 'activos',
        usuarioId: actor.uid,
        usuarioEmail: (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token.email,
        descripcion: `Importación de activos ejecutada con ${imported} registros creados.`,
        metadata: { imported, skipped },
    });
    return { imported, skipped };
});
//# sourceMappingURL=assetCallables.js.map