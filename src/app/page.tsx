'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/spinner';

export default function Home() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (user) {
                router.push('/dashboard');
            } else {
                router.push('/auth/login');
            }
        }
    }, [user, loading, router]);

    return (
        <div className="flex h-screen items-center justify-center bg-background">
            <div className="text-center">
                <Spinner size="lg" className="mx-auto mb-4" />
                <h1 className="text-xl font-semibold text-foreground">Cargando Sistema de Actas...</h1>
                <p className="text-muted-foreground">SERVICIUDAD ESP</p>
            </div>
        </div>
    );
}
