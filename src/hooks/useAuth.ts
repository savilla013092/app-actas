import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { useAuthStore } from '@/stores/authStore';
import { Usuario, RolUsuario } from '@/types/usuario';

// Asignar rol basado en email (para desarrollo)
function asignarRolPorEmail(email: string): RolUsuario {
    // Emails con acceso admin
    const admins = ['santy0130@gmail.com'];
    if (admins.includes(email.toLowerCase())) return 'admin';

    if (email.includes('admin')) return 'admin';
    if (email.includes('logistica')) return 'logistica';
    return 'custodio';
}

export function useAuth() {
    const { user, loading, setUser, setLoading, isAdmin, isLogistica, isCustodio } = useAuthStore();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Obtener datos del usuario de Firestore
                const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
                let userDoc = await getDoc(userDocRef);

                // Si el usuario no existe en Firestore, crearlo automáticamente
                if (!userDoc.exists() && firebaseUser.email) {
                    try {
                        const nuevoUsuario = {
                            email: firebaseUser.email,
                            nombre: firebaseUser.displayName || firebaseUser.email.split('@')[0],
                            cedula: '',
                            cargo: 'Sin asignar',
                            dependencia: 'Sin asignar',
                            rol: asignarRolPorEmail(firebaseUser.email),
                            activo: true,
                            creadoEn: serverTimestamp(),
                            actualizadoEn: serverTimestamp(),
                            creadoPor: 'auto-registro',
                        };
                        await setDoc(userDocRef, nuevoUsuario);
                        userDoc = await getDoc(userDocRef);
                    } catch (error) {
                        console.error('Error al crear documento de usuario:', error);
                    }
                }

                const usuario = userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } as Usuario : null;

                setUser({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    usuario,
                });
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [setUser, setLoading]);

    return { user, loading, isAdmin, isLogistica, isCustodio };
}
