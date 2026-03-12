"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Download, Plus } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExpressLoan } from "@/types/expressLoan";
import {
  getExpressLoans,
  markExpressLoanReturned,
} from "@/services/expressLoanService";
import { generateExpressLoanPDF } from "@/lib/pdfGenerator";

const formatDate = (value?: string) => {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return format(date, "dd MMM yyyy HH:mm", { locale: es });
};

const getStatusVariant = (status: ExpressLoan["status"]) => {
  if (status === "devuelto") {
    return "success" as const;
  }
  if (status === "vencido") {
    return "destructive" as const;
  }
  return "info" as const;
};

const getItemTypeLabel = (loan: ExpressLoan) =>
  loan.item_type === "activo_registrado" ? "Activo registrado" : "Comodín";

export default function ExpressLoansPage() {
  const [loans, setLoans] = useState<ExpressLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    void fetchLoans();
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

  const handleMarkReturned = async (loan: ExpressLoan) => {
    const confirmed = window.confirm(
      `¿Desea marcar como devuelto el préstamo de ${loan.element_description}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingId(loan.id);
      await markExpressLoanReturned(loan.id);
      await fetchLoans();
    } catch (error) {
      console.error("Error marking loan as returned:", error);
      alert("No fue posible registrar la devolución del préstamo.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Préstamo Express
          </h1>
          <p className="mt-1 text-slate-500">
            Control operativo de préstamos rápidos con activos registrados o ítems comodín.
          </p>
        </div>
        <Button asChild leftIcon={<Plus className="h-5 w-5" />}>
          <Link href="/express-loans/new">Nuevo préstamo</Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/60 shadow-sm backdrop-blur-xl">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/90">
              <tr>
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">
                  Fecha
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                  Ítem
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                  Recibe
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                  Entrega
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                  Evidencias
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                  Estado
                </th>
                <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white/40">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Cargando préstamos...
                  </td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No hay registros de préstamos express.
                  </td>
                </tr>
              ) : (
                loans.map((loan) => (
                  <tr key={loan.id} className="transition-colors hover:bg-slate-50/60">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">
                      <div>{formatDate(loan.loan_date)}</div>
                      {loan.return_date && (
                        <div className="mt-1 text-xs text-slate-500">
                          Devuelto: {formatDate(loan.return_date)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm text-slate-600">
                      <div className="space-y-2">
                        <div className="font-medium text-slate-900">
                          {loan.element_description}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{getItemTypeLabel(loan)}</Badge>
                          {loan.asset_code && <Badge variant="info">{loan.asset_code}</Badge>}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <div className="font-medium text-slate-900">{loan.borrower_name}</div>
                      {loan.borrower_document && (
                        <div className="text-xs text-slate-500">{loan.borrower_document}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600">
                      {loan.lender_name || "Desconocido"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600">
                      <Badge variant={loan.evidences.length > 0 ? "secondary" : "outline"}>
                        {loan.evidences.length} foto{loan.evidences.length === 1 ? "" : "s"}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <Badge variant={getStatusVariant(loan.status)}>
                        {loan.status}
                      </Badge>
                    </td>
                    <td className="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div className="flex justify-end gap-2">
                        {loan.status === "activo" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            loading={processingId === loan.id}
                            leftIcon={<ArrowLeftRight className="h-3.5 w-3.5" />}
                            onClick={() => void handleMarkReturned(loan)}
                          >
                            Marcar devuelto
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          leftIcon={<Download className="h-3.5 w-3.5" />}
                          onClick={() => handleDownloadPdf(loan)}
                        >
                          PDF
                        </Button>
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
