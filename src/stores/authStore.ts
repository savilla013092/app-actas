import { create } from 'zustand';

import { RolUsuario, UsuarioAuth } from '@/types/usuario';

interface AuthState {
  user: UsuarioAuth | null;
  loading: boolean;
  setUser: (user: UsuarioAuth | null) => void;
  setLoading: (loading: boolean) => void;
  getRole: () => RolUsuario | null;
  hasReadyAccess: () => boolean;
  isAdmin: () => boolean;
  isLogistica: () => boolean;
  isCustodio: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  getRole: () => get().user?.claims.role ?? null,
  hasReadyAccess: () => get().user?.accessStatus === 'ready',
  isAdmin: () => get().hasReadyAccess() && get().getRole() === 'admin',
  isLogistica: () => get().hasReadyAccess() && get().getRole() === 'logistica',
  isCustodio: () => get().hasReadyAccess() && get().getRole() === 'custodio',
}));
