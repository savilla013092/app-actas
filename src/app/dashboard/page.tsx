'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LucideAlertTriangle,
  LucideArrowRight,
  LucideClipboardCheck,
  LucideClock,
  LucideFileText,
  LucideTrendingUp,
} from 'lucide-react';

import assetClassificationMap from '@/lib/constants/assetClassificationMap.json';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { contarActivosPorCategoria, contarActivosPorEstado } from '@/services/activoService';
import {
  obtenerAsignacionesPendientesFirma,
  obtenerTodasAsignacionesPendientes,
} from '@/services/asignacionService';
import {
  contarRevisionesPorMes,
  obtenerEstadisticasRevisiones,
  obtenerRevisionesPendientesFirma,
  obtenerRevisionesRecientes,
  obtenerTodasPendientesFirma,
} from '@/services/revisionService';
import { AsignacionInicial } from '@/types/asignacion';
import { Revision } from '@/types/revision';

const RevisionesPorMesChart = dynamic(
  () => import('@/components/charts/StatsChart').then((module) => module.RevisionesPorMesChart),
  { ssr: false }
);
const ActivosPorEstadoChart = dynamic(
  () => import('@/components/charts/StatsChart').then((module) => module.ActivosPorEstadoChart),
  { ssr: false }
);
const CategoriaChart = dynamic(
  () => import('@/components/charts/StatsChart').then((module) => module.CategoriaChart),
  { ssr: false }
);
const TendenciaChart = dynamic(
  () => import('@/components/charts/StatsChart').then((module) => module.TendenciaChart),
  { ssr: false }
);

interface Stats {
  totalRevisiones: number;
  pendientesFirma: number;
  actasMalEstado: number;
  actasCompletadas: number;
}

interface ChartPoint {
  name: string;
  value: number;
  color?: string;
}

interface DashboardCharts {
  revisionesPorMes: ChartPoint[];
  activosPorEstado: ChartPoint[];
  activosPorCategoria: ChartPoint[];
  tendencia: ChartPoint[];
}

const CHART_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6'];
const KNOWN_CATEGORIES = Array.from(new Set(Object.values(assetClassificationMap))).concat('Sin clasificacion');

const buildMonthRanges = (months: number) => {
  const now = new Date();
  return Array.from({ length: months }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - offset), 1);
    const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleString('es-CO', { month: 'short' }),
      start: date,
      end: next,
    };
  });
};

export default function DashboardPage() {
  const { user, isAdmin, isCustodio, isLogistica } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [revisionesRecientes, setRevisionesRecientes] = useState<Revision[]>([]);
  const [pendientesFirma, setPendientesFirma] = useState<Revision[]>([]);
  const [pendientesAsignacion, setPendientesAsignacion] = useState<AsignacionInicial[]>([]);
  const [charts, setCharts] = useState<DashboardCharts>({
    revisionesPorMes: [],
    activosPorEstado: [],
    activosPorCategoria: [],
    tendencia: [],
  });
  const [loading, setLoading] = useState(true);

  const isCustodian = isCustodio();
  const isManager = isAdmin() || isLogistica();

  useEffect(() => {
    async function loadDashboardData() {
      if (!user) {
        return;
      }

      try {
        const statsPromise = obtenerEstadisticasRevisiones();
        const recientesPromise = obtenerRevisionesRecientes(5);
        const pendientesPromise = isCustodian
          ? obtenerRevisionesPendientesFirma(user.uid)
          : obtenerTodasPendientesFirma(5);
        const pendientesAsignacionPromise = isCustodian
          ? obtenerAsignacionesPendientesFirma(user.uid)
          : obtenerTodasAsignacionesPendientes(5);

        const [estadisticas, recientes, pendientes, asignacionesPendientes] = await Promise.all([
          statsPromise,
          recientesPromise,
          pendientesPromise,
          pendientesAsignacionPromise,
        ]);

        setStats(estadisticas);
        setRevisionesRecientes(recientes);
        setPendientesFirma(isCustodian ? pendientes : pendientes.slice(0, 5));
        setPendientesAsignacion(isCustodian ? asignacionesPendientes : asignacionesPendientes.slice(0, 5));

        if (!isCustodian) {
          const twelveMonths = buildMonthRanges(12);
          const sixMonths = buildMonthRanges(6);
          const [
            activosActivos,
            activosMantenimiento,
            activosTraslado,
            activosBaja,
            categoryCounts,
            revisionesPorMes,
            tendencia,
          ] = await Promise.all([
            contarActivosPorEstado('activo'),
            contarActivosPorEstado('mantenimiento'),
            contarActivosPorEstado('traslado'),
            contarActivosPorEstado('baja'),
            Promise.all(
              KNOWN_CATEGORIES.map(async (categoria) => ({
                name: categoria,
                value: await contarActivosPorCategoria(categoria),
              }))
            ),
            Promise.all(
              twelveMonths.map(async (month) => ({
                name: month.label.charAt(0).toUpperCase() + month.label.slice(1),
                value: await contarRevisionesPorMes(month.start, month.end),
              }))
            ),
            Promise.all(
              sixMonths.map(async (month) => ({
                name: month.label.charAt(0).toUpperCase() + month.label.slice(1),
                value: await contarRevisionesPorMes(month.start, month.end),
              }))
            ),
          ]);

          setCharts({
            revisionesPorMes,
            tendencia,
            activosPorEstado: [
              { name: 'Activo', value: activosActivos, color: CHART_COLORS[0] },
              { name: 'Mantenimiento', value: activosMantenimiento, color: CHART_COLORS[1] },
              { name: 'Traslado', value: activosTraslado, color: CHART_COLORS[2] },
              { name: 'Baja', value: activosBaja, color: CHART_COLORS[3] },
            ].filter((item) => item.value > 0),
            activosPorCategoria: categoryCounts
              .filter((item) => item.value > 0)
              .sort((a, b) => b.value - a.value)
              .slice(0, 6)
              .map((item) => ({
                name: item.name.substring(0, 18),
                value: item.value,
              })),
          });
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setLoading(false);
      }
    }

    void loadDashboardData();
  }, [user, isCustodian, isManager]);

  const formatDate = (date: Date | { seconds: number } | undefined) => {
    if (!date) return '';
    if (typeof date === 'object' && 'seconds' in date) {
      return new Date(date.seconds * 1000).toLocaleDateString('es-CO');
    }
    return new Date(date).toLocaleDateString('es-CO');
  };

  if (loading) {
    return (
      <div className='space-y-8'>
        <div>
          <div className='mb-2 h-8 w-64 animate-pulse rounded bg-muted' />
          <div className='h-4 w-48 animate-pulse rounded bg-muted' />
        </div>
        <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
          {[1, 2, 3, 4].map((item) => (
            <SkeletonCard key={item} />
          ))}
        </div>
      </div>
    );
  }

  const statsData = [
    {
      label: 'Revisiones realizadas',
      value: stats?.totalRevisiones.toString() || '0',
      icon: LucideClipboardCheck,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100',
      trend: '+12%',
    },
    {
      label: 'Pendientes por firmar',
      value: stats?.pendientesFirma.toString() || '0',
      icon: LucideClock,
      color: 'text-amber-600',
      bg: 'bg-amber-100',
      trend: null,
    },
    {
      label: 'Activos en mal estado',
      value: stats?.actasMalEstado.toString() || '0',
      icon: LucideAlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-100',
      trend: null,
    },
    {
      label: 'Actas generadas',
      value: stats?.actasCompletadas.toString() || '0',
      icon: LucideFileText,
      color: 'text-primary',
      bg: 'bg-primary/10',
      trend: '+8%',
    },
  ];

  return (
    <div className='space-y-8'>
      <div className='flex flex-col justify-between gap-4 md:flex-row md:items-center'>
        <div>
          <h2 className='text-2xl font-bold text-foreground'>
            Bienvenido, {user?.usuario?.nombre?.split(' ')[0]}
          </h2>
          <p className='mt-1 text-muted-foreground'>Resumen de actividad - SERVICIUDAD ESP</p>
        </div>
        {isManager ? (
          <Link href='/activos'>
            <Button className='flex items-center gap-2'>
              <LucideTrendingUp size={18} />
              Nueva revisión
            </Button>
          </Link>
        ) : null}
      </div>

      <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4'>
        {statsData.map((stat) => (
          <Card key={stat.label} className='border-border/50 p-6 hover-lift'>
            <div className='flex items-start justify-between'>
              <div className={`rounded-xl p-3 ${stat.bg} ${stat.color}`}>
                <stat.icon size={22} />
              </div>
              {stat.trend ? (
                <Badge variant='success' size='sm'>
                  {stat.trend}
                </Badge>
              ) : null}
            </div>
            <div className='mt-4'>
              <p className='text-3xl font-bold text-foreground'>{stat.value}</p>
              <p className='mt-1 text-sm text-muted-foreground'>{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {!isCustodian && (charts.tendencia.length > 0 || charts.activosPorEstado.length > 0) ? (
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
          <TendenciaChart data={charts.tendencia} title='Tendencia últimos 6 meses' />
          <ActivosPorEstadoChart data={charts.activosPorEstado} />
        </div>
      ) : null}

      {!isCustodian && charts.activosPorCategoria.length > 0 ? (
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
          <CategoriaChart data={charts.activosPorCategoria} title='Activos por clasificación' />
          <RevisionesPorMesChart data={charts.revisionesPorMes} />
        </div>
      ) : null}

      <div className='grid grid-cols-1 gap-8 lg:grid-cols-2'>
        <Card className='border-border/50 p-6 shadow-elegant'>
          <div className='mb-6 flex items-center justify-between'>
            <h3 className='text-lg font-bold text-foreground'>Revisiones recientes</h3>
            <Link href='/revision'>
              <Button variant='ghost' size='sm' className='text-primary'>
                Ver todas
                <LucideArrowRight size={16} className='ml-1' />
              </Button>
            </Link>
          </div>
          <div className='space-y-3'>
            {revisionesRecientes.length > 0 ? (
              revisionesRecientes.map((revision) => (
                <Link href={`/revision/${revision.id}`} key={revision.id}>
                  <div className='cursor-pointer rounded-xl border border-border/50 bg-muted/50 p-4 transition-all duration-200 hover:bg-muted'>
                    <div className='flex items-center justify-between gap-4'>
                      <div>
                        <p className='text-sm font-semibold text-foreground'>{revision.numeroActa || 'Sin número'}</p>
                        <p className='text-xs text-muted-foreground'>
                          {revision.codigoActivo} - {formatDate(revision.fecha)}
                        </p>
                      </div>
                      <Badge variant='completed' size='sm'>
                        Completada
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className='py-12 text-center text-muted-foreground'>
                <LucideFileText className='mx-auto mb-3 opacity-50' size={40} />
                <p>No hay revisiones recientes.</p>
              </div>
            )}
          </div>
        </Card>

        <Card className='border-border/50 p-6 shadow-elegant'>
          <div className='mb-6 flex items-center justify-between'>
            <h3 className='text-lg font-bold text-foreground'>
              {isCustodian ? 'Mis pendientes' : 'Pendientes de firma'}
            </h3>
            <Badge variant='pending' size='sm'>
              {pendientesFirma.length} pendiente{pendientesFirma.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className='space-y-3'>
            {pendientesFirma.length > 0 ? (
              pendientesFirma.map((revision) => (
                <Link href={`/revision/${revision.id}`} key={revision.id}>
                  <div className='cursor-pointer rounded-xl border border-amber-100 bg-amber-50/50 p-4 transition-all duration-200 hover:bg-amber-50'>
                    <div className='flex items-center justify-between gap-4'>
                      <div>
                        <p className='text-sm font-semibold text-foreground'>{revision.codigoActivo}</p>
                        <p className='text-xs text-muted-foreground'>
                          {isCustodian ? 'Pendiente tu firma' : `Firma de ${revision.custodioNombre}`}
                        </p>
                      </div>
                      <Button variant='outline' size='sm' className='border-amber-200 text-amber-700 hover:bg-amber-100'>
                        {isCustodian ? 'Firmar' : 'Ver'}
                      </Button>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className='py-12 text-center text-muted-foreground'>
                <LucideClipboardCheck className='mx-auto mb-3 text-emerald-500' size={40} />
                <p>Todo al día</p>
                <p className='mt-1 text-sm'>No hay pendientes de firma.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className='border-border/50 p-6 shadow-elegant'>
        <div className='mb-6 flex items-center justify-between'>
          <h3 className='text-lg font-bold text-foreground'>
            {isCustodian ? 'Mis asignaciones iniciales' : 'Asignaciones iniciales pendientes'}
          </h3>
          <Badge variant='pending' size='sm'>
            {pendientesAsignacion.length} pendiente{pendientesAsignacion.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <div className='space-y-3'>
          {pendientesAsignacion.length > 0 ? (
            pendientesAsignacion.map((assignment) => (
              <Link href={`/asignaciones/${assignment.id}`} key={assignment.id}>
                <div className='cursor-pointer rounded-xl border border-sky-100 bg-sky-50/50 p-4 transition-all duration-200 hover:bg-sky-50'>
                  <div className='flex items-center justify-between gap-4'>
                    <div>
                      <p className='text-sm font-semibold text-foreground'>{assignment.codigoActivo}</p>
                      <p className='text-xs text-muted-foreground'>
                        {isCustodian
                          ? 'Pendiente tu firma de asignación inicial'
                          : `Entrega inicial para ${assignment.custodioNombre}`}
                      </p>
                    </div>
                    <Button variant='outline' size='sm' className='border-sky-200 text-sky-700 hover:bg-sky-100'>
                      {isCustodian ? 'Firmar' : 'Ver'}
                    </Button>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className='py-12 text-center text-muted-foreground'>
              <LucideClipboardCheck className='mx-auto mb-3 text-sky-500' size={40} />
              <p>Sin asignaciones iniciales pendientes</p>
              <p className='mt-1 text-sm'>No hay actas iniciales esperando firma en este momento.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
