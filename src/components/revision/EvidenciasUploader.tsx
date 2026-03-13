'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { LucideImage, LucideX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

interface EvidenciasUploaderProps {
  evidencias: File[];
  onChange: (files: File[]) => void;
  maxFiles: number;
  accept?: string;
  helperText?: string;
}

function PreviewImage({ file, index }: { file: File; index: number }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!src) {
    return null;
  }

  return (
    <Image
      src={src}
      alt={`Evidencia ${index + 1}`}
      fill
      className='object-cover'
      unoptimized
    />
  );
}

export function EvidenciasUploader({
  evidencias,
  onChange,
  maxFiles,
  accept = 'image/*',
  helperText = 'Formatos permitidos: JPG, PNG, HEIC y HEIF. Las fotos de iPhone se convierten automaticamente a JPG.',
}: EvidenciasUploaderProps) {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) {
      return;
    }

    const newFiles = Array.from(event.target.files);
    if (evidencias.length + newFiles.length > maxFiles) {
      toast({
        title: 'Límite de archivos',
        description: `Solo puede cargar hasta ${maxFiles} archivos.`,
        variant: 'destructive',
      });
      return;
    }

    onChange([...evidencias, ...newFiles]);
  };

  const removeFile = (index: number) => {
    const newFiles = [...evidencias];
    newFiles.splice(index, 1);
    onChange(newFiles);
  };

  return (
    <div className='space-y-4'>
      {helperText ? (
        <p className='text-xs text-muted-foreground'>{helperText}</p>
      ) : null}

      <div className='grid grid-cols-2 gap-4 md:grid-cols-3'>
        {evidencias.map((file, index) => (
          <div
            key={`${file.name}-${index}`}
            className='group relative aspect-square overflow-hidden rounded-lg border border-border'
          >
            <PreviewImage file={file} index={index} />
            <div className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 py-2 text-[11px] text-white'>
              <p className='truncate' title={file.name}>
                {file.name}
              </p>
            </div>
            <button
              type='button'
              onClick={() => removeFile(index)}
              className='absolute right-2 top-2 rounded-full bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100'
            >
              <LucideX size={16} />
            </button>
          </div>
        ))}

        {evidencias.length < maxFiles && (
          <label className='flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border transition-colors hover:bg-muted'>
            <LucideImage size={32} className='mb-2 text-muted-foreground' />
            <span className='text-sm text-muted-foreground'>Subir foto</span>
            <input
              type='file'
              accept={accept}
              className='hidden'
              onChange={handleFileChange}
              multiple
            />
          </label>
        )}
      </div>
    </div>
  );
}
