import { NextRequest, NextResponse } from 'next/server';

import { buscarTercerosPorNombre, seleccionarTerceroAutomatico } from '@/lib/actas-formales/tercerosLookup';

export async function GET(request: NextRequest) {
  const nombre = request.nextUrl.searchParams.get('nombre') || '';

  if (nombre.trim().length < 3) {
    return NextResponse.json({ matches: [], selected: null });
  }

  const matches = buscarTercerosPorNombre(nombre, 5);
  const selected = seleccionarTerceroAutomatico(matches);

  return NextResponse.json(
    { matches, selected },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
