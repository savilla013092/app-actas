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
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <div className="text-center">
                <Spinner size="lg" className="mx-auto mb-4" />
                <h1 className="text-xl font-semibold text-gray-700">Cargando Sistema de Actas...</h1>
                <p className="text-gray-500">SERVICIUDAD ESP</p>
            </div>
        </div>
    );
}
