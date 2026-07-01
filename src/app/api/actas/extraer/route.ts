import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';

import {
  buildEntregaDraft,
  emptyActaFormalDraft,
  getMissingEntregaFields,
  getMissingFields,
} from '@/lib/actas-formales/conversation';
import {
  buscarTercerosPorNombre,
  seleccionarTerceroAutomatico,
} from '@/lib/actas-formales/tercerosLookup';
import { getAdminAuth } from '@/lib/firebase/admin';
import {
  ActaEntregaDotacionData,
  ActaFormalDraft,
  FormatoSolicitadoExtraccion,
} from '@/types/actaFormal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

// Esquema para la salida estructurada de Gemini (responseSchema). El modelo indica
// el tipo y llena solo el subconjunto de campos que aplica (el resto queda vacio).
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    tipoDetectado: { type: Type.STRING, enum: ['general', 'entrega_dotacion'] },
    fecha: { type: Type.STRING },
    hora: { type: Type.STRING },
    lugar: { type: Type.STRING },
    tipoReunion: { type: Type.STRING },
    objetivo: { type: Type.STRING },
    asistentes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          nombre: { type: Type.STRING },
          cargo: { type: Type.STRING },
        },
        required: ['nombre', 'cargo'],
      },
    },
    ordenDia: { type: Type.ARRAY, items: { type: Type.STRING } },
    desarrollo: { type: Type.ARRAY, items: { type: Type.STRING } },
    conclusiones: { type: Type.ARRAY, items: { type: Type.STRING } },
    compromisos: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          descripcion: { type: Type.STRING },
          responsable: { type: Type.STRING },
          fechaLimite: { type: Type.STRING },
        },
        required: ['descripcion', 'responsable', 'fechaLimite'],
      },
    },
    receptorNombre: { type: Type.STRING },
    receptorDocumento: { type: Type.STRING },
    tallaPantalon: { type: Type.STRING },
    tallaCamisa: { type: Type.STRING },
    tallaBota: { type: Type.STRING },
  },
  required: [
    'tipoDetectado',
    'fecha',
    'hora',
    'lugar',
    'tipoReunion',
    'objetivo',
    'asistentes',
    'ordenDia',
    'desarrollo',
    'conclusiones',
    'compromisos',
    'receptorNombre',
    'receptorDocumento',
    'tallaPantalon',
    'tallaCamisa',
    'tallaBota',
  ],
};

const extraccionSchema = z.object({
  tipoDetectado: z.enum(['general', 'entrega_dotacion']),
  fecha: z.string(),
  hora: z.string(),
  lugar: z.string(),
  tipoReunion: z.string(),
  objetivo: z.string(),
  asistentes: z.array(z.object({ nombre: z.string(), cargo: z.string() })),
  ordenDia: z.array(z.string()),
  desarrollo: z.array(z.string()),
  conclusiones: z.array(z.string()),
  compromisos: z.array(
    z.object({ descripcion: z.string(), responsable: z.string(), fechaLimite: z.string() })
  ),
  receptorNombre: z.string(),
  receptorDocumento: z.string(),
  tallaPantalon: z.string(),
  tallaCamisa: z.string(),
  tallaBota: z.string(),
});

type ExtraccionModelo = z.infer<typeof extraccionSchema>;

const buildSystemPrompt = (formato: FormatoSolicitadoExtraccion) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const instruccionTipo =
    formato === 'entrega_dotacion'
      ? 'El usuario esta creando un ACTA DE ENTREGA DE DOTACION: usa tipoDetectado="entrega_dotacion".'
      : formato === 'general'
      ? 'El usuario esta creando un ACTA FORMAL de reunion o comite: usa tipoDetectado="general".'
      : 'Decide tipoDetectado="entrega_dotacion" si la nota describe entrega de dotacion, uniforme o tallas a una persona; en cualquier otro caso usa "general".';

  return [
    'Eres un asistente que estructura actas institucionales de SERVICIUDAD ESP a partir de una nota dictada o escrita en espanol.',
    instruccionTipo,
    `La fecha de hoy es ${hoy}. Si la nota dice "hoy" u omite la fecha, usa esa fecha en formato YYYY-MM-DD.`,
    'Reglas:',
    '- Devuelve SIEMPRE todas las propiedades del esquema. Usa cadena vacia "" o arreglos vacios [] para lo que no aplique o no se mencione.',
    '- Para entrega_dotacion llena fecha, receptorNombre (en MAYUSCULAS), receptorDocumento (solo digitos si se menciona), tallaPantalon, tallaCamisa, tallaBota. Deja vacios los campos de reunion.',
    '- Para general llena fecha, hora, lugar, tipoReunion, objetivo, asistentes (nombre y cargo), ordenDia, desarrollo, conclusiones y compromisos (descripcion, responsable, fechaLimite). Deja vacios receptor y tallas.',
    '- No inventes datos que no esten en la nota. Si el documento de identidad no se menciona, deja receptorDocumento vacio: se buscara automaticamente en el catalogo de terceros.',
  ].join('\n');
};

const toEntregaData = (parsed: ExtraccionModelo): ActaEntregaDotacionData => ({
  fecha: parsed.fecha.trim(),
  receptorNombre: parsed.receptorNombre.trim().toUpperCase(),
  receptorDocumento: parsed.receptorDocumento.trim(),
  tallaPantalon: parsed.tallaPantalon.trim(),
  tallaCamisa: parsed.tallaCamisa.trim(),
  tallaBota: parsed.tallaBota.trim(),
});

const toGeneralDraft = (parsed: ExtraccionModelo): ActaFormalDraft => ({
  ...emptyActaFormalDraft,
  tipoFormato: 'general',
  fecha: parsed.fecha.trim(),
  hora: parsed.hora.trim(),
  lugar: parsed.lugar.trim(),
  tipoReunion: parsed.tipoReunion.trim(),
  objetivo: parsed.objetivo.trim(),
  asistentes: parsed.asistentes
    .filter((a) => a.nombre.trim())
    .map((a, index) => ({
      id: `asistente-ia-${index}-${Date.now()}`,
      nombre: a.nombre.trim(),
      cargo: a.cargo.trim() || 'Sin cargo indicado',
    })),
  ordenDia: parsed.ordenDia.map((item) => item.trim()).filter(Boolean),
  desarrollo: parsed.desarrollo.map((item) => item.trim()).filter(Boolean),
  conclusiones: parsed.conclusiones.map((item) => item.trim()).filter(Boolean),
  compromisos: parsed.compromisos
    .filter((c) => c.descripcion.trim())
    .map((c, index) => ({
      id: `compromiso-ia-${index}-${Date.now()}`,
      descripcion: c.descripcion.trim(),
      responsable: c.responsable.trim() || 'Por definir',
      fechaLimite: c.fechaLimite.trim() || 'Por definir',
    })),
});

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ disponible: false, motivo: 'IA no configurada' });
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    await getAdminAuth().verifyIdToken(token);
  } catch (error) {
    console.error('Token de sesion invalido en /api/actas/extraer.', error);
    return NextResponse.json({ error: 'Sesion invalida' }, { status: 401 });
  }

  let body: { nota?: string; formato?: FormatoSolicitadoExtraccion };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 });
  }

  const nota = (body.nota || '').trim();
  const formato: FormatoSolicitadoExtraccion = body.formato || 'auto';
  if (nota.length < 4) {
    return NextResponse.json({ error: 'La nota es demasiado corta.' }, { status: 400 });
  }

  const modelo = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const ai = new GoogleGenAI({ apiKey });

  let parsed: ExtraccionModelo;
  try {
    const response = await ai.models.generateContent({
      model: modelo,
      contents: nota,
      config: {
        systemInstruction: buildSystemPrompt(formato),
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0,
        maxOutputTokens: 2048,
      },
    });

    const rawText = (response.text || '').trim();
    if (!rawText) {
      return NextResponse.json({
        disponible: true,
        ok: false,
        motivo: 'La IA no devolvio datos.',
      });
    }

    parsed = extraccionSchema.parse(JSON.parse(rawText));
  } catch (error) {
    console.error('No fue posible interpretar la nota con IA.', error);
    return NextResponse.json({
      disponible: true,
      ok: false,
      motivo: 'No fue posible interpretar la nota. Use el modo manual.',
    });
  }

  const tipoDetectado = parsed.tipoDetectado;

  if (tipoDetectado === 'entrega_dotacion') {
    const entregaData = toEntregaData(parsed);
    let terceroSugerido = null;

    if (!entregaData.receptorDocumento && entregaData.receptorNombre.length >= 3) {
      const matches = buscarTercerosPorNombre(entregaData.receptorNombre, 5);
      const seleccionado = seleccionarTerceroAutomatico(matches);
      if (seleccionado) {
        entregaData.receptorNombre = seleccionado.nombre.toUpperCase();
        entregaData.receptorDocumento = seleccionado.documento;
        terceroSugerido = seleccionado;
      } else if (matches.length > 0) {
        terceroSugerido = matches[0];
      }
    }

    const draft = buildEntregaDraft(entregaData);
    return NextResponse.json({
      disponible: true,
      ok: true,
      tipoDetectado,
      draft,
      entregaDotacion: entregaData,
      camposFaltantes: getMissingEntregaFields(entregaData),
      terceroSugerido,
      modelo,
    });
  }

  const draft = toGeneralDraft(parsed);
  return NextResponse.json({
    disponible: true,
    ok: true,
    tipoDetectado,
    draft,
    camposFaltantes: getMissingFields(draft),
    modelo,
  });
}
