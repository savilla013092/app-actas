'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  LucideCheckCircle,
  LucideClock,
  LucideDownload,
  LucideFileText,
  LucideHome,
} from 'lucide-react';

import { AdvancedFilters, FilterConfig } from '@/components/filters/AdvancedFilters';
import { PageHeader, type ActionButton } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SkeletonList } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { exportToExcel, revisionesExportColumns } from '@/lib/utils/export';
import { obtenerRevisionesPaginadas } from '@/services/revisionService';
import { Revision } from '@/types/revision';

const PAGE_SIZE = 50;

export default function RevisionesPage() {
  const { user, isLogistica, isCustodio, isAdmin } = useAuth();
  const canSeeAllRevisions = isAdmin() || isLogistica();
  const canSignPendingRevisions = isCustodio();

  const [revisiones, setRevisiones] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<Revision['fecha'] | null>(null);

  const loadPage = useCallback(
    async (cursor: Revision['fecha'] | null = null, append = false) => {
      if (!user) {
        setRevisiones([]);
        setHasMore(false);
        setNextCursor(null);
        setTotalCount(0);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      try {
        const response = await obtenerRevisionesPaginadas({
          custodioId: canSignPendingRevisions ? user.uid : undefined,
          onlyPendingCustodian: canSignPendingRevisions,
          cursor,
          pageSize: PAGE_SIZE,
        });

        setRevisiones((current) => (append ? [...current, ...response.items] : response.items));
        setHasMore(response.hasMore);
        setNextCursor(response.nextCursor);
        setTotalCount(response.totalCount);
      } catch (error) {
        console.error('Error loading revisiones:', error);
        if (!append) {
          setRevisiones([]);
          setHasMore(false);
          setNextCursor(null);
          setTotalCount(0);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [canSignPendingRevisions, user]
  );

  useEffect(() => {
    setLoading(true);
    setLoadingMore(false);
    setHasMore(false);
    setNextCursor(null);
    setTotalCount(0);
    void loadPage();
  }, [loadPage]);

  const formatDate = (date: Date | { seconds: number } | undefined) => {
    if (!date) return '';
    if (typeof date === 'object' && 'seconds' in date) {
      return new Date(date.seconds * 1000).toLocaleDateString('es-CO');
    }
    return new Date(date).toLocaleDateString('es-CO');
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilterValues({});
    setSearch('');
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const dataToExport = filteredRevisiones.map((revision) => ({
        ...revision,
        fecha:
          typeof revision.fecha === 'object' && revision.fecha !== null && 'seconds' in revision.fecha
            ? new Date((revision.fecha as { seconds: number }).seconds * 1000).toISOString()
            : revision.fecha,
      }));

      await exportToExcel(
        dataToExport,
        revisionesExportColumns,
        'revisiones_serviciudad',
        'Revisiones'
      );
    } catch (error) {
      console.error('Error exporting revisiones:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleLoadMore = async () => {
    if (!hasMore || !nextCursor) {
      return;
    }

    setLoadingMore(true);
    await loadPage(nextCursor, true);
  };

  const uniqueEstados = useMemo(
    () => [
      { label: 'Borrador', value: 'borrador' },
      { label: 'Pendiente de firma', value: 'pendiente_firma_custodio' },
      { label: 'Generando PDF', value: 'firmada_completa' },
      { label: 'Completada', value: 'completada' },
      { label: 'Error', value: 'error_generacion' },
    ],
    []
  );

  const uniqueEstadosActivo = useMemo(() => {
    const estados = Array.from(new Set(revisiones.map((revision) => revision.estadoActivo).filter(Boolean)));
    return estados.map((estado) => ({
      label: estado.charAt(0).toUpperCase() + estado.slice(1),
      value: estado,
    }));
  }, [revisiones]);

  const uniqueRevisores = useMemo(() => {
    const revisores = Array.from(new Set(revisiones.map((revision) => revision.revisorNombre).filter(Boolean)));
    return revisores.map((revisor) => ({ label: revisor, value: revisor }));
  }, [revisiones]);

  const filterConfig: FilterConfig[] = [
    {
      key: 'estado',
      label: 'Estado proceso',
      type: 'select',
      options: uniqueEstados,
    },
    {
      key: 'estadoActivo',
      label: 'Estado activo',
      type: 'select',
      options: uniqueEstadosActivo,
    },
    ...(canSeeAllRevisions
      ? [
          {
            key: 'revisor',
            label: 'Revisor',
            type: 'select' as const,
            options: uniqueRevisores,
          },
        ]
      : []),
  ];

  const filteredRevisiones = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return revisiones.filter((revision) => {
      const matchesSearch =
        !normalizedSearch ||
        revision.numeroActa?.toLowerCase().includes(normalizedSearch) ||
        revision.codigoActivo.toLowerCase().includes(normalizedSearch) ||
        revision.descripcionActivo.toLowerCase().includes(normalizedSearch) ||
        revision.custodioNombre.toLowerCase().includes(normalizedSearch);

      const matchesEstado = !filterValues.estado || revision.estado === filterValues.estado;
      const matchesEstadoActivo =
        !filterValues.estadoActivo || revision.estadoActivo === filterValues.estadoActivo;
      const matchesRevisor = !filterValues.revisor || revision.revisorNombre === filterValues.revisor;

      return matchesSearch && matchesEstado && matchesEstadoActivo && matchesRevisor;
    });
  }, [filterValues, revisiones, search]);

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'borrador':
        return <Badge variant='secondary'>Borrador</Badge>;
      case 'pendiente_firma_custodio':
        return <Badge variant='pending' icon={<LucideClock size={10} />}>Pendiente firma</Badge>;
      case 'firmada_completa':
        return <Badge variant='info' icon={<LucideClock size={10} />}>Generando PDF...</Badge>;
      case 'completada':
        return <Badge variant='completed' icon={<LucideCheckCircle size={10} />}>Completada</Badge>;
      case 'error_generacion':
        return <Badge variant='error'>Error</Badge>;
      default:
        return <Badge variant='outline'>{estado}</Badge>;
    }
  };

  const loadedCount = revisiones.length;
  const filteredCount = filteredRevisiones.length;
  const allLoaded = !hasMore && loadedCount >= totalCount;
  const headerSubtitle = canSignPendingRevisions
    ? `${filteredCount} de ${loadedCount} revisiones pendientes cargadas${totalCount ? ` (${totalCount} total)` : ''}`
    : `${filteredCount} de ${loadedCount} revisiones cargadas${totalCount ? ` (${totalCount} total)` : ''}`;

  const headerActions: ActionButton[] = [
    {
      label: 'Menu principal',
      href: '/dashboard',
      icon: <LucideHome size={16} />,
      variant: 'outline',
    },
  ];

  if (!canSignPendingRevisions && loadedCount > 0) {
    headerActions.push({
      label: 'Exportar Excel',
      onClick: handleExport,
      icon: <LucideDownload size={16} />,
      variant: 'outline',
      loading: isExporting,
    });
  }

  if (loading) {
    return (
      <div className='space-y-6'>
        <PageHeader
          title='Historial de Revisiones'
          subtitle='Cargando revisiones...'
          breadcrumbItems={[{ label: 'Revisiones' }]}
          actions={headerActions}
        />
        <SkeletonList items={5} />
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Historial de Revisiones'
        subtitle={headerSubtitle}
        breadcrumbItems={[{ label: 'Revisiones' }]}
        actions={headerActions}
      />

      {!canSignPendingRevisions && (
        <AdvancedFilters
          filters={filterConfig}
          values={filterValues}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
          searchPlaceholder='Buscar por acta, codigo, descripcion o custodio...'
          searchValue={search}
          onSearchChange={setSearch}
        />
      )}

      {!allLoaded && loadedCount > 0 && (
        <div className='rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900'>
          La busqueda y los filtros se aplican sobre {loadedCount} revisiones ya cargadas. Usa &quot;Cargar mas&quot; para completar el historial.
        </div>
      )}

      {filteredRevisiones.length > 0 ? (
        <div className='space-y-4'>
          {filteredRevisiones.map((revision) => (
            <Link
              key={revision.id}
              href={
                revision.estado === 'borrador' && canSeeAllRevisions
                  ? `/revision/${revision.id}/editar`
                  : `/revision/${revision.id}`
              }
            >
              <Card className='cursor-pointer border-l-4 border-l-primary/30 p-5 hover:border-l-primary hover-lift'>
                <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
                  <div className='flex min-w-0 flex-1 items-center gap-4'>
                    <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10'>
                      <LucideFileText size={22} className='text-primary' />
                    </div>
                    <div className='min-w-0 flex-1'>
                      <div className='mb-1 flex flex-wrap items-center gap-2'>
                        <p className='font-bold text-foreground'>
                          {revision.numeroActa || 'PRE-ACTA'}
                        </p>
                        {getEstadoBadge(revision.estado)}
                      </div>
                      <p className='truncate text-sm text-muted-foreground'>
                        <span className='font-medium text-foreground'>{revision.codigoActivo}</span>
                        {' - '}
                        {revision.descripcionActivo}
                      </p>
                      <p className='mt-1 text-xs text-muted-foreground'>
                        <span className='font-medium'>Fecha:</span> {formatDate(revision.fecha)}
                        <span className='mx-2'>-</span>
                        <span className='font-medium'>Custodio:</span> {revision.custodioNombre}
                      </p>
                    </div>
                  </div>

                  <div className='flex shrink-0 items-center gap-4'>
                    <div className='hidden text-right md:block'>
                      <p className='mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground'>
                        Estado activo
                      </p>
                      <Badge
                        variant={
                          revision.estadoActivo === 'excelente' || revision.estadoActivo === 'bueno'
                            ? 'success'
                            : 'warning'
                        }
                      >
                        {revision.estadoActivo}
                      </Badge>
                    </div>
                    <Button variant='outline' size='sm'>
                      {canSignPendingRevisions && revision.estado === 'pendiente_firma_custodio'
                        ? 'Firmar como custodio'
                        : revision.estado === 'borrador' && canSeeAllRevisions
                        ? 'Editar borrador'
                        : 'Ver detalle'}
                    </Button>
                  </div>
                </div>
              </Card>
            </Link>
          ))}

          {hasMore && (
            <div className='flex justify-center pt-2'>
              <Button variant='outline' onClick={handleLoadMore} loading={loadingMore}>
                Cargar mas revisiones
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className='rounded-xl border border-dashed border-border bg-card py-16 text-center'>
          <LucideFileText className='mx-auto mb-4 text-muted-foreground' size={48} />
          <p className='font-medium text-muted-foreground'>No se encontraron revisiones</p>
          <p className='mt-1 text-sm text-muted-foreground'>
            {canSignPendingRevisions
              ? 'No tienes revisiones listas para firma del custodio.'
              : 'Intenta ajustar la busqueda o los filtros.'}
          </p>
          {isLogistica() && (
            <Button asChild className='mt-4'>
              <Link href='/activos'>Ir a Activos</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

