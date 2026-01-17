'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LucideImage, LucideX } from 'lucide-react';

interface EvidenciasUploaderProps {
    evidencias: File[];
    onChange: (files: File[]) => void;
    maxFiles: number;
}

export function EvidenciasUploader({ evidencias, onChange, maxFiles }: EvidenciasUploaderProps) {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            if (evidencias.length + newFiles.length > maxFiles) {
                alert(`Máximo ${maxFiles} archivos permitidos`);
                return;
            }
            onChange([...evidencias, ...newFiles]);
        }
    };

    const removeFile = (index: number) => {
        const newFiles = [...evidencias];
        newFiles.splice(index, 1);
        onChange(newFiles);
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {evidencias.map((file, index) => (
                    <div key={index} className="relative aspect-square border rounded-lg overflow-hidden group">
                        <img
                            src={URL.createObjectURL(file)}
                            alt={`Evidencia ${index + 1}`}
                            className="w-full h-full object-cover"
                        />
                        <button
                            onClick={() => removeFile(index)}
                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <LucideX size={16} />
                        </button>
                    </div>
                ))}
                {evidencias.length < maxFiles && (
                    <label className="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
                        <LucideImage size={32} className="text-gray-400 mb-2" />
                        <span className="text-sm text-gray-500">Subir foto</span>
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileChange}
                            multiple
                        />
                    </label>
                )}
            </div>
        </div>
    );
}
