'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { crearUsuario, actualizarUsuario } from '@/services/usuarioService';
import { Usuario, RolUsuario } from '@/types/usuario';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import app from '@/lib/firebase/config';
import { LucideX } from 'lucide-react';

const usuarioSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
    nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
    cedula: z.string().min(5, 'La cédula es requerida'),
    cargo: z.string().min(2, 'El cargo es requerido'),
    dependencia: z.string().min(1, 'La dependencia es requerida'),
    telefono: z.string().optional(),
    rol: z.enum(['admin', 'logistica', 'custodio']),
});

type UsuarioFormData = z.infer<typeof usuarioSchema>;

interface UsuarioFormProps {
    usuario?: Usuario | null;
    onSuccess: () => void;
    onCancel: () => void;
}

const DEPENDENCIAS = [
    'Gerencia General',
    'Dirección Administrativa',
    'Dirección Técnica',
    'Dirección Comercial',
    'Recursos Humanos',
    'Contabilidad',
    'Logística',
    'Sistemas',
    'Atención al Cliente',
    'Operaciones',
];

const CARGOS = [
    'Gerente',
    'Director',
    'Coordinador',
    'Profesional',
    'Técnico',
    'Auxiliar',
    'Asistente',
    'Analista',
];

export function UsuarioForm({ usuario, onSuccess, onCancel }: UsuarioFormProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isEditing = !!usuario;
    const getSecondaryAuth = () => {
        const existing = getApps().find((firebaseApp) => firebaseApp.name === 'secondary');
        const secondaryApp = existing ?? initializeApp(app.options, 'secondary');
        return getAuth(secondaryApp);
    };

    const { register, handleSubmit, formState: { errors } } = useForm<UsuarioFormData>({
        resolver: zodResolver(usuarioSchema),
        defaultValues: usuario ? {
            email: usuario.email,
            nombre: usuario.nombre,
            cedula: usuario.cedula,
            cargo: usuario.cargo,
            dependencia: usuario.dependencia,
            telefono: usuario.telefono || '',
            rol: usuario.rol,
        } : {
            rol: 'custodio',
            dependencia: '',
        },
    });

    const onSubmit = async (data: UsuarioFormData) => {
        if (!user?.usuario) {
            setError('No se pudo cargar su perfil. Cierre sesion e ingrese nuevamente.');
            return;
        }
        setLoading(true);
        setError(null);

        try {
            if (isEditing && usuario) {
                // Actualizar usuario existente (sin cambiar email ni password en Firebase Auth)
                await actualizarUsuario(usuario.id, {
                    nombre: data.nombre,
                    cedula: data.cedula,
                    cargo: data.cargo,
                    dependencia: data.dependencia,
                    telefono: data.telefono || undefined,
                    rol: data.rol as RolUsuario,
                });
            } else {
                // Crear nuevo usuario en Firebase Auth
                if (!data.password) {
                    setError('La contraseña es requerida para crear un nuevo usuario');
                    setLoading(false);
                    return;
                }

                const secondaryAuth = getSecondaryAuth();
                const userCredential = await createUserWithEmailAndPassword(
                    secondaryAuth,
                    data.email,
                    data.password
                );

                // Crear perfil del usuario en Firestore
                await crearUsuario(userCredential.user.uid, {
                    email: data.email,
                    nombre: data.nombre,
                    cedula: data.cedula,
                    cargo: data.cargo,
                    dependencia: data.dependencia,
                    telefono: data.telefono || undefined,
                    rol: data.rol as RolUsuario,
                    activo: true,
                    creadoPor: user.uid,
                });
                await signOut(secondaryAuth);
            }

            onSuccess();
        } catch (err: unknown) {
            console.error('Error al guardar usuario:', err);
            if (err && typeof err === 'object' && 'code' in err) {
                const firebaseError = err as { code: string };
                if (firebaseError.code === 'auth/email-already-in-use') {
                    setError('Este email ya está registrado');
                } else if (firebaseError.code === 'auth/weak-password') {
                    setError('La contraseña es muy débil');
                } else {
                    setError('Error al crear el usuario');
                }
            } else {
                setError('Error al guardar el usuario');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-foreground">
                    {isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h2>
                <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
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
                        <Label htmlFor="email">Correo Electrónico *</Label>
                        <Input
                            {...register('email')}
                            type="email"
                            placeholder="usuario@serviciudad.gov.co"
                            disabled={isEditing}
                        />
                        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
                    </div>

                    {!isEditing && (
                        <div>
                            <Label htmlFor="password">Contraseña *</Label>
                            <Input
                                {...register('password')}
                                type="password"
                                placeholder="Mínimo 6 caracteres"
                            />
                            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="nombre">Nombre Completo *</Label>
                        <Input
                            {...register('nombre')}
                            placeholder="Nombre y apellidos"
                        />
                        {errors.nombre && <p className="text-red-500 text-sm mt-1">{errors.nombre.message}</p>}
                    </div>

                    <div>
                        <Label htmlFor="cedula">Cédula *</Label>
                        <Input
                            {...register('cedula')}
                            placeholder="Número de cédula"
                        />
                        {errors.cedula && <p className="text-red-500 text-sm mt-1">{errors.cedula.message}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="cargo">Cargo *</Label>
                        <Select {...register('cargo')}>
                            <option value="">Seleccione un cargo</option>
                            {CARGOS.map(cargo => (
                                <option key={cargo} value={cargo}>{cargo}</option>
                            ))}
                        </Select>
                        {errors.cargo && <p className="text-red-500 text-sm mt-1">{errors.cargo.message}</p>}
                    </div>

                    <div>
                        <Label htmlFor="dependencia">Dependencia *</Label>
                        <Select {...register('dependencia')}>
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
                        <Label htmlFor="telefono">Teléfono</Label>
                        <Input
                            {...register('telefono')}
                            placeholder="Número de contacto"
                        />
                    </div>

                    <div>
                        <Label htmlFor="rol">Rol en el Sistema *</Label>
                        <Select {...register('rol')}>
                            <option value="custodio">Custodio</option>
                            <option value="logistica">Profesional de Logística</option>
                            <option value="admin">Administrador</option>
                        </Select>
                        {errors.rol && <p className="text-red-500 text-sm mt-1">{errors.rol.message}</p>}
                    </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm text-blue-700">
                    <strong>Nota sobre roles:</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                        <li><strong>Custodio:</strong> Puede ver sus activos asignados y firmar actas de revisión.</li>
                        <li><strong>Profesional de Logística:</strong> Puede crear revisiones y firmar como revisor.</li>
                        <li><strong>Administrador:</strong> Acceso completo al sistema.</li>
                    </ul>
                </div>

                <div className="flex gap-4 pt-4">
                    <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={loading} className="flex-1">
                        {loading ? 'Guardando...' : isEditing ? 'Actualizar Usuario' : 'Crear Usuario'}
                    </Button>
                </div>
            </form>
        </Card>
    );
}
