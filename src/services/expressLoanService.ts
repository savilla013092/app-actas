import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import imageCompression from "browser-image-compression";

import { db, storage } from "@/lib/firebase/config";
import {
  CreateExpressLoanDTO,
  ExpressLoan,
  ExpressLoanEvidence,
  ExpressLoanItemType,
  UpdateExpressLoanDTO,
} from "@/types/expressLoan";

const COLLECTION_NAME = "express_loans";
const STORAGE_PATH = "express_loans";
const IMAGE_UPLOAD_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
};

const toIsoString = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return fallback;
};

const stripUndefinedDeep = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T;
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefinedDeep(entryValue)])
    ) as T;
  }

  return value;
};

const inferItemType = (data: Record<string, unknown>): ExpressLoanItemType =>
  data.item_type === "activo_registrado" || typeof data.asset_id === "string"
    ? "activo_registrado"
    : "comodin";

const mapExpressLoan = (id: string, data: Record<string, unknown>): ExpressLoan => {
  const createdAt = toIsoString(data.created_at);
  const updatedAt = toIsoString(data.updated_at, createdAt);

  return {
    id,
    borrower_name: String(data.borrower_name || ""),
    borrower_document:
      typeof data.borrower_document === "string"
        ? data.borrower_document
        : undefined,
    item_type: inferItemType(data),
    asset_id: typeof data.asset_id === "string" ? data.asset_id : undefined,
    asset_code:
      typeof data.asset_code === "string"
        ? data.asset_code
        : typeof data.asset_snapshot === "object" &&
          data.asset_snapshot !== null &&
          typeof (data.asset_snapshot as { codigo?: unknown }).codigo === "string"
        ? (data.asset_snapshot as { codigo: string }).codigo
        : undefined,
    asset_snapshot:
      typeof data.asset_snapshot === "object" && data.asset_snapshot !== null
        ? (data.asset_snapshot as ExpressLoan["asset_snapshot"])
        : undefined,
    element_description:
      typeof data.element_description === "string"
        ? data.element_description
        : "Elemento sin descripcion",
    evidences: Array.isArray(data.evidences)
      ? (data.evidences as ExpressLoanEvidence[])
      : [],
    notes: typeof data.notes === "string" ? data.notes : undefined,
    loan_date: toIsoString(data.loan_date),
    return_date: toIsoString(data.return_date) || undefined,
    status:
      data.status === "devuelto" || data.status === "vencido"
        ? data.status
        : "activo",
    lender_id: typeof data.lender_id === "string" ? data.lender_id : "",
    lender_name: typeof data.lender_name === "string" ? data.lender_name : undefined,
    created_at: createdAt,
    updated_at: updatedAt,
  };
};

const uploadEvidenceFile = async (
  loanId: string,
  file: File,
  index: number
): Promise<{ evidence: ExpressLoanEvidence; storagePath: string }> => {
  const compressedFile = await imageCompression(file, IMAGE_UPLOAD_OPTIONS);
  const fileName = `${Date.now()}_${index}_${file.name}`;
  const storagePath = `${STORAGE_PATH}/${loanId}/${fileName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, compressedFile);
  const url = await getDownloadURL(storageRef);

  return {
    storagePath,
    evidence: {
      id: fileName,
      url,
      nombre: file.name,
      subidaEn: new Date().toISOString(),
    },
  };
};

export const getActiveExpressLoanByAsset = async (
  assetId: string
): Promise<ExpressLoan | null> => {
  const q = query(collection(db, COLLECTION_NAME), where("asset_id", "==", assetId));
  const snapshot = await getDocs(q);

  const activeLoan = snapshot.docs
    .map((loanDoc) =>
      mapExpressLoan(loanDoc.id, loanDoc.data() as Record<string, unknown>)
    )
    .find((loan) => loan.status === "activo");

  return activeLoan || null;
};

export const createExpressLoan = async (
  data: CreateExpressLoanDTO,
  evidenceFiles: File[] = []
): Promise<string> => {
  if (data.item_type === "comodin" && evidenceFiles.length === 0) {
    throw new Error("EVIDENCE_REQUIRED");
  }

  if (data.item_type === "activo_registrado" && data.asset_id) {
    const activeLoan = await getActiveExpressLoanByAsset(data.asset_id);
    if (activeLoan) {
      throw new Error("ACTIVE_LOAN_EXISTS");
    }
  }

  const now = new Date().toISOString();
  const loanRef = doc(collection(db, COLLECTION_NAME));
  const uploadedPaths: string[] = [];
  const evidences: ExpressLoanEvidence[] = [];

  try {
    for (let index = 0; index < evidenceFiles.length; index += 1) {
      const file = evidenceFiles[index];
      const result = await uploadEvidenceFile(loanRef.id, file, index + 1);
      uploadedPaths.push(result.storagePath);
      evidences.push(result.evidence);
    }

    const payload = stripUndefinedDeep({
      ...data,
      status: "activo" as const,
      loan_date: data.loan_date || now,
      evidences,
      created_at: now,
      updated_at: now,
    });

    await setDoc(loanRef, payload);
    return loanRef.id;
  } catch (error) {
    await Promise.allSettled(
      uploadedPaths.map((path) => deleteObject(ref(storage, path)))
    );
    throw error;
  }
};

export const getExpressLoans = async (): Promise<ExpressLoan[]> => {
  const q = query(collection(db, COLLECTION_NAME), orderBy("loan_date", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((loanDoc) =>
    mapExpressLoan(loanDoc.id, loanDoc.data() as Record<string, unknown>)
  );
};

export const getExpressLoan = async (id: string): Promise<ExpressLoan | null> => {
  const docRef = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  return mapExpressLoan(snapshot.id, snapshot.data() as Record<string, unknown>);
};

export const updateExpressLoan = async (
  id: string,
  data: UpdateExpressLoanDTO
): Promise<void> => {
  const docRef = doc(db, COLLECTION_NAME, id);
  const payload = stripUndefinedDeep({
    ...data,
    updated_at: new Date().toISOString(),
  });

  await updateDoc(docRef, payload);
};

export const markExpressLoanReturned = async (id: string): Promise<void> => {
  await updateExpressLoan(id, {
    status: "devuelto",
    return_date: new Date().toISOString(),
  });
};