'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { crearActivo, actualizarActivo } from '@/services/activoService';
import { obtenerTodosLosUsuarios } from '@/services/usuarioService';
import { Activo, EstadoActivoFisico } from '@/types/activo';
import { Usuario } from '@/types/usuario';
import { LucideX } from 'lucide-react';
import { getAssetClassification } from '@/lib/utils/assetClassification';

const activoSchema = z.object({
    codigo: z.string().min(1, 'El codigo es requerido'),
    descripcion: z.string().min(5, 'La descripcion debe tener al menos 5 caracteres'),
    categoria: z.string().min(1, 'La clasificacion es requerida'),
    marca: z.string().optional(),
    modelo: z.string().optional(),
    serial: z.string().optional(),
    ubicacion: z.string().min(1, 'La ubicacion es requerida'),
    dependencia: z.string().min(1, 'La dependencia es requerida'),
    custodioId: z.string().optional(),
    estado: z.enum(['activo', 'baja', 'traslado', 'mantenimiento']),
    valorAdquisicion: z.string().optional(),
    fechaAdquisicion: z.string().optional(),
    observaciones: z.string().optional(),
});

type ActivoFormData = z.infer<typeof activoSchema>;

interface ActivoFormProps {
    activo?: Activo | null;
    onSuccess: (activoId: string) => void;
    onCancel: () => void;
}

const DEPENDENCIAS = [
    'Gerencia General',
    'Direccion Administrativa',
    'Direccion Tecnica',
    'Direccion Comercial',
    'Recursos Humanos',
    'Contabilidad',
    'Logistica',
    'Sistemas',
    'Atencion al Cliente',
    'Operaciones',
];

const toDateInputValue = (value: unknown): string => {
    if (!value) return '';

    let date: Date | null = null;
    if (value instanceof Date) {
        date = value;
    } else if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) date = parsed;
    } else if (
        typeof value === 'object' &&
        value !== null &&
        'toDate' in value &&
        typeof (value as { toDate?: unknown }).toDate === 'function'
    ) {
        const parsed = (value as { toDate: () => Date }).toDate();
        if (!Number.isNaN(parsed.getTime())) date = parsed;
    }

    if (!date || Number.isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
};

export function ActivoForm({ activo, onSuccess, onCancel }: ActivoFormProps) {
    const { user, isAdmin, isLogistica } = useAuth();
    const [loading, setLoading] = useState(false);
    const [custodios, setCustodios] = useState<Usuario[]>([]);
    const [loadingCustodios, setLoadingCustodios] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const isEditing = !!activo;

    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ActivoFormData>({
        resolver: zodResolver(activoSchema),
        defaultValues: activo ? {
            codigo: activo.codigo,
            descripcion: activo.descripcion,
            categoria: getAssetClassification(activo.codigo, activo.categoria).classificationName,
            marca: activo.marca || '',
            modelo: activo.modelo || '',
            serial: activo.serial || '',
            ubicacion: activo.ubicacion,
            dependencia: activo.dependencia,
            custodioId: activo.custodioId,
            estado: activo.estado,
            valorAdquisicion: activo.valorAdquisicion?.toString() || '',
            fechaAdquisicion: toDateInputValue(activo.fechaAdquisicion),
            observaciones: activo.observaciones || '',
        } : {
            estado: 'activo',
            categoria: '',
            dependencia: '',
        },
    });

    const codigoValue = watch('codigo');
    const derivedCategory = useMemo(
        () => getAssetClassification(codigoValue, activo?.categoria).classificationName,
        [codigoValue, activo?.categoria]
    );

    useEffect(() => {
        setValue('categoria', derivedCategory, { shouldValidate: true });
    }, [derivedCategory, setValue]);

    useEffect(() => {
        let cancelled = false;
        const timeoutId = setTimeout(() => {
            if (cancelled) return;
            console.warn('Carga de custodios lenta o bloqueada. Continuando sin custodios.');
            setLoadingCustodios(false);
            setError(prev => prev ?? 'No se pudieron cargar custodios. Puedes crear el activo sin asignar custodio.');
        }, 8000);

        async function loadCustodios() {
            try {
                const usuarios = await obtenerTodosLosUsuarios();
                if (cancelled) return;
                setCustodios(usuarios.filter(u => u.activo));
            } catch (loadError) {
                if (cancelled) return;
                console.error('Error loading custodios:', loadError);
                setCustodios([]);
            } finally {
                if (!cancelled) setLoadingCustodios(false);
                clearTimeout(timeoutId);
            }
        }

        void loadCustodios();

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, []);

    const onSubmit = async (data: ActivoFormData) => {
        setError(null);

        if (!user) {
            setError('Debe iniciar sesion para crear un activo');
            return;
        }

        if (!user.usuario) {
            setError('Su perfil de usuario no esta configurado correctamente. Cierre sesion e inicie de nuevo.');
            return;
        }

        if (!isAdmin() && !isLogistica()) {
            setError('No tiene permisos para crear o editar activos.');
            return;
        }

        setLoading(true);

        try {
            const custodioSeleccionado = data.custodioId ? custodios.find(c => c.id === data.custodioId) : null;

            const activoData = {
                codigo: data.codigo,
                descripcion: data.descripcion,
                categoria: getAssetClassification(data.codigo, data.categoria).classificationName,
                marca: data.marca || undefined,
                modelo: data.modelo || undefined,
                serial: data.serial || undefined,
                ubicacion: data.ubicacion,
                dependencia: data.dependencia,
                custodioId: data.custodioId || '',
                custodioNombre: custodioSeleccionado?.nombre || 'Sin asignar',
                estado: data.estado as EstadoActivoFisico,
                valorAdquisicion: data.valorAdquisicion ? parseFloat(data.valorAdquisicion) : undefined,
                fechaAdquisicion: data.fechaAdquisicion ? new Date(data.fechaAdquisicion) : undefined,
                observaciones: data.observaciones || undefined,
                creadoPor: user.uid,
            };

            if (isEditing && activo) {
                await actualizarActivo(activo.id, activoData);
                onSuccess(activo.id);
            } else {
                const activoId = await crearActivo(activoData);
                onSuccess(activoId);
            }
        } catch (err: unknown) {
            console.error('Error al guardar activo:', err);
            let errorMessage = 'Error desconocido';

            if (err instanceof Error) {
                if (err.message.includes('permission-denied') || err.message.includes('PERMISSION_DENIED')) {
                    errorMessage = 'No tiene permisos para realizar esta accion. Verifique su rol.';
                } else {
                    errorMessage = err.message;
                }
            }

            setError(`Error al guardar el activo: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-foreground">
                    {isEditing ? 'Editar Activo' : 'Nuevo Activo'}
                </h2>
                <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
                    <LucideX size={24} />
                </button>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="codigo">Codigo del Activo *</Label>
                        <Input
                            id="codigo"
                            {...register('codigo')}
                            placeholder="Ej: AF-2420-0001"
                        />
                        {errors.codigo && <p className="text-red-500 text-sm mt-1">{errors.codigo.message}</p>}
                    </div>

                    <div>
                        <Label htmlFor="categoria">Clasificacion *</Label>
                        <Input
                            id="categoria"
                            {...register('categoria')}
                            readOnly
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                            Se calcula automaticamente con los primeros 4 digitos del codigo del activo.
                        </p>
                        {errors.categoria && <p className="text-red-500 text-sm mt-1">{errors.categoria.message}</p>}
                    </div>
                </div>

                <div>
                    <Label htmlFor="descripcion">Descripcion *</Label>
                    <Textarea
                        id="descripcion"
                        {...register('descripcion')}
                        rows={2}
                        placeholder="Descripcion detallada del activo"
                    />
                    {errors.descripcion && <p className="text-red-500 text-sm mt-1">{errors.descripcion.message}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <Label htmlFor="marca">Marca</Label>
                        <Input id="marca" {...register('marca')} placeholder="Ej: Dell" />
                    </div>
                    <div>
                        <Label htmlFor="modelo">Modelo</Label>
                        <Input id="modelo" {...register('modelo')} placeholder="Ej: Optiplex 7090" />
                    </div>
                    <div>
                        <Label htmlFor="serial">Serial</Label>
                        <Input id="serial" {...register('serial')} placeholder="Numero de serie" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="ubicacion">Ubicacion *</Label>
                        <Input id="ubicacion" {...register('ubicacion')} placeholder="Ej: Oficina 201, Piso 2" />
                        {errors.ubicacion && <p className="text-red-500 text-sm mt-1">{errors.ubicacion.message}</p>}
                    </div>

                    <div>
                        <Label htmlFor="dependencia">Dependencia *</Label>
                        <Select id="dependencia" {...register('dependencia')}>
                            <option value="">Seleccione una dependencia</option>
                            {DEPENDENCIAS.map(dep => (
                                <option key={dep} value={dep}>{dep}</option>
                            ))}
                        </Select>
                        {errors.dependencia && <p className="text-red-500 text-sm mt-1">{errors.dependencia.message}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="custodioId">Custodio Responsable (opcional)</Label>
                        <Select id="custodioId" {...register('custodioId')} disabled={loadingCustodios}>
                            <option value="">
                                {loadingCustodios ? 'Cargando custodios...' : 'Seleccione un custodio'}
                            </option>
                            {custodios.map(custodio => (
                                <option key={custodio.id} value={custodio.id}>
                                    {custodio.nombre} - {custodio.cedula}
                                </option>
                            ))}
                        </Select>
                        {errors.custodioId && <p className="text-red-500 text-sm mt-1">{errors.custodioId.message}</p>}
                        {custodios.length === 0 && (
                            <p className="text-orange-500 text-sm mt-1">
                                No hay usuarios registrados. Primero debe crear usuarios en el sistema.
                            </p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="estado">Estado *</Label>
                        <Select id="estado" {...register('estado')}>
                            <option value="activo">Activo</option>
                            <option value="mantenimiento">En Mantenimiento</option>
                            <option value="traslado">En Traslado</option>
                            <option value="baja">Dado de Baja</option>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="valorAdquisicion">Valor de Adquisicion</Label>
                        <Input
                            id="valorAdquisicion"
                            type="number"
                            step="0.01"
                            {...register('valorAdquisicion')}
                            placeholder="0.00"
                        />
                    </div>
                    <div>
                        <Label htmlFor="fechaAdquisicion">Fecha de Adquisicion</Label>
                        <Input id="fechaAdquisicion" type="date" {...register('fechaAdquisicion')} />
                    </div>
                </div>

                <div>
                    <Label htmlFor="observaciones">Observaciones</Label>
                    <Textarea
                        id="observaciones"
                        {...register('observaciones')}
                        rows={2}
                        placeholder="Observaciones adicionales sobre el activo"
                    />
                </div>

                <div className="flex gap-4 pt-4">
                    <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={loading} className="flex-1">
                        {loading ? 'Guardando...' : isEditing ? 'Actualizar Activo' : 'Crear Activo'}
                    </Button>
                </div>
            </form>
        </Card>
    );
}