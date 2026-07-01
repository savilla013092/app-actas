# Configuración de IA (agente de actas) y PWA

## 1. Extracción de actas por IA (Gemini)

El modo **"Nota IA"** de `/agente-actas` envía una nota (dictada o escrita) a la ruta de
servidor `POST /api/actas/extraer`, que la interpreta con **Gemini** (Google AI Studio, nivel
gratuito) y devuelve el borrador estructurado (formal o de entrega de dotación).

### Variables de entorno (solo servidor)

Configúralas en `.env.local` (desarrollo) y en **Vercel → Settings → Environment Variables**
(Production y Preview). **Nunca** uses el prefijo `NEXT_PUBLIC_` para estas claves.

| Variable | Requerida | Descripción |
|---|---|---|
| `GEMINI_API_KEY` | Sí (para IA) | Clave de Google AI Studio. Sin ella, el modo Nota cae al **parser determinista**. |
| `GEMINI_MODEL` | No | Modelo de Gemini. Default `gemini-2.5-flash-lite` (nivel gratuito). |
| `FIREBASE_ADMIN_CREDENTIALS` | No | Service account (JSON o base64) para operaciones privilegiadas. La verificación del ID token funciona solo con el `projectId`. |

Obtén una clave gratuita en https://aistudio.google.com/apikey.

### Diseño híbrido (con respaldo)

- **Con `GEMINI_API_KEY`:** la nota se interpreta con IA; si menciona una persona sin
  cédula, se resuelve automáticamente contra el catálogo de terceros (`tercerosLookup`).
- **Sin clave o ante error/rechazo:** el flujo cae al parser determinista
  (`src/lib/actas-formales/conversation.ts`) sin interrumpir el trabajo.

### Seguridad y privacidad

- La clave vive solo en el servidor (`src/app/api/actas/extraer/route.ts`); no se incluye en
  el bundle del cliente.
- El endpoint exige un **ID token de Firebase válido** (`Authorization: Bearer <token>`) antes
  de llamar a la IA.
- **Privacidad:** el texto de la nota (nombres, cédulas) se envía a Google. En el nivel
  gratuito de Gemini el contenido puede usarse para mejorar sus modelos. Para datos
  institucionales sensibles, considera un plan de pago con retención de datos o el modo manual.

### Costo

El nivel gratuito de Gemini (`gemini-2.5-flash-lite`) tiene límites de peticiones por minuto/día
suficientes para el volumen de actas, sin cargos. Si se superan los límites, la app cae al
parser determinista.

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
