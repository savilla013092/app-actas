'use client';

import { useState, useEffect } from 'react';
import { obtenerTodosLosUsuarios, actualizarUsuario } from '@/services/usuarioService';
import { Usuario } from '@/types/usuario';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { UsuarioForm } from '@/components/forms/UsuarioForm';
import { LucideSearch, LucidePlus, LucideUser, LucideShield, LucideTruck, LucidePackage, LucideArrowLeft, LucideHome } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function UsuariosPage() {
    const router = useRouter();
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const loadUsuarios = async () => {
        try {
            const items = await obtenerTodosLosUsuarios();
            setUsuarios(items);
        } catch (error) {
            console.error('Error loading usuarios:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsuarios();
    }, []);

    const handleFormSuccess = () => {
        setShowForm(false);
        setEditingUsuario(null);
        loadUsuarios();
    };

    const handleEditUsuario = (usuario: Usuario) => {
        setEditingUsuario(usuario);
        setShowForm(true);
    };

    const handleToggleActivo = async (usuario: Usuario) => {
        setTogglingId(usuario.id);
        try {
            await actualizarUsuario(usuario.id, { activo: !usuario.activo });
            await loadUsuarios();
        } catch (error) {
            console.error('Error toggling user status:', error);
            alert('Error al cambiar el estado del usuario');
        } finally {
            setTogglingId(null);
        }
    };

    const filteredUsuarios = usuarios.filter(usuario =>
        usuario.nombre.toLowerCase().includes(search.toLowerCase()) ||
        usuario.email.toLowerCase().includes(search.toLowerCase()) ||
        usuario.cedula.toLowerCase().includes(search.toLowerCase()) ||
        usuario.dependencia.toLowerCase().includes(search.toLowerCase())
    );

    const getRolIcon = (rol: string) => {
        switch (rol) {
            case 'admin':
                return <LucideShield size={16} className="text-indigo-700" />;
            case 'logistica':
                return <LucideTruck size={16} className="text-sky-700" />;
            case 'custodio':
                return <LucidePackage size={16} className="text-emerald-700" />;
            default:
                return <LucideUser size={16} className="text-muted-foreground" />;
        }
    };

    const getRolBadge = (rol: string) => {
        const styles: Record<string, string> = {
            admin: 'bg-indigo-100 text-indigo-800',
            logistica: 'bg-sky-100 text-sky-800',
            custodio: 'bg-emerald-100 text-emerald-800',
        };
        return styles[rol] || 'bg-muted text-muted-foreground';
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.back()}
                    className="flex items-center gap-2"
                >
                    <LucideArrowLeft size={16} />
                    Atrás
                </Button>
                <Link href="/dashboard">
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                        <LucideHome size={16} />
                        Inicio
                    </Button>
                </Link>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Gestión de Usuarios</h2>
                    <p className="text-muted-foreground">Administración de usuarios del sistema.</p>
                </div>
                <Button
                    className="flex items-center gap-2"
                    onClick={() => {
                        setEditingUsuario(null);
                        setShowForm(true);
                    }}
                >
                    <LucidePlus size={18} />
                    Nuevo Usuario
                </Button>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <LucideSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input
                        className="pl-10"
                        placeholder="Buscar por nombre, email, cédula o dependencia..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredUsuarios.map((usuario) => (
                    <Card key={usuario.id} className="p-6 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                                {getRolIcon(usuario.rol)}
                                <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${getRolBadge(usuario.rol)}`}>
                                    {usuario.rol}
                                </span>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${usuario.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                {usuario.activo ? 'Activo' : 'Inactivo'}
                            </span>
                        </div>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center text-muted-foreground font-bold">
                                {usuario.nombre.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="font-bold text-foreground">{usuario.nombre}</h3>
                                <p className="text-sm text-muted-foreground">{usuario.cargo}</p>
                            </div>
                        </div>

                        <div className="space-y-2 mb-6">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Email:</span>
                                <span className="text-foreground font-medium truncate ml-2">{usuario.email}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Cédula:</span>
                                <span className="text-foreground font-medium">{usuario.cedula}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Dependencia:</span>
                                <span className="text-foreground font-medium">{usuario.dependencia}</span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="flex-1 text-xs"
                                onClick={() => handleEditUsuario(usuario)}
                            >
                                Editar
                            </Button>
                            <Button
                                variant="outline"
                                className={`flex-1 text-xs ${usuario.activo
                                    ? 'text-rose-700 hover:text-rose-800 hover:bg-rose-50 border-rose-200'
                                    : 'text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200'
                                    }`}
                                onClick={() => handleToggleActivo(usuario)}
                                disabled={togglingId === usuario.id}
                            >
                                {togglingId === usuario.id ? 'Procesando...' : usuario.activo ? 'Desactivar' : 'Activar'}
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>

            {filteredUsuarios.length === 0 && (
                <div className="text-center py-12 bg-card rounded-xl border border-border">
                    <LucideUser className="mx-auto text-muted-foreground mb-4" size={48} />
                    <p className="text-muted-foreground">No se encontraron usuarios que coincidan con la búsqueda.</p>
                </div>
            )}

            {/* Modal del Formulario */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-2xl">
                        <UsuarioForm
                            usuario={editingUsuario}
                            onSuccess={handleFormSuccess}
                            onCancel={() => {
                                setShowForm(false);
                                setEditingUsuario(null);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
