import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Limpiar valores de variables de entorno (eliminar espacios y saltos de línea)
const clean = (value: string | undefined): string | undefined =>
  value?.trim().replace(/[\r\n]/g, '');

const firebaseConfig = {
  apiKey: clean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: clean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: clean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: clean(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: clean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
};

// Verificar configuración en desarrollo
if (typeof window !== 'undefined') {
  const missingVars = [];
  if (!firebaseConfig.apiKey) missingVars.push('NEXT_PUBLIC_FIREBASE_API_KEY');
  if (!firebaseConfig.authDomain) missingVars.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
  if (!firebaseConfig.projectId) missingVars.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');

  if (missingVars.length > 0) {
    console.error('Firebase config missing:', missingVars.join(', '));
  }
}

// Inicializar solo si no existe
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (error) {
  console.error('Error initializing Firebase:', error);
  throw error;
}

export { auth, db, storage };
export default app;
