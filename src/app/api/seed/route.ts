import { NextRequest, NextResponse } from 'next/server';

const DEMO_SEED_SECRET = process.env.SEED_DEMO_SECRET;

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const providedSecret = request.headers.get('x-seed-secret');
  if (!DEMO_SEED_SECRET || providedSecret !== DEMO_SEED_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(
    {
      ok: false,
      message:
        'La ruta de seed ya no ejecuta escrituras directas. Usa scripts controlados o funciones administrativas.',
    },
    { status: 410 }
  );
}
