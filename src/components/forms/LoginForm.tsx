'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { auth } from '@/lib/firebase/config';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const loginSchema = z.object({
    email: z.string().email('Correo electrónico inválido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [configStatus, setConfigStatus] = useState<'checking' | 'ok' | 'error'>('checking');
    const router = useRouter();

    const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    // Verificar configuración de Firebase al cargar
    useEffect(() => {
        const checkConfig = () => {
            const hasApiKey = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
            const hasAuthDomain = !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
            const hasProjectId = !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

            if (hasApiKey && hasAuthDomain && hasProjectId) {
                setConfigStatus('ok');
            } else {
                setConfigStatus('error');
                console.error('Firebase config missing:', {
                    hasApiKey,
                    hasAuthDomain,
                    hasProjectId
                });
            }
        };
        checkConfig();
    }, []);

    const onSubmit = async (data: LoginFormData) => {
        setError(null);
        setLoading(true);

        try {
            // Verificar que Firebase esté configurado
            if (!auth || !auth.app) {
                throw new Error('Firebase no está configurado correctamente');
            }

            const result = await signInWithEmailAndPassword(auth, data.email, data.password);

            if (result.user) {
                // Esperar a que el store de auth esté listo antes de redirigir
                await new Promise<void>((resolve) => {
                    const checkAuth = () => {
                        const state = useAuthStore.getState();
                        if (!state.loading && state.user) {
                            resolve();
                        } else {
                            setTimeout(checkAuth, 100);
                        }
                    };
                    checkAuth();
                });
                router.push('/dashboard');
            }
        } catch (err: any) {
            console.error('Error de login:', err.code, err.message);

            // Mapeo de errores de Firebase a mensajes amigables
            const errorMessages: Record<string, string> = {
                'auth/invalid-credential': 'Credenciales inválidas. Por favor verifique su correo y contraseña.',
                'auth/wrong-password': 'Contraseña incorrecta.',
                'auth/user-not-found': 'Usuario no encontrado.',
                'auth/invalid-api-key': 'Error de configuración del servidor. Contacte al administrador.',
                'auth/network-request-failed': 'Error de conexión. Verifique su internet.',
                'auth/too-many-requests': 'Demasiados intentos. Intente de nuevo en unos minutos.',
                'auth/user-disabled': 'Esta cuenta ha sido deshabilitada.',
                'auth/operation-not-allowed': 'Operación no permitida. Contacte al administrador.',
                'auth/unauthorized-domain': 'Este dominio no está autorizado. Contacte al administrador.',
            };

            const errorMessage = errorMessages[err.code] || `Error: ${err.message || 'Error desconocido'}`;
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    placeholder="correo@serviciudad.gov.co"
                />
                {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>}
            </div>

            <div>
                <Label htmlFor="password">Contraseña</Label>
                <Input
                    id="password"
                    type="password"
                    {...register('password')}
                    placeholder="••••••••"
                />
                {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>}
            </div>

            {configStatus === 'error' && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
                    <strong>Configuración incompleta:</strong> Las variables de entorno de Firebase no están configuradas.
                    Verifique la configuración en Vercel.
                </div>
            )}

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {error}
                </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Ingresando...' : 'Ingresar'}
            </Button>
        </form>
    );
}
