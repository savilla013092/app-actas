'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LucideImageOff, LucideTrash2 } from 'lucide-react';
import { z } from 'zod';

import { EvidenciasUploader } from '@/components/revision/EvidenciasUploader';
import { SignaturePad } from '@/components/signature/SignaturePad';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { getAssetLocation } from '@/lib/utils/assetLocation';
import {
  EVIDENCE_FILE_ACCEPT,
  getEvidenceUploadErrorDescription,
} from '@/services/evidenceUploadService';
import {
  actualizarBorradorRevision,
  crearRevision,
  eliminarEvidenciaBorradorRevision,
  firmarComoRevisor,
  subirEvidencias,
  type UpdateRevisionDraftPayload,
} from '@/services/revisionService';
import { getOperationalSessionErrorDescription } from '@/services/sessionService';
import { Activo } from '@/types/activo';
import { Evidencia, Revision } from '@/types/revision';
import { Usuario } from '@/types/usuario';

const revisionSchema = z.object({
  fecha: z.string().min(1, 'La fecha es requerida'),
  estadoActivo: z.enum(['excelente', 'bueno', 'regular', 'malo', 'para_baja']),
  descripcion: z.string().min(10, 'La descripción debe tener al menos 10 caracteres'),
  observaciones: z.string().optional(),
  custodioId: z.string().min(1, 'Debe seleccionar un custodio'),
});

type RevisionFormData = z.infer<typeof revisionSchema>;

interface CustodioSnapshot {
  id: string;
  nombre: string;
  cedula: string;
  cargo: string;
}

interface RevisionFormProps {
  activo: Activo;
  custodio: CustodioSnapshot;
  onSuccess: (revisionId: string) => void;
  revision?: Revision | null;
  custodios?: Usuario[];
  custodioSelectionEnabled?: boolean;
  loadWarning?: string | null;
}

interface SafeDateInputResult {
  value: string;
  usedFallback: boolean;
}

const FALLBACK_CUSTODIO = {
  nombre: 'Custodio sin nombre',
  cedula: 'Sin cedula',
  cargo: 'Sin cargo',
} as const;

function toDateInputValue(value: Date): string {
  const normalized = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return normalized.toISOString().split('T')[0];
}

function logIncompleteField(
  field: string,
  documentId: string,
  source: string,
  value: unknown
) {
  console.warn('[RevisionForm] dato incompleto detectado.', {
    documentId,
    source,
    field,
    value,
  });
}

function normalizeTextField(
  value: unknown,
  fallback: string,
  field: 'nombre' | 'cedula' | 'cargo',
  documentId: string,
  source: string
): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  logIncompleteField(field, documentId, source, value);
  return fallback;
}

function normalizeCustodioSnapshot(
  value: Partial<CustodioSnapshot> | undefined,
  documentId: string,
  source: string
): CustodioSnapshot | null {
  const id = typeof value?.id === 'string' ? value.id.trim() : '';

  if (!id) {
    logIncompleteField('id', documentId, source, value?.id);
    return null;
  }

  return {
    id,
    nombre: normalizeTextField(
      value?.nombre,
      FALLBACK_CUSTODIO.nombre,
      'nombre',
      documentId,
      source
    ),
    cedula: normalizeTextField(
      value?.cedula,
      FALLBACK_CUSTODIO.cedula,
      'cedula',
      documentId,
      source
    ),
    cargo: normalizeTextField(
      value?.cargo,
      FALLBACK_CUSTODIO.cargo,
      'cargo',
      documentId,
      source
    ),
  };
}

function formatDateInput(
  value: Date | { seconds: number } | { toDate: () => Date } | string | null | undefined,
  documentId: string
): SafeDateInputResult {
  if (!value) {
    logIncompleteField('fecha', documentId, 'revision actual', value);
    return { value: toDateInputValue(new Date()), usedFallback: true };
  }

  let parsedDate: Date;

  if (typeof value === 'object' && 'toDate' in value) {
    parsedDate = value.toDate();
  } else if (typeof value === 'object' && 'seconds' in value) {
    parsedDate = new Date(value.seconds * 1000);
  } else {
    parsedDate = new Date(value);
  }

  if (Number.isNaN(parsedDate.getTime())) {
    logIncompleteField('fecha', documentId, 'revision actual', value);
    return { value: toDateInputValue(new Date()), usedFallback: true };
  }

  return { value: toDateInputValue(parsedDate), usedFallback: false };
}

function ExistingEvidenceCard({
  evidencia,
  deleting,
  onDelete,
}: {
  evidencia: Evidencia;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div className='group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted'>
      {evidencia.url ? (
        <Image src={evidencia.url} alt={evidencia.nombre} fill className='object-cover' unoptimized />
      ) : (
        <div className='flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground'>
          <LucideImageOff size={28} />
          <span className='px-3 text-center text-xs'>Vista previa no disponible</span>
        </div>
      )}

      <div className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 text-[11px] text-white'>
        <p className='truncate' title={evidencia.nombre}>
          {evidencia.nombre}
        </p>
      </div>

      <button
        type='button'
        onClick={onDelete}
        disabled={deleting}
        className='absolute right-2 top-2 rounded-full bg-red-600 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-100'
        aria-label={`Eliminar ${evidencia.nombre}`}
      >
        <LucideTrash2 size={16} />
      </button>
    </div>
  );
}

export function RevisionForm({
  activo,
  custodio,
  onSuccess,
  revision = null,
  custodios = [],
  custodioSelectionEnabled = true,
  loadWarning = null,
}: RevisionFormProps) {
  const { user } = useAuth();
  const isEditMode = revision !== null;
  const documentId = revision?.id ?? 'nueva-revision';
  const initialCustodio = useMemo<CustodioSnapshot | null>(
    () =>
      normalizeCustodioSnapshot(
        revision
          ? {
              id: revision.custodioId,
              nombre: revision.custodioNombre,
              cedula: revision.custodioCedula,
              cargo: revision.custodioCargo,
            }
          : custodio,
        documentId,
        'custodio actual'
      ),
    [custodio, documentId, revision]
  );
  const fallbackCustodio = useMemo<CustodioSnapshot>(
    () => ({
      id: initialCustodio?.id ?? '',
      nombre: initialCustodio?.nombre ?? FALLBACK_CUSTODIO.nombre,
      cedula: initialCustodio?.cedula ?? FALLBACK_CUSTODIO.cedula,
      cargo: initialCustodio?.cargo ?? FALLBACK_CUSTODIO.cargo,
    }),
    [initialCustodio]
  );
  const initialDate = useMemo(
    () => formatDateInput(revision?.fecha ?? null, documentId),
    [documentId, revision?.fecha]
  );

  const [paso, setPaso] = useState<'formulario' | 'evidencias' | 'firma'>('formulario');
  const [revisionId, setRevisionId] = useState<string | null>(revision?.id ?? null);
  const [evidencias, setEvidencias] = useState<File[]>([]);
  const [evidenciasExistentes, setEvidenciasExistentes] = useState<Evidencia[]>(revision?.evidencias ?? []);
  const [loading, setLoading] = useState(false);
  const [deletingEvidenceId, setDeletingEvidenceId] = useState<string | null>(null);
  const assetLocation = getAssetLocation(activo.ubicacion);

  const custodioOptions = useMemo(() => {
    const options = new Map<string, CustodioSnapshot>();

    if (fallbackCustodio.id) {
      options.set(fallbackCustodio.id, fallbackCustodio);
    }

    custodios
      .filter((usuario) => usuario.rol === 'custodio' && usuario.activo)
      .forEach((usuario) => {
        const normalized = normalizeCustodioSnapshot(usuario, documentId, `usuario:${usuario.id}`);
        if (normalized) {
          options.set(normalized.id, normalized);
        }
      });

    return Array.from(options.values()).sort((left, right) =>
      (left.nombre || FALLBACK_CUSTODIO.nombre).localeCompare(
        right.nombre || FALLBACK_CUSTODIO.nombre,
        'es-CO'
      )
    );
  }, [custodios, documentId, fallbackCustodio]);

  const {
    register,
    handleSubmit,
    getValues,
    watch,
    formState: { errors },
  } = useForm<RevisionFormData>({
    resolver: zodResolver(revisionSchema),
    defaultValues: {
      fecha: initialDate.value,
      estadoActivo: revision?.estadoActivo ?? 'bueno',
      descripcion: revision?.descripcion ?? '',
      observaciones: revision?.observaciones ?? '',
      custodioId: fallbackCustodio.id,
    },
  });

  const selectedCustodioId = watch('custodioId');
  const selectedCustodio =
    custodioOptions.find((item) => item.id === selectedCustodioId) ?? fallbackCustodio;
  const totalEvidenceCount = evidenciasExistentes.length + evidencias.length;

  const buildDraftPayload = (data: RevisionFormData): UpdateRevisionDraftPayload | null => {
    const custodioSeleccionado =
      custodioOptions.find((item) => item.id === data.custodioId) ?? fallbackCustodio;

    if (!custodioSeleccionado || !custodioSeleccionado.id) {
      return null;
    }

    return {
      activoId: activo.id,
      codigoActivo: activo.codigo,
      descripcionActivo: activo.descripcion,
      ubicacionActivo: assetLocation.locationName,
      custodioId: custodioSeleccionado.id,
      custodioNombre: custodioSeleccionado.nombre,
      custodioCedula: custodioSeleccionado.cedula,
      custodioCargo: custodioSeleccionado.cargo,
      fecha: new Date(data.fecha),
      estadoActivo: data.estadoActivo,
      descripcion: data.descripcion,
      observaciones: data.observaciones,
    };
  };

  const onSubmitFormulario = async (data: RevisionFormData) => {
    if (!user?.usuario) {
      toast({
        title: 'Perfil no disponible',
        description: 'Debe iniciar sesión con un perfil operativo válido para crear revisiones.',
        variant: 'destructive',
      });
      return;
    }

    const payload = buildDraftPayload(data);
    if (!payload) {
      toast({
        title: 'Custodio no disponible',
        description: 'Seleccione un custodio válido para continuar.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      if (isEditMode && revisionId) {
        await actualizarBorradorRevision(revisionId, payload);
      } else {
        const id = await crearRevision({
          ...payload,
          revisorId: user.uid,
          revisorNombre: user.usuario.nombre,
          revisorCedula: user.usuario.cedula,
          revisorCargo: user.usuario.cargo,
          estado: 'borrador',
          creadoPor: user.uid,
        });

        setRevisionId(id);
      }

      setPaso('evidencias');
    } catch (error) {
      console.error('Error saving revision draft:', error);
      toast({
        title: isEditMode ? 'No fue posible actualizar el borrador' : 'No fue posible crear la revisión',
        description: 'Revise sus permisos e intente nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubirEvidencias = async () => {
    if (!revisionId) {
      return;
    }

    if (evidencias.length === 0) {
      if (evidenciasExistentes.length === 0) {
        return;
      }

      setPaso('firma');
      return;
    }

    setLoading(true);

    try {
      const nuevasEvidencias = await subirEvidencias(revisionId, evidencias);
      setEvidenciasExistentes((current) => [...current, ...nuevasEvidencias]);
      setEvidencias([]);
      setPaso('firma');
    } catch (error) {
      console.error('Error uploading evidences:', error);
      toast({
        title: 'Error al subir evidencias',
        description: getEvidenceUploadErrorDescription(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarEvidencia = async (evidenciaId: string) => {
    if (!revisionId) {
      return;
    }

    setDeletingEvidenceId(evidenciaId);

    try {
      await eliminarEvidenciaBorradorRevision(revisionId, evidenciaId);
      setEvidenciasExistentes((current) =>
        current.filter((evidencia) => evidencia.id !== evidenciaId)
      );
      toast({
        title: 'Evidencia eliminada',
        description: 'La evidencia se retiró del borrador correctamente.',
      });
    } catch (error) {
      console.error('Error deleting draft evidence:', error);
      toast({
        title: 'No fue posible eliminar la evidencia',
        description: 'Intente nuevamente mientras el borrador siga sin firmar.',
        variant: 'destructive',
      });
    } finally {
      setDeletingEvidenceId(null);
    }
  };

  const handleFirmaRevisor = async (firmaDataUrl: string) => {
    if (!revisionId) {
      return;
    }

    setLoading(true);

    try {
      const datosRevision = {
        ...getValues(),
        activo,
        custodio: selectedCustodio,
        revisor: user?.usuario,
        fecha: new Date().toISOString(),
      };

      await firmarComoRevisor(revisionId, firmaDataUrl, datosRevision);
      onSuccess(revisionId);
    } catch (error) {
      console.error('Error registering reviewer signature:', error);
      toast({
        title: 'No fue posible registrar la firma',
        description:
          getOperationalSessionErrorDescription(error) ??
          'La revisión quedó guardada, pero la firma del revisor no se pudo procesar.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='mx-auto max-w-2xl'>
      <div className='mb-8 flex justify-between'>
        {['Datos', 'Evidencias', 'Firma'].map((label, index) => {
          const currentIndex = ['formulario', 'evidencias', 'firma'].indexOf(paso);
          const isCompleted = index < currentIndex;
          const isCurrent = paso === ['formulario', 'evidencias', 'firma'][index];

          return (
            <div
              key={label}
              className={`flex items-center ${
                isCompleted ? 'text-green-600' : isCurrent ? 'text-blue-600' : 'text-muted-foreground'
              }`}
            >
              <span className='mr-2 flex h-8 w-8 items-center justify-center rounded-full border-2'>
                {index + 1}
              </span>
              {label}
            </div>
          );
        })}
      </div>

      {paso === 'formulario' && (
        <form onSubmit={handleSubmit(onSubmitFormulario)} className='space-y-6'>
          <div className='mb-6 rounded-lg border border-border bg-muted p-4'>
            <h3 className='mb-2 font-semibold'>
              {isEditMode ? 'Borrador de revisión editable' : 'Activo a revisar'}
            </h3>
            <p>
              <strong>Código:</strong> {activo.codigo}
            </p>
            <p>
              <strong>Descripción:</strong> {activo.descripcion}
            </p>
            <p>
              <strong>Ubicación:</strong> {assetLocation.locationName}
            </p>
            <p>
              <strong>Custodio:</strong> {selectedCustodio.nombre}
            </p>
            {isEditMode ? (
              <p className='mt-2 text-xs text-muted-foreground'>
                Puede corregir datos y evidencias mientras el borrador no haya sido firmado por el revisor.
              </p>
            ) : null}
          </div>

          {loadWarning ? (
            <div className='rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900'>
              {loadWarning}
            </div>
          ) : null}

          {isEditMode && initialDate.usedFallback ? (
            <div className='rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900'>
              La fecha original del borrador no era valida. Se cargo la fecha de hoy para evitar bloquear la edicion.
            </div>
          ) : null}

          {isEditMode && custodioSelectionEnabled ? (
            <div>
              <Label htmlFor='custodioId'>Custodio responsable</Label>
              <Select id='custodioId' {...register('custodioId')}>
                {custodioOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre} - {item.cedula}
                  </option>
                ))}
              </Select>
              {errors.custodioId ? (
                <p className='text-sm text-red-500'>{errors.custodioId.message}</p>
              ) : null}
            </div>
          ) : null}

          {isEditMode && !custodioSelectionEnabled ? (
            <div>
              <Label>Custodio responsable</Label>
              <div className='rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground'>
                {selectedCustodio.nombre} - {selectedCustodio.cedula}
              </div>
              <p className='mt-1 text-xs text-muted-foreground'>
                El directorio de custodios no esta disponible en este momento. Puede seguir editando el borrador con el custodio actual.
              </p>
            </div>
          ) : null}

          <div>
            <Label htmlFor='fecha'>Fecha de revisión</Label>
            <Input id='fecha' type='date' {...register('fecha')} />
            {errors.fecha && <p className='text-sm text-red-500'>{errors.fecha.message}</p>}
          </div>

          <div>
            <Label htmlFor='estadoActivo'>Estado del activo</Label>
            <Select id='estadoActivo' {...register('estadoActivo')}>
              <option value='excelente'>Excelente</option>
              <option value='bueno'>Bueno</option>
              <option value='regular'>Regular</option>
              <option value='malo'>Malo</option>
              <option value='para_baja'>Para baja</option>
            </Select>
          </div>

          <div>
            <Label htmlFor='descripcion'>Descripción de la revisión</Label>
            <Textarea
              id='descripcion'
              {...register('descripcion')}
              rows={4}
              placeholder='Describa detalladamente el estado del activo y los hallazgos de la revisión.'
            />
            {errors.descripcion ? (
              <p className='text-sm text-red-500'>{errors.descripcion.message}</p>
            ) : null}
          </div>

          <div>
            <Label htmlFor='observaciones'>Observaciones adicionales</Label>
            <Textarea
              id='observaciones'
              {...register('observaciones')}
              rows={3}
              placeholder='Observaciones o recomendaciones adicionales.'
            />
          </div>

          <Button type='submit' disabled={loading} className='w-full'>
            {loading
              ? isEditMode
                ? 'Actualizando...'
                : 'Guardando...'
              : isEditMode
              ? 'Guardar borrador y continuar'
              : 'Continuar a evidencias'}
          </Button>
        </form>
      )}

      {paso === 'evidencias' && (
        <div className='space-y-6'>
          <div>
            <h3 className='text-lg font-semibold'>Subir evidencias fotográficas</h3>
            <p className='text-muted-foreground'>
              Agregue entre 1 y 5 fotografías del activo revisado.
            </p>
          </div>

          {evidenciasExistentes.length > 0 ? (
            <div className='space-y-3'>
              <div>
                <h4 className='text-sm font-semibold text-foreground'>Evidencias ya registradas</h4>
                <p className='text-xs text-muted-foreground'>
                  Puede conservarlas o eliminarlas mientras la revisión siga en borrador.
                </p>
              </div>
              <div className='grid grid-cols-2 gap-4 md:grid-cols-3'>
                {evidenciasExistentes.map((evidencia) => (
                  <ExistingEvidenceCard
                    key={evidencia.id}
                    evidencia={evidencia}
                    deleting={deletingEvidenceId === evidencia.id}
                    onDelete={() => void handleEliminarEvidencia(evidencia.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className='space-y-2'>
            <h4 className='text-sm font-semibold text-foreground'>
              {isEditMode ? 'Agregar nuevas evidencias' : 'Evidencias del borrador'}
            </h4>
            <EvidenciasUploader
              evidencias={evidencias}
              onChange={setEvidencias}
              maxFiles={Math.max(0, 5 - evidenciasExistentes.length)}
              accept={EVIDENCE_FILE_ACCEPT}
            />
          </div>

          <div className='flex gap-4'>
            <Button variant='outline' onClick={() => setPaso('formulario')}>
              Volver
            </Button>
            <Button
              onClick={handleSubirEvidencias}
              disabled={totalEvidenceCount === 0 || loading || deletingEvidenceId !== null}
              className='flex-1'
            >
              {loading ? 'Subiendo...' : 'Continuar a firma'}
            </Button>
          </div>
        </div>
      )}

      {paso === 'firma' && user?.usuario ? (
        <SignaturePad
          titulo='Firma del profesional de logística'
          nombreFirmante={user.usuario.nombre}
          cedulaFirmante={user.usuario.cedula}
          declaracion='Certifico que realicé la revisión física del activo y que la información registrada corresponde a su estado real al momento de la inspección.'
          onSave={handleFirmaRevisor}
          onCancel={() => setPaso('evidencias')}
        />
      ) : null}
    </div>
  );
}
