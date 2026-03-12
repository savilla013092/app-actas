import { useEffect } from 'react';
import { getIdTokenResult, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { auth, db } from '@/lib/firebase/config';
import { refreshSessionClaims } from '@/services/sessionService';
import { useAuthStore } from '@/stores/authStore';
import { Usuario, UsuarioAuth, UsuarioClaims } from '@/types/usuario';

const normalizeClaims = (claims: Record<string, unknown>): UsuarioClaims => ({
  role:
    claims.role === 'admin' || claims.role === 'logistica' || claims.role === 'custodio'
      ? claims.role
      : undefined,
  active: claims.active === true,
});

export function useAuth() {
  const {
    user,
    loading,
    setUser,
    setLoading,
    getRole,
    hasReadyAccess,
    isAdmin,
    isLogistica,
    isCustodio,
  } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
        const [userDoc] = await Promise.all([
          getDoc(userDocRef),
          refreshSessionClaims().catch((error) => {
            console.warn('No fue posible refrescar los claims de sesion.', error);
            return null;
          }),
        ]);

        const usuario = userDoc.exists()
          ? ({ id: userDoc.id, ...userDoc.data() } as Usuario)
          : null;

        const tokenResult = await getIdTokenResult(firebaseUser, true);
        const claims = normalizeClaims(tokenResult.claims);

        const accessStatus: UsuarioAuth['accessStatus'] = !usuario
          ? 'no_profile'
          : usuario.activo === false || claims.active === false
          ? 'inactive'
          : claims.role
          ? 'ready'
          : 'inactive';

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          usuario,
          claims,
          accessStatus,
        });
      } catch (error) {
        console.error('Error loading authenticated session:', error);
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          usuario: null,
          claims: {},
          accessStatus: 'inactive',
        });
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setLoading, setUser]);

  return {
    user,
    loading,
    role: getRole(),
    hasReadyAccess: hasReadyAccess(),
    isAdmin,
    isLogistica,
    isCustodio,
  };
}
