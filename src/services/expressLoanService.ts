import { collection, addDoc, getDocs, getDoc, updateDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { CreateExpressLoanDTO, ExpressLoan, UpdateExpressLoanDTO, ExpressLoanStatus } from "@/types/expressLoan";

const COLLECTION_NAME = "express_loans";

export const createExpressLoan = async (data: CreateExpressLoanDTO): Promise<string> => {
  const now = new Date().toISOString();
  
  const payload = {
    ...data,
    status: data.status || "activo",
    loan_date: data.loan_date || now,
    created_at: now,
    updated_at: now,
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
  return docRef.id;
};

export const getExpressLoans = async (): Promise<ExpressLoan[]> => {
  const q = query(collection(db, COLLECTION_NAME), orderBy("loan_date", "desc"));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as ExpressLoan[];
};

export const getExpressLoan = async (id: string): Promise<ExpressLoan | null> => {
  const docRef = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  
  return {
    id: snapshot.id,
    ...snapshot.data()
  } as ExpressLoan;
};

export const updateExpressLoan = async (id: string, data: UpdateExpressLoanDTO): Promise<void> => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    ...data,
    updated_at: new Date().toISOString()
  });
};
