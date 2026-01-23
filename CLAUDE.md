# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sistema de Actas de Revisión de Activos Fijos for SERVICIUDAD ESP. A web application that automates fixed asset revision records with photographic evidence and dual digital signatures (Logistics Professional + Custodian).

## Commands

```bash
# Development
npm run dev              # Start Next.js development server
npm run build            # Build for production
npm run lint             # Run ESLint

# Firebase
npm run firebase:emulators   # Start Firebase local emulators
npm run firebase:deploy      # Deploy to Firebase
```

## Architecture

### Tech Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + TailwindCSS
- **Backend**: Firebase (Firestore, Auth, Storage, Cloud Functions)
- **State**: Zustand (`src/stores/authStore.ts`)
- **Forms**: React Hook Form + Zod validation
- **Signature**: react-signature-canvas

### Project Structure
```
APP_ACTAS/
├── src/                    # Main application source
│   ├── app/                # Next.js App Router pages
│   │   ├── auth/login/     # Login page
│   │   ├── dashboard/      # Main dashboard
│   │   ├── activos/        # Asset management pages
│   │   └── revision/       # Revision workflow pages
│   ├── components/
│   │   ├── ui/             # Reusable UI components
│   │   ├── forms/          # Form components
│   │   ├── layout/         # Layout components (AuthGuard)
│   │   ├── signature/      # SignaturePad component
│   │   └── revision/       # Revision-specific components
│   ├── lib/
│   │   ├── firebase/config.ts  # Firebase initialization
│   │   └── utils/          # Utilities (cn, hash)
│   ├── services/           # Firestore service layer
│   ├── stores/             # Zustand stores
│   ├── hooks/              # Custom hooks
│   └── types/              # TypeScript type definitions
├── scripts/                # Utility scripts
│   ├── importar-activos.js # Import assets from Excel
│   └── limpiar-datos.js    # Data cleanup utilities
├── functions/              # Firebase Cloud Functions
├── docs/                   # Documentation
│   └── GUIA_IMPORTACION.md # Asset import guide
├── data/                   # Data files (git-ignored)
│   └── Listado_activos.xlsx # Current assets list
└── ... (config files)
```

**Note**: Firebase credentials (`service-account.json`) should be stored outside the project in `C:\Users\<user>\firebase-credentials\`

### Path Alias
Use `@/*` for imports from `src/` directory.

### User Roles
- **admin**: Full access to users, assets, revisions, reports
- **logistica**: Create revisions, sign as reviewer, view all assets
- **custodio**: View assigned assets, sign pending revision records

### Dual Signature Flow
1. Logistics Professional creates revision with evidence photos
2. Signs as reviewer → state becomes `pendiente_firma_custodio`
3. Custodian reviews and signs → state becomes `firmada_completa`
4. Cloud Function generates PDF with institutional format

### Revision States
`borrador` → `pendiente_firma_custodio` → `firmada_completa` → `completada`

### Firestore Collections
- `usuarios` - User profiles linked to Firebase Auth
- `activos` - Fixed assets with custodian assignments
- `revisiones` - Revision records with evidence and signatures
- `consecutivos` - Auto-increment counters (Cloud Functions only)
- `auditoria` - Audit logs (Cloud Functions only)

### Firebase Configuration
Environment variables required (prefix `NEXT_PUBLIC_FIREBASE_`):
- API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID

### Security Rules
Firestore rules in `firestore.rules` implement role-based access:
- Custodians can only sign revisions for their own assets
- Only logistics can create revisions
- Consecutive numbers and audit logs are Cloud Functions only
