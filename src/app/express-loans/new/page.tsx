"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { format } from "date-fns";

import { createExpressLoan } from "@/services/expressLoanService";
import { CreateExpressLoanDTO } from "@/types/expressLoan";
import { useAuth } from "@/hooks/useAuth";

export default function NewExpressLoanPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<CreateExpressLoanDTO>({
    defaultValues: {
      status: "activo",
      loan_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    }
  });

  const onSubmit = async (data: CreateExpressLoanDTO) => {
    try {
      setLoading(true);

      const payload = {
        ...data,
        lender_id: user?.uid || "anon",
        lender_name: user?.usuario?.nombre || "Desconocido",
      };

      if (payload.loan_date) {
        payload.loan_date = new Date(payload.loan_date).toISOString();
      }
      if (payload.return_date) {
        payload.return_date = new Date(payload.return_date).toISOString();
      } else {
        delete payload.return_date;
      }

      await createExpressLoan(payload);
      router.push("/express-loans");
      
    } catch (error) {
      console.error("Error creating loan:", error);
      alert("Hubo un error al guardar el préstamo");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "block w-full rounded-xl border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm bg-white p-2.5 transition-colors border";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Nuevo Préstamo Express
        </h1>
        <p className="text-sm text-slate-500 mt-1">Registra rápidamente un elemento prestado.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/50 backdrop-blur-xl shadow-sm p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
            
            <div className="sm:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de quien recibe *</label>
              <input
                type="text"
                {...register("borrower_name", { required: "Requerido" })}
                className={`${inputClass} ${errors.borrower_name ? "border-red-300" : ""}`}
                placeholder="Ej. Juan Pérez"
              />
              {errors.borrower_name && <p className="mt-1 text-sm text-red-600">{errors.borrower_name.message}</p>}
            </div>

            <div className="sm:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Documento de identidad (Opcional)</label>
              <input
                type="text"
                {...register("borrower_document")}
                className={inputClass}
                placeholder="CC o NIT"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Descripción del Elemento *</label>
              <input
                type="text"
                {...register("element_description", { required: "Requerido" })}
                className={`${inputClass} ${errors.element_description ? "border-red-300" : ""}`}
                placeholder="Ej. Taladro Percutor DeWalt"
              />
              {errors.element_description && <p className="mt-1 text-sm text-red-600">{errors.element_description.message}</p>}
            </div>

            <div className="sm:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Entrega</label>
              <input
                type="datetime-local"
                {...register("loan_date")}
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
              <select {...register("status")} className={inputClass}>
                <option value="activo">Activo</option>
                <option value="devuelto">Devuelto</option>
                <option value="vencido">Vencido</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Notas u Observaciones (Opcional)</label>
              <textarea
                rows={3}
                {...register("notes")}
                className={inputClass}
                placeholder="Condiciones del equipo, cables incluidos, etc."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-6">
            <button
              type="button"
              onClick={() => router.push("/express-loans")}
              disabled={loading}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-500 transition-colors shadow-sm disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar Préstamo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}