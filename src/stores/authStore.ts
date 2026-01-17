import { create } from 'zustand';
import { Usuario, UsuarioAuth } from '@/types/usuario';

interface AuthState {
    user: UsuarioAuth | null;
    loading: boolean;
    setUser: (user: UsuarioAuth | null) => void;
    setLoading: (loading: boolean) => void;
    isAdmin: () => boolean;
    isLogistica: () => boolean;
    isCustodio: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    loading: true,
    setUser: (user) => set({ user }),
    setLoading: (loading) => set({ loading }),
    isAdmin: () => get().user?.usuario?.rol === 'admin',
    isLogistica: () => get().user?.usuario?.rol === 'logistica',
    isCustodio: () => get().user?.usuario?.rol === 'custodio',
}));
