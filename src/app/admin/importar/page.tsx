'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { LucideArrowLeft, LucideHome, LucideShieldAlert, LucideUpload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { storage } from '@/lib/firebase/config';
import { callCallable } from '@/services/callableService';

export default function ImportarPage() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLog((current) => [...current, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleImport = async (file: File) => {
    if (!user?.uid) {
      toast({
        title: 'Sesión no disponible',
        description: 'Debe iniciar sesión antes de importar activos.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setLog([]);

    try {
      addLog('Preparando archivo para importación backend...');
      const storagePath = `imports/asset-imports/${user.uid}/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file, {
        contentType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      await getDownloadURL(storageRef);
      addLog('Archivo cargado en Storage. Iniciando importación segura...');

      const result = await callCallable<{ storagePath: string }, { imported: number; skipped: number }>(
        'startAssetImport',
        { storagePath }
      );

      addLog(`Importación finalizada. Importados: ${result.imported}. Omitidos: ${result.skipped}.`);
      toast({
        title: 'Importación completada',
        description: `Se crearon ${result.imported} activos y se omitieron ${result.skipped} filas sin código.`,
      });
    } catch (error) {
      console.error('Error importing assets:', error);
      addLog('La importación falló. Revise permisos, reglas e índices del proyecto.');
      toast({
        title: 'No fue posible importar activos',
        description: 'El proceso backend rechazó la importación o falló al procesar el archivo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleImport(file);
    }
  };

  if (!user) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <Card className='p-6'>
          <p className='text-red-600'>Debe iniciar sesión para acceder a esta página.</p>
        </Card>
      </div>
    );
  }

  if (!isAdmin()) {
    return (
      <div className='mx-auto max-w-3xl space-y-6'>
        <div className='flex items-center gap-4'>
          <Button variant='outline' size='sm' onClick={() => router.back()} className='flex items-center gap-2'>
            <LucideArrowLeft size={16} />
            Atrás
          </Button>
          <Link href='/dashboard'>
            <Button variant='outline' size='sm' className='flex items-center gap-2'>
              <LucideHome size={16} />
              Inicio
            </Button>
          </Link>
        </div>

        <Card className='border-amber-200 bg-amber-50 p-6 text-amber-900'>
          <div className='flex items-start gap-3'>
            <LucideShieldAlert className='mt-0.5 shrink-0' size={20} />
            <div>
              <p className='font-semibold'>Acceso restringido</p>
              <p className='text-sm text-amber-800'>Solo los administradores pueden ejecutar importaciones masivas.</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className='space-y-6 p-6'>
      <div className='mb-2 flex items-center gap-4'>
        <Button variant='outline' size='sm' onClick={() => router.back()} className='flex items-center gap-2'>
          <LucideArrowLeft size={16} />
          Atrás
        </Button>
        <Link href='/dashboard'>
          <Button variant='outline' size='sm' className='flex items-center gap-2'>
            <LucideHome size={16} />
            Inicio
          </Button>
        </Link>
      </div>

      <div>
        <h1 className='text-2xl font-bold text-foreground'>Importar activos</h1>
        <p className='text-muted-foreground'>El archivo se carga y procesa en backend; ya no se escribe desde el navegador.</p>
      </div>

      <Card className='p-6'>
        <div className='space-y-4'>
          <div>
            <label className='mb-2 block text-sm font-medium text-foreground'>Seleccionar archivo Excel</label>
            <input
              type='file'
              accept='.xlsx,.xls'
              onChange={handleFileChange}
              disabled={loading}
              className='block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50'
            />
          </div>

          {loading ? (
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <Spinner size='sm' />
              Procesando archivo en backend...
            </div>
          ) : (
            <div className='rounded-lg border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground'>
              La importación masiva crea activos sin custodio asignado por defecto y registra auditoría del proceso.
            </div>
          )}

          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <LucideUpload size={16} />
            Formatos permitidos: `.xlsx`, `.xls`
          </div>
        </div>
      </Card>

      {log.length > 0 ? (
        <Card className='p-6'>
          <h3 className='mb-4 font-semibold'>Log de importación</h3>
          <div className='max-h-96 overflow-y-auto rounded-lg bg-foreground p-4 font-mono text-sm text-emerald-300'>
            {log.map((line, index) => (
              <div key={`${line}-${index}`}>{line}</div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
