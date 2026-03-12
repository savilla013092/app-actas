'use client';

import { useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { auth } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { RolUsuario } from '@/types/usuario';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: RolUsuario[];
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      router.push('/auth/login');
      return;
    }

    if (
      user.accessStatus === 'ready' &&
      allowedRoles &&
      user.claims.role &&
      !allowedRoles.includes(user.claims.role)
    ) {
      router.push('/dashboard');
    }
  }, [allowedRoles, loading, router, user]);

  if (loading) {
    return (
      <div className='flex h-screen items-center justify-center'>
        <Spinner size='lg' />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (user.accessStatus !== 'ready') {
    const title =
      user.accessStatus === 'no_profile'
        ? 'Acceso pendiente'
        : 'Cuenta suspendida';
    const description =
      user.accessStatus === 'no_profile'
        ? 'Tu cuenta esta autenticada, pero no tiene un perfil operativo asignado. Debes solicitar habilitacion al administrador.'
        : 'Tu perfil existe, pero esta inactivo. Contacta al administrador antes de continuar.';

    return (
      <div className='flex min-h-screen items-center justify-center bg-background p-6'>
        <Card className='w-full max-w-lg space-y-4 p-8'>
          <div className='space-y-2'>
            <h1 className='text-2xl font-semibold text-foreground'>{title}</h1>
            <p className='text-sm text-muted-foreground'>{description}</p>
            <p className='text-xs text-muted-foreground'>
              Cuenta: {user.email ?? 'Sin correo disponible'}
            </p>
          </div>
          <div className='flex flex-wrap gap-3'>
            <Button variant='outline' onClick={() => router.push('/auth/login')}>
              Volver al inicio de sesion
            </Button>
            <Button
              variant='destructive'
              onClick={async () => {
                await signOut(auth);
                router.push('/auth/login');
              }}
            >
              Cerrar sesion
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (allowedRoles && (!user.claims.role || !allowedRoles.includes(user.claims.role))) {
    return null;
  }

  return <>{children}</>;
}
