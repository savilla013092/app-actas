# AGENTS.md

Guía para agentes de código (Codex, Claude Code y similares) en este repositorio.

> **La documentación de arquitectura, comandos, estructura y flujos vive en [`CLAUDE.md`](./CLAUDE.md).**
> Este archivo solo añade recordatorios operativos para evitar duplicar (y desincronizar) contenido.

## Reglas rápidas

- **Web = Vercel, backend = Firebase.** `firebase.json` no define `hosting`; no lo reintroduzcas. El deploy web se hace en Vercel desde `main`.
- **Claves de IA solo en el servidor.** `ANTHROPIC_API_KEY` / `ACTAS_AI_MODEL` nunca deben llevar prefijo `NEXT_PUBLIC_` ni usarse desde el cliente. La IA vive en `src/app/api/actas/extraer/route.ts`.
- **Diseño híbrido:** cualquier cambio en el agente de actas debe conservar el respaldo determinista (`src/lib/actas-formales/conversation.ts`) cuando la IA no esté disponible.
- **Datos y binarios** (`.xlsx`, documentos fuente) van en `data/` (git-ignored), no en la raíz. Las plantillas e imágenes que la app sirve van en `public/actas-formales/`.
- **Operaciones privilegiadas** (consecutivos, auditoría, creación de usuarios) son exclusivas de Cloud Functions; no las repliques en el cliente.

## Antes de dar por terminado un cambio

```bash
npm run lint
npx tsc --noEmit
npm test            # smoke
npm run build       # valida SSR + generación del service worker
```

Para cambios en reglas de Firestore/Storage: `npm run test:rules` (requiere emuladores).
