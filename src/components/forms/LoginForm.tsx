'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase/config';

const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function sanitizeNextPath(nextPath: string | null): string {
  if (!nextPath || !nextPath.startsWith('/')) {
    return '/dashboard';
  }

  return nextPath;
}

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [configStatus, setConfigStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [sessionRedirect, setSessionRedirect] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: authUser, loading: authLoading } = useAuth();
  const redirectTarget = sanitizeNextPath(searchParams.get('next') ?? sessionRedirect);
  const isRevisionRedirect = redirectTarget.startsWith('/revision/');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    const hasApiKey = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
    const hasAuthDomain = Boolean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
    const hasProjectId = Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

    if (hasApiKey && hasAuthDomain && hasProjectId) {
      setConfigStatus('ok');
      return;
    }

    setConfigStatus('error');
    console.error('Firebase config missing:', { hasApiKey, hasAuthDomain, hasProjectId });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setSessionRedirect(window.sessionStorage.getItem('postLoginRedirect'));
  }, []);

  useEffect(() => {
    if (!authLoading && authUser) {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('postLoginRedirect');
      }

      router.replace(redirectTarget);
    }
  }, [authLoading, authUser, redirectTarget, router]);

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    setLoading(true);

    try {
      if (!auth || !auth.app) {
        throw new Error('Firebase no está configurado correctamente');
      }

      await signInWithEmailAndPassword(auth, data.email, data.password);
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      console.error('Login error:', firebaseError.code, firebaseError.message);

      const errorMessages: Record<string, string> = {
        'auth/invalid-credential': 'Credenciales inválidas. Verifique su correo y contraseña.',
        'auth/wrong-password': 'Contraseña incorrecta.',
        'auth/user-not-found': 'Usuario no encontrado.',
        'auth/invalid-api-key': 'Error de configuración del servidor. Contacte al administrador.',
        'auth/network-request-failed': 'Error de conexión. Verifique su acceso a internet.',
        'auth/too-many-requests': 'Demasiados intentos. Intente nuevamente en unos minutos.',
        'auth/user-disabled': 'Esta cuenta ha sido deshabilitada.',
        'auth/operation-not-allowed': 'Operación no permitida. Contacte al administrador.',
        'auth/unauthorized-domain': 'Este dominio no está autorizado. Contacte al administrador.',
      };

      const errorMessage =
        (firebaseError.code && errorMessages[firebaseError.code]) ||
        firebaseError.message ||
        'Error desconocido al iniciar sesión.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
      <div>
        <Label htmlFor='email'>Correo electrónico</Label>
        <Input id='email' type='email' {...register('email')} placeholder='correo@serviciudad.gov.co' />
        {errors.email ? <p className='mt-1 text-sm text-red-500'>{errors.email.message}</p> : null}
      </div>

      <div>
        <Label htmlFor='password'>Contraseña</Label>
        <Input id='password' type='password' {...register('password')} placeholder='••••••••' />
        {errors.password ? <p className='mt-1 text-sm text-red-500'>{errors.password.message}</p> : null}
      </div>

      {configStatus === 'error' ? (
        <div className='rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800'>
          <strong>Configuración incompleta:</strong> faltan variables de entorno de Firebase. Revise la configuración del entorno activo.
        </div>
      ) : null}

      {isRevisionRedirect ? (
        <div className='rounded border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800'>
          Despues de ingresar, continuara directamente con la revision pendiente de firma.
        </div>
      ) : null}

      {error ? <div className='rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700'>{error}</div> : null}

      <Button type='submit' className='w-full' disabled={loading}>
        {loading ? 'Ingresando...' : 'Ingresar'}
      </Button>
    </form>
  );
}
