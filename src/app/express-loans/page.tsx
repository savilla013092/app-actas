"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Download } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { ExpressLoan } from "@/types/expressLoan";
import { getExpressLoans } from "@/services/expressLoanService";
import { generateExpressLoanPDF } from "@/lib/pdfGenerator";

export default function ExpressLoansPage() {
  const [loans, setLoans] = useState<ExpressLoan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const data = await getExpressLoans();
      setLoans(data);
    } catch (error) {
      console.error("Error fetching loans:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = (loan: ExpressLoan) => {
    generateExpressLoanPDF(loan);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Préstamo Express
          </h1>
          <p className="text-slate-500 mt-1">
            Registro rápido de entrega funcional de elementos.
          </p>
        </div>
        <Link
          href="/express-loans/new"
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 hover:shadow-md transition-all sm:w-auto w-full justify-center"
        >
          <Plus className="h-5 w-5" />
          Nuevo Préstamo
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/50 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">Fecha</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Elemento</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Recibe</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Entrega</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Estado</th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white/40">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Cargando préstamos...
                  </td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No hay registros de préstamos express.
                  </td>
                </tr>
              ) : (
                loans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">
                      {format(new Date(loan.loan_date), "dd MMM yyyy HH:mm", { locale: es })}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                      {loan.element_description}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <div className="font-medium text-slate-900">{loan.borrower_name}</div>
                      {loan.borrower_document && <div className="text-slate-500 text-xs">{loan.borrower_document}</div>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                      {loan.lender_name || "Desconocido"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                          loan.status === "activo"
                            ? "bg-blue-50 text-blue-700 ring-blue-600/20"
                            : loan.status === "devuelto"
                            ? "bg-green-50 text-green-700 ring-green-600/20"
                            : "bg-red-50 text-red-700 ring-red-600/10"
                        }`}
                      >
                        {loan.status}
                      </span>
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleDownloadPdf(loan)}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                        >
                          <Download className="h-3 w-3" />
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}