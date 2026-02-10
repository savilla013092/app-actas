'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { obtenerTodosLosActivos, obtenerActivosPorCustodio } from '@/services/activoService';
import { Activo } from '@/types/activo';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ActivoForm } from '@/components/forms/ActivoForm';
import { LucideSearch, LucidePlus, LucideFilter } from 'lucide-react';
import Link from 'next/link';

export default function ActivosPage() {
    const { user, isCustodio } = useAuth();
    const [activos, setActivos] = useState<Activo[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingActivo, setEditingActivo] = useState<Activo | null>(null);

    const loadActivos = async (isCustodioRole: boolean) => {
        if (!user) return;
        setLoading(true);
        try {
            let items: Activo[];
            if (isCustodioRole) {
                items = await obtenerActivosPorCustodio(user.uid);
            } else {
                items = await obtenerTodosLosActivos();
            }
            setActivos(items);
        } catch (error) {
            console.error('Error loading activos:', error);
        } finally {
            setLoading(false);
        }
    };

    const isCustodioRole = isCustodio();

    useEffect(() => {
        if (!user) return;
        loadActivos(isCustodioRole);
    }, [user?.uid, isCustodioRole]);

    const handleFormSuccess = () => {
        setShowForm(false);
        setEditingActivo(null);
        loadActivos(isCustodioRole);
    };

    const handleEditActivo = (activo: Activo) => {
        setEditingActivo(activo);
        setShowForm(true);
    };

    const filteredActivos = activos.filter(activo =>
        activo.codigo.toLowerCase().includes(search.toLowerCase()) ||
        activo.descripcion.toLowerCase().includes(search.toLowerCase()) ||
        activo.custodioNombre.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Inventario de Activos</h2>
                    <p className="text-muted-foreground">Gestión y consulta de activos fijos institucionales.</p>
                </div>
                {!isCustodio() && (
                    <Button
                        className="flex items-center gap-2"
                        onClick={() => {
                            setEditingActivo(null);
                            setShowForm(true);
                        }}
                    >
                        <LucidePlus size={18} />
                        Nuevo Activo
                    </Button>
                )}
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <LucideSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input
                        className="pl-10"
                        placeholder="Buscar por código, descripción o custodio..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Button variant="outline" className="flex items-center gap-2">
                    <LucideFilter size={18} />
                    Filtros
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredActivos.map((activo) => (
                    <Card key={activo.id} className="p-6 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-xs font-bold text-primary bg-primary/15 ring-1 ring-primary/20 px-2 py-1 rounded uppercase tracking-wider">
                                {activo.categoria}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${activo.estado === 'activo' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                {activo.estado}
                            </span>
                        </div>
                        <h3 className="font-bold text-foreground mb-1">{activo.descripcion}</h3>
                        <p className="text-sm text-muted-foreground mb-4">{activo.codigo}</p>

                        <div className="space-y-2 mb-6">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Ubicación:</span>
                                <span className="text-foreground font-medium">{activo.ubicacion}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Custodio:</span>
                                <span className="text-foreground font-medium">{activo.custodioNombre}</span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Link href={`/activos/${activo.id}`} className="flex-1">
                                <Button variant="outline" className="w-full text-xs">Ver Detalle</Button>
                            </Link>
                            {!isCustodio() && (
                                <Link href={`/revision/nueva/${activo.id}`} className="flex-1">
                                    <Button className="w-full text-xs">Revisar</Button>
                                </Link>
                            )}
                        </div>
                        {!isCustodio() && (
                            <Button
                                variant="outline"
                                className="w-full text-xs mt-2"
                                onClick={() => handleEditActivo(activo)}
                            >
                                Editar
                            </Button>
                        )}
                    </Card>
                ))}
            </div>

            {filteredActivos.length === 0 && (
                <div className="text-center py-12 bg-card rounded-xl border border-border">
                    <p className="text-muted-foreground">No se encontraron activos que coincidan con la búsqueda.</p>
                </div>
            )}

            {/* Modal del Formulario */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-2xl">
                        <ActivoForm
                            activo={editingActivo}
                            onSuccess={handleFormSuccess}
                            onCancel={() => {
                                setShowForm(false);
                                setEditingActivo(null);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
