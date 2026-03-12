"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Boxes, ImagePlus, PackageSearch } from "lucide-react";

import { EvidenciasUploader } from "@/components/revision/EvidenciasUploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { obtenerTodosLosActivos } from "@/services/activoService";
import {
  createExpressLoan,
  getActiveExpressLoanByAsset,
} from "@/services/expressLoanService";
import { useAuth } from "@/hooks/useAuth";
import { Activo } from "@/types/activo";
import { CreateExpressLoanDTO, ExpressLoanItemType } from "@/types/expressLoan";

interface ExpressLoanFormValues {
  borrower_name: string;
  borrower_document?: string;
  wildcard_description?: string;
  notes?: string;
  loan_date: string;
}

const inputClass =
  "border-slate-300 bg-white/90 shadow-sm focus-visible:ring-primary/40";

const buildAssetSnapshot = (asset: Activo) => ({
  codigo: asset.codigo,
  descripcion: asset.descripcion,
  categoria: asset.categoria,
  marca: asset.marca,
  modelo: asset.modelo,
  serial: asset.serial,
  ubicacion: asset.ubicacion,
  dependencia: asset.dependencia,
  custodioNombre: asset.custodioNombre,
});

const formatLoanDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return format(date, "dd MMM yyyy HH:mm", { locale: es });
};

export default function NewExpressLoanPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [itemType, setItemType] = useState<ExpressLoanItemType>("activo_registrado");
  const [activos, setActivos] = useState<Activo[]>([]);
  const [assetSearch, setAssetSearch] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpressLoanFormValues>({
    defaultValues: {
      loan_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    },
  });

  useEffect(() => {
    let active = true;

    async function loadAssets() {
      try {
        setLoadingAssets(true);
        const items = await obtenerTodosLosActivos();
        if (!active) {
          return;
        }
        setActivos(items.filter((asset) => asset.estado === "activo"));
      } catch (error) {
      console.error("Error creating loan:", error);

      const message =
        error instanceof Error && error.message === "ACTIVE_LOAN_EXISTS"
          ? "El activo seleccionado ya tiene un prestamo express activo."
          : error instanceof Error && error.message === "EVIDENCE_REQUIRED"
          ? "El item comodin requiere al menos una foto como soporte."
          : error instanceof Error && error.message.includes("permission-denied")
          ? "No tiene permisos para registrar prestamos express."
          : "Hubo un error al guardar el prestamo. Revise la conexion e intentelo nuevamente.";
      setFormError(message);
    } finally {
        if (active) {
          setLoadingAssets(false);
        }
      }
    }

    loadAssets();

    return () => {
      active = false;
    };
  }, []);

  const deferredAssetSearch = useDeferredValue(assetSearch);

  const assetsById = useMemo(
    () => new Map(activos.map((asset) => [asset.id, asset])),
    [activos]
  );

  const filteredAssets = useMemo(() => {
    const search = deferredAssetSearch.trim().toLowerCase();
    if (!search) {
      return activos.slice(0, 50);
    }

    return activos
      .filter((asset) => {
        const haystack = [
          asset.codigo,
          asset.descripcion,
          asset.serial || "",
          asset.marca || "",
          asset.modelo || "",
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(search);
      })
      .slice(0, 50);
  }, [activos, deferredAssetSearch]);

  const selectedAsset = selectedAssetId ? assetsById.get(selectedAssetId) || null : null;

  const onSubmit = async (values: ExpressLoanFormValues) => {
    try {
      setLoading(true);
      setFormError(null);

      if (!user?.usuario) {
        setFormError("Debe iniciar sesión con un usuario válido para registrar el préstamo.");
        return;
      }

      if (itemType === "activo_registrado") {
        if (!selectedAsset) {
          setFormError("Seleccione un activo registrado para continuar.");
          return;
        }

        const activeLoan = await getActiveExpressLoanByAsset(selectedAsset.id);
        if (activeLoan) {
          setFormError(
            `El activo ${selectedAsset.codigo} ya tiene un préstamo activo a nombre de ${activeLoan.borrower_name} desde ${formatLoanDate(activeLoan.loan_date)}.`
          );
          return;
        }
      }

      if (itemType === "comodin" && evidenceFiles.length === 0) {
        setFormError("El item comodin requiere al menos una foto como soporte.");
        return;
      }

      const payload: CreateExpressLoanDTO = {
        borrower_name: values.borrower_name.trim(),
        borrower_document: values.borrower_document?.trim() || undefined,
        item_type: itemType,
        asset_id: selectedAsset?.id,
        asset_code: selectedAsset?.codigo,
        asset_snapshot: selectedAsset ? buildAssetSnapshot(selectedAsset) : undefined,
        element_description:
          itemType === "activo_registrado"
            ? selectedAsset?.descripcion || ""
            : values.wildcard_description?.trim() || "",
        notes: values.notes?.trim() || undefined,
        loan_date: new Date(values.loan_date).toISOString(),
        lender_id: user.uid,
        lender_name: user.usuario.nombre,
      };

      if (!payload.element_description) {
        setFormError("La descripción del ítem es obligatoria.");
        return;
      }

      await createExpressLoan(payload, evidenceFiles);
      router.push("/express-loans");
    } catch (error) {
      console.error("Error creating loan:", error);

      const message =
        error instanceof Error && error.message === "ACTIVE_LOAN_EXISTS"
          ? "El activo seleccionado ya tiene un prestamo express activo."
          : error instanceof Error && error.message === "EVIDENCE_REQUIRED"
          ? "El item comodin requiere al menos una foto como soporte."
          : error instanceof Error && error.message.includes("permission-denied")
          ? "No tiene permisos para registrar prestamos express."
          : "Hubo un error al guardar el prestamo. Revise la conexion e intentelo nuevamente.";
      setFormError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Nuevo Préstamo Express
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Registra un activo existente o un item comodin con evidencia fotográfica.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          leftIcon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => router.push("/express-loans")}
        >
          Volver al listado
        </Button>
      </div>

      {formError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white/60 p-6 shadow-sm backdrop-blur-xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">1. Tipo de ítem</h2>
              <p className="text-sm text-slate-500">
                El préstamo express maneja un solo ítem por registro.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setItemType("activo_registrado");
                  setFormError(null);
                }}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  itemType === "activo_registrado"
                    ? "border-primary-500 bg-primary-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="mb-3 flex items-center gap-2 text-slate-900">
                  <PackageSearch className="h-5 w-5" />
                  <span className="font-semibold">Activo registrado</span>
                </div>
                <p className="text-sm text-slate-600">
                  Selecciona un activo existente y bloquea nuevos préstamos mientras siga activo.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setItemType("comodin");
                  setSelectedAssetId("");
                  setFormError(null);
                }}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  itemType === "comodin"
                    ? "border-primary-500 bg-primary-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="mb-3 flex items-center gap-2 text-slate-900">
                  <Boxes className="h-5 w-5" />
                  <span className="font-semibold">Ítem comodín</span>
                </div>
                <p className="text-sm text-slate-600">
                  Registra un elemento manual sin validarlo contra la base y exige soporte fotográfico.
                </p>
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">2. Datos del ítem</h2>
              <p className="text-sm text-slate-500">
                {itemType === "activo_registrado"
                  ? "Busca por código, descripción, serial, marca o modelo."
                  : "Describe el elemento tal como se entrega."}
              </p>
            </div>

            {itemType === "activo_registrado" ? (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Buscar activo registrado
                    </label>
                    <Input
                      value={assetSearch}
                      onChange={(event) => setAssetSearch(event.target.value)}
                      placeholder="Ej. AF-MOB-2024-0001, escritorio, Dell, serial..."
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Activo disponible
                    </label>
                    <select
                      value={selectedAssetId}
                      onChange={(event) => setSelectedAssetId(event.target.value)}
                      className={`flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 ${
                        loadingAssets ? "opacity-70" : ""
                      }`}
                      disabled={loadingAssets}
                    >
                      <option value="">
                        {loadingAssets
                          ? "Cargando activos..."
                          : filteredAssets.length > 0
                          ? "Seleccione un activo"
                          : "Sin resultados"}
                      </option>
                      {filteredAssets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.codigo} - {asset.descripcion}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedAsset && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{selectedAsset.descripcion}</h3>
                          <Badge variant="info">{selectedAsset.codigo}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {selectedAsset.categoria} · {selectedAsset.ubicacion} · {selectedAsset.dependencia}
                        </p>
                      </div>
                      <Badge variant="outline">Custodio: {selectedAsset.custodioNombre}</Badge>
                    </div>
                    {(selectedAsset.serial || selectedAsset.marca || selectedAsset.modelo) && (
                      <p className="mt-3 text-sm text-slate-600">
                        {[selectedAsset.marca, selectedAsset.modelo, selectedAsset.serial]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Descripción del ítem comodín *
                </label>
                <Textarea
                  rows={3}
                  {...register("wildcard_description", {
                    validate: (value) =>
                      itemType === "comodin" && !value?.trim()
                        ? "La descripción es obligatoria"
                        : true,
                  })}
                  className={inputClass}
                  placeholder="Ej. Taladro industrial sin código institucional, con cargador y maletín"
                />
                {errors.wildcard_description && (
                  <p className="text-sm text-red-600">{errors.wildcard_description.message}</p>
                )}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">3. Evidencias fotográficas</h2>
                <Badge variant={itemType === "comodin" ? "warning" : "outline"}>
                  {itemType === "comodin" ? "Mínimo 1 obligatoria" : "Opcionales"}
                </Badge>
              </div>
              <p className="text-sm text-slate-500">
                Puedes cargar hasta 5 imágenes. El ítem comodín exige evidencia para dejar trazabilidad.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                <ImagePlus className="h-4 w-4" />
                Registro fotográfico
              </div>
              <EvidenciasUploader
                evidencias={evidenceFiles}
                onChange={setEvidenceFiles}
                maxFiles={5}
              />
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">4. Datos del préstamo</h2>
              <p className="text-sm text-slate-500">
                Registra quién recibe el elemento y cualquier observación relevante.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Nombre de quien recibe *
                </label>
                <Input
                  {...register("borrower_name", { required: "Este campo es obligatorio" })}
                  className={inputClass}
                  placeholder="Ej. Juan Pérez"
                />
                {errors.borrower_name && (
                  <p className="text-sm text-red-600">{errors.borrower_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Documento de identidad
                </label>
                <Input
                  {...register("borrower_document")}
                  className={inputClass}
                  placeholder="CC o NIT"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Fecha de entrega
                </label>
                <Input
                  type="datetime-local"
                  {...register("loan_date", { required: true })}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Entrega registrada por
                </label>
                <Input
                  value={user?.usuario?.nombre || "Sin usuario"}
                  className={inputClass}
                  readOnly
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">
                  Notas u observaciones
                </label>
                <Textarea
                  rows={3}
                  {...register("notes")}
                  className={inputClass}
                  placeholder="Estado de entrega, accesorios incluidos, observaciones de uso, etc."
                />
              </div>
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/express-loans")}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              Guardar préstamo
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
