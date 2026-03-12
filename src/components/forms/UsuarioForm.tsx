'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LucideX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { crearUsuario, actualizarUsuario } from '@/services/usuarioService';
import { RolUsuario, Usuario } from '@/types/usuario';

const usuarioSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  cedula: z.string().min(5, 'La cédula es requerida'),
  cargo: z.string().min(2, 'El cargo es requerido'),
  dependencia: z.string().min(1, 'La dependencia es requerida'),
  telefono: z.string().optional(),
  rol: z.enum(['admin', 'logistica', 'custodio']),
});

type UsuarioFormData = z.infer<typeof usuarioSchema>;

interface UsuarioFormProps {
  usuario?: Usuario | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const DEPENDENCIAS = [
  'Gerencia General',
  'Direccion Administrativa',
  'Direccion Tecnica',
  'Direccion Comercial',
  'Recursos Humanos',
  'Contabilidad',
  'Logistica',
  'Sistemas',
  'Atencion al Cliente',
  'Operaciones',
];

const CARGOS = [
  'Gerente',
  'Director',
  'Coordinador',
  'Profesional',
  'Tecnico',
  'Auxiliar',
  'Asistente',
  'Analista',
];

export function UsuarioForm({ usuario, onSuccess, onCancel }: UsuarioFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(usuario);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UsuarioFormData>({
    resolver: zodResolver(usuarioSchema),
    defaultValues: usuario
      ? {
          email: usuario.email,
          nombre: usuario.nombre,
          cedula: usuario.cedula,
          cargo: usuario.cargo,
          dependencia: usuario.dependencia,
          telefono: usuario.telefono || '',
          rol: usuario.rol,
        }
      : {
          rol: 'custodio',
          dependencia: '',
        },
  });

  const onSubmit = async (data: UsuarioFormData) => {
    if (!user?.usuario) {
      setError('No se pudo cargar su perfil. Cierre sesión e ingrese nuevamente.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isEditing && usuario) {
        await actualizarUsuario(usuario.id, {
          nombre: data.nombre,
          cedula: data.cedula,
          cargo: data.cargo,
          dependencia: data.dependencia,
          telefono: data.telefono || undefined,
          rol: data.rol as RolUsuario,
        });
      } else {
        if (!data.password) {
          setError('La contraseña es obligatoria para crear un nuevo usuario.');
          setLoading(false);
          return;
        }

        await crearUsuario({
          email: data.email,
          password: data.password,
          nombre: data.nombre,
          cedula: data.cedula,
          cargo: data.cargo,
          dependencia: data.dependencia,
          telefono: data.telefono || undefined,
          rol: data.rol as RolUsuario,
          activo: true,
        });
      }

      onSuccess();
    } catch (err) {
      console.error('Error saving user:', err);
      if (err && typeof err === 'object' && 'code' in err) {
        const firebaseError = err as { code: string };
        if (firebaseError.code === 'functions/already-exists') {
          setError('Ese correo ya está registrado en el sistema.');
        } else if (firebaseError.code === 'functions/permission-denied') {
          setError('No tiene permisos para administrar usuarios.');
        } else {
          setError('No fue posible guardar el usuario.');
        }
      } else {
        setError('No fue posible guardar el usuario.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className='max-h-[90vh] overflow-y-auto p-6'>
      <div className='mb-6 flex items-center justify-between'>
        <h2 className='text-xl font-bold text-foreground'>
          {isEditing ? 'Editar usuario' : 'Nuevo usuario'}
        </h2>
        <button type='button' onClick={onCancel} className='text-muted-foreground hover:text-foreground'>
          <LucideX size={24} />
        </button>
      </div>

      {error ? (
        <div className='mb-4 rounded-lg border border-red-300 bg-red-100 p-3 text-red-700'>{error}</div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div>
            <Label htmlFor='email'>Correo electrónico *</Label>
            <Input {...register('email')} type='email' placeholder='usuario@serviciudad.gov.co' disabled={isEditing} />
            {errors.email ? <p className='mt-1 text-sm text-red-500'>{errors.email.message}</p> : null}
          </div>

          {!isEditing ? (
            <div>
              <Label htmlFor='password'>Contraseña *</Label>
              <Input {...register('password')} type='password' placeholder='Mínimo 6 caracteres' />
              {errors.password ? <p className='mt-1 text-sm text-red-500'>{errors.password.message}</p> : null}
            </div>
          ) : null}
        </div>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div>
            <Label htmlFor='nombre'>Nombre completo *</Label>
            <Input {...register('nombre')} placeholder='Nombre y apellidos' />
            {errors.nombre ? <p className='mt-1 text-sm text-red-500'>{errors.nombre.message}</p> : null}
          </div>

          <div>
            <Label htmlFor='cedula'>Cédula *</Label>
            <Input {...register('cedula')} placeholder='Número de cédula' />
            {errors.cedula ? <p className='mt-1 text-sm text-red-500'>{errors.cedula.message}</p> : null}
          </div>
        </div>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div>
            <Label htmlFor='cargo'>Cargo *</Label>
            <Select {...register('cargo')}>
              <option value=''>Seleccione un cargo</option>
              {CARGOS.map((cargo) => (
                <option key={cargo} value={cargo}>
                  {cargo}
                </option>
              ))}
            </Select>
            {errors.cargo ? <p className='mt-1 text-sm text-red-500'>{errors.cargo.message}</p> : null}
          </div>

          <div>
            <Label htmlFor='dependencia'>Dependencia *</Label>
            <Select {...register('dependencia')}>
              <option value=''>Seleccione una dependencia</option>
              {DEPENDENCIAS.map((dependencia) => (
                <option key={dependencia} value={dependencia}>
                  {dependencia}
                </option>
              ))}
            </Select>
            {errors.dependencia ? <p className='mt-1 text-sm text-red-500'>{errors.dependencia.message}</p> : null}
          </div>
        </div>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div>
            <Label htmlFor='telefono'>Teléfono</Label>
            <Input {...register('telefono')} placeholder='Número de contacto' />
          </div>

          <div>
            <Label htmlFor='rol'>Rol en el sistema *</Label>
            <Select {...register('rol')}>
              <option value='custodio'>Custodio</option>
              <option value='logistica'>Profesional de logística</option>
              <option value='admin'>Administrador</option>
            </Select>
            {errors.rol ? <p className='mt-1 text-sm text-red-500'>{errors.rol.message}</p> : null}
          </div>
        </div>

        <div className='rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700'>
          <strong>Roles disponibles:</strong>
          <ul className='mt-2 list-inside list-disc space-y-1'>
            <li><strong>Custodio:</strong> Consulta sus activos asignados y firma revisiones pendientes.</li>
            <li><strong>Profesional de logística:</strong> Crea revisiones, registra evidencias y firma como revisor.</li>
            <li><strong>Administrador:</strong> Gestiona usuarios, inventario y módulos operativos.</li>
          </ul>
        </div>

        <div className='flex gap-4 pt-4'>
          <Button type='button' variant='outline' onClick={onCancel} className='flex-1'>
            Cancelar
          </Button>
          <Button type='submit' disabled={loading} className='flex-1'>
            {loading ? 'Guardando...' : isEditing ? 'Actualizar usuario' : 'Crear usuario'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
