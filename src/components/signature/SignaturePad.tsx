'use client';

import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';

interface SignaturePadProps {
  onSave: (dataUrl: string, datosFirmante?: { nombre: string; cedula: string }) => void;
  onCancel: () => void;
  titulo: string;
  nombreFirmante: string;
  cedulaFirmante: string;
  declaracion: string;
  permitirEdicion?: boolean;
}

export function SignaturePad({
  onSave,
  onCancel,
  titulo,
  nombreFirmante,
  cedulaFirmante,
  declaracion,
  permitirEdicion = false,
}: SignaturePadProps) {
  const signatureRef = useRef<SignatureCanvas>(null);
  const [aceptaDeclaracion, setAceptaDeclaracion] = useState(false);
  const [nombre, setNombre] = useState(nombreFirmante);
  const [cedula, setCedula] = useState(cedulaFirmante);

  const handleClear = () => {
    signatureRef.current?.clear();
  };

  const handleSave = () => {
    if (signatureRef.current?.isEmpty()) {
      toast({
        title: 'Firma requerida',
        description: 'Debe dibujar la firma antes de continuar.',
        variant: 'destructive',
      });
      return;
    }

    if (!aceptaDeclaracion) {
      toast({
        title: 'Declaración pendiente',
        description: 'Debe aceptar la declaración antes de firmar.',
        variant: 'destructive',
      });
      return;
    }

    if (permitirEdicion && (!nombre.trim() || !cedula.trim())) {
      toast({
        title: 'Datos incompletos',
        description: 'Complete el nombre y la cédula del firmante.',
        variant: 'destructive',
      });
      return;
    }

    const dataUrl = signatureRef.current?.toDataURL('image/png');
    if (!dataUrl) {
      return;
    }

    if (permitirEdicion) {
      onSave(dataUrl, { nombre: nombre.trim(), cedula: cedula.trim() });
      return;
    }

    onSave(dataUrl);
  };

  return (
    <div className='mx-auto max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg'>
      <h3 className='mb-4 text-lg font-semibold'>{titulo}</h3>

      {permitirEdicion ? (
        <div className='mb-4 space-y-3 rounded border border-border bg-muted p-3'>
          <div>
            <Label htmlFor='nombre-firmante' className='text-sm font-medium'>
              Nombre del firmante *
            </Label>
            <Input
              id='nombre-firmante'
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder='Nombre completo'
              className='mt-1'
            />
          </div>
          <div>
            <Label htmlFor='cedula-firmante' className='text-sm font-medium'>
              Cédula *
            </Label>
            <Input
              id='cedula-firmante'
              value={cedula}
              onChange={(event) => setCedula(event.target.value)}
              placeholder='Número de cédula'
              className='mt-1'
            />
          </div>
        </div>
      ) : (
        <div className='mb-4 rounded border border-border bg-muted p-3'>
          <p className='text-sm'>
            <strong>Nombre:</strong> {nombreFirmante}
          </p>
          <p className='text-sm'>
            <strong>Cédula:</strong> {cedulaFirmante}
          </p>
        </div>
      )}

      <div className='mb-4'>
        <p className='mb-2 text-sm text-muted-foreground'>Dibuje su firma en el recuadro:</p>
        <div className='rounded border-2 border-border bg-background'>
          <SignatureCanvas
            ref={signatureRef}
            penColor='black'
            canvasProps={{
              width: 400,
              height: 200,
              className: 'signature-canvas h-[200px] w-full',
            }}
          />
        </div>
      </div>

      <div className='mb-4'>
        <label className='flex cursor-pointer items-start gap-2'>
          <input
            type='checkbox'
            checked={aceptaDeclaracion}
            onChange={(event) => setAceptaDeclaracion(event.target.checked)}
            className='mt-1'
          />
          <span className='text-sm text-foreground'>{declaracion}</span>
        </label>
      </div>

      <div className='flex gap-2'>
        <Button variant='outline' onClick={handleClear}>
          Limpiar
        </Button>
        <Button variant='outline' onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={!aceptaDeclaracion}>
          Firmar
        </Button>
      </div>
    </div>
  );
}
