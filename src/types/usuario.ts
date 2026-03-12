export type RolUsuario = 'admin' | 'logistica' | 'custodio';
export type UserAccessStatus = 'ready' | 'no_profile' | 'inactive';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  cedula: string;
  cargo: string;
  dependencia: string;
  telefono?: string;
  rol: RolUsuario;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
  creadoPor: string;
}

export interface UsuarioClaims {
  role?: RolUsuario;
  active?: boolean;
}

export interface UsuarioAuth {
  uid: string;
  email: string | null;
  usuario: Usuario | null;
  claims: UsuarioClaims;
  accessStatus: UserAccessStatus;
}
