import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = {
    hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    hasAuthDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    hasStorageBucket: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    hasMessagingSenderId: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    hasAppId: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    // Mostrar parcialmente para debug (primeros 8 caracteres)
    apiKeyPreview: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.substring(0, 8) + '...' || 'NOT SET',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'NOT SET',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'NOT SET',
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
