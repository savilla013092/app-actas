# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Plataforma web de **SERVICIUDAD ESP** (Dosquebradas) para gestionar activos fijos y **generar actas de forma agéntica**. Cubre tres flujos principales:

1. **Revisiones de activos** con evidencia fotográfica y **firma digital dual** (Profesional de Logística + Custodio).
2. **Agente de actas** (`/agente-actas`): genera actas **formales** (reuniones/comités) y de **entrega de dotación** a partir de una nota dictada o escrita, con extracción por IA y respaldo determinista.
3. **Préstamos exprés** de activos (`/express-loans`).

## Commands

```bash
# Desarrollo
npm run dev              # Servidor de desarrollo Next.js
npm run build            # Build de producción (incluye service worker PWA)
npm run lint             # ESLint
npx tsc --noEmit         # Chequeo de tipos

# Pruebas
npm test                 # Smoke tests (tests/smoke/repository-guards.run.mjs)
npm run test:rules       # Reglas de Firestore contra el emulador
npm run test:smoke:roles # Smoke de acceso por rol contra el emulador

# Firebase
npm run firebase:emulators   # Emuladores locales
npm run firebase:deploy      # Deploy de Firestore/Functions/Storage (NO hosting web)

# Utilidades
npm run terceros:catalogo    # Regenera src/lib/actas-formales/tercerosCatalog.json
```

## Deployment

- **Web (Next.js SSR + API routes):** se despliega en **Vercel** (proyecto `app-actas-serviciudad`). Producción se publica desde la rama `main`.
- **Firebase:** solo backend — Firestore (reglas + índices), Cloud Functions y Storage (reglas). `firebase.json` **no** define `hosting` (se eliminó para evitar conflictos con el SSR de Vercel).
- Las variables `NEXT_PUBLIC_FIREBASE_*` y las de IA (`ANTHROPIC_API_KEY`, `ACTAS_AI_MODEL`) deben configurarse en Vercel.

## Architecture

### Tech Stack
- **Frontend:** Next.js 14 (App Router) + TypeScript + TailwindCSS. PWA instalable vía `@ducanh2912/next-pwa`.
- **Backend:** Firebase (Firestore, Auth, Storage, Cloud Functions). Verificación de ID token en el servidor con `firebase-admin`.
- **IA:** `@google/genai` (Gemini, nivel gratuito) en rutas de servidor para extracción estructurada.
- **Estado:** Zustand (`src/stores/authStore.ts`). **Formularios:** React Hook Form + Zod. **Firma:** react-signature-canvas.
- **Documentos:** `docx` y `jspdf` (cliente); `pdfkit` en Cloud Functions.

### Project Structure
```
src/
├── app/                      # App Router
│   ├── agente-actas/         # Agente de actas (formal + dotación, IA + respaldo)
│   ├── activos/              # Gestión de activos
│   ├── admin/importar/       # Importación de activos
│   ├── auth/login/           # Login
│   ├── dashboard/            # Panel principal
│   ├── express-loans/        # Préstamos exprés
│   ├── firmar-acta/[actaId]/[token]/  # Firma pública por asistente
│   ├── revision/[id]/        # Flujo de revisión
│   └── api/
│       ├── actas/extraer/    # POST: extracción de nota → borrador (Claude + Zod)
│       ├── health/           # Estado de configuración Firebase
│       ├── seed/             # Seed de demo (solo dev)
│       └── terceros/         # Búsqueda difusa de terceros por nombre
├── components/               # ui/, forms/, layout/, signature/, revision/, actas-formales/, charts/, filters/
├── lib/
│   ├── firebase/config.ts    # Firebase cliente
│   ├── firebase/admin.ts     # firebase-admin (verificación de ID token)
│   ├── actas-formales/       # conversation.ts, documentGenerator.ts, aiExtraction.ts, tercerosLookup.ts, tercerosCatalog.json
│   ├── constants/            # catálogos de clasificación y ubicación
│   └── utils/                # cn, hash, clasificación/búsqueda de activos, export
├── services/                 # Capa Firestore (activo, revisión, asignación, actaFormal, expressLoan, ...)
├── stores/                   # authStore (Zustand)
├── hooks/                    # useAuth
└── types/                    # activo, revision, acta, actaFormal, expressLoan, usuario, asignacion

functions/src/                # Cloud Functions (ver abajo)
tests/                        # smoke/ (guards, roles) y rules/ (Firestore/Storage vía emulador)
public/                       # estáticos, manifest.webmanifest, icons/, actas-formales/ (plantillas e imágenes)
data/                         # git-ignored (fuentes .xlsx y documentos de referencia)
```

**Nota:** credenciales sensibles fuera del proyecto (p. ej. `C:\Users\<user>\firebase-credentials\`). No commitear `service-account.json`.

### Path Alias
`@/*` → `src/*`.

### User Roles
- **admin:** acceso total (usuarios, activos, revisiones, reportes).
- **logistica:** crea revisiones, firma como revisor, ve todos los activos.
- **custodio:** ve activos asignados, firma revisiones pendientes.

## Agente de actas (`/agente-actas`)

Página cliente que arma dos tipos de acta:
- **Formal** (`tipoFormato: 'general'`): fecha, hora, lugar, tipo de reunión, asistentes, objetivo, orden del día, desarrollo, conclusiones, compromisos.
- **Entrega de dotación** (`tipoFormato: 'entrega_dotacion'`): formato **preconfigurado** (lugar, objetivo y textos fijos en `buildEntregaDraft`); solo pide fecha, receptor, documento y tallas. Los elementos (pantalón, camisa, bota) son **opcionales e independientes**: basta con uno. Un elemento sin talla —o respondido con "no aplica" en el modo paso a paso— se registra en `itemsOmitidos`, no bloquea la firma y desaparece de la tabla del Word/PDF (las filas se renumeran y la nota de garantía de la bota solo aparece si se entrega calzado).

Tres modos de captura (`src/app/agente-actas/page.tsx`):
- **Nota IA** (por defecto): se dicta/pega una sola nota; `POST /api/actas/extraer` la interpreta con Gemini (`generateContent` + `responseSchema` JSON, validado con Zod) y rellena el borrador. Reusa `tercerosLookup` para resolver la cédula por nombre.
- **Paso a paso** y **En bloque**: parser determinista en `src/lib/actas-formales/conversation.ts` (regex).

**Diseño híbrido:** si `GEMINI_API_KEY` no está configurada o la IA falla, el modo Nota cae automáticamente al parser determinista. El dictado usa la Web Speech API del navegador (`es-CO`).

**Firmas:** el acta se publica generando un enlace por asistente (`/firmar-acta/[actaId]/[token]`); al completarse todas las firmas se cierra (`marcarActaFormalCerrada`). Descarga en Word/PDF vía `documentGenerator.ts`.

### Variables de entorno de IA (solo servidor, sin `NEXT_PUBLIC_`)
- `GEMINI_API_KEY` — clave de Google AI Studio (nivel gratuito). Sin ella el modo Nota usa el respaldo determinista.
- `GEMINI_MODEL` — modelo de Gemini (default `gemini-2.5-flash-lite`, nivel gratuito).
- `FIREBASE_ADMIN_CREDENTIALS` — opcional (JSON o base64). La verificación del ID token funciona solo con el `projectId`.

## Dual Signature Flow (revisiones)
1. Logística crea la revisión con evidencia → firma como revisor → `pendiente_firma_custodio`.
2. Custodio revisa y firma → `firmada_completa`.
3. Cloud Function genera el PDF institucional.

Estados de revisión: `borrador` → `pendiente_firma_custodio` → `firmada_completa` → `completada`.
Estados de acta formal: `borrador` → `pendiente_firmas` → `cerrada` (o `anulada`).

### Firestore Collections
- `usuarios`, `activos`, `revisiones`, `actas_formales` (+ subcolección `firmantes`), `express_loans`.
- `consecutivos` y `auditoria`: **solo Cloud Functions**.

### Cloud Functions (`functions/src/`)
- `revisionCallables.ts`, `assetCallables.ts`, `assignmentCallables.ts`, `userCallables.ts` — operaciones privilegiadas (crear/actualizar/firmar, subir evidencia, gestionar usuarios).
- `generarActaPDF.ts`, `generarActaAsignacionPDF.ts` — triggers que generan PDF al firmar.
- `triggers.ts` — sincroniza índices de búsqueda y claims de auth.
- `consecutivos.ts`, `assetCatalogs.ts`, `security.ts` (guards de rol), `index.ts`.

### Security Rules
`firestore.rules` implementa acceso por rol:
- Custodios solo firman revisiones de sus propios activos.
- Solo logística crea revisiones.
- Consecutivos y auditoría son exclusivos de Cloud Functions.
- El endpoint `/api/actas/extraer` exige ID token de Firebase válido antes de llamar a la IA.

> **Privacidad:** el modo Nota IA envía el texto de la nota (nombres, cédulas) a Google (Gemini). En el nivel gratuito el contenido puede usarse para mejorar sus modelos; tenerlo en cuenta para datos institucionales sensibles.
