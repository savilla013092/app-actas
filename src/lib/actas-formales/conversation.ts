import {
  ActaEntregaDotacionData,
  ActaFormalDraft,
  AsistenteActaFormal,
  CompromisoActaFormal,
} from '@/types/actaFormal';

export type CampoActaFormal =
  | 'fecha'
  | 'hora'
  | 'lugar'
  | 'tipoReunion'
  | 'asistentes'
  | 'objetivo'
  | 'ordenDia'
  | 'desarrollo'
  | 'conclusiones'
  | 'compromisos';

const FIELD_ORDER: CampoActaFormal[] = [
  'fecha',
  'hora',
  'lugar',
  'tipoReunion',
  'asistentes',
  'objetivo',
  'ordenDia',
  'desarrollo',
  'conclusiones',
  'compromisos',
];

export const emptyActaFormalDraft: ActaFormalDraft = {
  tipoFormato: 'general',
  fecha: '',
  hora: '',
  lugar: '',
  tipoReunion: '',
  asistentes: [],
  objetivo: '',
  ordenDia: [],
  desarrollo: [],
  conclusiones: [],
  compromisos: [],
};

export type CampoActaEntregaDotacion =
  | 'fecha'
  | 'receptorNombre'
  | 'receptorDocumento'
  | 'tallaPantalon'
  | 'tallaCamisa'
  | 'tallaBota';

export const emptyActaEntregaDotacionData: ActaEntregaDotacionData = {
  fecha: '',
  receptorNombre: '',
  receptorDocumento: '',
  tallaPantalon: '',
  tallaCamisa: '',
  tallaBota: '',
};

const ENTREGA_FIELD_ORDER: CampoActaEntregaDotacion[] = [
  'fecha',
  'receptorNombre',
  'receptorDocumento',
  'tallaPantalon',
  'tallaCamisa',
  'tallaBota',
];

export const entregaCampoLabels: Record<CampoActaEntregaDotacion, string> = {
  fecha: 'fecha',
  receptorNombre: 'persona que recibe y firma',
  receptorDocumento: 'cedula o documento',
  tallaPantalon: 'talla de pantalon',
  tallaCamisa: 'talla de camisa',
  tallaBota: 'talla de bota',
};

export const entregaCampoPrompts: Record<CampoActaEntregaDotacion, string> = {
  fecha: 'Indique la fecha del acta de entrega.',
  receptorNombre:
    'Indique el nombre completo de la persona que recibe y firma. Buscare la identificacion en terceros automaticamente.',
  receptorDocumento: 'Indique la cedula o documento de la persona que recibe.',
  tallaPantalon: 'Indique la talla del pantalon.',
  tallaCamisa: 'Indique la talla de la camisa.',
  tallaBota: 'Indique la talla de la bota o calzado.',
};

export const campoLabels: Record<CampoActaFormal, string> = {
  fecha: 'fecha',
  hora: 'hora',
  lugar: 'lugar',
  tipoReunion: 'tipo de reunion o comite',
  asistentes: 'asistentes',
  objetivo: 'objetivo',
  ordenDia: 'orden del dia',
  desarrollo: 'desarrollo',
  conclusiones: 'conclusiones',
  compromisos: 'compromisos',
};

export const campoPrompts: Record<CampoActaFormal, string> = {
  fecha: 'Indique la fecha del acta. Puede usar formato 2026-06-30 o escribirla en texto.',
  hora: 'Indique la hora de inicio o rango horario de la reunion.',
  lugar: 'Indique el lugar donde se realiza la reunion o si fue virtual.',
  tipoReunion: 'Que tipo de reunion o comite es?',
  asistentes:
    'Liste los asistentes con nombre y cargo. Ejemplo: Ana Perez - Profesional de Logistica; Carlos Ruiz - Custodio.',
  objetivo: 'Cual fue el objetivo de la reunion?',
  ordenDia: 'Escriba los puntos del orden del dia separados por punto y coma o en lineas.',
  desarrollo: 'Describa los temas tratados. Puede hacerlo en parrafos, lineas o vinetas.',
  conclusiones: 'Indique las conclusiones principales, separadas por lineas o punto y coma.',
  compromisos:
    'Liste compromisos con responsable y fecha limite. Ejemplo: Actualizar inventario | Ana Perez | 2026-07-05.',
};

const makeId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');

const splitItems = (value: string) =>
  value
    .split(/\r?\n|;|•|- /)
    .map((item) => normalize(item.replace(/^\d+[\).\s-]+/, '')))
    .filter(Boolean);

const parsePerson = (value: string): AsistenteActaFormal | null => {
  const cleaned = normalize(value.replace(/^\d+[\).\s-]+/, ''));
  if (!cleaned) return null;

  const [namePart, ...cargoParts] = cleaned.split(/\s[-|:]\s|,\s*cargo\s*:?\s*/i);
  const nombre = normalize(namePart || cleaned);
  const cargo = normalize(cargoParts.join(' - '));

  if (!nombre) return null;

  return {
    id: makeId('asistente'),
    nombre,
    cargo: cargo || 'Sin cargo indicado',
  };
};

const parseAsistentes = (value: string) =>
  splitItems(value)
    .map(parsePerson)
    .filter((item): item is AsistenteActaFormal => Boolean(item));

const parseCompromiso = (value: string): CompromisoActaFormal | null => {
  const cleaned = normalize(value.replace(/^\d+[\).\s-]+/, ''));
  if (!cleaned) return null;

  const parts = cleaned
    .split(/\s\|\s|;\s*responsable\s*:?\s*|;\s*fecha\s*:?\s*/i)
    .map(normalize)
    .filter(Boolean);

  if (parts.length >= 3) {
    return {
      id: makeId('compromiso'),
      descripcion: parts[0],
      responsable: parts[1],
      fechaLimite: parts.slice(2).join(' '),
    };
  }

  const responsableMatch = cleaned.match(/responsable\s*:?\s*([^;|,]+)(?:[;|,]|$)/i);
  const fechaMatch = cleaned.match(/(?:fecha limite|fecha|plazo)\s*:?\s*([^;|,]+)(?:[;|,]|$)/i);
  const descripcion = cleaned.replace(/responsable\s*:?\s*[^;|,]+/i, '').replace(/(?:fecha limite|fecha|plazo)\s*:?\s*[^;|,]+/i, '');

  return {
    id: makeId('compromiso'),
    descripcion: normalize(descripcion.replace(/[;|,]+$/g, '')) || cleaned,
    responsable: normalize(responsableMatch?.[1] || 'Por definir'),
    fechaLimite: normalize(fechaMatch?.[1] || 'Por definir'),
  };
};

const parseCompromisos = (value: string) =>
  value
    .split(/\r?\n/)
    .flatMap((line) => (line.includes('|') ? [line] : line.split(/(?=\d+[\).\s-]+)/)))
    .map(parseCompromiso)
    .filter((item): item is CompromisoActaFormal => Boolean(item));

export function getMissingFields(draft: ActaFormalDraft): CampoActaFormal[] {
  return FIELD_ORDER.filter((field) => {
    const value = draft[field];
    if (Array.isArray(value)) {
      return value.length === 0;
    }

    return !String(value || '').trim();
  });
}

export function getNextPrompt(draft: ActaFormalDraft) {
  const [nextField] = getMissingFields(draft);
  if (!nextField) {
    return 'Ya tengo todos los datos obligatorios. Revise el resumen y confirme para generar el borrador formal.';
  }

  return campoPrompts[nextField];
}

export function applyFieldAnswer(
  draft: ActaFormalDraft,
  field: CampoActaFormal,
  answer: string
): ActaFormalDraft {
  const value = answer.trim();
  if (!value) return draft;

  if (field === 'asistentes') {
    return { ...draft, asistentes: parseAsistentes(value) };
  }

  if (field === 'ordenDia') {
    return { ...draft, ordenDia: splitItems(value) };
  }

  if (field === 'desarrollo') {
    return { ...draft, desarrollo: splitItems(value).length > 1 ? splitItems(value) : [value] };
  }

  if (field === 'conclusiones') {
    return { ...draft, conclusiones: splitItems(value) };
  }

  if (field === 'compromisos') {
    return { ...draft, compromisos: parseCompromisos(value) };
  }

  return { ...draft, [field]: value };
}

const labelPatterns: Array<[CampoActaFormal, RegExp]> = [
  ['fecha', /^fecha\s*:?\s*(.+)$/i],
  ['hora', /^hora\s*:?\s*(.+)$/i],
  ['lugar', /^lugar\s*:?\s*(.+)$/i],
  ['tipoReunion', /^(tipo|tipo de reunion|comite)\s*:?\s*(.+)$/i],
  ['asistentes', /^asistentes?\s*:?\s*(.*)$/i],
  ['objetivo', /^objetivo\s*:?\s*(.*)$/i],
  ['ordenDia', /^(orden del dia|agenda)\s*:?\s*(.*)$/i],
  ['desarrollo', /^(desarrollo|temas tratados)\s*:?\s*(.*)$/i],
  ['conclusiones', /^conclusiones?\s*:?\s*(.*)$/i],
  ['compromisos', /^compromisos?\s*:?\s*(.*)$/i],
];

export function applyBulkAnswer(draft: ActaFormalDraft, answer: string): ActaFormalDraft {
  const lines = answer.split(/\r?\n/);
  const sections = new Map<CampoActaFormal, string[]>();
  let currentField: CampoActaFormal | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const found = labelPatterns.find(([, pattern]) => pattern.test(line));
    if (found) {
      const [field, pattern] = found;
      currentField = field;
      const match = line.match(pattern);
      const captured = field === 'tipoReunion' ? match?.[2] : match?.[1];
      sections.set(field, captured ? [captured] : []);
      continue;
    }

    if (currentField) {
      sections.set(currentField, [...(sections.get(currentField) || []), line]);
    }
  }

  let nextDraft = { ...draft };
  sections.forEach((values, field) => {
    nextDraft = applyFieldAnswer(nextDraft, field, values.join('\n'));
  });

  return nextDraft;
}

export function buildActaTitle(draft: ActaFormalDraft) {
  if (draft.tipoFormato === 'entrega_dotacion') {
    const name = draft.entregaDotacion?.receptorNombre || 'receptor';
    const date = draft.entregaDotacion?.fecha || draft.fecha || new Date().toISOString().slice(0, 10);
    return `Acta de entrega - ${name} - ${date}`;
  }

  const type = draft.tipoReunion?.trim() || 'reunion';
  const date = draft.fecha?.trim() || new Date().toISOString().slice(0, 10);
  return `Acta de ${type} - ${date}`;
}

export function buildDraftSummary(draft: ActaFormalDraft) {
  return [
    `Fecha: ${draft.fecha || 'pendiente'}`,
    `Hora: ${draft.hora || 'pendiente'}`,
    `Lugar: ${draft.lugar || 'pendiente'}`,
    `Tipo: ${draft.tipoReunion || 'pendiente'}`,
    `Asistentes: ${draft.asistentes.length}`,
    `Orden del dia: ${draft.ordenDia.length} punto(s)`,
    `Compromisos: ${draft.compromisos.length}`,
  ].join('\n');
}

export function getMissingEntregaFields(data: ActaEntregaDotacionData): CampoActaEntregaDotacion[] {
  return ENTREGA_FIELD_ORDER.filter((field) => !String(data[field] || '').trim());
}

export function getNextEntregaPrompt(data: ActaEntregaDotacionData) {
  const [nextField] = getMissingEntregaFields(data);
  if (!nextField) {
    return 'Ya tengo los datos del acta de entrega. Puede generar el borrador y enviarlo a firma.';
  }

  return entregaCampoPrompts[nextField];
}

export function applyEntregaFieldAnswer(
  data: ActaEntregaDotacionData,
  field: CampoActaEntregaDotacion,
  answer: string
): ActaEntregaDotacionData {
  const value = answer.trim();
  if (!value) return data;

  return {
    ...data,
    [field]: field === 'receptorNombre' ? value.toUpperCase() : value,
  };
}

export function buildEntregaDraft(data: ActaEntregaDotacionData): ActaFormalDraft {
  return {
    tipoFormato: 'entrega_dotacion',
    fecha: data.fecha,
    hora: 'No aplica',
    lugar: 'Dosquebradas',
    tipoReunion: 'Acta de entrega de dotacion',
    asistentes: [
      {
        id: 'receptor-dotacion',
        nombre: data.receptorNombre.toUpperCase(),
        cargo: 'Recibe dotacion',
      },
    ],
    objetivo: 'Formalizar la entrega de dotacion institucional.',
    ordenDia: ['Entrega de dotacion institucional.'],
    desarrollo: [
      `Se hace entrega de la dotacion al funcionario ${data.receptorNombre.toUpperCase()} identificado con C.C ${data.receptorDocumento}.`,
    ],
    conclusiones: ['La dotacion queda recibida por el funcionario y sujeta a las condiciones del formato oficial.'],
    compromisos: [],
    entregaDotacion: data,
  };
}

export function buildEntregaSummary(data: ActaEntregaDotacionData) {
  return [
    `Fecha: ${data.fecha || 'pendiente'}`,
    `Recibe/Firma: ${data.receptorNombre || 'pendiente'}`,
    `Documento: ${data.receptorDocumento || 'pendiente'}`,
    `Pantalon: ${data.tallaPantalon || 'pendiente'}`,
    `Camisa: ${data.tallaCamisa || 'pendiente'}`,
    `Bota: ${data.tallaBota || 'pendiente'}`,
  ].join('\n');
}
