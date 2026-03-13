import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as XLSX from 'xlsx';

import { normalizeClassificationCode, resolveClassificationName, resolveLocationName } from './assetCatalogs';
import {
  ExpressLoanAssetSnapshot,
  REGION,
  UploadedFilePayload,
  buildAssetSearchPayload,
  db,
  ensureRole,
  ensureStoragePath,
  mapUploadedEvidence,
  normalizeLocation,
  normalizeText,
  parseExcelDate,
  serverTimestamp,
  stripUndefinedDeep,
  toIsoDateString,
  tokenizeSearchParts,
  writeAuditLog,
  storage,
} from './security';

interface CreateExpressLoanPayload {
  loanId?: string;
  borrower_name: string;
  borrower_document?: string;
  item_type: 'activo_registrado' | 'comodin';
  asset_id?: string;
  asset_code?: string;
  asset_snapshot?: ExpressLoanAssetSnapshot;
  element_description: string;
  notes?: string;
  loan_date?: string;
  lender_name?: string;
  evidences?: UploadedFilePayload[];
}

interface SearchActiveAssetsCursor {
  codigo: string;
  id: string;
}

interface SearchActiveAssetsPayload {
  search?: string;
  classificationCode?: string;
  locationName?: string;
  limit?: number;
  cursor?: SearchActiveAssetsCursor | null;
}

const MAX_ASSET_SEARCH_LIMIT = 50;
const SEARCH_CANDIDATE_LIMIT = 350;

const compareAssets = (left: Record<string, unknown>, right: SearchActiveAssetsCursor) => {
  const codeCompare = String(left.codigo || '').localeCompare(String(right.codigo || ''));
  if (codeCompare !== 0) {
    return codeCompare;
  }

  return String(left.id || '').localeCompare(String(right.id || ''));
};

const buildSearchFields = (asset: Record<string, unknown>) => {
  const classificationName =
    typeof asset.search === 'object' && asset.search !== null && typeof (asset.search as { classificationName?: unknown }).classificationName === 'string'
      ? String((asset.search as { classificationName: string }).classificationName)
      : resolveClassificationName(
          typeof asset.codigo === 'string' ? asset.codigo : undefined,
          typeof asset.categoria === 'string' ? asset.categoria : undefined
        );

  const locationName =
    typeof asset.search === 'object' && asset.search !== null && typeof (asset.search as { locationName?: unknown }).locationName === 'string'
      ? String((asset.search as { locationName: string }).locationName)
      : resolveLocationName(
          typeof asset.ubicacion === 'string' || typeof asset.ubicacion === 'number'
            ? asset.ubicacion
            : undefined
        );

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

const matchesAssetFilters = (
  asset: Record<string, unknown>,
  classificationCode?: string,
  locationName?: string
) => {
  const resolvedClassificationCode =
    typeof asset.search === 'object' && asset.search !== null && typeof (asset.search as { classificationCode?: unknown }).classificationCode === 'string'
      ? String((asset.search as { classificationCode: string }).classificationCode)
      : normalizeClassificationCode(typeof asset.codigo === 'string' ? asset.codigo : undefined);

  const resolvedLocationName =
    typeof asset.search === 'object' && asset.search !== null && typeof (asset.search as { locationName?: unknown }).locationName === 'string'
      ? String((asset.search as { locationName: string }).locationName)
      : resolveLocationName(
          typeof asset.ubicacion === 'string' || typeof asset.ubicacion === 'number'
            ? asset.ubicacion
            : undefined
        );

  if (classificationCode && resolvedClassificationCode !== classificationCode) {
    return false;
  }

  if (locationName && resolvedLocationName !== locationName) {
    return false;
  }

  return asset.estado === 'activo';
};

const matchesAssetSearch = (
  asset: Record<string, unknown>,
  normalizedSearch: string,
  queryTokens: string[]
) => {
  if (!normalizedSearch) {
    return true;
  }

  const searchableFields = buildSearchFields(asset)
    .map((value) => normalizeText(value))
    .filter(Boolean);

  if (searchableFields.some((value) => value.includes(normalizedSearch))) {
    return true;
  }

  const storedTokens = Array.isArray((asset.search as { tokens?: unknown[] } | undefined)?.tokens)
    ? ((asset.search as { tokens: unknown[] }).tokens
        .filter((token): token is string => typeof token === 'string')
        .map((token) => normalizeText(token)))
    : [];
  const availableTokens = new Set<string>([...storedTokens, ...tokenizeSearchParts(buildSearchFields(asset))]);

  return queryTokens.every((token) => {
    if (availableTokens.has(token)) {
      return true;
    }

    return searchableFields.some((value) => value.includes(token));
  });
};

type AssetDocument = Record<string, unknown> & { id: string; codigo?: string };

const mapAssetDocument = (snapshot: FirebaseFirestore.QueryDocumentSnapshot): AssetDocument => ({
  id: snapshot.id,
  ...snapshot.data(),
});

export const searchActiveAssets = functions.region(REGION).https.onCall(async (data, context) => {
  ensureRole(context, ['admin', 'logistica']);

  const payload = data as SearchActiveAssetsPayload;
  const rawSearch = payload.search?.trim() || '';
  const normalizedSearch = normalizeText(rawSearch);
  const classificationCode = normalizeClassificationCode(payload.classificationCode);
  const locationName = payload.locationName ? resolveLocationName(payload.locationName) : undefined;
  const maxResults = Math.min(Math.max(payload.limit ?? MAX_ASSET_SEARCH_LIMIT, 10), MAX_ASSET_SEARCH_LIMIT);
  const cursor = payload.cursor || null;

  const activosRef = db.collection('activos');

  if (!normalizedSearch) {
    let assetQuery: FirebaseFirestore.Query = activosRef.where('estado', '==', 'activo');

    if (classificationCode) {
      assetQuery = assetQuery.where('search.classificationCode', '==', classificationCode);
    }

    if (locationName) {
      assetQuery = assetQuery.where('search.locationName', '==', locationName);
    }

    assetQuery = assetQuery
      .orderBy('codigo', 'asc')
      .orderBy(admin.firestore.FieldPath.documentId(), 'asc');

    if (cursor?.codigo && cursor?.id) {
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

  const queryTokens = tokenizeSearchParts([rawSearch]);
  const results = new Map<string, Record<string, unknown>>();
  const searches: Promise<FirebaseFirestore.QuerySnapshot>[] = [
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
    searches.push(
      activosRef
        .where('estado', '==', 'activo')
        .where('search.tokens', 'array-contains-any', queryTokens.slice(0, 10))
        .limit(SEARCH_CANDIDATE_LIMIT)
        .get()
    );
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

export const createExpressLoan = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['admin', 'logistica']);
  const payload = data as CreateExpressLoanPayload;

  if (!payload.borrower_name?.trim() || !payload.item_type || !payload.element_description?.trim()) {
    throw new functions.https.HttpsError('invalid-argument', 'El prestamo no contiene los campos obligatorios.');
  }

  if (payload.item_type === 'comodin' && (!payload.evidences || payload.evidences.length === 0)) {
    throw new functions.https.HttpsError('invalid-argument', 'El item comodin requiere evidencia fotografica.');
  }

  if (payload.item_type === 'activo_registrado' && payload.asset_id) {
    const activeLoanSnapshot = await db
      .collection('express_loans')
      .where('asset_id', '==', payload.asset_id)
      .where('status', '==', 'activo')
      .limit(1)
      .get();

    if (!activeLoanSnapshot.empty) {
      throw new functions.https.HttpsError('already-exists', 'El activo ya tiene un prestamo express activo.');
    }
  }

  (payload.evidences || []).forEach((file) => ensureStoragePath(file.storagePath, 'express_loans/'));

  const loanRef = payload.loanId ? db.collection('express_loans').doc(payload.loanId) : db.collection('express_loans').doc();
  const now = toIsoDateString(payload.loan_date);
  const loanDoc = stripUndefinedDeep({
    borrower_name: payload.borrower_name.trim(),
    borrower_document: payload.borrower_document?.trim(),
    item_type: payload.item_type,
    asset_id: payload.asset_id,
    asset_code: payload.asset_code,
    asset_snapshot: payload.asset_snapshot,
    element_description: payload.element_description.trim(),
    evidences: mapUploadedEvidence(payload.evidences || []),
    notes: payload.notes?.trim(),
    loan_date: now,
    status: 'activo',
    lender_id: actor.uid,
    lender_name: payload.lender_name?.trim(),
    created_at: now,
    updated_at: now,
    created_by: actor.uid,
    updated_by: actor.uid,
  });

  await loanRef.set(loanDoc);

  await writeAuditLog({
    accion: 'crear_prestamo_express',
    modulo: 'express_loans',
    documentoId: loanRef.id,
    usuarioId: actor.uid,
    usuarioEmail: context.auth?.token.email as string | undefined,
    descripcion: `Prestamo express creado para ${payload.borrower_name.trim()}.`,
  });

  return { id: loanRef.id };
});

export const markExpressLoanReturned = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['admin', 'logistica']);
  const payload = data as { loanId?: string };

  if (!payload.loanId) {
    throw new functions.https.HttpsError('invalid-argument', 'Debe indicar el prestamo a devolver.');
  }

  const loanRef = db.collection('express_loans').doc(payload.loanId);
  const snapshot = await loanRef.get();
  if (!snapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'El prestamo indicado no existe.');
  }

  const loan = snapshot.data() as { status?: string };
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

  await writeAuditLog({
    accion: 'devolver_prestamo_express',
    modulo: 'express_loans',
    documentoId: payload.loanId,
    usuarioId: actor.uid,
    usuarioEmail: context.auth?.token.email as string | undefined,
    descripcion: 'Prestamo express marcado como devuelto.',
  });

  return { ok: true };
});

export const startAssetImport = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['admin']);
  const payload = data as { storagePath?: string };

  if (!payload.storagePath) {
    throw new functions.https.HttpsError('invalid-argument', 'Debe suministrar la ruta del archivo a importar.');
  }

  ensureStoragePath(payload.storagePath, `imports/asset-imports/${actor.uid}/`);

  const bucket = storage.bucket();
  const file = bucket.file(payload.storagePath);
  const [buffer] = await file.download();
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

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
  let batch = db.batch();
  let batchSize = 0;

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] as Array<string | number | boolean | null | undefined>;
    if (!row || !row[COL.CODIGO]) {
      skipped += 1;
      continue;
    }

    const codigo = `AF-${String(row[COL.CODIGO]).trim()}`;
    const categoria = resolveClassificationName(codigo, undefined);
    const ubicacion = normalizeLocation(row[COL.UBICACION]);
    const assetData = stripUndefinedDeep({
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
      fechaAdquisicion: parseExcelDate(row[COL.FECHA_ADQ]),
      observaciones: row[COL.DESC_TECNICA] ? String(row[COL.DESC_TECNICA]).trim() : undefined,
      search: buildAssetSearchPayload({
        codigo,
        descripcion: row[COL.DESCRIPCION],
        categoria,
        serial: row[COL.SERIAL],
        marca: row[COL.MARCA],
        modelo: row[COL.MODELO],
        ubicacion,
      }),
      creadoEn: serverTimestamp(),
      actualizadoEn: serverTimestamp(),
      creadoPor: actor.uid,
      actualizadoPor: actor.uid,
    });

    const docRef = db.collection('activos').doc();
    batch.set(docRef, assetData);
    batchSize += 1;
    imported += 1;

    if (batchSize >= 350) {
      await batch.commit();
      batch = db.batch();
      batchSize = 0;
    }
  }

  if (batchSize > 0) {
    await batch.commit();
  }

  await file.delete().catch((): undefined => undefined);

  await writeAuditLog({
    accion: 'importar_activos',
    modulo: 'activos',
    usuarioId: actor.uid,
    usuarioEmail: context.auth?.token.email as string | undefined,
    descripcion: `Importacion de activos ejecutada con ${imported} registros creados.`,
    metadata: { imported, skipped },
  });

  return { imported, skipped };
});
