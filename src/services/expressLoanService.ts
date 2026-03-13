import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore';

import { db } from '@/lib/firebase/config';
import { callCallable } from '@/services/callableService';
import { cleanupUploadedFiles, uploadFilesToStorage } from '@/services/evidenceUploadService';
import {
  CreateExpressLoanDTO,
  ExpressLoan,
  ExpressLoanEvidence,
  ExpressLoanItemType,
} from '@/types/expressLoan';

const COLLECTION_NAME = 'express_loans';
const STORAGE_PATH = 'express_loans';

const toIsoString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return fallback;
};

const inferItemType = (data: Record<string, unknown>): ExpressLoanItemType =>
  data.item_type === 'activo_registrado' || typeof data.asset_id === 'string'
    ? 'activo_registrado'
    : 'comodin';

const mapExpressLoan = (id: string, data: Record<string, unknown>): ExpressLoan => {
  const createdAt = toIsoString(data.created_at);
  const updatedAt = toIsoString(data.updated_at, createdAt);

  return {
    id,
    borrower_name: String(data.borrower_name || ''),
    borrower_document:
      typeof data.borrower_document === 'string' ? data.borrower_document : undefined,
    item_type: inferItemType(data),
    asset_id: typeof data.asset_id === 'string' ? data.asset_id : undefined,
    asset_code:
      typeof data.asset_code === 'string'
        ? data.asset_code
        : typeof data.asset_snapshot === 'object' &&
          data.asset_snapshot !== null &&
          typeof (data.asset_snapshot as { codigo?: unknown }).codigo === 'string'
        ? (data.asset_snapshot as { codigo: string }).codigo
        : undefined,
    asset_snapshot:
      typeof data.asset_snapshot === 'object' && data.asset_snapshot !== null
        ? (data.asset_snapshot as ExpressLoan['asset_snapshot'])
        : undefined,
    element_description:
      typeof data.element_description === 'string'
        ? data.element_description
        : 'Elemento sin descripcion',
    evidences: Array.isArray(data.evidences)
      ? (data.evidences as ExpressLoanEvidence[])
      : [],
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    loan_date: toIsoString(data.loan_date),
    return_date: toIsoString(data.return_date) || undefined,
    status:
      data.status === 'devuelto' || data.status === 'vencido'
        ? data.status
        : 'activo',
    lender_id: typeof data.lender_id === 'string' ? data.lender_id : '',
    lender_name: typeof data.lender_name === 'string' ? data.lender_name : undefined,
    created_at: createdAt,
    updated_at: updatedAt,
  };
};

export const getActiveExpressLoanByAsset = async (assetId: string): Promise<ExpressLoan | null> => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('asset_id', '==', assetId),
    where('status', '==', 'activo')
  );
  const snapshot = await getDocs(q);

  const activeLoan = snapshot.docs
    .map((loanDoc) => mapExpressLoan(loanDoc.id, loanDoc.data() as Record<string, unknown>))
    .find((loan) => loan.status === 'activo');

  return activeLoan || null;
};

export const createExpressLoan = async (
  data: CreateExpressLoanDTO,
  evidenceFiles: File[] = []
): Promise<string> => {
  if (data.item_type === 'comodin' && evidenceFiles.length === 0) {
    throw new Error('EVIDENCE_REQUIRED');
  }

  if (data.item_type === 'activo_registrado' && data.asset_id) {
    const activeLoan = await getActiveExpressLoanByAsset(data.asset_id);
    if (activeLoan) {
      throw new Error('ACTIVE_LOAN_EXISTS');
    }
  }

  const loanId = doc(collection(db, COLLECTION_NAME)).id;
  let uploadedFiles: Array<ExpressLoanEvidence & { storagePath: string }> = [];

  try {
    uploadedFiles = (await uploadFilesToStorage({
      documentId: loanId,
      storagePrefix: STORAGE_PATH,
      files: evidenceFiles,
      buildNombre: (_index, file) => file.name,
    })).map((file) => ({
      id: file.id,
      url: file.url,
      nombre: file.nombre,
      subidaEn: new Date().toISOString(),
      storagePath: file.storagePath,
    }));

    const response = await callCallable<
      CreateExpressLoanDTO & {
        loanId: string;
        evidences: Array<{ id: string; storagePath: string; url: string; nombre: string }>;
      },
      { id: string }
    >('createExpressLoan', {
      ...data,
      loanId,
      evidences: uploadedFiles.map((file) => ({
        id: file.id,
        storagePath: file.storagePath,
        url: file.url,
        nombre: file.nombre,
      })),
    });

    return response.id;
  } catch (error) {
    await cleanupUploadedFiles(uploadedFiles.map((file) => file.storagePath));
    throw error;
  }
};

export const getExpressLoans = async (): Promise<ExpressLoan[]> => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('loan_date', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((loanDoc) => mapExpressLoan(loanDoc.id, loanDoc.data() as Record<string, unknown>));
};

export const getExpressLoan = async (id: string): Promise<ExpressLoan | null> => {
  const docRef = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  return mapExpressLoan(snapshot.id, snapshot.data() as Record<string, unknown>);
};

export const markExpressLoanReturned = async (id: string): Promise<void> => {
  await callCallable<{ loanId: string }, { ok: boolean }>('markExpressLoanReturned', {
    loanId: id,
  });
};
