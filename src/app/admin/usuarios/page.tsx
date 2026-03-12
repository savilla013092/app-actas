'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LucideArrowLeft,
  LucideHome,
  LucidePackage,
  LucidePlus,
  LucideSearch,
  LucideShield,
  LucideTruck,
  LucideUser,
} from 'lucide-react';

import { UsuarioForm } from '@/components/forms/UsuarioForm';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { cambiarEstadoUsuario, obtenerTodosLosUsuarios } from '@/services/usuarioService';
import { Usuario } from '@/types/usuario';

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
      console.error('Error loading users:', error);
      toast({
        title: 'No fue posible cargar usuarios',
        description: 'Revise sus permisos e intente nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsuarios();
  }, []);

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingUsuario(null);
    void loadUsuarios();
  };

  const handleEditUsuario = (usuario: Usuario) => {
    setEditingUsuario(usuario);
    setShowForm(true);
  };

  const handleToggleActivo = async (usuario: Usuario) => {
    setTogglingId(usuario.id);
    try {
      await cambiarEstadoUsuario(usuario.id, !usuario.activo);
      await loadUsuarios();
      toast({
        title: usuario.activo ? 'Usuario desactivado' : 'Usuario activado',
        description: `${usuario.nombre} fue ${usuario.activo ? 'deshabilitado' : 'habilitado'} correctamente.`,
      });
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast({
        title: 'No fue posible cambiar el estado',
        description: 'Revise sus permisos e intente nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const filteredUsuarios = usuarios.filter((usuario) => {
    const normalizedSearch = search.toLowerCase();
    return (
      usuario.nombre.toLowerCase().includes(normalizedSearch) ||
      usuario.email.toLowerCase().includes(normalizedSearch) ||
      usuario.cedula.toLowerCase().includes(normalizedSearch) ||
      usuario.dependencia.toLowerCase().includes(normalizedSearch)
    );
  });

  const getRolIcon = (rol: string) => {
    switch (rol) {
      case 'admin':
        return <LucideShield size={16} className='text-indigo-700' />;
      case 'logistica':
        return <LucideTruck size={16} className='text-sky-700' />;
      case 'custodio':
        return <LucidePackage size={16} className='text-emerald-700' />;
      default:
        return <LucideUser size={16} className='text-muted-foreground' />;
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
      <div className='flex h-64 items-center justify-center'>
        <Spinner size='lg' />
      </div>
    );
  }

  return (
    <div className='space-y-6'>
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

      <div className='flex flex-col justify-between gap-4 md:flex-row md:items-center'>
        <div>
          <h2 className='text-2xl font-bold text-foreground'>Gestión de usuarios</h2>
          <p className='text-muted-foreground'>Administración de usuarios y perfiles operativos.</p>
        </div>
        <Button
          className='flex items-center gap-2'
          onClick={() => {
            setEditingUsuario(null);
            setShowForm(true);
          }}
        >
          <LucidePlus size={18} />
          Nuevo usuario
        </Button>
      </div>

      <div className='flex flex-col gap-4 md:flex-row'>
        <div className='relative flex-1'>
          <LucideSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={18} />
          <Input
            className='pl-10'
            placeholder='Buscar por nombre, correo, cédula o dependencia...'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
        {filteredUsuarios.map((usuario) => (
          <Card key={usuario.id} className='p-6 transition-shadow hover:shadow-md'>
            <div className='mb-4 flex items-start justify-between'>
              <div className='flex items-center gap-2'>
                {getRolIcon(usuario.rol)}
                <span className={`rounded px-2 py-1 text-xs font-bold uppercase tracking-wider ${getRolBadge(usuario.rol)}`}>
                  {usuario.rol}
                </span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  usuario.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {usuario.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <div className='mb-4 flex items-center gap-3'>
              <div className='flex h-12 w-12 items-center justify-center rounded-full bg-muted font-bold text-muted-foreground'>
                {usuario.nombre.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className='font-bold text-foreground'>{usuario.nombre}</h3>
                <p className='text-sm text-muted-foreground'>{usuario.cargo}</p>
              </div>
            </div>

            <div className='mb-6 space-y-2'>
              <div className='flex justify-between text-xs'>
                <span className='text-muted-foreground'>Correo:</span>
                <span className='ml-2 truncate font-medium text-foreground'>{usuario.email}</span>
              </div>
              <div className='flex justify-between text-xs'>
                <span className='text-muted-foreground'>Cédula:</span>
                <span className='font-medium text-foreground'>{usuario.cedula}</span>
              </div>
              <div className='flex justify-between text-xs'>
                <span className='text-muted-foreground'>Dependencia:</span>
                <span className='font-medium text-foreground'>{usuario.dependencia}</span>
              </div>
            </div>

            <div className='flex gap-2'>
              <Button variant='outline' className='flex-1 text-xs' onClick={() => handleEditUsuario(usuario)}>
                Editar
              </Button>
              <Button
                variant='outline'
                className={`flex-1 text-xs ${
                  usuario.activo
                    ? 'border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800'
                    : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800'
                }`}
                onClick={() => void handleToggleActivo(usuario)}
                disabled={togglingId === usuario.id}
              >
                {togglingId === usuario.id ? 'Procesando...' : usuario.activo ? 'Desactivar' : 'Activar'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filteredUsuarios.length === 0 ? (
        <div className='rounded-xl border border-border bg-card py-12 text-center'>
          <LucideUser className='mx-auto mb-4 text-muted-foreground' size={48} />
          <p className='text-muted-foreground'>No se encontraron usuarios que coincidan con la búsqueda.</p>
        </div>
      ) : null}

      {showForm ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
          <div className='w-full max-w-2xl'>
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
      ) : null}
    </div>
  );
}
