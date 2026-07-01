# Configuración de IA (agente de actas) y PWA

## 1. Extracción de actas por IA

El modo **"Nota IA"** de `/agente-actas` envía una nota (dictada o escrita) a la ruta de
servidor `POST /api/actas/extraer`, que la interpreta con Claude y devuelve el borrador
estructurado (formal o de entrega de dotación).

### Variables de entorno (solo servidor)

Configúralas en `.env.local` (desarrollo) y en **Vercel → Settings → Environment Variables**
(Production y Preview). **Nunca** uses el prefijo `NEXT_PUBLIC_` para estas claves.

| Variable | Requerida | Descripción |
|---|---|---|
| `ANTHROPIC_API_KEY` | Sí (para IA) | Clave de la API de Anthropic. Sin ella, el modo Nota cae al **parser determinista**. |
| `ACTAS_AI_MODEL` | No | Modelo de Claude. Default `claude-haiku-4-5` (económico). Alternativa: `claude-sonnet-4-6`. |
| `FIREBASE_ADMIN_CREDENTIALS` | No | Service account (JSON o base64) para operaciones privilegiadas. La verificación del ID token funciona solo con el `projectId`. |

### Diseño híbrido (con respaldo)

- **Con `ANTHROPIC_API_KEY`:** la nota se interpreta con IA; si menciona una persona sin
  cédula, se resuelve automáticamente contra el catálogo de terceros (`tercerosLookup`).
- **Sin clave o ante error/rechazo:** el flujo cae al parser determinista
  (`src/lib/actas-formales/conversation.ts`) sin interrumpir el trabajo.

### Seguridad

- La clave vive solo en el servidor (`src/app/api/actas/extraer/route.ts`); no se incluye en
  el bundle del cliente.
- El endpoint exige un **ID token de Firebase válido** (`Authorization: Bearer <token>`) antes
  de llamar a la IA.

### Costo / modelo

`claude-haiku-4-5` (~US$1/US$5 por 1M tokens) es suficiente para extraer datos de notas cortas.
Para mayor precisión, cambia `ACTAS_AI_MODEL` a `claude-sonnet-4-6` (~US$3/US$15).

## 2. PWA (instalable en el celular)

- Manifiesto en `public/manifest.webmanifest`; íconos en `public/icons/` (SVG, incl. maskable).
- Service worker generado por `@ducanh2912/next-pwa` en el `build` (deshabilitado en `dev`).
- Los archivos generados (`public/sw.js`, `public/workbox-*.js`, etc.) están **git-ignored**.

### Instalación
En Chrome/Edge (móvil o escritorio), abre la app y usa **"Instalar app"** / "Agregar a la
pantalla de inicio". Requiere HTTPS (Vercel lo provee).

### Alcance offline
El service worker cachea el app-shell para instalación y arranque. Los datos en tiempo real
(Firestore) y la IA **requieren red**; las rutas `/api/*` no se sirven desde caché.
