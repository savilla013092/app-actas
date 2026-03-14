'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { LucideAlertTriangle, LucideFileText, LucideRefreshCcw } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function RevisionDraftEditError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const revisionId =
    typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : null;
  const detailHref = revisionId ? `/revision/${revisionId}` : '/revision';

  useEffect(() => {
    console.error('Error rendering revision draft editor.', {
      revisionId,
      error,
    });
  }, [error, revisionId]);

  return (
    <div className='mx-auto max-w-3xl space-y-6'>
      <PageHeader
        title='No fue posible abrir el borrador'
        subtitle='La pantalla de edicion encontro un problema del lado del cliente.'
        breadcrumbItems={[
          { label: 'Revisiones', href: '/revision', icon: <LucideFileText size={14} /> },
          { label: 'Editar borrador' },
        ]}
        backHref={detailHref}
      />

      <Card className='space-y-4 border-border/50 p-6 shadow-elegant'>
        <div className='flex items-start gap-3'>
          <LucideAlertTriangle className='mt-0.5 shrink-0 text-amber-600' size={20} />
          <div className='space-y-2'>
            <p className='font-semibold text-foreground'>Se detecto un error al cargar la edicion.</p>
            <p className='text-sm text-muted-foreground'>
              Puede volver al detalle de la revision o reintentar la carga del borrador.
            </p>
          </div>
        </div>

        <div className='flex flex-wrap gap-3'>
          <Button type='button' onClick={reset} leftIcon={<LucideRefreshCcw size={16} />}>
            Reintentar
          </Button>
          <Button asChild type='button' variant='outline'>
            <Link href={detailHref}>Volver al detalle</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
