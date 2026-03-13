'use client';

import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  ImagePlus,
  MapPin,
  PackageSearch,
  Search,
} from 'lucide-react';

import assetClassificationMap from '@/lib/constants/assetClassificationMap.json';
import { LOCATION_OPTIONS } from '@/lib/utils/assetLocation';
import { EvidenciasUploader } from '@/components/revision/EvidenciasUploader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { getAssetClassification } from '@/lib/utils/assetClassification';
import { getAssetLocation } from '@/lib/utils/assetLocation';
import {
  buscarActivosDisponibles,
  SearchActiveAssetsCursor,
} from '@/services/activoService';
import { createExpressLoan, getActiveExpressLoanByAsset } from '@/services/expressLoanService';
import { Activo } from '@/types/activo';
import { CreateExpressLoanDTO, ExpressLoanItemType } from '@/types/expressLoan';

interface ExpressLoanFormValues {
  borrower_name: string;
  borrower_document?: string;
  wildcard_description?: string;
  notes?: string;
  loan_date: string;
}

const PAGE_SIZE = 50;
const inputClass = 'border-slate-300 bg-white/90 shadow-sm focus-visible:ring-primary/40';
const classificationCatalog = assetClassificationMap as Record<string, string>;

const buildAssetSnapshot = (asset: Activo) => ({
  codigo: asset.codigo,
  descripcion: asset.descripcion,
  categoria: getAssetClassification(asset.codigo, asset.categoria).classificationName,
  marca: asset.marca,
  modelo: asset.modelo,
  serial: asset.serial,
  ubicacion: getAssetLocation(asset.ubicacion).locationName,
  dependencia: asset.dependencia,
  custodioNombre: asset.custodioNombre,
});

const formatLoanDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return format(date, 'dd MMM yyyy HH:mm', { locale: es });
};

export default function NewExpressLoanPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [loadingMoreAssets, setLoadingMoreAssets] = useState(false);
  const [itemType, setItemType] = useState<ExpressLoanItemType>('activo_registrado');
  const [activos, setActivos] = useState<Activo[]>([]);
  const [assetSearch, setAssetSearch] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [assetCursor, setAssetCursor] = useState<SearchActiveAssetsCursor | null>(null);
  const [hasMoreAssets, setHasMoreAssets] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Activo | null>(null);
  const selectedAssetIdRef = useRef('');
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

  const deferredAssetSearch = useDeferredValue(assetSearch);

  useEffect(() => {
    selectedAssetIdRef.current = selectedAssetId;
  }, [selectedAssetId]);

  const classificationOptions = useMemo(
    () =>
      Object.entries(classificationCatalog)
        .map(([code, name]) => ({ code, name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    []
  );

  useEffect(() => {
    let active = true;

    async function loadAssets() {
      if (itemType !== 'activo_registrado') {
        setLoadingAssets(false);
        return;
      }

      try {
        setLoadingAssets(true);
        const result = await buscarActivosDisponibles({
          search: deferredAssetSearch,
          classificationCode: classificationFilter || undefined,
          locationName: locationFilter || undefined,
          limit: PAGE_SIZE,
        });

        if (!active) {
          return;
        }

        startTransition(() => {
          setActivos(result.items);
          setAssetCursor(result.nextCursor);
          setHasMoreAssets(result.hasMore);

          if (selectedAssetIdRef.current) {
            const currentSelection = result.items.find((asset) => asset.id === selectedAssetIdRef.current);
            if (currentSelection) {
              setSelectedAsset(currentSelection);
            }
          }
        });
      } catch (error) {
        console.error('Error loading assets for express loan:', error);
        if (active) {
          setFormError('No fue posible cargar los activos disponibles para prestamo express.');
          setActivos([]);
          setAssetCursor(null);
          setHasMoreAssets(false);
        }
      } finally {
        if (active) {
          setLoadingAssets(false);
        }
      }
    }

    void loadAssets();

    return () => {
      active = false;
    };
  }, [classificationFilter, deferredAssetSearch, itemType, locationFilter]);

  const selectedAssetLocation = useMemo(
    () => (selectedAsset ? getAssetLocation(selectedAsset.ubicacion).locationName : ''),
    [selectedAsset]
  );

  const handleSelectAsset = (asset: Activo) => {
    setSelectedAssetId(asset.id);
    setSelectedAsset(asset);
    setFormError(null);
  };

  const handleLoadMoreAssets = async () => {
    if (!assetCursor || !hasMoreAssets) {
      return;
    }

    try {
      setLoadingMoreAssets(true);
      const result = await buscarActivosDisponibles({
        search: deferredAssetSearch,
        classificationCode: classificationFilter || undefined,
        locationName: locationFilter || undefined,
        limit: PAGE_SIZE,
        cursor: assetCursor,
      });

      startTransition(() => {
        setActivos((current) => {
          const itemsById = new Map(current.map((asset) => [asset.id, asset]));
          result.items.forEach((asset) => itemsById.set(asset.id, asset));
          return Array.from(itemsById.values()).sort((left, right) => left.codigo.localeCompare(right.codigo));
        });
        setAssetCursor(result.nextCursor);
        setHasMoreAssets(result.hasMore);

        if (selectedAssetIdRef.current) {
          const currentSelection = result.items.find((asset) => asset.id === selectedAssetIdRef.current);
          if (currentSelection) {
            setSelectedAsset(currentSelection);
          }
        }
      });
    } catch (error) {
      console.error('Error loading more assets for express loan:', error);
      setFormError('No fue posible cargar mas activos disponibles.');
    } finally {
      setLoadingMoreAssets(false);
    }
  };

  const onSubmit = async (values: ExpressLoanFormValues) => {
    try {
      setLoading(true);
      setFormError(null);

      if (!user?.usuario) {
        setFormError('Debe iniciar sesion con un perfil valido para registrar el prestamo.');
        return;
      }

      if (itemType === 'activo_registrado') {
        if (!selectedAsset) {
          setFormError('Seleccione un activo registrado para continuar.');
          return;
        }

        const activeLoan = await getActiveExpressLoanByAsset(selectedAsset.id);
        if (activeLoan) {
          setFormError(
            `El activo ${selectedAsset.codigo} ya tiene un prestamo activo a nombre de ${activeLoan.borrower_name} desde ${formatLoanDate(activeLoan.loan_date)}.`
          );
          return;
        }
      }

      if (itemType === 'comodin' && evidenceFiles.length === 0) {
        setFormError('El item comodin requiere al menos una foto como soporte.');
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
          itemType === 'activo_registrado'
            ? selectedAsset?.descripcion || ''
            : values.wildcard_description?.trim() || '',
        notes: values.notes?.trim() || undefined,
        loan_date: new Date(values.loan_date).toISOString(),
        lender_id: user.uid,
        lender_name: user.usuario.nombre,
      };

      if (!payload.element_description) {
        setFormError('La descripcion del item es obligatoria.');
        return;
      }

      await createExpressLoan(payload, evidenceFiles);
      toast({ title: 'Prestamo registrado', description: 'El prestamo express quedo guardado correctamente.' });
      router.push('/express-loans');
    } catch (error) {
      console.error('Error creating express loan:', error);

      const message =
        error instanceof Error && error.message === 'ACTIVE_LOAN_EXISTS'
          ? 'El activo seleccionado ya tiene un prestamo express activo.'
          : error instanceof Error && error.message === 'EVIDENCE_REQUIRED'
          ? 'El item comodin requiere al menos una foto como soporte.'
          : error instanceof Error && error.message.includes('permission-denied')
          ? 'No tiene permisos para registrar prestamos express.'
          : 'Hubo un error al guardar el prestamo. Revise la conexion e intentelo nuevamente.';
      setFormError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='mx-auto max-w-6xl space-y-6'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight text-slate-900'>Nuevo prestamo express</h1>
          <p className='mt-1 text-sm text-slate-500'>
            Registre un activo existente o un item comodin con evidencia fotografica.
          </p>
        </div>
        <Button
          type='button'
          variant='outline'
          leftIcon={<ArrowLeft className='h-4 w-4' />}
          onClick={() => router.push('/express-loans')}
        >
          Volver al listado
        </Button>
      </div>

      {formError ? (
        <div className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
          {formError}
        </div>
      ) : null}

      <div className='rounded-2xl border border-slate-200 bg-white/60 p-6 shadow-sm backdrop-blur-xl'>
        <form onSubmit={handleSubmit(onSubmit)} className='space-y-8'>
          <section className='space-y-4'>
            <div>
              <h2 className='text-base font-semibold text-slate-900'>1. Tipo de item</h2>
              <p className='text-sm text-slate-500'>El prestamo express maneja un solo item por registro.</p>
            </div>
            <div className='grid gap-4 md:grid-cols-2'>
              <button
                type='button'
                onClick={() => {
                  setItemType('activo_registrado');
                  setFormError(null);
                }}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  itemType === 'activo_registrado'
                    ? 'border-primary-500 bg-primary-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className='mb-3 flex items-center gap-2 text-slate-900'>
                  <PackageSearch className='h-5 w-5' />
                  <span className='font-semibold'>Activo registrado</span>
                </div>
                <p className='text-sm text-slate-600'>
                  Selecciona un activo existente y bloquea nuevos prestamos mientras siga activo.
                </p>
              </button>

              <button
                type='button'
                onClick={() => {
                  setItemType('comodin');
                  setSelectedAssetId('');
                  setSelectedAsset(null);
                  setFormError(null);
                }}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  itemType === 'comodin'
                    ? 'border-primary-500 bg-primary-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className='mb-3 flex items-center gap-2 text-slate-900'>
                  <Boxes className='h-5 w-5' />
                  <span className='font-semibold'>Item comodin</span>
                </div>
                <p className='text-sm text-slate-600'>
                  Registra un elemento manual sin validarlo contra la base y exige soporte fotografico.
                </p>
              </button>
            </div>
          </section>

          <section className='space-y-4'>
            <div>
              <h2 className='text-base font-semibold text-slate-900'>2. Datos del item</h2>
              <p className='text-sm text-slate-500'>
                {itemType === 'activo_registrado'
                  ? 'Busque por codigo, descripcion, serial, marca, modelo, clasificacion o ubicacion.'
                  : 'Describa el elemento tal como se entrega.'}
              </p>
            </div>

            {itemType === 'activo_registrado' ? (
              <div className='space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4'>
                {selectedAsset ? (
                  <div className='rounded-xl border border-primary/20 bg-white p-4 shadow-sm'>
                    <div className='flex flex-wrap items-start justify-between gap-3'>
                      <div>
                        <div className='flex flex-wrap items-center gap-2'>
                          <h3 className='font-semibold text-slate-900'>{selectedAsset.descripcion}</h3>
                          <Badge variant='info'>{selectedAsset.codigo}</Badge>
                          <Badge variant='success' icon={<CheckCircle2 size={10} />}>
                            Seleccionado
                          </Badge>
                        </div>
                        <p className='mt-1 text-sm text-slate-500'>
                          {getAssetClassification(selectedAsset.codigo, selectedAsset.categoria).classificationName} -{' '}
                          {selectedAssetLocation} - {selectedAsset.dependencia}
                        </p>
                      </div>
                      <Badge variant='outline'>Custodio: {selectedAsset.custodioNombre}</Badge>
                    </div>
                    {selectedAsset.serial || selectedAsset.marca || selectedAsset.modelo ? (
                      <p className='mt-3 text-sm text-slate-600'>
                        {[selectedAsset.marca, selectedAsset.modelo, selectedAsset.serial]
                          .filter(Boolean)
                          .join(' ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½ ')}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className='grid gap-4 lg:grid-cols-[1.5fr_0.8fr_1fr]'>
                  <div className='space-y-2'>
                    <label className='block text-sm font-medium text-slate-700'>Buscar activo registrado</label>
                    <div className='relative'>
                      <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
                      <Input
                        value={assetSearch}
                        onChange={(event) => setAssetSearch(event.target.value)}
                        placeholder='Ej. AF-2420-0001, portatil, Dell, Romelia...'
                        className={`${inputClass} pl-10`}
                      />
                    </div>
                  </div>

                  <div className='space-y-2'>
                    <label className='block text-sm font-medium text-slate-700'>Clasificacion</label>
                    <select
                      value={classificationFilter}
                      onChange={(event) => setClassificationFilter(event.target.value)}
                      className='flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40'
                    >
                      <option value=''>Todas</option>
                      {classificationOptions.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.code} - {option.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className='space-y-2'>
                    <label className='block text-sm font-medium text-slate-700'>Ubicacion</label>
                    <select
                      value={locationFilter}
                      onChange={(event) => setLocationFilter(event.target.value)}
                      className='flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40'
                    >
                      <option value=''>Todas</option>
                      {LOCATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className='rounded-xl border border-slate-200 bg-white'>
                  <div className='flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-sm text-slate-500'>
                    <span>{loadingAssets ? 'Cargando activos...' : `${activos.length} activos cargados`}</span>
                    <span className='text-xs text-slate-400'>Solo se muestran activos en estado activo</span>
                  </div>

                  {loadingAssets ? (
                    <div className='p-4'>
                      <SkeletonTable rows={5} />
                    </div>
                  ) : activos.length === 0 ? (
                    <div className='px-4 py-10 text-center text-sm text-slate-500'>
                      No hay activos que coincidan con la busqueda y los filtros aplicados.
                    </div>
                  ) : (
                    <>
                      <div className='hidden overflow-x-auto md:block'>
                        <table className='min-w-full text-sm'>
                          <thead className='bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500'>
                            <tr>
                              <th className='px-4 py-3'>Codigo</th>
                              <th className='px-4 py-3'>Descripcion</th>
                              <th className='px-4 py-3'>Clasificacion</th>
                              <th className='px-4 py-3'>Ubicacion</th>
                              <th className='px-4 py-3'>Serial</th>
                              <th className='px-4 py-3'>Custodio</th>
                              <th className='px-4 py-3 text-right'>Accion</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activos.map((asset) => {
                              const classification = getAssetClassification(asset.codigo, asset.categoria);
                              const location = getAssetLocation(asset.ubicacion);
                              const isSelected = asset.id === selectedAssetId;

                              return (
                                <tr
                                  key={asset.id}
                                  className={`border-t border-slate-100 ${isSelected ? 'bg-primary-50/70' : 'hover:bg-slate-50'}`}
                                >
                                  <td className='px-4 py-3 font-medium text-slate-900'>{asset.codigo}</td>
                                  <td className='px-4 py-3 text-slate-700'>
                                    <div className='max-w-[320px] truncate'>{asset.descripcion}</div>
                                  </td>
                                  <td className='px-4 py-3 text-slate-600'>{classification.classificationName}</td>
                                  <td className='px-4 py-3 text-slate-600'>{location.locationName}</td>
                                  <td className='px-4 py-3 text-slate-600'>{asset.serial || '-'}</td>
                                  <td className='px-4 py-3 text-slate-600'>{asset.custodioNombre || 'Sin custodio'}</td>
                                  <td className='px-4 py-3 text-right'>
                                    <Button
                                      type='button'
                                      size='sm'
                                      variant={isSelected ? 'secondary' : 'outline'}
                                      onClick={() => handleSelectAsset(asset)}
                                    >
                                      {isSelected ? 'Seleccionado' : 'Seleccionar'}
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className='space-y-3 p-4 md:hidden'>
                        {activos.map((asset) => {
                          const classification = getAssetClassification(asset.codigo, asset.categoria);
                          const location = getAssetLocation(asset.ubicacion);
                          const isSelected = asset.id === selectedAssetId;

                          return (
                            <button
                              key={asset.id}
                              type='button'
                              onClick={() => handleSelectAsset(asset)}
                              className={`w-full rounded-xl border p-4 text-left transition ${
                                isSelected
                                  ? 'border-primary-400 bg-primary-50 shadow-sm'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <div className='flex items-start justify-between gap-3'>
                                <div>
                                  <p className='font-semibold text-slate-900'>{asset.descripcion}</p>
                                  <p className='text-sm text-slate-500'>{asset.codigo}</p>
                                </div>
                                <Badge variant={isSelected ? 'success' : 'outline'}>
                                  {isSelected ? 'Seleccionado' : 'Disponible'}
                                </Badge>
                              </div>
                              <div className='mt-3 space-y-1 text-sm text-slate-600'>
                                <p>{classification.classificationName}</p>
                                <p>{location.locationName}</p>
                                <p>{asset.serial || 'Sin serial'} - {asset.custodioNombre || 'Sin custodio'}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {hasMoreAssets ? (
                        <div className='border-t border-slate-200 px-4 py-3 text-right'>
                          <Button
                            type='button'
                            variant='outline'
                            onClick={handleLoadMoreAssets}
                            loading={loadingMoreAssets}
                          >
                            Cargar mas
                          </Button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className='space-y-2'>
                <label className='block text-sm font-medium text-slate-700'>Descripcion del item comodin *</label>
                <Textarea
                  rows={3}
                  {...register('wildcard_description', {
                    validate: (value) =>
                      itemType === 'comodin' && !value?.trim() ? 'La descripcion es obligatoria' : true,
                  })}
                  className={inputClass}
                  placeholder='Ej. Taladro industrial sin codigo institucional, con cargador y maletin.'
                />
                {errors.wildcard_description ? (
                  <p className='text-sm text-red-600'>{errors.wildcard_description.message}</p>
                ) : null}
              </div>
            )}
          </section>

          <section className='space-y-4'>
            <div>
              <div className='flex items-center gap-2'>
                <h2 className='text-base font-semibold text-slate-900'>3. Evidencias fotograficas</h2>
                <Badge variant={itemType === 'comodin' ? 'warning' : 'outline'}>
                  {itemType === 'comodin' ? 'Minimo 1 obligatoria' : 'Opcionales'}
                </Badge>
              </div>
              <p className='text-sm text-slate-500'>
                Puede cargar hasta 5 imagenes. El item comodin exige evidencia para dejar trazabilidad.
              </p>
            </div>

            <div className='rounded-2xl border border-slate-200 bg-slate-50/80 p-4'>
              <div className='mb-3 flex items-center gap-2 text-sm font-medium text-slate-700'>
                <ImagePlus className='h-4 w-4' />
                Registro fotografico
              </div>
              <EvidenciasUploader evidencias={evidenceFiles} onChange={setEvidenceFiles} maxFiles={5} />
            </div>
          </section>

          <section className='space-y-4'>
            <div>
              <h2 className='text-base font-semibold text-slate-900'>4. Datos del prestamo</h2>
              <p className='text-sm text-slate-500'>
                Registre quien recibe el elemento y cualquier observacion relevante.
              </p>
            </div>

            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <label className='block text-sm font-medium text-slate-700'>Nombre de quien recibe *</label>
                <Input
                  {...register('borrower_name', { required: 'Este campo es obligatorio' })}
                  className={inputClass}
                  placeholder='Ej. Juan Perez'
                />
                {errors.borrower_name ? (
                  <p className='text-sm text-red-600'>{errors.borrower_name.message}</p>
                ) : null}
              </div>

              <div className='space-y-2'>
                <label className='block text-sm font-medium text-slate-700'>Documento de identidad</label>
                <Input {...register('borrower_document')} className={inputClass} placeholder='CC o NIT' />
              </div>

              <div className='space-y-2'>
                <label className='block text-sm font-medium text-slate-700'>Fecha de entrega</label>
                <Input type='datetime-local' {...register('loan_date', { required: true })} className={inputClass} />
              </div>

              <div className='space-y-2'>
                <label className='flex items-center gap-2 text-sm font-medium text-slate-700'>
                  <MapPin className='h-4 w-4' />
                  Entrega registrada por
                </label>
                <Input value={user?.usuario?.nombre || 'Sin usuario'} className={inputClass} readOnly />
              </div>

              <div className='space-y-2 md:col-span-2'>
                <label className='block text-sm font-medium text-slate-700'>Notas u observaciones</label>
                <Textarea
                  rows={3}
                  {...register('notes')}
                  className={inputClass}
                  placeholder='Estado de entrega, accesorios incluidos u observaciones de uso.'
                />
              </div>
            </div>
          </section>

          <div className='flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end'>
            <Button
              type='button'
              variant='outline'
              onClick={() => router.push('/express-loans')}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type='submit' loading={loading}>
              Guardar prestamo
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


