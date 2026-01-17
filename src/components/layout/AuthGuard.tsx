'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { RolUsuario } from '@/types/usuario';
import { Spinner } from '@/components/ui/spinner';

interface AuthGuardProps {
    children: React.ReactNode;
    allowedRoles?: RolUsuario[];
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/auth/login');
            } else if (allowedRoles && user.usuario && !allowedRoles.includes(user.usuario.rol)) {
                router.push('/dashboard'); // Redirigir si no tiene permiso
            }
        }
    }, [user, loading, router, allowedRoles]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }

    if (!user) {
        return null;
    }

    if (allowedRoles && user.usuario && !allowedRoles.includes(user.usuario.rol)) {
        return null;
    }

    return <>{children}</>;
}
