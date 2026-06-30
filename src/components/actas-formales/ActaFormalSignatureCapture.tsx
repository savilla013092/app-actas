'use client';

import { useRef, useState } from 'react';
import {
  LucideCheck,
  LucideEraser,
  LucideImage,
  LucideKeyboard,
  LucidePenLine,
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { MetodoFirmaActaFormal } from '@/types/actaFormal';

interface ActaFormalSignatureCaptureProps {
  signerName: string;
  signerRole: string;
  onSave: (payload: {
    metodoFirma: MetodoFirmaActaFormal;
    firmaDataUrl?: string;
    claveFirma?: string;
    declaracionAceptada: boolean;
  }) => Promise<void> | void;
  saving?: boolean;
}

const modes: Array<{
  id: MetodoFirmaActaFormal;
  label: string;
  icon: typeof LucidePenLine;
}> = [
  { id: 'firma_touch', label: 'Dibujar', icon: LucidePenLine },
  { id: 'imagen', label: 'Imagen', icon: LucideImage },
  { id: 'clave', label: 'Clave', icon: LucideKeyboard },
];

export function ActaFormalSignatureCapture({
  signerName,
  signerRole,
  onSave,
  saving = false,
}: ActaFormalSignatureCaptureProps) {
  const signatureRef = useRef<SignatureCanvas>(null);
  const [mode, setMode] = useState<MetodoFirmaActaFormal>('firma_touch');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [claveFirma, setClaveFirma] = useState('');
  const [accepted, setAccepted] = useState(false);

  const handleImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Archivo no valido',
        description: 'Seleccione una imagen de firma.',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const clearSignature = () => {
    signatureRef.current?.clear();
    setImageDataUrl('');
    setClaveFirma('');
  };

  const handleSave = async () => {
    if (!accepted) {
      toast({
        title: 'Declaracion pendiente',
        description: 'Debe aceptar la declaracion antes de firmar.',
        variant: 'destructive',
      });
      return;
    }

    if (mode === 'firma_touch') {
      if (signatureRef.current?.isEmpty()) {
        toast({
          title: 'Firma requerida',
          description: 'Dibuje la firma en el recuadro.',
          variant: 'destructive',
        });
        return;
      }

      await onSave({
        metodoFirma: mode,
        firmaDataUrl: signatureRef.current?.getTrimmedCanvas().toDataURL('image/png'),
        declaracionAceptada: accepted,
      });
      return;
    }

    if (mode === 'imagen') {
      if (!imageDataUrl) {
        toast({
          title: 'Imagen requerida',
          description: 'Cargue una imagen de la firma.',
          variant: 'destructive',
        });
        return;
      }

      await onSave({
        metodoFirma: mode,
        firmaDataUrl: imageDataUrl,
        declaracionAceptada: accepted,
      });
      return;
    }

    if (!claveFirma.trim()) {
      toast({
        title: 'Clave requerida',
        description: 'Escriba su nombre completo o clave acordada para firmar.',
        variant: 'destructive',
      });
      return;
    }

    await onSave({
      metodoFirma: mode,
      claveFirma: claveFirma.trim(),
      declaracionAceptada: accepted,
    });
  };

  return (
    <div className='space-y-4 rounded-lg border border-border bg-card p-4 shadow-elegant'>
      <div>
        <p className='text-sm font-semibold text-foreground'>{signerName}</p>
        <p className='text-xs text-muted-foreground'>{signerRole}</p>
      </div>

      <div className='grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted p-1'>
        {modes.map((item) => {
          const Icon = item.icon;
          const active = mode === item.id;
          return (
            <button
              key={item.id}
              type='button'
              onClick={() => setMode(item.id)}
              className={`flex min-h-[42px] items-center justify-center gap-1 rounded-md px-2 text-xs font-semibold transition-colors ${
                active ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:bg-background'
              }`}
            >
              <Icon className='h-4 w-4' />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {mode === 'firma_touch' ? (
        <div className='rounded-lg border-2 border-dashed border-border bg-white'>
          <SignatureCanvas
            ref={signatureRef}
            penColor='black'
            canvasProps={{
              width: 640,
              height: 240,
              className: 'h-[220px] w-full touch-none',
            }}
          />
        </div>
      ) : null}

      {mode === 'imagen' ? (
        <div className='space-y-3'>
          <Input
            type='file'
            accept='image/*'
            onChange={(event) => handleImage(event.target.files?.[0])}
          />
          {imageDataUrl ? (
            <div className='flex h-44 items-center justify-center rounded-lg border border-border bg-white p-3'>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageDataUrl} alt='Firma cargada' className='max-h-full max-w-full object-contain' />
            </div>
          ) : (
            <div className='flex h-44 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground'>
              Sin imagen cargada
            </div>
          )}
        </div>
      ) : null}

      {mode === 'clave' ? (
        <div className='space-y-2'>
          <Input
            value={claveFirma}
            onChange={(event) => setClaveFirma(event.target.value)}
            placeholder='Nombre completo o clave acordada'
          />
          <p className='text-xs text-muted-foreground'>
            Esta opcion registra una firma por aceptacion expresa, asociada al enlace individual.
          </p>
        </div>
      ) : null}

      <label className='flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm'>
        <input
          type='checkbox'
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className='mt-1'
        />
        <span>
          Declaro que revise el contenido del acta y que esta firma corresponde a mi aprobacion como asistente.
        </span>
      </label>

      <div className='grid grid-cols-2 gap-2'>
        <Button type='button' variant='outline' onClick={clearSignature} leftIcon={<LucideEraser size={16} />}>
          Limpiar
        </Button>
        <Button type='button' onClick={handleSave} loading={saving} leftIcon={<LucideCheck size={16} />}>
          Firmar
        </Button>
      </div>
    </div>
  );
}
