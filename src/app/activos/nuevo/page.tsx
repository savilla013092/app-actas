'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LucideBox, LucideHome, LucideShieldAlert } from 'lucide-react';

import { PageHeader, type ActionButton } from '@/components/layout/PageHeader';
import { ActivoForm } from '@/components/forms/ActivoForm';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/hooks/useAuth';

export default function NuevoActivoPage() {
    const router = useRouter();
    const { user, loading } = useAuth();

    const userRole = user?.usuario?.rol;
    const canManageActivos = userRole === 'admin' || userRole === 'logistica';
    const profileUnavailable = Boolean(user && !user.usuario);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth/login');
        }
    }, [loading, user, router]);

    const headerActions: ActionButton[] = [
        {
            label: 'Menu principal',
            href: '/dashboard',
            icon: <LucideHome size={16} />,
            variant: 'outline',
        },
    ];

    if (loading || !user) {
        return (
            <div className='flex min-h-[50vh] items-center justify-center'>
                <Spinner size='lg' />
            </div>
        );
    }

    if (profileUnavailable) {
        return (
            <div className='mx-auto max-w-4xl space-y-6'>
                <PageHeader
                    title='Nuevo Activo'
                    subtitle='No fue posible validar tu perfil para crear activos.'
                    breadcrumbItems={[
                        { label: 'Activos', href: '/activos', icon: <LucideBox size={14} /> },
                        { label: 'Nuevo activo' },
                    ]}
                    actions={headerActions}
                />

                <Card className='border-amber-200 bg-amber-50 p-6 text-amber-900'>
                    <div className='flex items-start gap-3'>
                        <LucideShieldAlert className='mt-0.5 shrink-0' size={20} />
                        <div className='space-y-3'>
                            <div>
                                <p className='font-semibold'>Perfil no disponible</p>
                                <p className='text-sm text-amber-800'>
                                    Tu cuenta esta autenticada, pero el perfil interno no pudo cargarse. Cierra sesion e ingresa de nuevo antes de crear activos.
                                </p>
                            </div>
                            <div className='flex flex-wrap gap-2'>
                                <Button type='button' variant='outline' onClick={() => router.push('/activos')}>
                                    Volver a activos
                                </Button>
                                <Button type='button' onClick={() => router.push('/dashboard')}>
                                    Ir al menu principal
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    if (!canManageActivos) {
        return (
            <div className='mx-auto max-w-4xl space-y-6'>
                <PageHeader
                    title='Nuevo Activo'
                    subtitle='Solo administracion y logistica pueden registrar activos.'
                    breadcrumbItems={[
                        { label: 'Activos', href: '/activos', icon: <LucideBox size={14} /> },
                        { label: 'Nuevo activo' },
                    ]}
                    actions={headerActions}
                />

                <Card className='border-border/60 p-6'>
                    <div className='space-y-3'>
                        <p className='font-semibold text-foreground'>Acceso restringido</p>
                        <p className='text-sm text-muted-foreground'>
                            No tienes permisos para registrar activos nuevos en el sistema.
                        </p>
                        <Button type='button' variant='outline' onClick={() => router.push('/activos')}>
                            Volver a activos
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className='mx-auto max-w-4xl space-y-6'>
            <PageHeader
                title='Nuevo Activo'
                subtitle='Registra un activo institucional con clasificacion automatica por codigo.'
                breadcrumbItems={[
                    { label: 'Activos', href: '/activos', icon: <LucideBox size={14} /> },
                    { label: 'Nuevo activo' },
                ]}
                actions={headerActions}
            />

            <ActivoForm
                onSuccess={(activoId) => router.push(`/activos/${activoId}`)}
                onCancel={() => router.push('/activos')}
            />
        </div>
    );
}