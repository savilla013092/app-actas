import * as functions from 'firebase-functions';
import * as XLSX from 'xlsx';

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

export const searchActiveAssets = functions.region(REGION).https.onCall(async (data, context) => {
  ensureRole(context, ['admin', 'logistica']);
  const payload = data as { search?: string; limit?: number };
  const rawSearch = payload.search?.trim() || '';
  const normalizedSearch = normalizeText(rawSearch);
  const maxResults = Math.min(Math.max(payload.limit ?? 25, 5), 50);
  const results = new Map<string, Record<string, unknown>>();

  const baseCollection = db.collection('activos');

  const collectSnapshot = (snapshot: FirebaseFirestore.QuerySnapshot) => {
    snapshot.docs.forEach((docSnapshot) => {
      const data = docSnapshot.data() as Record<string, unknown>;
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
  } else {
    const queries: Promise<FirebaseFirestore.QuerySnapshot>[] = [
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

    const tokens = tokenizeSearchParts([rawSearch]);
    if (tokens.length > 0) {
      queries.push(
        baseCollection
          .where('search.tokens', 'array-contains-any', tokens.slice(0, 10))
          .limit(maxResults)
          .get()
      );
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

export const createExpressLoan = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['admin', 'logistica']);
  const payload = data as CreateExpressLoanPayload;

  if (!payload.borrower_name?.trim() || !payload.item_type || !payload.element_description?.trim()) {
    throw new functions.https.HttpsError('invalid-argument', 'El préstamo no contiene los campos obligatorios.');
  }

  if (payload.item_type === 'comodin' && (!payload.evidences || payload.evidences.length === 0)) {
    throw new functions.https.HttpsError('invalid-argument', 'El item comodín requiere evidencia fotográfica.');
  }

  if (payload.item_type === 'activo_registrado' && payload.asset_id) {
    const activeLoanSnapshot = await db
      .collection('express_loans')
      .where('asset_id', '==', payload.asset_id)
      .where('status', '==', 'activo')
      .limit(1)
      .get();

    if (!activeLoanSnapshot.empty) {
      throw new functions.https.HttpsError('already-exists', 'El activo ya tiene un préstamo express activo.');
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
    descripcion: `Préstamo express creado para ${payload.borrower_name.trim()}.`,
  });

  return { id: loanRef.id };
});

export const markExpressLoanReturned = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = ensureRole(context, ['admin', 'logistica']);
  const payload = data as { loanId?: string };

  if (!payload.loanId) {
    throw new functions.https.HttpsError('invalid-argument', 'Debe indicar el préstamo a devolver.');
  }

  const loanRef = db.collection('express_loans').doc(payload.loanId);
  const snapshot = await loanRef.get();
  if (!snapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'El préstamo indicado no existe.');
  }

  const loan = snapshot.data() as { status?: string };
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

  await writeAuditLog({
    accion: 'devolver_prestamo_express',
    modulo: 'express_loans',
    documentoId: payload.loanId,
    usuarioId: actor.uid,
    usuarioEmail: context.auth?.token.email as string | undefined,
    descripcion: 'Préstamo express marcado como devuelto.',
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
    const assetData = stripUndefinedDeep({
      codigo,
      descripcion: String(row[COL.DESCRIPCION] || 'Sin descripcion').trim(),
      categoria: 'Sin clasificacion',
      marca: row[COL.MARCA] ? String(row[COL.MARCA]).trim() : undefined,
      modelo: row[COL.MODELO] ? String(row[COL.MODELO]).trim() : undefined,
      serial: row[COL.SERIAL] ? String(row[COL.SERIAL]).trim() : undefined,
      ubicacion: normalizeLocation(row[COL.UBICACION]),
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
        serial: row[COL.SERIAL],
        marca: row[COL.MARCA],
        modelo: row[COL.MODELO],
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
    descripcion: `Importación de activos ejecutada con ${imported} registros creados.`,
    metadata: { imported, skipped },
  });

  return { imported, skipped };
});


