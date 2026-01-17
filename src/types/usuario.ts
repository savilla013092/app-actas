export type RolUsuario = 'admin' | 'logistica' | 'custodio';

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

export interface UsuarioAuth {
    uid: string;
    email: string | null;
    usuario: Usuario | null;
}
