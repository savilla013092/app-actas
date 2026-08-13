import { auth } from '@/lib/firebase/config';
import {
  ActaEntregaDotacionData,
  ActaFormalDraft,
  FormatoSolicitadoExtraccion,
  ResultadoExtraccionActa,
} from '@/types/actaFormal';

export interface ContextoActaEnProgreso {
  entregaActual?: ActaEntregaDotacionData | null;
  draftActual?: ActaFormalDraft | null;
}

/**
 * Envia una nota libre (dictada o escrita) a la ruta de servidor que la
 * interpreta con IA. Si ya hay un acta en progreso, se envia como contexto para
 * que la nueva nota la complete o corrija (en vez de duplicar la informacion).
 * Si la IA no esta configurada o falla, la respuesta lo indica para que el
 * cliente use el parser determinista como respaldo.
 */
export async function interpretarNotaActa(
  nota: string,
  formato: FormatoSolicitadoExtraccion,
  contexto?: ContextoActaEnProgreso
): Promise<ResultadoExtraccionActa> {
  const usuario = auth.currentUser;
  if (!usuario) {
    return { disponible: false, motivo: 'Sesion no iniciada' };
  }

  const token = await usuario.getIdToken();
  const response = await fetch('/api/actas/extraer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      nota,
      formato,
      entregaActual: contexto?.entregaActual ?? null,
      draftActual: contexto?.draftActual ?? null,
    }),
  });

  if (!response.ok) {
    return { disponible: false, motivo: `Error ${response.status}` };
  }

  return (await response.json()) as ResultadoExtraccionActa;
}
