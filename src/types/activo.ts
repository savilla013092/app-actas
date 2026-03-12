import { AssetSearchIndex } from '@/lib/utils/assetSearch';

export type EstadoActivoFisico = 'activo' | 'baja' | 'traslado' | 'mantenimiento';

export interface Activo {
  id: string;
  codigo: string;
  descripcion: string;
  categoria: string;
  marca?: string;
  modelo?: string;
  serial?: string;
  ubicacion: string;
  dependencia: string;
  custodioId: string;
  custodioNombre: string;
  estado: EstadoActivoFisico;
  valorAdquisicion?: number;
  fechaAdquisicion?: Date;
  observaciones?: string;
  search?: AssetSearchIndex;
  creadoEn: Date;
  actualizadoEn: Date;
  creadoPor: string;
}
