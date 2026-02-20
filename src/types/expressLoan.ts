export type ExpressLoanStatus = 'activo' | 'devuelto' | 'vencido';

export interface ExpressLoan {
  id: string;
  borrower_name: string;
  borrower_document?: string;
  element_description: string;
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
  element_description: string;
  notes?: string;
  loan_date?: string;
  return_date?: string;
  status?: ExpressLoanStatus;
  lender_id?: string;
  lender_name?: string;
}

export interface UpdateExpressLoanDTO {
  borrower_name?: string;
  borrower_document?: string;
  element_description?: string;
  notes?: string;
  return_date?: string;
  status?: ExpressLoanStatus;
}

