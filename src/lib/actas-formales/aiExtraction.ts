import { auth } from '@/lib/firebase/config';
import { FormatoSolicitadoExtraccion, ResultadoExtraccionActa } from '@/types/actaFormal';

/**
 * Envia una nota libre (dictada o escrita) a la ruta de servidor que la
 * interpreta con IA. Si la IA no esta configurada o falla, la respuesta lo
 * indica para que el cliente use el parser determinista como respaldo.
 */
export async function interpretarNotaActa(
  nota: string,
  formato: FormatoSolicitadoExtraccion
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
    body: JSON.stringify({ nota, formato }),
  });

  if (!response.ok) {
    return { disponible: false, motivo: `Error ${response.status}` };
  }

  return (await response.json()) as ResultadoExtraccionActa;
}
