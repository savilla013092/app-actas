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
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const XLSX = __importStar(require("xlsx"));
const assetCatalogs_1 = require("./assetCatalogs");
const security_1 = require("./security");
const MAX_ASSET_SEARCH_LIMIT = 50;
const SEARCH_CANDIDATE_LIMIT = 350;
const compareAssets = (left, right) => {
    const codeCompare = String(left.codigo || '').localeCompare(String(right.codigo || ''));
    if (codeCompare !== 0) {
        return codeCompare;
    }
    return String(left.id || '').localeCompare(String(right.id || ''));
};
const buildSearchFields = (asset) => {
    const classificationName = typeof asset.search === 'object' && asset.search !== null && typeof asset.search.classificationName === 'string'
        ? String(asset.search.classificationName)
        : (0, assetCatalogs_1.resolveClassificationName)(typeof asset.codigo === 'string' ? asset.codigo : undefined, typeof asset.categoria === 'string' ? asset.categoria : undefined);
    const locationName = typeof asset.search === 'object' && asset.search !== null && typeof asset.search.locationName === 'string'
        ? String(asset.search.locationName)
        : (0, assetCatalogs_1.resolveLocationName)(typeof asset.ubicacion === 'string' || typeof asset.ubicacion === 'number'
            ? asset.ubicacion
            : undefined);
    return [
        typeof asset.codigo === 'string' ? asset.codigo : '',
        typeof asset.descripcion === 'string' ? asset.descripcion : '',
        typeof asset.serial === 'string' ? asset.serial : '',
        typeof asset.marca === 'string' ? asset.marca : '',
        typeof asset.modelo === 'string' ? asset.modelo : '',
        classificationName,
        locationName,
        typeof asset.custodioNombre === 'string' ? asset.custodioNombre : '',
    ];
};
const matchesAssetFilters = (asset, classificationCode, locationName) => {
    const resolvedClassificationCode = typeof asset.search === 'object' && asset.search !== null && typeof asset.search.classificationCode === 'string'
        ? String(asset.search.classificationCode)
        : (0, assetCatalogs_1.normalizeClassificationCode)(typeof asset.codigo === 'string' ? asset.codigo : undefined);
    const resolvedLocationName = typeof asset.search === 'object' && asset.search !== null && typeof asset.search.locationName === 'string'
        ? String(asset.search.locationName)
        : (0, assetCatalogs_1.resolveLocationName)(typeof asset.ubicacion === 'string' || typeof asset.ubicacion === 'number'
            ? asset.ubicacion
            : undefined);
    if (classificationCode && resolvedClassificationCode !== classificationCode) {
        return false;
    }
    if (locationName && resolvedLocationName !== locationName) {
        return false;
    }
    return asset.estado === 'activo';
};
const matchesAssetSearch = (asset, normalizedSearch, queryTokens) => {
    var _a;
    if (!normalizedSearch) {
        return true;
    }
    const searchableFields = buildSearchFields(asset)
        .map((value) => (0, security_1.normalizeText)(value))
        .filter(Boolean);
    if (searchableFields.some((value) => value.includes(normalizedSearch))) {
        return true;
    }
    const storedTokens = Array.isArray((_a = asset.search) === null || _a === void 0 ? void 0 : _a.tokens)
        ? (asset.search.tokens
            .filter((token) => typeof token === 'string')
            .map((token) => (0, security_1.normalizeText)(token)))
        : [];
    const availableTokens = new Set([...storedTokens, ...(0, security_1.tokenizeSearchParts)(buildSearchFields(asset))]);
    return queryTokens.every((token) => {
        if (availableTokens.has(token)) {
            return true;
        }
        return searchableFields.some((value) => value.includes(token));
    });
};
const mapAssetDocument = (snapshot) => ({
    id: snapshot.id,
    ...snapshot.data(),
});
exports.searchActiveAssets = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    var _a, _b;
    (0, security_1.ensureRole)(context, ['admin', 'logistica']);
    const payload = data;
    const rawSearch = ((_a = payload.search) === null || _a === void 0 ? void 0 : _a.trim()) || '';
    const normalizedSearch = (0, security_1.normalizeText)(rawSearch);
    const classificationCode = (0, assetCatalogs_1.normalizeClassificationCode)(payload.classificationCode);
    const locationName = payload.locationName ? (0, assetCatalogs_1.resolveLocationName)(payload.locationName) : undefined;
    const maxResults = Math.min(Math.max((_b = payload.limit) !== null && _b !== void 0 ? _b : MAX_ASSET_SEARCH_LIMIT, 10), MAX_ASSET_SEARCH_LIMIT);
    const cursor = payload.cursor || null;
    const activosRef = security_1.db.collection('activos');
    if (!normalizedSearch) {
        let assetQuery = activosRef.where('estado', '==', 'activo');
        if (classificationCode) {
            assetQuery = assetQuery.where('search.classificationCode', '==', classificationCode);
        }
        if (locationName) {
            assetQuery = assetQuery.where('search.locationName', '==', locationName);
        }
        assetQuery = assetQuery
            .orderBy('codigo', 'asc')
            .orderBy(admin.firestore.FieldPath.documentId(), 'asc');
        if ((cursor === null || cursor === void 0 ? void 0 : cursor.codigo) && (cursor === null || cursor === void 0 ? void 0 : cursor.id)) {
            assetQuery = assetQuery.startAfter(cursor.codigo, cursor.id);
        }
        const snapshot = await assetQuery.limit(maxResults).get();
        const items = snapshot.docs.map(mapAssetDocument);
        const lastItem = items.length > 0 ? items[items.length - 1] : null;
        return {
            items,
            nextCursor: lastItem ? { codigo: String(lastItem.codigo || ''), id: String(lastItem.id || '') } : null,
            hasMore: snapshot.size === maxResults,
        };
    }
    const queryTokens = (0, security_1.tokenizeSearchParts)([rawSearch]);
    const results = new Map();
    const searches = [
        activosRef
            .where('estado', '==', 'activo')
            .orderBy('search.codigo')
            .startAt(normalizedSearch)
            .endAt(`${normalizedSearch}\uf8ff`)
            .limit(SEARCH_CANDIDATE_LIMIT)
            .get(),
        activosRef
            .where('estado', '==', 'activo')
            .orderBy('search.serial')
            .startAt(normalizedSearch)
            .endAt(`${normalizedSearch}\uf8ff`)
            .limit(SEARCH_CANDIDATE_LIMIT)
            .get(),
    ];
    if (queryTokens.length > 0) {
        searches.push(activosRef
            .where('estado', '==', 'activo')
            .where('search.tokens', 'array-contains-any', queryTokens.slice(0, 10))
            .limit(SEARCH_CANDIDATE_LIMIT)
            .get());
    }
    const snapshots = await Promise.all(searches);
    snapshots.forEach((snapshot) => {
        snapshot.docs.forEach((docSnapshot) => {
            const asset = mapAssetDocument(docSnapshot);
            if (!matchesAssetFilters(asset, classificationCode, locationName)) {
                return;
            }
            if (!matchesAssetSearch(asset, normalizedSearch, queryTokens)) {
                return;
            }
            results.set(docSnapshot.id, asset);
        });
    });
    const filteredItems = Array.from(results.values())
        .sort((left, right) => {
        const codeCompare = String(left.codigo || '').localeCompare(String(right.codigo || ''));
        if (codeCompare !== 0) {
            return codeCompare;
        }
        return String(left.id || '').localeCompare(String(right.id || ''));
    })
        .filter((asset) => {
        if (!cursor) {
            return true;
        }
        return compareAssets(asset, cursor) > 0;
    });
    const items = filteredItems.slice(0, maxResults);
    const lastItem = items.length > 0 ? items[items.length - 1] : null;
    return {
        items,
        nextCursor: lastItem ? { codigo: String(lastItem.codigo || ''), id: String(lastItem.id || '') } : null,
        hasMore: filteredItems.length > items.length,
    };
});
exports.createExpressLoan = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e, _f;
    const actor = (0, security_1.ensureRole)(context, ['admin', 'logistica']);
    const payload = data;
    if (!((_a = payload.borrower_name) === null || _a === void 0 ? void 0 : _a.trim()) || !payload.item_type || !((_b = payload.element_description) === null || _b === void 0 ? void 0 : _b.trim())) {
        throw new functions.https.HttpsError('invalid-argument', 'El prestamo no contiene los campos obligatorios.');
    }
    if (payload.item_type === 'comodin' && (!payload.evidences || payload.evidences.length === 0)) {
        throw new functions.https.HttpsError('invalid-argument', 'El item comodin requiere evidencia fotografica.');
    }
    if (payload.item_type === 'activo_registrado' && payload.asset_id) {
        const activeLoanSnapshot = await security_1.db
            .collection('express_loans')
            .where('asset_id', '==', payload.asset_id)
            .where('status', '==', 'activo')
            .limit(1)
            .get();
        if (!activeLoanSnapshot.empty) {
            throw new functions.https.HttpsError('already-exists', 'El activo ya tiene un prestamo express activo.');
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
        descripcion: `Prestamo express creado para ${payload.borrower_name.trim()}.`,
    });
    return { id: loanRef.id };
});
exports.markExpressLoanReturned = functions.region(security_1.REGION).https.onCall(async (data, context) => {
    var _a;
    const actor = (0, security_1.ensureRole)(context, ['admin', 'logistica']);
    const payload = data;
    if (!payload.loanId) {
        throw new functions.https.HttpsError('invalid-argument', 'Debe indicar el prestamo a devolver.');
    }
    const loanRef = security_1.db.collection('express_loans').doc(payload.loanId);
    const snapshot = await loanRef.get();
    if (!snapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'El prestamo indicado no existe.');
    }
    const loan = snapshot.data();
    if (loan.status !== 'activo') {
        throw new functions.https.HttpsError('failed-precondition', 'El prestamo ya no esta activo.');
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
        descripcion: 'Prestamo express marcado como devuelto.',
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
        const categoria = (0, assetCatalogs_1.resolveClassificationName)(codigo, undefined);
        const ubicacion = (0, security_1.normalizeLocation)(row[COL.UBICACION]);
        const assetData = (0, security_1.stripUndefinedDeep)({
            codigo,
            descripcion: String(row[COL.DESCRIPCION] || 'Sin descripcion').trim(),
            categoria,
            marca: row[COL.MARCA] ? String(row[COL.MARCA]).trim() : undefined,
            modelo: row[COL.MODELO] ? String(row[COL.MODELO]).trim() : undefined,
            serial: row[COL.SERIAL] ? String(row[COL.SERIAL]).trim() : undefined,
            ubicacion,
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
                categoria,
                serial: row[COL.SERIAL],
                marca: row[COL.MARCA],
                modelo: row[COL.MODELO],
                ubicacion,
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
        descripcion: `Importacion de activos ejecutada con ${imported} registros creados.`,
        metadata: { imported, skipped },
    });
    return { imported, skipped };
});
//# sourceMappingURL=assetCallables.js.map