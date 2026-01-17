'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { EvidenciasUploader } from '@/components/revision/EvidenciasUploader';
import { SignaturePad } from '@/components/signature/SignaturePad';
import { Activo } from '@/types/activo';
import { useAuth } from '@/hooks/useAuth';
import { crearRevision, subirEvidencia, firmarComoRevisor } from '@/services/revisionService';

const revisionSchema = z.object({
    fecha: z.string().min(1, 'La fecha es requerida'),
    estadoActivo: z.enum(['excelente', 'bueno', 'regular', 'malo', 'para_baja']),
    descripcion: z.string().min(10, 'La descripción debe tener al menos 10 caracteres'),
    observaciones: z.string().optional(),
});

type RevisionFormData = z.infer<typeof revisionSchema>;

interface RevisionFormProps {
    activo: Activo;
    custodio: {
        id: string;
        nombre: string;
        cedula: string;
        cargo: string;
    };
    onSuccess: (revisionId: string) => void;
}

export function RevisionForm({ activo, custodio, onSuccess }: RevisionFormProps) {
    const { user } = useAuth();
    const [paso, setPaso] = useState<'formulario' | 'evidencias' | 'firma'>('formulario');
    const [revisionId, setRevisionId] = useState<string | null>(null);
    const [evidencias, setEvidencias] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);

    const { register, handleSubmit, getValues, formState: { errors } } = useForm<RevisionFormData>({
        resolver: zodResolver(revisionSchema),
        defaultValues: {
            fecha: new Date().toISOString().split('T')[0],
            estadoActivo: 'bueno',
        },
    });

    // Paso 1: Guardar datos básicos
    const onSubmitFormulario = async (data: RevisionFormData) => {
        if (!user?.usuario) return;
        setLoading(true);

        try {
            const id = await crearRevision({
                activoId: activo.id,
                codigoActivo: activo.codigo,
                descripcionActivo: activo.descripcion,
                ubicacionActivo: activo.ubicacion,

                custodioId: custodio.id,
                custodioNombre: custodio.nombre,
                custodioCedula: custodio.cedula,
                custodioCargo: custodio.cargo,

                revisorId: user.uid,
                revisorNombre: user.usuario.nombre,
                revisorCedula: user.usuario.cedula,
                revisorCargo: user.usuario.cargo,

                fecha: new Date(data.fecha),
                estadoActivo: data.estadoActivo,
                descripcion: data.descripcion,
                observaciones: data.observaciones,

                estado: 'borrador',
                creadoPor: user.uid,
            });

            setRevisionId(id);
            setPaso('evidencias');
        } catch (error) {
            console.error('Error al crear revisión:', error);
            alert('Error al crear la revisión');
        } finally {
            setLoading(false);
        }
    };

    // Paso 2: Subir evidencias
    const handleSubirEvidencias = async () => {
        if (!revisionId) return;
        setLoading(true);

        try {
            for (let i = 0; i < evidencias.length; i++) {
                await subirEvidencia(
                    revisionId,
                    evidencias[i],
                    `Evidencia ${i + 1}`,
                    `Fotografía de revisión ${i + 1}`
                );
            }
            setPaso('firma');
        } catch (error) {
            console.error('Error al subir evidencias:', error);
            alert('Error al subir las evidencias');
        } finally {
            setLoading(false);
        }
    };

    // Paso 3: Firmar como revisor
    const handleFirmaRevisor = async (firmaDataUrl: string) => {
        if (!revisionId) return;
        setLoading(true);

        try {
            const datosRevision = {
                ...getValues(),
                activo,
                custodio,
                revisor: user?.usuario,
                fecha: new Date().toISOString(),
            };

            await firmarComoRevisor(revisionId, firmaDataUrl, datosRevision);
            onSuccess(revisionId);
        } catch (error) {
            console.error('Error al firmar:', error);
            alert('Error al registrar la firma');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            {/* Indicador de pasos */}
            <div className="flex justify-between mb-8">
                {['Datos', 'Evidencias', 'Firma'].map((label, index) => (
                    <div
                        key={label}
                        className={`flex items-center ${index < ['formulario', 'evidencias', 'firma'].indexOf(paso)
                                ? 'text-green-600'
                                : paso === ['formulario', 'evidencias', 'firma'][index]
                                    ? 'text-blue-600'
                                    : 'text-gray-400'
                            }`}
                    >
                        <span className="w-8 h-8 rounded-full border-2 flex items-center justify-center mr-2">
                            {index + 1}
                        </span>
                        {label}
                    </div>
                ))}
            </div>

            {/* Paso 1: Formulario */}
            {paso === 'formulario' && (
                <form onSubmit={handleSubmit(onSubmitFormulario)} className="space-y-6">
                    <div className="bg-gray-50 p-4 rounded-lg mb-6">
                        <h3 className="font-semibold mb-2">Activo a revisar</h3>
                        <p><strong>Código:</strong> {activo.codigo}</p>
                        <p><strong>Descripción:</strong> {activo.descripcion}</p>
                        <p><strong>Ubicación:</strong> {activo.ubicacion}</p>
                        <p><strong>Custodio:</strong> {custodio.nombre}</p>
                    </div>

                    <div>
                        <Label htmlFor="fecha">Fecha de revisión</Label>
                        <Input type="date" {...register('fecha')} />
                        {errors.fecha && <p className="text-red-500 text-sm">{errors.fecha.message}</p>}
                    </div>

                    <div>
                        <Label htmlFor="estadoActivo">Estado del activo</Label>
                        <Select
                            {...register('estadoActivo')}
                        >
                            <option value="excelente">Excelente</option>
                            <option value="bueno">Bueno</option>
                            <option value="regular">Regular</option>
                            <option value="malo">Malo</option>
                            <option value="para_baja">Para baja</option>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="descripcion">Descripción de la revisión</Label>
                        <Textarea
                            {...register('descripcion')}
                            rows={4}
                            placeholder="Describa detalladamente el estado del activo y los hallazgos de la revisión..."
                        />
                        {errors.descripcion && <p className="text-red-500 text-sm">{errors.descripcion.message}</p>}
                    </div>

                    <div>
                        <Label htmlFor="observaciones">Observaciones adicionales</Label>
                        <Textarea
                            {...register('observaciones')}
                            rows={3}
                            placeholder="Observaciones o recomendaciones..."
                        />
                    </div>

                    <Button type="submit" disabled={loading} className="w-full">
                        {loading ? 'Guardando...' : 'Continuar a Evidencias'}
                    </Button>
                </form>
            )}

            {/* Paso 2: Evidencias */}
            {paso === 'evidencias' && (
                <div className="space-y-6">
                    <h3 className="text-lg font-semibold">Subir evidencias fotográficas</h3>
                    <p className="text-gray-600">
                        Agregue fotografías del activo revisado. Mínimo 1, máximo 5 fotografías.
                    </p>

                    <EvidenciasUploader
                        evidencias={evidencias}
                        onChange={setEvidencias}
                        maxFiles={5}
                    />

                    <div className="flex gap-4">
                        <Button variant="outline" onClick={() => setPaso('formulario')}>
                            Volver
                        </Button>
                        <Button
                            onClick={handleSubirEvidencias}
                            disabled={evidencias.length === 0 || loading}
                            className="flex-1"
                        >
                            {loading ? 'Subiendo...' : 'Continuar a Firma'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Paso 3: Firma */}
            {paso === 'firma' && user?.usuario && (
                <SignaturePad
                    titulo="Firma del Profesional de Logística"
                    nombreFirmante={user.usuario.nombre}
                    cedulaFirmante={user.usuario.cedula}
                    declaracion="Certifico que he realizado la revisión física del activo y que la información registrada corresponde al estado real del mismo al momento de la inspección."
                    onSave={handleFirmaRevisor}
                    onCancel={() => setPaso('evidencias')}
                />
            )}
        </div>
    );
}
