'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LucideCheckCircle2,
  LucideCopy,
  LucideDownload,
  LucideFileText,
  LucideLink,
  LucideMic,
  LucideMicOff,
  LucidePlus,
  LucideSend,
  LucideSparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import {
  applyBulkAnswer,
  applyEntregaFieldAnswer,
  applyFieldAnswer,
  buildActaTitle,
  buildDraftSummary,
  buildEntregaDraft,
  buildEntregaSummary,
  campoLabels,
  emptyActaFormalDraft,
  emptyActaEntregaDotacionData,
  entregaCampoLabels,
  getMissingFields,
  getMissingEntregaFields,
  getNextPrompt,
  getNextEntregaPrompt,
} from '@/lib/actas-formales/conversation';
import {
  generarActaEntregaDotacionDocx,
  generarActaEntregaDotacionPdf,
  generarActaFormalDocx,
  generarActaFormalPdf,
} from '@/lib/actas-formales/documentGenerator';
import {
  construirEnlaceFirma,
  escucharFirmantesActaFormal,
  escucharMisActasFormales,
  guardarBorradorActaFormal,
  marcarActaFormalCerrada,
  publicarActaFormalParaFirmas,
} from '@/services/actaFormalService';
import {
  ActaEntregaDotacionData,
  ActaFormal,
  ActaFormalDraft,
  FirmanteActaFormal,
  MensajeAsistenteActaFormal,
  TipoActaFormal,
} from '@/types/actaFormal';

type CaptureMode = 'paso' | 'bloque';

type TerceroApiMatch = {
  nombre: string;
  documento: string;
  dv?: string;
  score: number;
};

type TercerosLookupResponse = {
  matches: TerceroApiMatch[];
  selected: TerceroApiMatch | null;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const createMessage = (autor: MensajeAsistenteActaFormal['autor'], texto: string): MensajeAsistenteActaFormal => ({
  id: `${autor}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  autor,
  texto,
  creadoEn: new Date(),
});

const initialMessages = [
  createMessage(
    'agente',
    'Estoy listo para construir el acta formal. Puede responder paso a paso o pegar todos los datos en bloque.'
  ),
  createMessage('agente', getNextPrompt(emptyActaFormalDraft)),
];

const initialEntregaMessages = [
  createMessage(
    'agente',
    'Acta de entrega seleccionada. Este formato es fijo; solo actualizare fecha, persona que recibe/firma y tallas.'
  ),
  createMessage('agente', getNextEntregaPrompt(emptyActaEntregaDotacionData)),
];

const cloneDraft = (acta: ActaFormal): ActaFormalDraft => ({
  tipoFormato: acta.tipoFormato || 'general',
  fecha: acta.fecha,
  hora: acta.hora,
  lugar: acta.lugar,
  tipoReunion: acta.tipoReunion,
  asistentes: acta.asistentes,
  objetivo: acta.objetivo,
  ordenDia: acta.ordenDia,
  desarrollo: acta.desarrollo,
  conclusiones: acta.conclusiones,
  compromisos: acta.compromisos,
  entregaDotacion: acta.entregaDotacion,
});

const estadoBadge = (estado: ActaFormal['estado']) => {
  if (estado === 'cerrada') return <Badge variant='success'>Cerrada</Badge>;
  if (estado === 'pendiente_firmas') return <Badge variant='pending'>Pendiente firmas</Badge>;
  if (estado === 'anulada') return <Badge variant='destructive'>Anulada</Badge>;
  return <Badge variant='info'>Borrador</Badge>;
};

export default function AgenteActasPage() {
  const { user } = useAuth();
  const [formato, setFormato] = useState<TipoActaFormal>('general');
  const [mode, setMode] = useState<CaptureMode>('paso');
  const [draft, setDraft] = useState<ActaFormalDraft>(emptyActaFormalDraft);
  const [entregaData, setEntregaData] = useState<ActaEntregaDotacionData>(emptyActaEntregaDotacionData);
  const [messages, setMessages] = useState<MensajeAsistenteActaFormal[]>(initialMessages);
  const [input, setInput] = useState('');
  const [actas, setActas] = useState<ActaFormal[]>([]);
  const [selectedActa, setSelectedActa] = useState<ActaFormal | null>(null);
  const [savedActaId, setSavedActaId] = useState<string | null>(null);
  const [firmantes, setFirmantes] = useState<FirmanteActaFormal[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [downloading, setDownloading] = useState<'docx' | 'pdf' | null>(null);
  const [listening, setListening] = useState(false);
  const [lookingTercero, setLookingTercero] = useState(false);
  const [closingActa, setClosingActa] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const missingFields = useMemo(() => getMissingFields(draft), [draft]);
  const entregaMissingFields = useMemo(() => getMissingEntregaFields(entregaData), [entregaData]);
  const isEntrega = formato === 'entrega_dotacion';
  const activeDraft = useMemo(
    () => (isEntrega ? buildEntregaDraft(entregaData) : draft),
    [draft, entregaData, isEntrega]
  );
  const activeMissingCount = isEntrega ? entregaMissingFields.length : missingFields.length;
  const nextField = missingFields[0];
  const nextEntregaField = entregaMissingFields[0];
  const canGenerate = activeMissingCount === 0;
  const signedCount = firmantes.filter((firmante) => firmante.estado === 'firmada').length;
  const expectedSigners = selectedActa?.asistentes.length || activeDraft.asistentes.length;
  const allSigned = expectedSigners > 0 && signedCount === expectedSigners;

  const actor = useMemo(
    () =>
      user
        ? {
            uid: user.uid,
            email: user.email,
            nombre: user.usuario?.nombre || user.email || 'Usuario SERVICIUDAD',
          }
        : null,
    [user]
  );

  useEffect(() => {
    if (!user?.uid) return undefined;

    return escucharMisActasFormales(
      user.uid,
      setActas,
      (error) => console.error('No fue posible escuchar actas formales.', error)
    );
  }, [user?.uid]);

  useEffect(() => {
    if (!selectedActa?.id) {
      setFirmantes([]);
      return undefined;
    }

    return escucharFirmantesActaFormal(
      selectedActa.id,
      setFirmantes,
      (error) => console.error('No fue posible escuchar firmantes.', error)
    );
  }, [selectedActa?.id]);

  useEffect(() => {
    if (!selectedActa || selectedActa.estado !== 'pendiente_firmas' || !allSigned || closingActa) {
      return;
    }

    setClosingActa(true);
    marcarActaFormalCerrada(selectedActa.id)
      .then(() => {
        setSelectedActa((current) => (current ? { ...current, estado: 'cerrada', cerradoEn: new Date() } : current));
        toast({
          title: 'Acta cerrada',
          description: 'Todos los asistentes registrados ya firmaron.',
        });
      })
      .catch((error) => {
        console.error('No fue posible cerrar el acta formal.', error);
      })
      .finally(() => setClosingActa(false));
  }, [allSigned, closingActa, selectedActa]);

  const appendAgentPrompt = (nextDraft: ActaFormalDraft) => {
    const missing = getMissingFields(nextDraft);
    if (missing.length === 0) {
      setMessages((current) => [
        ...current,
        createMessage('agente', `Datos completos. Resumen:\n${buildDraftSummary(nextDraft)}`),
        createMessage('agente', 'Confirme con el boton de generar borrador para dejar el acta lista para firmas.'),
      ]);
      return;
    }

    setMessages((current) => [
      ...current,
      createMessage('agente', `Falta ${campoLabels[missing[0]]}. ${getNextPrompt(nextDraft)}`),
    ]);
  };

  const buildEntregaPromptMessages = (nextData: ActaEntregaDotacionData) => {
    const missing = getMissingEntregaFields(nextData);
    if (missing.length === 0) {
      return [
        createMessage('agente', `Datos completos para acta de entrega:\n${buildEntregaSummary(nextData)}`),
        createMessage('agente', 'Genere el borrador para dejar el documento listo y enviarlo a firma desde celular.'),
      ];
    }

    return [
      createMessage('agente', `Falta ${entregaCampoLabels[missing[0]]}. ${getNextEntregaPrompt(nextData)}`),
    ];
  };

  const appendEntregaAgentPrompt = (
    nextData: ActaEntregaDotacionData,
    previousMessages: MensajeAsistenteActaFormal[] = []
  ) => {
    setMessages((current) => [...current, ...previousMessages, ...buildEntregaPromptMessages(nextData)]);
  };

  const lookupTerceroByName = async (nombre: string): Promise<TercerosLookupResponse> => {
    const response = await fetch(`/api/terceros?nombre=${encodeURIComponent(nombre)}`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error('No fue posible consultar terceros.');
    }

    return response.json();
  };

  const handleSend = async () => {
    const answer = input.trim();
    if (!answer) return;

    setMessages((current) => [...current, createMessage('usuario', answer)]);
    setInput('');

    if (isEntrega) {
      let nextData = nextEntregaField
        ? applyEntregaFieldAnswer(entregaData, nextEntregaField, answer)
        : entregaData;
      const lookupMessages: MensajeAsistenteActaFormal[] = [];

      if (nextEntregaField === 'receptorNombre') {
        setLookingTercero(true);
        try {
          const result = await lookupTerceroByName(answer);

          if (result.selected) {
            nextData = {
              ...nextData,
              receptorNombre: result.selected.nombre.toUpperCase(),
              receptorDocumento: result.selected.documento,
            };
            lookupMessages.push(
              createMessage(
                'agente',
                `Identificacion encontrada en terceros: ${result.selected.documento} para ${result.selected.nombre}.`
              )
            );
          } else if (result.matches.length > 0) {
            const options = result.matches
              .slice(0, 3)
              .map((match) => `- ${match.nombre} (${match.documento})`)
              .join('\n');
            lookupMessages.push(
              createMessage(
                'agente',
                `Encontre posibles terceros, pero no una coincidencia unica:\n${options}\nIndique la identificacion manualmente.`
              )
            );
          } else {
            lookupMessages.push(
              createMessage('agente', 'No encontre ese nombre en terceros. Indique la identificacion manualmente.')
            );
          }
        } catch (error) {
          console.error('No fue posible consultar terceros.', error);
          lookupMessages.push(
            createMessage(
              'agente',
              'No pude consultar terceros en este momento. Indique la identificacion manualmente para continuar.'
            )
          );
        } finally {
          setLookingTercero(false);
        }
      }

      const nextDraft = buildEntregaDraft(nextData);
      setEntregaData(nextData);
      setDraft(nextDraft);
      setSelectedActa(null);
      appendEntregaAgentPrompt(nextData, lookupMessages);
      return;
    }

    const nextDraft =
      mode === 'bloque' || answer.includes(':')
        ? applyBulkAnswer(draft, answer)
        : nextField
        ? applyFieldAnswer(draft, nextField, answer)
        : draft;

    setDraft(nextDraft);
    setSelectedActa(null);
    appendAgentPrompt(nextDraft);
  };

  const handleSaveDraft = async () => {
    if (!actor || !canGenerate) return null;

    setSaving(true);
    try {
      const workingDraft = isEntrega ? buildEntregaDraft(entregaData) : draft;
      const title = buildActaTitle(workingDraft);
      const id = await guardarBorradorActaFormal({
        actaId: savedActaId || selectedActa?.id,
        draft: workingDraft,
        titulo: title,
        actor,
      });
      const now = new Date();
      const localActa: ActaFormal = {
        id,
        ...workingDraft,
        titulo: title,
        estado: 'borrador',
        creadoPor: actor.uid,
        creadoPorNombre: actor.nombre,
        creadoPorEmail: actor.email,
        creadoEn: selectedActa?.creadoEn || now,
        actualizadoEn: now,
      };
      setDraft(workingDraft);
      setSavedActaId(id);
      setSelectedActa(localActa);
      toast({ title: 'Borrador guardado', description: 'El acta quedo en el historico.' });
      return localActa;
    } catch (error) {
      console.error('No fue posible guardar el acta formal.', error);
      toast({
        title: 'No fue posible guardar',
        description: 'Revise la conexion o los permisos de Firebase.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!canGenerate) return;

    setPublishing(true);
    try {
      const acta = selectedActa || (await handleSaveDraft());
      if (!acta) return;

      const asistentesConToken = await publicarActaFormalParaFirmas(acta);
      const nextActa = {
        ...acta,
        asistentes: asistentesConToken,
        estado: 'pendiente_firmas' as const,
        publicadoEn: new Date(),
      };
      setSelectedActa(nextActa);
      setMessages((current) => [
        ...current,
        createMessage('agente', 'Acta publicada. Los enlaces individuales de firma ya estan disponibles.'),
      ]);
      toast({
        title: 'Enlaces generados',
        description: 'Comparta un enlace por cada asistente.',
      });
    } catch (error) {
      console.error('No fue posible publicar el acta formal.', error);
      toast({
        title: 'No fue posible publicar',
        description: 'El acta no fue enviada a firmas.',
        variant: 'destructive',
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleDownload = async (kind: 'docx' | 'pdf') => {
    const source = selectedActa || activeDraft;
    setDownloading(kind);
    try {
      if (source.tipoFormato === 'entrega_dotacion' && source.entregaDotacion) {
        if (kind === 'docx') {
          await generarActaEntregaDotacionDocx({ data: source.entregaDotacion, firmantes });
        } else {
          await generarActaEntregaDotacionPdf({ data: source.entregaDotacion, firmantes });
        }
      } else if (kind === 'docx') {
        await generarActaFormalDocx({ acta: source, firmantes });
      } else {
        await generarActaFormalPdf({ acta: source, firmantes });
      }
    } catch (error) {
      console.error('No fue posible generar el documento.', error);
      toast({
        title: 'No fue posible generar',
        description: 'Revise que el navegador permita descargar archivos.',
        variant: 'destructive',
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleCopyLink = async (token?: string) => {
    if (!selectedActa?.id || !token) return;
    const link = construirEnlaceFirma(selectedActa.id, token);

    try {
      await navigator.clipboard.writeText(link);
      toast({ title: 'Enlace copiado', description: 'Ya puede enviarlo al asistente.' });
    } catch {
      toast({
        title: 'No se pudo copiar',
        description: link,
        duration: 9000,
      });
    }
  };

  const handleSelectActa = (acta: ActaFormal) => {
    const nextFormato = acta.tipoFormato || 'general';
    setSelectedActa(acta);
    setSavedActaId(acta.id);
    setDraft(cloneDraft(acta));
    setFormato(nextFormato);
    setEntregaData(acta.entregaDotacion || emptyActaEntregaDotacionData);
    setMessages([
      createMessage('agente', `Acta cargada: ${acta.titulo}`),
      createMessage('agente', `Estado actual: ${acta.estado}.`),
    ]);
  };

  const handleNewActa = (nextFormato: TipoActaFormal = formato) => {
    setFormato(nextFormato);
    setDraft(nextFormato === 'entrega_dotacion' ? buildEntregaDraft(emptyActaEntregaDotacionData) : emptyActaFormalDraft);
    setEntregaData(emptyActaEntregaDotacionData);
    setSelectedActa(null);
    setSavedActaId(null);
    setFirmantes([]);
    setInput('');
    setMode('paso');
    setMessages(nextFormato === 'entrega_dotacion' ? initialEntregaMessages : initialMessages);
  };

  const handleVoice = () => {
    const speechWindow = window as Window &
      typeof globalThis & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      toast({
        title: 'Voz no disponible',
        description: 'Este navegador no tiene reconocimiento de voz activo.',
        variant: 'destructive',
      });
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = 'es-CO';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(' ')
        .trim();
      if (transcript) {
        setInput((current) => (current ? `${current} ${transcript}` : transcript));
      }
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    <div className='mx-auto flex w-full max-w-7xl flex-col gap-5'>
      <div className='flex flex-col justify-between gap-3 md:flex-row md:items-center'>
        <div>
          <div className='mb-2 inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary'>
            <LucideSparkles className='h-3.5 w-3.5' />
            Agente asistente
          </div>
          <h2 className='text-2xl font-bold text-foreground'>Actas formales y firmas por asistente</h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Formato oficial con membrete SERVICIUDAD, generacion Word/PDF y cierre por firmas completas.
          </p>
        </div>
        <Button variant='outline' onClick={() => handleNewActa()} leftIcon={<LucidePlus size={16} />}>
          Nueva acta
        </Button>
      </div>

      <Card className='rounded-lg border-border/70 p-2 shadow-elegant'>
        <div className='grid gap-2 sm:grid-cols-2'>
          <button
            type='button'
            onClick={() => handleNewActa('general')}
            className={`rounded-md border px-4 py-3 text-left transition-colors ${
              formato === 'general'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-foreground hover:bg-muted'
            }`}
          >
            <p className='text-sm font-bold'>Acta formal</p>
            <p className='mt-1 text-xs text-muted-foreground'>Reunion o comite con agenda, conclusiones y compromisos.</p>
          </button>
          <button
            type='button'
            onClick={() => handleNewActa('entrega_dotacion')}
            className={`rounded-md border px-4 py-3 text-left transition-colors ${
              formato === 'entrega_dotacion'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-foreground hover:bg-muted'
            }`}
          >
            <p className='text-sm font-bold'>Acta de entrega</p>
            <p className='mt-1 text-xs text-muted-foreground'>Formato fijo: fecha, receptor, documento y tallas.</p>
          </button>
        </div>
      </Card>

      <div className='grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]'>
        <Card className='overflow-hidden rounded-lg border-border/70 shadow-elegant'>
          <div className='border-b border-border bg-card px-4 py-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <div>
                <p className='text-sm font-bold text-foreground'>Conversacion guiada</p>
                <p className='text-xs text-muted-foreground'>
                  {canGenerate ? 'Datos completos' : `${activeMissingCount} dato(s) pendiente(s)`}
                </p>
              </div>
              {!isEntrega ? (
                <div className='grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1'>
                  <button
                    type='button'
                    onClick={() => setMode('paso')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                      mode === 'paso' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    Paso a paso
                  </button>
                  <button
                    type='button'
                    onClick={() => setMode('bloque')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                      mode === 'bloque' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    En bloque
                  </button>
                </div>
              ) : (
                <Badge variant='info'>Formato fijo</Badge>
              )}
            </div>
          </div>

          <div className='max-h-[520px] min-h-[420px] space-y-3 overflow-y-auto bg-slate-50/70 p-4'>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.autor === 'usuario' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed shadow-sm ${
                    message.autor === 'usuario'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-card text-foreground'
                  }`}
                >
                  {message.texto}
                </div>
              </div>
            ))}
          </div>

          <div className='border-t border-border bg-card p-4'>
            <div className='flex items-end gap-2'>
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={
                  isEntrega
                    ? nextEntregaField
                      ? getNextEntregaPrompt(entregaData)
                      : 'Datos completos. Genere el borrador o envie a firma.'
                    : mode === 'bloque'
                    ? 'Pegue fecha, hora, lugar, asistentes, objetivo, orden del dia, desarrollo, conclusiones y compromisos...'
                    : nextField
                    ? getNextPrompt(draft)
                    : 'Escriba ajustes o confirme con los botones de generacion.'
                }
                className='min-h-[92px] resize-none rounded-lg'
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                    void handleSend();
                  }
                }}
              />
              <div className='grid gap-2'>
                <Button
                  type='button'
                  variant={listening ? 'destructive' : 'outline'}
                  size='icon'
                  onClick={handleVoice}
                  title='Dictar'
                >
                  {listening ? <LucideMicOff size={18} /> : <LucideMic size={18} />}
                </Button>
                <Button
                  type='button'
                  size='icon'
                  onClick={() => void handleSend()}
                  title={lookingTercero ? 'Consultando terceros' : 'Enviar'}
                  disabled={lookingTercero}
                >
                  <LucideSend size={18} />
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className='space-y-5'>
          <Card className='rounded-lg border-border/70 p-4 shadow-elegant'>
            <div className='mb-4 flex items-center justify-between gap-3'>
              <div>
                <p className='text-sm font-bold text-foreground'>Estado del acta</p>
                <p className='text-xs text-muted-foreground'>{selectedActa?.titulo || buildActaTitle(activeDraft)}</p>
              </div>
              {selectedActa ? estadoBadge(selectedActa.estado) : <Badge variant='secondary'>Sin guardar</Badge>}
            </div>

            <div className='space-y-2'>
              {isEntrega
                ? Object.entries(entregaCampoLabels).map(([field, label]) => {
                    const isMissing = entregaMissingFields.includes(field as keyof typeof entregaCampoLabels);
                    return (
                      <div key={field} className='flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2'>
                        <span className='text-xs font-medium text-foreground'>{label}</span>
                        <Badge variant={isMissing ? 'pending' : 'success'} size='sm'>
                          {isMissing ? 'Pendiente' : 'Listo'}
                        </Badge>
                      </div>
                    );
                  })
                : Object.entries(campoLabels).map(([field, label]) => {
                    const isMissing = missingFields.includes(field as keyof typeof campoLabels);
                    return (
                      <div key={field} className='flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2'>
                        <span className='text-xs font-medium text-foreground'>{label}</span>
                        <Badge variant={isMissing ? 'pending' : 'success'} size='sm'>
                          {isMissing ? 'Pendiente' : 'Listo'}
                        </Badge>
                      </div>
                    );
                  })}
            </div>

            <div className='mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2'>
              <Button onClick={handleSaveDraft} disabled={!canGenerate} loading={saving} leftIcon={<LucideFileText size={16} />}>
                Generar borrador
              </Button>
              <Button
                variant='success'
                onClick={handlePublish}
                disabled={!canGenerate}
                loading={publishing}
                leftIcon={<LucideLink size={16} />}
              >
                Enviar a firmas
              </Button>
            </div>
          </Card>

          <Card className='rounded-lg border-border/70 p-4 shadow-elegant'>
            <div className='mb-3 flex items-center justify-between'>
              <p className='text-sm font-bold text-foreground'>Firmas</p>
              <Badge variant={allSigned ? 'success' : 'pending'}>
                {signedCount}/{expectedSigners || 0}
              </Badge>
            </div>

            {selectedActa?.estado === 'pendiente_firmas' || selectedActa?.estado === 'cerrada' ? (
              <div className='space-y-2'>
                {selectedActa.asistentes.map((asistente) => {
                  const signer = firmantes.find((item) => item.asistenteId === asistente.id);
                  return (
                    <div key={asistente.id} className='rounded-md border border-border bg-muted/30 p-3'>
                      <div className='flex items-start justify-between gap-2'>
                        <div className='min-w-0'>
                          <p className='truncate text-sm font-semibold text-foreground'>{asistente.nombre}</p>
                          <p className='truncate text-xs text-muted-foreground'>{asistente.cargo}</p>
                        </div>
                        <Badge variant={signer?.estado === 'firmada' ? 'success' : 'pending'} size='sm'>
                          {signer?.estado === 'firmada' ? 'Firmada' : 'Pendiente'}
                        </Badge>
                      </div>
                      {signer?.estado !== 'firmada' ? (
                        <Button
                          variant='outline'
                          size='sm'
                          className='mt-2 w-full'
                          onClick={() => handleCopyLink(asistente.token)}
                          leftIcon={<LucideCopy size={14} />}
                        >
                          Copiar enlace
                        </Button>
                      ) : (
                        <p className='mt-2 text-xs text-muted-foreground'>
                          {signer.fechaFirma ? `Firmo: ${signer.fechaFirma.toLocaleString('es-CO')}` : 'Firma registrada'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className='rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground'>
                Publique el acta para generar enlaces individuales de firma.
              </div>
            )}

            <div className='mt-4 grid grid-cols-2 gap-2'>
              <Button
                variant='outline'
                onClick={() => handleDownload('docx')}
                disabled={!canGenerate}
                loading={downloading === 'docx'}
                leftIcon={<LucideDownload size={16} />}
              >
                Word
              </Button>
              <Button
                variant='outline'
                onClick={() => handleDownload('pdf')}
                disabled={!canGenerate}
                loading={downloading === 'pdf'}
                leftIcon={<LucideDownload size={16} />}
              >
                PDF
              </Button>
            </div>
          </Card>

          <Card className='rounded-lg border-border/70 p-4 shadow-elegant'>
            <div className='mb-3 flex items-center justify-between'>
              <p className='text-sm font-bold text-foreground'>Historico</p>
              <Badge variant='outline'>{actas.length}</Badge>
            </div>
            <div className='max-h-72 space-y-2 overflow-y-auto'>
              {actas.length > 0 ? (
                actas.map((acta) => (
                  <button
                    key={acta.id}
                    type='button'
                    onClick={() => handleSelectActa(acta)}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${
                      selectedActa?.id === acta.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-muted/30 hover:bg-muted'
                    }`}
                  >
                    <div className='flex items-start justify-between gap-2'>
                      <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold text-foreground'>{acta.titulo}</p>
                        <p className='text-xs text-muted-foreground'>
                          {acta.creadoEn.toLocaleDateString('es-CO')} - {acta.creadoPorNombre}
                        </p>
                      </div>
                      {acta.estado === 'cerrada' ? (
                        <LucideCheckCircle2 className='h-4 w-4 shrink-0 text-emerald-600' />
                      ) : null}
                    </div>
                  </button>
                ))
              ) : (
                <p className='rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground'>
                  Aun no hay actas formales guardadas.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
