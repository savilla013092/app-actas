# Analisis Paso 0 - Agente asistente de actas formales

## Formatos y estructura existentes

- `formato documento.docx`: existe en la raiz del repositorio. Al inspeccionarlo, el cuerpo del Word esta vacio y no contiene campos editables de acta; el formato real esta en el encabezado y pie como imagenes institucionales.
- Recursos extraidos del formato:
  - `public/actas-formales/header-serviciudad.png`
  - `public/actas-formales/footer-serviciudad.png`
- Actas operativas existentes:
  - `functions/src/generarActaPDF.ts`: genera PDF para actas de revision de activos fijos.
  - `functions/src/generarActaAsignacionPDF.ts`: genera PDF para actas de asignacion inicial.
  - `src/types/acta.ts`, `src/types/revision.ts`, `src/types/asignacion.ts`: ya modelan estados, evidencias y firmas.

## Que se puede reutilizar

- Firebase Auth, Firestore y reglas por rol.
- `react-signature-canvas`, ya usado en el sistema para firma manuscrita.
- El patron de estados de firma: borrador, pendiente de firma, firmado/cerrado.
- El enfoque de trazabilidad con fecha, autor, estado y auditoria de documentos.
- El membrete oficial del Word existente, usado como base visual para Word/PDF del nuevo modulo.

## Que faltaba construir

- Un modulo independiente para actas formales de reunion/comite, porque no existia un cuerpo editable para ese tipo de acta.
- Una experiencia conversacional mobile-first que capture fecha, hora, lugar, tipo, asistentes, objetivo, orden del dia, desarrollo, conclusiones y compromisos.
- Generacion de Word `.docx` y PDF para actas formales con secciones institucionales y cuadros de firma por asistente.
- Enlaces publicos individuales para que cada asistente firme desde su celular sin instalar nada.
- Estado de firmas en tiempo real y cierre automatico del acta cuando todos firman.
- Historico de actas formales por autor y estado.

## Decision de implementacion

Se construyo todo de forma aditiva:

- Nueva ruta autenticada: `/agente-actas`.
- Nueva ruta publica de firma: `/firmar-acta/[actaId]/[token]`.
- Nueva coleccion Firestore: `actas_formales`.
- Nueva subcoleccion por acta: `firmantes`.
- Nuevos generadores de documento en `src/lib/actas-formales/documentGenerator.ts`.

Los flujos existentes de activos, revisiones, asignaciones y prestamos express no se eliminaron ni se reemplazaron.
