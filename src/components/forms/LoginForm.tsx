'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { auth } from '@/lib/firebase/config';
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
    const router = useRouter();

    const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormData) => {
        setError(null);
        setLoading(true);

        try {
            console.log('Intentando login con:', data.email);
            const result = await signInWithEmailAndPassword(auth, data.email, data.password);
            console.log('Login exitoso:', result.user.uid);
            router.push('/dashboard');
        } catch (err: any) {
            console.error('Error de login:', err.code, err.message);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
                setError('Credenciales inválidas. Por favor verifique su correo y contraseña.');
            } else if (err.code === 'auth/invalid-api-key') {
                setError('Error de configuración. Contacte al administrador.');
            } else if (err.code === 'auth/network-request-failed') {
                setError('Error de conexión. Verifique su internet.');
            } else {
                setError(`Error: ${err.message || 'Error desconocido'}`);
            }
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
