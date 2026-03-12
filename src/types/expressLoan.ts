export type ExpressLoanStatus = "activo" | "devuelto" | "vencido";
export type ExpressLoanItemType = "activo_registrado" | "comodin";

export interface ExpressLoanEvidence {
  id: string;
  url: string;
  nombre: string;
  subidaEn: string;
}

export interface ExpressLoanAssetSnapshot {
  codigo: string;
  descripcion: string;
  categoria: string;
  marca?: string;
  modelo?: string;
  serial?: string;
  ubicacion: string;
  dependencia: string;
  custodioNombre: string;
}

export interface ExpressLoan {
  id: string;
  borrower_name: string;
  borrower_document?: string;
  item_type?: ExpressLoanItemType;
  asset_id?: string;
  asset_code?: string;
  asset_snapshot?: ExpressLoanAssetSnapshot;
  element_description: string;
  evidences: ExpressLoanEvidence[];
  notes?: string;
  loan_date: string;
  return_date?: string;
  status: ExpressLoanStatus;
  lender_id: string;
  lender_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateExpressLoanDTO {
  borrower_name: string;
  borrower_document?: string;
  item_type: ExpressLoanItemType;
  asset_id?: string;
  asset_code?: string;
  asset_snapshot?: ExpressLoanAssetSnapshot;
  element_description: string;
  notes?: string;
  loan_date?: string;
  lender_id?: string;
  lender_name?: string;
}

export interface UpdateExpressLoanDTO {
  borrower_name?: string;
  borrower_document?: string;
  asset_code?: string;
  element_description?: string;
  notes?: string;
  return_date?: string;
  status?: ExpressLoanStatus;
}
