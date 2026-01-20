import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Limpiar valores de variables de entorno
const clean = (value: string | undefined): string =>
  value?.trim().replace(/[\r\n]/g, '') || 'NOT SET';

export async function GET() {
  const apiKey = clean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  const authDomain = clean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
  const projectId = clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const storageBucket = clean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
  const messagingSenderId = clean(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID);
  const appId = clean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID);

  const config = {
    hasApiKey: apiKey !== 'NOT SET',
    hasAuthDomain: authDomain !== 'NOT SET',
    hasProjectId: projectId !== 'NOT SET',
    hasStorageBucket: storageBucket !== 'NOT SET',
    hasMessagingSenderId: messagingSenderId !== 'NOT SET',
    hasAppId: appId !== 'NOT SET',
    // Mostrar parcialmente para debug (primeros 8 caracteres)
    apiKeyPreview: apiKey !== 'NOT SET' ? apiKey.substring(0, 8) + '...' : 'NOT SET',
    authDomain: authDomain,
    projectId: projectId,
  };

  const allConfigured = config.hasApiKey &&
                        config.hasAuthDomain &&
                        config.hasProjectId &&
                        config.hasStorageBucket &&
                        config.hasMessagingSenderId &&
                        config.hasAppId;

  return NextResponse.json({
    status: allConfigured ? 'ok' : 'missing_config',
    message: allConfigured
      ? 'Firebase configuration is complete'
      : 'Some Firebase environment variables are missing',
    config,
    timestamp: new Date().toISOString(),
  });
}
