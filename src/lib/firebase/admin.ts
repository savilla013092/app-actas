import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const clean = (value: string | undefined) => value?.trim().replace(/[\r\n]/g, '');

const projectId = clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

/**
 * Verificar un ID token no requiere service account: el Admin SDK valida la
 * firma contra las claves publicas de Google usando el projectId para el `aud`.
 * Si se provee FIREBASE_ADMIN_CREDENTIALS (JSON o base64), se usa para habilitar
 * ademas operaciones privilegiadas.
 */
const parseServiceAccount = (): Record<string, string> | null => {
  const raw = clean(process.env.FIREBASE_ADMIN_CREDENTIALS);
  if (!raw) return null;

  try {
    const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (error) {
    console.error('FIREBASE_ADMIN_CREDENTIALS no es un JSON valido.', error);
    return null;
  }
};

const initAdminApp = (): App => {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const serviceAccount = parseServiceAccount();
  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId,
    });
  }

  return initializeApp({ projectId });
};

export const getAdminAuth = () => getAuth(initAdminApp());

export const adminProjectIdConfigured = Boolean(projectId);
