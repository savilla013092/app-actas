'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { collection, doc, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { LucideArrowLeft, LucideHome } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { getAssetClassification } from '@/lib/utils/assetClassification';
import { getAssetLocation } from '@/lib/utils/assetLocation';

export default function ImportarPage() {
    const router = useRouter();
    const { user, isAdmin } = useAuth();
    const [loading, setLoading] = useState(false);
    const [log, setLog] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);

    const addLog = (message: string) => {
        setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    };

    const convertirFechaExcel = (fechaExcel: number | string | null): Date | null => {
        if (!fechaExcel || fechaExcel === '30/12/1899') return null;
        if (typeof fechaExcel === 'number') {
            const fecha = new Date((fechaExcel - 25569) * 86400 * 1000);
            return fecha;
        }
        return null;
    };

    const crearUsuariosPorDefecto = async () => {
        addLog('Creando usuarios por defecto...');

        // Usuario Admin vinculado al usuario actual
        if (user) {
            const userRef = doc(db, 'usuarios', user.uid);
            await setDoc(userRef, {
                email: user.email,
                nombre: user.email?.split('@')[0] || 'Administrador',
                cedula: '0000000000',
                cargo: 'Administrador',
                dependencia: 'Sistemas',
                rol: 'admin',
                activo: true,
                creadoEn: serverTimestamp(),
                actualizadoEn: serverTimestamp(),
                creadoPor: 'importacion-inicial',
            }, { merge: true });
            addLog(`ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“ Usuario admin actualizado: ${user.email}`);
        }

        // Usuario custodio por defecto
        const custodioId = 'custodio-sistema';
        const custodioRef = doc(db, 'usuarios', custodioId);
        await setDoc(custodioRef, {
            email: 'custodio@serviciudad.gov.co',
            nombre: 'Custodio General',
            cedula: '2222222222',
            cargo: 'Custodio de Activos',
            dependencia: 'DirecciÃƒÆ’Ã‚Â³n Administrativa',
            rol: 'custodio',
            activo: true,
            creadoEn: serverTimestamp(),
            actualizadoEn: serverTimestamp(),
            creadoPor: 'importacion-inicial',
        }, { merge: true });
        addLog('ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“ Usuario custodio creado');

        // Usuario logÃƒÆ’Ã‚Â­stica
        const logisticaId = 'logistica-sistema';
        const logisticaRef = doc(db, 'usuarios', logisticaId);
        await setDoc(logisticaRef, {
            email: 'logistica@serviciudad.gov.co',
            nombre: 'Profesional LogÃƒÆ’Ã‚Â­stica',
            cedula: '1111111111',
            cargo: 'Profesional LogÃƒÆ’Ã‚Â­stica',
            dependencia: 'LogÃƒÆ’Ã‚Â­stica',
            rol: 'logistica',
            activo: true,
            creadoEn: serverTimestamp(),
            actualizadoEn: serverTimestamp(),
            creadoPor: 'importacion-inicial',
        }, { merge: true });
        addLog('ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“ Usuario logÃƒÆ’Ã‚Â­stica creado');

        return custodioId;
    };

    const importarDesdeArchivo = async (file: File) => {
        setLoading(true);
        setLog([]);
        setProgress(0);

        try {
            addLog('='.repeat(50));
            addLog('IMPORTACIÃƒÆ’Ã¢â‚¬Å“N DE ACTIVOS - SERVICIUDAD ESP');
            addLog('='.repeat(50));

            // Crear usuarios primero
            const custodioId = await crearUsuariosPorDefecto();

            // Leer archivo Excel
            addLog('Leyendo archivo Excel...');
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const datos = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

            const totalFilas = datos.length - 1;
            addLog(`Total de activos a importar: ${totalFilas}`);

            // ÃƒÆ’Ã‚Ândices de columnas
            const COL = {
                CODIGO: 0,
                PLACA: 1,
                DESCRIPCION: 2,
                CLASIFICACION: 3,
                UBICACION: 7,
                SERIAL: 9,
                DESC_TECNICA: 10,
                MARCA: 48,
                MODELO: 50,
                FECHA_ADQ: 63,
                VALOR: 64,
                RETIRADO: 75,
            };

            // Importar en lotes
            const BATCH_SIZE = 400;
            let importados = 0;
            let batch = writeBatch(db);
            let batchCount = 0;

            for (let i = 1; i < datos.length; i++) {
                const fila = datos[i] as (string | number | boolean | null)[];

                if (!fila[COL.CODIGO]) continue;

                let estado: 'activo' | 'baja' | 'traslado' | 'mantenimiento' = 'activo';
                if (fila[COL.RETIRADO] === true) {
                    estado = 'baja';
                }

                const activo: Record<string, unknown> = {
                    codigo: `AF-${String(fila[COL.CODIGO])}`,
                    descripcion: fila[COL.DESCRIPCION] || 'Sin descripciÃƒÆ’Ã‚Â³n',
                    categoria: getAssetClassification(String(fila[COL.CODIGO] || '')).classificationName,
                    ubicacion: getAssetLocation(fila[COL.UBICACION] as string | number | null | undefined).locationName,
                    dependencia: 'DirecciÃƒÆ’Ã‚Â³n Administrativa',
                    custodioId: custodioId,
                    custodioNombre: 'Custodio General',
                    estado: estado,
                    valorAdquisicion: fila[COL.VALOR] || 0,
                    creadoEn: serverTimestamp(),
                    actualizadoEn: serverTimestamp(),
                    creadoPor: user?.uid || 'importacion-excel',
                };

                // Agregar campos opcionales
                if (fila[COL.MARCA]) activo.marca = fila[COL.MARCA];
                if (fila[COL.MODELO]) activo.modelo = fila[COL.MODELO];
                if (fila[COL.SERIAL]) activo.serial = fila[COL.SERIAL];
                if (fila[COL.DESC_TECNICA]) activo.observaciones = fila[COL.DESC_TECNICA];

                const fechaAdq = convertirFechaExcel(fila[COL.FECHA_ADQ] as number);
                if (fechaAdq) activo.fechaAdquisicion = fechaAdq;

                const docRef = doc(collection(db, 'activos'));
                batch.set(docRef, activo);
                batchCount++;
                importados++;

                // Commit batch si llega al lÃƒÆ’Ã‚Â­mite
                if (batchCount >= BATCH_SIZE) {
                    await batch.commit();
                    const porcentaje = Math.round((importados / totalFilas) * 100);
                    setProgress(porcentaje);
                    addLog(`Importados ${importados} activos (${porcentaje}%)...`);
                    batch = writeBatch(db);
                    batchCount = 0;
                }
            }

            // Commit batch final
            if (batchCount > 0) {
                await batch.commit();
            }

            setProgress(100);
            addLog('='.repeat(50));
            addLog('IMPORTACIÃƒÆ’Ã¢â‚¬Å“N COMPLETADA');
            addLog('='.repeat(50));
            addLog(`ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“ Total de activos importados: ${importados}`);

        } catch (error) {
            addLog(`ERROR: ${error instanceof Error ? error.message : 'Error desconocido'}`);
            console.error('Error durante la importaciÃƒÆ’Ã‚Â³n:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            importarDesdeArchivo(file);
        }
    };

    if (!user) {
        return (
            <div className="flex justify-center items-center h-64">
                <Card className="p-6">
                    <p className="text-red-600">Debe iniciar sesiÃƒÆ’Ã‚Â³n para acceder a esta pÃƒÆ’Ã‚Â¡gina.</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center gap-4 mb-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.back()}
                    className="flex items-center gap-2"
                >
                    <LucideArrowLeft size={16} />
                    AtrÃƒÆ’Ã‚Â¡s
                </Button>
                <Link href="/dashboard">
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                        <LucideHome size={16} />
                        Inicio
                    </Button>
                </Link>
            </div>

            <div>
                <h1 className="text-2xl font-bold text-foreground">Importar Activos</h1>
                <p className="text-muted-foreground">Importar activos desde archivo Excel (.xlsx)</p>
            </div>

            <Card className="p-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Seleccionar archivo Excel
                        </label>
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileChange}
                            disabled={loading}
                            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50"
                        />
                    </div>

                    {loading && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Spinner size="sm" />
                                <span>Importando activos...</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2.5">
                                <div
                                    className="bg-primary h-2.5 rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-sm text-muted-foreground">{progress}% completado</p>
                        </div>
                    )}
                </div>
            </Card>

            {log.length > 0 && (
                <Card className="p-6">
                    <h3 className="font-semibold mb-4">Log de ImportaciÃƒÆ’Ã‚Â³n</h3>
                    <div className="bg-foreground text-emerald-300 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
                        {log.map((line, i) => (
                            <div key={i}>{line}</div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}
