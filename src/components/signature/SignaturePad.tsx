'use client';

import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
            alert('Por favor, dibuje su firma antes de continuar.');
            return;
        }

        if (!aceptaDeclaracion) {
            alert('Debe aceptar la declaración para continuar.');
            return;
        }

        if (permitirEdicion && (!nombre.trim() || !cedula.trim())) {
            alert('Por favor, complete el nombre y la cédula.');
            return;
        }

        const dataUrl = signatureRef.current?.toDataURL('image/png');
        if (dataUrl) {
            if (permitirEdicion) {
                onSave(dataUrl, { nombre: nombre.trim(), cedula: cedula.trim() });
            } else {
                onSave(dataUrl);
            }
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg mx-auto">
            <h3 className="text-lg font-semibold mb-4">{titulo}</h3>

            {permitirEdicion ? (
                <div className="mb-4 p-3 bg-gray-50 rounded space-y-3">
                    <div>
                        <Label htmlFor="nombre-firmante" className="text-sm font-medium">Nombre del Firmante *</Label>
                        <Input
                            id="nombre-firmante"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Nombre completo"
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <Label htmlFor="cedula-firmante" className="text-sm font-medium">Cédula *</Label>
                        <Input
                            id="cedula-firmante"
                            value={cedula}
                            onChange={(e) => setCedula(e.target.value)}
                            placeholder="Número de cédula"
                            className="mt-1"
                        />
                    </div>
                </div>
            ) : (
                <div className="mb-4 p-3 bg-gray-50 rounded">
                    <p className="text-sm"><strong>Nombre:</strong> {nombreFirmante}</p>
                    <p className="text-sm"><strong>Cédula:</strong> {cedulaFirmante}</p>
                </div>
            )}

            <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Dibuje su firma en el recuadro:</p>
                <div className="border-2 border-gray-300 rounded">
                    <SignatureCanvas
                        ref={signatureRef}
                        penColor="black"
                        canvasProps={{
                            width: 400,
                            height: 200,
                            className: 'signature-canvas w-full h-[200px]',
                        }}
                    />
                </div>
            </div>

            <div className="mb-4">
                <label className="flex items-start gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={aceptaDeclaracion}
                        onChange={(e) => setAceptaDeclaracion(e.target.checked)}
                        className="mt-1"
                    />
                    <span className="text-sm text-gray-700">{declaracion}</span>
                </label>
            </div>

            <div className="flex gap-2">
                <Button variant="outline" onClick={handleClear}>
                    Limpiar
                </Button>
                <Button variant="outline" onClick={onCancel}>
                    Cancelar
                </Button>
                <Button onClick={handleSave} disabled={!aceptaDeclaracion}>
                    Firmar
                </Button>
            </div>
        </div>
    );
}
