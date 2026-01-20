import { NextResponse } from 'next/server';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await getDocs(collection(db, 'revisiones'));

    const revisiones = snapshot.docs.map(doc => ({
      id: doc.id,
      estado: doc.data().estado,
      numeroActa: doc.data().numeroActa || 'Sin número',
      codigoActivo: doc.data().codigoActivo,
      revisorId: doc.data().revisorId,
      custodioId: doc.data().custodioId,
    }));

    return NextResponse.json({
      total: revisiones.length,
      revisiones: revisiones.sort((a, b) => {
        const numA = a.numeroActa?.replace(/\D/g, '') || '0';
        const numB = b.numeroActa?.replace(/\D/g, '') || '0';
        return parseInt(numB) - parseInt(numA);
      }),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
