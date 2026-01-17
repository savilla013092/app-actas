# Plan de Implementación - Sistema de Actas de Revisión de Activos Fijos

## SERVICIUDAD ESP

**Versión:** 1.0
**Fecha:** Enero 2025
**Responsable:** Profesional Especializado en Logística

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Modelo de Datos](#3-modelo-de-datos)
4. [Estructura del Proyecto](#4-estructura-del-proyecto)
5. [Configuración Inicial](#5-configuración-inicial)
6. [Implementación por Módulos](#6-implementación-por-módulos)
7. [Cloud Functions](#7-cloud-functions)
8. [Reglas de Seguridad](#8-reglas-de-seguridad)
9. [Flujo de Doble Firma](#9-flujo-de-doble-firma)
10. [Generación del PDF](#10-generación-del-pdf)
11. [Despliegue](#11-despliegue)
12. [Cronograma de Desarrollo](#12-cronograma-de-desarrollo)

---

## 1. Resumen Ejecutivo

### Objetivo
Desarrollar un aplicativo web que automatice las actas de revisión de activos fijos de SERVICIUDAD ESP, con trazabilidad completa, evidencias fotográficas y **doble firma digital** (Profesional de Logística + Custodio).

### Alcance Funcional
- Gestión de usuarios (administradores, profesional de logística, custodios)
- Gestión de activos fijos
- Registro de revisiones con evidencias fotográficas
- Generación automática de actas en PDF con formato institucional
- Sistema de doble firma digital
- Histórico y auditoría completa

### Stack Tecnológico
| Componente | Tecnología |
|------------|------------|
| Frontend | Next.js 14 + TypeScript + TailwindCSS |
| Backend | Firebase (Firestore, Auth, Storage, Functions) |
| PDF | PDFKit en Cloud Functions |
| Firma Digital | react-signature-canvas |
| Validación | Zod + React Hook Form |
| Estado | Zustand |

---

## 2. Arquitectura del Sistema

### Diagrama General

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   FRONTEND                                       │
│                            Next.js 14 + TypeScript                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Módulo    │  │   Módulo    │  │   Módulo    │  │   Módulo                │ │
│  │   Auth      │  │   Activos   │  │ Revisiones  │  │   Firma Digital         │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FIREBASE SERVICES                                   │
│                                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐   │
│  │  Authentication  │  │    Firestore     │  │         Storage              │   │
│  │                  │  │                  │  │                              │   │
│  │  - Email/Pass    │  │  - usuarios      │  │  - /evidencias/{revId}/     │   │
│  │  - Custom Claims │  │  - activos       │  │  - /firmas/{revId}/         │   │
│  │    (roles)       │  │  - revisiones    │  │  - /actas/{revId}.pdf       │   │
│  │                  │  │  - consecutivos  │  │                              │   │
│  │                  │  │  - auditoria     │  │                              │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────────┘   │
│                                        │                                         │
│                                        ▼                                         │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                          CLOUD FUNCTIONS                                   │  │
│  │                                                                            │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐    │  │
│  │  │ setUserRole     │  │ generarActaPDF  │  │ registrarAuditoria      │    │  │
│  │  │ (HTTP)          │  │ (Firestore      │  │ (Firestore Trigger)     │    │  │
│  │  │                 │  │  Trigger)       │  │                         │    │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘    │  │
│  │                                                                            │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                                 │  │
│  │  │ generarConsecut │  │ enviarNotifica  │                                 │  │
│  │  │ ivo (Callable)  │  │ cion (opcional) │                                 │  │
│  │  └─────────────────┘  └─────────────────┘                                 │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Roles del Sistema

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| **admin** | Administrador del sistema | Todo: usuarios, activos, revisiones, reportes |
| **logistica** | Profesional de Logística (tú) | Crear revisiones, firmar como revisor, ver todos los activos |
| **custodio** | Responsable de activos asignados | Ver sus activos, firmar actas de sus activos |

### Flujo de Firma Doble

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         FLUJO DE DOBLE FIRMA                                  │
└──────────────────────────────────────────────────────────────────────────────┘

  PROFESIONAL LOGÍSTICA                              CUSTODIO
         │                                              │
         │  1. Crea revisión                            │
         │  2. Sube evidencias                          │
         │  3. Completa formulario                      │
         │  4. FIRMA como revisor                       │
         │─────────────────────────────────────────────▶│
         │                                              │
         │     Estado: "pendiente_firma_custodio"       │
         │                                              │
         │                                              │  5. Recibe notificación
         │                                              │  6. Revisa el acta
         │                                              │  7. FIRMA como custodio
         │◀─────────────────────────────────────────────│
         │                                              │
         │     Estado: "firmada_completa"               │
         │                                              │
         ▼                                              ▼
    ┌─────────────────────────────────────────────────────┐
    │           CLOUD FUNCTION: generarActaPDF            │
    │                                                     │
    │   - Detecta ambas firmas completas                  │
    │   - Genera número de acta consecutivo               │
    │   - Crea PDF con formato institucional              │
    │   - Incluye ambas firmas en el documento            │
    │   - Sube PDF a Storage                              │
    │   - Actualiza estado a "completada"                 │
    └─────────────────────────────────────────────────────┘
```

---

## 3. Modelo de Datos

### Colección: `usuarios`

```typescript
interface Usuario {
  id: string;                    // UID de Firebase Auth
  email: string;
  nombre: string;
  cedula: string;
  cargo: string;
  dependencia: string;
  telefono?: string;
  rol: 'admin' | 'logistica' | 'custodio';
  activo: boolean;
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
  creadoPor: string;             // userId del creador
}
```

**Ejemplo de documento:**
```json
{
  "id": "abc123xyz",
  "email": "juan.perez@serviciudad.gov.co",
  "nombre": "Juan Carlos Pérez Rodríguez",
  "cedula": "1234567890",
  "cargo": "Profesional Especializado",
  "dependencia": "Dirección Administrativa",
  "telefono": "3001234567",
  "rol": "custodio",
  "activo": true,
  "creadoEn": "2024-01-15T10:30:00Z",
  "actualizadoEn": "2024-01-15T10:30:00Z",
  "creadoPor": "admin123"
}
```

### Colección: `activos`

```typescript
interface Activo {
  id: string;
  codigo: string;                // Código institucional único (ej: "AF-MOB-2024-0089")
  descripcion: string;
  categoria: string;             // "Mobiliario", "Equipo Cómputo", "Vehículos", etc.
  marca?: string;
  modelo?: string;
  serial?: string;
  ubicacion: string;
  dependencia: string;
  custodioId: string;            // Referencia a usuarios/
  custodioNombre: string;        // Desnormalizado para consultas
  estado: 'activo' | 'baja' | 'traslado' | 'mantenimiento';
  valorAdquisicion?: number;
  fechaAdquisicion?: Timestamp;
  observaciones?: string;
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
  creadoPor: string;
}
```

**Ejemplo de documento:**
```json
{
  "id": "activo001",
  "codigo": "AF-MOB-2024-0089",
  "descripcion": "Escritorio ejecutivo en madera con tres cajones",
  "categoria": "Mobiliario",
  "marca": "Inval",
  "modelo": "EJ-2000",
  "serial": "INV2024001234",
  "ubicacion": "Oficina 301 - Edificio Principal",
  "dependencia": "Dirección Administrativa",
  "custodioId": "abc123xyz",
  "custodioNombre": "Juan Carlos Pérez Rodríguez",
  "estado": "activo",
  "valorAdquisicion": 850000,
  "fechaAdquisicion": "2024-01-10T00:00:00Z",
  "observaciones": "",
  "creadoEn": "2024-01-10T08:00:00Z",
  "actualizadoEn": "2024-01-10T08:00:00Z",
  "creadoPor": "admin123"
}
```

### Colección: `revisiones`

```typescript
interface Revision {
  id: string;
  numeroActa?: string;           // Se genera al completar ambas firmas

  // Datos del activo
  activoId: string;
  codigoActivo: string;          // Desnormalizado
  descripcionActivo: string;     // Desnormalizado
  ubicacionActivo: string;       // Desnormalizado

  // Datos del custodio
  custodioId: string;
  custodioNombre: string;        // Desnormalizado
  custodioCedula: string;        // Desnormalizado
  custodioCargo: string;         // Desnormalizado

  // Datos del revisor (Profesional de Logística)
  revisorId: string;
  revisorNombre: string;         // Desnormalizado
  revisorCedula: string;         // Desnormalizado
  revisorCargo: string;          // Desnormalizado

  // Datos de la revisión
  fecha: Timestamp;
  estadoActivo: 'excelente' | 'bueno' | 'regular' | 'malo' | 'para_baja';
  descripcion: string;           // Descripción detallada de la revisión
  observaciones?: string;

  // Evidencias fotográficas
  evidencias: Evidencia[];

  // Firma del revisor (Profesional de Logística)
  firmaRevisor?: FirmaDigital;

  // Firma del custodio
  firmaCustodio?: FirmaDigital;

  // Estado del proceso
  estado: 'borrador' | 'pendiente_firma_custodio' | 'firmada_completa' | 'completada' | 'anulada';

  // PDF generado
  actaPdfUrl?: string;

  // Auditoría
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
  creadoPor: string;
}

interface Evidencia {
  id: string;
  url: string;
  nombre: string;
  descripcion?: string;
  subidaEn: Timestamp;
}

interface FirmaDigital {
  url: string;                   // URL de la imagen de firma en Storage
  fechaFirma: Timestamp;
  ipCliente: string;
  userAgent: string;
  hashDocumento: string;         // SHA-256 de los datos al momento de firmar
  declaracionAceptada: boolean;
  geolocalizacion?: {
    latitud: number;
    longitud: number;
  };
}
```

**Ejemplo de documento:**
```json
{
  "id": "rev001",
  "numeroActa": "ACTA-2024-00125",

  "activoId": "activo001",
  "codigoActivo": "AF-MOB-2024-0089",
  "descripcionActivo": "Escritorio ejecutivo en madera con tres cajones",
  "ubicacionActivo": "Oficina 301 - Edificio Principal",

  "custodioId": "abc123xyz",
  "custodioNombre": "Juan Carlos Pérez Rodríguez",
  "custodioCedula": "1234567890",
  "custodioCargo": "Profesional Especializado",

  "revisorId": "logistica001",
  "revisorNombre": "María Elena García López",
  "revisorCedula": "9876543210",
  "revisorCargo": "Profesional Especializado en Logística",

  "fecha": "2024-01-15T14:30:00Z",
  "estadoActivo": "bueno",
  "descripcion": "Se realizó revisión física del activo encontrándose en buen estado general. La superficie presenta desgaste normal por uso. Los cajones funcionan correctamente.",
  "observaciones": "Se recomienda limpieza periódica y mantenimiento preventivo.",

  "evidencias": [
    {
      "id": "ev001",
      "url": "https://storage.../evidencias/rev001/foto1.jpg",
      "nombre": "Vista frontal",
      "descripcion": "Vista frontal del escritorio",
      "subidaEn": "2024-01-15T14:25:00Z"
    },
    {
      "id": "ev002",
      "url": "https://storage.../evidencias/rev001/foto2.jpg",
      "nombre": "Detalle cajones",
      "descripcion": "Estado de los cajones",
      "subidaEn": "2024-01-15T14:26:00Z"
    }
  ],

  "firmaRevisor": {
    "url": "https://storage.../firmas/rev001/revisor.png",
    "fechaFirma": "2024-01-15T14:35:00Z",
    "ipCliente": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "hashDocumento": "a1b2c3d4e5f6...",
    "declaracionAceptada": true
  },

  "firmaCustodio": {
    "url": "https://storage.../firmas/rev001/custodio.png",
    "fechaFirma": "2024-01-15T15:10:00Z",
    "ipCliente": "192.168.1.105",
    "userAgent": "Mozilla/5.0...",
    "hashDocumento": "a1b2c3d4e5f6...",
    "declaracionAceptada": true
  },

  "estado": "completada",
  "actaPdfUrl": "https://storage.../actas/rev001.pdf",

  "creadoEn": "2024-01-15T14:20:00Z",
  "actualizadoEn": "2024-01-15T15:15:00Z",
  "creadoPor": "logistica001"
}
```

### Colección: `consecutivos`

```typescript
interface Consecutivo {
  id: string;          // "actas"
  año: number;
  ultimo: number;      // Último número usado
}
```

**Ejemplo:**
```json
{
  "id": "actas",
  "año": 2024,
  "ultimo": 125
}
```

### Colección: `auditoria`

```typescript
interface LogAuditoria {
  id: string;
  accion: 'crear' | 'modificar' | 'firmar' | 'anular' | 'eliminar';
  modulo: 'usuarios' | 'activos' | 'revisiones';
  documentoId: string;
  usuarioId: string;
  usuarioEmail: string;
  usuarioNombre: string;
  descripcion: string;
  datosAntes?: Record<string, any>;
  datosDespues?: Record<string, any>;
  ip: string;
  userAgent: string;
  timestamp: Timestamp;
}
```

---

## 4. Estructura del Proyecto

```
APP_ACTAS/
├── public/
│   └── images/
│       ├── logo-serviciudad.png
│       └── favicon.ico
│
├── src/
│   ├── app/                          # App Router de Next.js
│   │   ├── globals.css
│   │   ├── layout.tsx                # Layout principal
│   │   ├── page.tsx                  # Página de inicio (redirect a login/dashboard)
│   │   │
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   │   └── page.tsx          # Página de login
│   │   │   └── layout.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── page.tsx              # Dashboard principal según rol
│   │   │   └── layout.tsx            # Layout con sidebar
│   │   │
│   │   ├── revision/
│   │   │   ├── page.tsx              # Lista de revisiones
│   │   │   ├── nueva/
│   │   │   │   └── [activoId]/
│   │   │   │       └── page.tsx      # Nueva revisión para un activo
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx          # Detalle de revisión
│   │   │   └── firmar/
│   │   │       └── [id]/
│   │   │           └── page.tsx      # Página para firma del custodio
│   │   │
│   │   ├── activos/
│   │   │   ├── page.tsx              # Lista de activos
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Detalle de activo
│   │   │
│   │   └── admin/
│   │       ├── layout.tsx            # Layout admin
│   │       ├── usuarios/
│   │       │   ├── page.tsx          # Lista usuarios
│   │       │   └── [id]/
│   │       │       └── page.tsx      # Editar usuario
│   │       ├── activos/
│   │       │   ├── page.tsx          # Lista activos
│   │       │   └── [id]/
│   │       │       └── page.tsx      # Editar activo
│   │       └── reportes/
│   │           └── page.tsx          # Reportes y auditoría
│   │
│   ├── components/
│   │   ├── ui/                       # Componentes UI base (shadcn)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── select.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── table.tsx
│   │   │   ├── badge.tsx
│   │   │   └── spinner.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── AuthGuard.tsx         # Protección de rutas
│   │   │
│   │   ├── forms/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── UsuarioForm.tsx
│   │   │   ├── ActivoForm.tsx
│   │   │   └── RevisionForm.tsx
│   │   │
│   │   ├── signature/
│   │   │   ├── SignaturePad.tsx      # Componente de captura de firma
│   │   │   └── SignatureModal.tsx    # Modal para firmar
│   │   │
│   │   ├── revision/
│   │   │   ├── RevisionCard.tsx
│   │   │   ├── RevisionDetail.tsx
│   │   │   ├── EvidenciasUploader.tsx
│   │   │   ├── EvidenciasGallery.tsx
│   │   │   └── EstadoActivo.tsx
│   │   │
│   │   └── activos/
│   │       ├── ActivoCard.tsx
│   │       └── ActivoDetail.tsx
│   │
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── config.ts             # Configuración Firebase
│   │   │   ├── auth.ts               # Funciones de autenticación
│   │   │   ├── firestore.ts          # Helpers de Firestore
│   │   │   └── storage.ts            # Helpers de Storage
│   │   │
│   │   ├── utils/
│   │   │   ├── cn.ts                 # Utility para clases CSS
│   │   │   ├── formatters.ts         # Formateo de fechas, moneda, etc.
│   │   │   ├── hash.ts               # Generación de hash SHA-256
│   │   │   └── imageCompression.ts   # Compresión de imágenes
│   │   │
│   │   └── validations/
│   │       ├── usuario.ts            # Schema Zod para usuarios
│   │       ├── activo.ts             # Schema Zod para activos
│   │       └── revision.ts           # Schema Zod para revisiones
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                # Hook de autenticación
│   │   ├── useUsuarios.ts            # Hook para usuarios
│   │   ├── useActivos.ts             # Hook para activos
│   │   ├── useRevisiones.ts          # Hook para revisiones
│   │   └── useToast.ts               # Hook para notificaciones
│   │
│   ├── services/
│   │   ├── usuarioService.ts         # CRUD usuarios
│   │   ├── activoService.ts          # CRUD activos
│   │   ├── revisionService.ts        # CRUD revisiones
│   │   └── auditoriaService.ts       # Registro de auditoría
│   │
│   ├── stores/
│   │   ├── authStore.ts              # Estado de autenticación (Zustand)
│   │   └── uiStore.ts                # Estado de UI
│   │
│   └── types/
│       ├── index.ts                  # Exportaciones
│       ├── usuario.ts                # Tipos de usuario
│       ├── activo.ts                 # Tipos de activo
│       ├── revision.ts               # Tipos de revisión
│       └── auditoria.ts              # Tipos de auditoría
│
├── functions/                        # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.ts                  # Entry point
│   │   ├── generarActaPDF.ts         # Generación de PDF
│   │   ├── consecutivos.ts           # Manejo de consecutivos
│   │   ├── auditoria.ts              # Triggers de auditoría
│   │   └── utils/
│   │       ├── pdfGenerator.ts       # Lógica de generación PDF
│   │       └── storage.ts            # Helpers de storage
│   │
│   ├── package.json
│   └── tsconfig.json
│
├── .env.local                        # Variables de entorno (NO commitear)
├── .env.example                      # Ejemplo de variables
├── .gitignore
├── firebase.json                     # Configuración Firebase
├── firestore.rules                   # Reglas de seguridad Firestore
├── firestore.indexes.json            # Índices de Firestore
├── storage.rules                     # Reglas de seguridad Storage
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── README.md
```

---

## 5. Configuración Inicial

### 5.1 Crear Proyecto en Firebase Console

1. Ir a [Firebase Console](https://console.firebase.google.com/)
2. Crear nuevo proyecto: `serviciudad-actas`
3. Habilitar:
   - **Authentication** → Email/Password
   - **Cloud Firestore** → Modo producción
   - **Storage** → Modo producción
   - **Functions** → Plan Blaze (requerido para funciones)

### 5.2 Variables de Entorno

**Archivo: `.env.local`**
```env
# Firebase Config (obtener de Firebase Console → Project Settings)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=serviciudad-actas.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=serviciudad-actas
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=serviciudad-actas.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Configuración de la aplicación
NEXT_PUBLIC_APP_NAME=Sistema de Actas - SERVICIUDAD ESP
NEXT_PUBLIC_EMPRESA_NIT=123.456.789-0
NEXT_PUBLIC_EMPRESA_DIRECCION=Calle Principal #123, Ciudad, Colombia
```

### 5.3 package.json

```json
{
  "name": "app-actas-serviciudad",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "firebase:emulators": "firebase emulators:start",
    "firebase:deploy": "firebase deploy"
  },
  "dependencies": {
    "next": "^14.0.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "firebase": "^10.7.1",
    "react-hook-form": "^7.49.2",
    "@hookform/resolvers": "^3.3.2",
    "zod": "^3.22.4",
    "zustand": "^4.4.7",
    "react-signature-canvas": "^1.0.6",
    "browser-image-compression": "^2.0.2",
    "date-fns": "^3.0.6",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.2.0",
    "lucide-react": "^0.303.0",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-toast": "^1.1.5",
    "class-variance-authority": "^0.7.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.6",
    "@types/react": "^18.2.46",
    "@types/react-dom": "^18.2.18",
    "@types/react-signature-canvas": "^1.0.5",
    "typescript": "^5.3.3",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.32",
    "autoprefixer": "^10.4.16",
    "eslint": "^8.56.0",
    "eslint-config-next": "^14.0.4"
  }
}
```

### 5.4 Configuración Firebase

**Archivo: `src/lib/firebase/config.ts`**
```typescript
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Inicializar solo si no existe
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
```

### 5.5 Configurar Índices de Firestore

**Archivo: `firestore.indexes.json`**
```json
{
  "indexes": [
    {
      "collectionGroup": "revisiones",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "custodioId", "order": "ASCENDING" },
        { "fieldPath": "fecha", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "revisiones",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "revisorId", "order": "ASCENDING" },
        { "fieldPath": "fecha", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "revisiones",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "activoId", "order": "ASCENDING" },
        { "fieldPath": "fecha", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "revisiones",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "estado", "order": "ASCENDING" },
        { "fieldPath": "creadoEn", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "activos",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "custodioId", "order": "ASCENDING" },
        { "fieldPath": "codigo", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "auditoria",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "modulo", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

## 6. Implementación por Módulos

### 6.1 Módulo de Autenticación

#### Tipos (`src/types/usuario.ts`)
```typescript
export type RolUsuario = 'admin' | 'logistica' | 'custodio';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  cedula: string;
  cargo: string;
  dependencia: string;
  telefono?: string;
  rol: RolUsuario;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
  creadoPor: string;
}

export interface UsuarioAuth {
  uid: string;
  email: string | null;
  usuario: Usuario | null;
}
```

#### Store de Autenticación (`src/stores/authStore.ts`)
```typescript
import { create } from 'zustand';
import { Usuario, UsuarioAuth } from '@/types/usuario';

interface AuthState {
  user: UsuarioAuth | null;
  loading: boolean;
  setUser: (user: UsuarioAuth | null) => void;
  setLoading: (loading: boolean) => void;
  isAdmin: () => boolean;
  isLogistica: () => boolean;
  isCustodio: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  isAdmin: () => get().user?.usuario?.rol === 'admin',
  isLogistica: () => get().user?.usuario?.rol === 'logistica',
  isCustodio: () => get().user?.usuario?.rol === 'custodio',
}));
```

#### Hook de Auth (`src/hooks/useAuth.ts`)
```typescript
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { useAuthStore } from '@/stores/authStore';
import { Usuario } from '@/types/usuario';

export function useAuth() {
  const { user, loading, setUser, setLoading, isAdmin, isLogistica, isCustodio } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Obtener datos del usuario de Firestore
        const userDoc = await getDoc(doc(db, 'usuarios', firebaseUser.uid));
        const usuario = userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } as Usuario : null;

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          usuario,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setLoading]);

  return { user, loading, isAdmin, isLogistica, isCustodio };
}
```

#### Componente AuthGuard (`src/components/layout/AuthGuard.tsx`)
```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { RolUsuario } from '@/types/usuario';
import { Spinner } from '@/components/ui/spinner';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: RolUsuario[];
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/auth/login');
      } else if (allowedRoles && user.usuario && !allowedRoles.includes(user.usuario.rol)) {
        router.push('/dashboard'); // Redirigir si no tiene permiso
      }
    }
  }, [user, loading, router, allowedRoles]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (allowedRoles && user.usuario && !allowedRoles.includes(user.usuario.rol)) {
    return null;
  }

  return <>{children}</>;
}
```

#### Formulario de Login (`src/components/forms/LoginForm.tsx`)
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { auth } from '@/lib/firebase/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      router.push('/dashboard');
    } catch (err: any) {
      setError('Credenciales inválidas. Por favor verifique su correo y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          placeholder="correo@serviciudad.gov.co"
        />
        {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          {...register('password')}
          placeholder="••••••••"
        />
        {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Ingresando...' : 'Ingresar'}
      </Button>
    </form>
  );
}
```

### 6.2 Módulo de Revisiones

#### Tipos (`src/types/revision.ts`)
```typescript
export type EstadoActivo = 'excelente' | 'bueno' | 'regular' | 'malo' | 'para_baja';
export type EstadoRevision = 'borrador' | 'pendiente_firma_custodio' | 'firmada_completa' | 'completada' | 'anulada';

export interface Evidencia {
  id: string;
  url: string;
  nombre: string;
  descripcion?: string;
  subidaEn: Date;
}

export interface FirmaDigital {
  url: string;
  fechaFirma: Date;
  ipCliente: string;
  userAgent: string;
  hashDocumento: string;
  declaracionAceptada: boolean;
  geolocalizacion?: {
    latitud: number;
    longitud: number;
  };
}

export interface Revision {
  id: string;
  numeroActa?: string;

  // Activo
  activoId: string;
  codigoActivo: string;
  descripcionActivo: string;
  ubicacionActivo: string;

  // Custodio
  custodioId: string;
  custodioNombre: string;
  custodioCedula: string;
  custodioCargo: string;

  // Revisor (Profesional de Logística)
  revisorId: string;
  revisorNombre: string;
  revisorCedula: string;
  revisorCargo: string;

  // Datos revisión
  fecha: Date;
  estadoActivo: EstadoActivo;
  descripcion: string;
  observaciones?: string;

  // Evidencias y firmas
  evidencias: Evidencia[];
  firmaRevisor?: FirmaDigital;
  firmaCustodio?: FirmaDigital;

  // Estado y PDF
  estado: EstadoRevision;
  actaPdfUrl?: string;

  // Auditoría
  creadoEn: Date;
  actualizadoEn: Date;
  creadoPor: string;
}
```

#### Servicio de Revisiones (`src/services/revisionService.ts`)
```typescript
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import { Revision, Evidencia, FirmaDigital } from '@/types/revision';
import { calcularHash } from '@/lib/utils/hash';
import imageCompression from 'browser-image-compression';

const COLLECTION = 'revisiones';

// Crear nueva revisión (borrador)
export async function crearRevision(data: Omit<Revision, 'id' | 'creadoEn' | 'actualizadoEn'>): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    estado: 'borrador',
    evidencias: [],
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  });
  return docRef.id;
}

// Subir evidencia fotográfica
export async function subirEvidencia(
  revisionId: string,
  archivo: File,
  nombre: string,
  descripcion?: string
): Promise<Evidencia> {
  // Comprimir imagen
  const opciones = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  };
  const archivoComprimido = await imageCompression(archivo, opciones);

  // Subir a Storage
  const nombreArchivo = `${Date.now()}_${archivo.name}`;
  const storageRef = ref(storage, `evidencias/${revisionId}/${nombreArchivo}`);
  await uploadBytes(storageRef, archivoComprimido);
  const url = await getDownloadURL(storageRef);

  const evidencia: Evidencia = {
    id: nombreArchivo,
    url,
    nombre,
    descripcion,
    subidaEn: new Date(),
  };

  // Actualizar documento con nueva evidencia
  const revisionRef = doc(db, COLLECTION, revisionId);
  const revisionDoc = await getDoc(revisionRef);
  const evidenciasActuales = revisionDoc.data()?.evidencias || [];

  await updateDoc(revisionRef, {
    evidencias: [...evidenciasActuales, evidencia],
    actualizadoEn: serverTimestamp(),
  });

  return evidencia;
}

// Firmar como revisor (Profesional de Logística)
export async function firmarComoRevisor(
  revisionId: string,
  firmaDataUrl: string,
  datosRevision: object
): Promise<void> {
  // Calcular hash del documento
  const hashDocumento = await calcularHash(JSON.stringify(datosRevision));

  // Subir imagen de firma
  const blob = await (await fetch(firmaDataUrl)).blob();
  const storageRef = ref(storage, `firmas/${revisionId}/revisor.png`);
  await uploadBytes(storageRef, blob);
  const urlFirma = await getDownloadURL(storageRef);

  const firma: FirmaDigital = {
    url: urlFirma,
    fechaFirma: new Date(),
    ipCliente: '', // Se obtiene en el cliente
    userAgent: navigator.userAgent,
    hashDocumento,
    declaracionAceptada: true,
  };

  await updateDoc(doc(db, COLLECTION, revisionId), {
    firmaRevisor: firma,
    estado: 'pendiente_firma_custodio',
    actualizadoEn: serverTimestamp(),
  });
}

// Firmar como custodio
export async function firmarComoCustodio(
  revisionId: string,
  firmaDataUrl: string,
  datosRevision: object
): Promise<void> {
  const hashDocumento = await calcularHash(JSON.stringify(datosRevision));

  const blob = await (await fetch(firmaDataUrl)).blob();
  const storageRef = ref(storage, `firmas/${revisionId}/custodio.png`);
  await uploadBytes(storageRef, blob);
  const urlFirma = await getDownloadURL(storageRef);

  const firma: FirmaDigital = {
    url: urlFirma,
    fechaFirma: new Date(),
    ipCliente: '',
    userAgent: navigator.userAgent,
    hashDocumento,
    declaracionAceptada: true,
  };

  await updateDoc(doc(db, COLLECTION, revisionId), {
    firmaCustodio: firma,
    estado: 'firmada_completa', // Cloud Function detectará esto y generará el PDF
    actualizadoEn: serverTimestamp(),
  });
}

// Obtener revisiones por custodio (para que firme)
export async function obtenerRevisionesPendientesFirma(custodioId: string): Promise<Revision[]> {
  const q = query(
    collection(db, COLLECTION),
    where('custodioId', '==', custodioId),
    where('estado', '==', 'pendiente_firma_custodio'),
    orderBy('fecha', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Revision[];
}

// Obtener revisiones creadas por el revisor
export async function obtenerRevisionesPorRevisor(revisorId: string): Promise<Revision[]> {
  const q = query(
    collection(db, COLLECTION),
    where('revisorId', '==', revisorId),
    orderBy('fecha', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Revision[];
}

// Obtener revisión por ID
export async function obtenerRevision(id: string): Promise<Revision | null> {
  const docSnap = await getDoc(doc(db, COLLECTION, id));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as Revision;
}
```

#### Componente de Firma (`src/components/signature/SignaturePad.tsx`)
```typescript
'use client';

import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  titulo: string;
  nombreFirmante: string;
  cedulaFirmante: string;
  declaracion: string;
}

export function SignaturePad({
  onSave,
  onCancel,
  titulo,
  nombreFirmante,
  cedulaFirmante,
  declaracion,
}: SignaturePadProps) {
  const signatureRef = useRef<SignatureCanvas>(null);
  const [aceptaDeclaracion, setAceptaDeclaracion] = useState(false);

  const handleClear = () => {
    signatureRef.current?.clear();
  };

  const handleSave = () => {
    if (signatureRef.current?.isEmpty()) {
      alert('Por favor, dibuje su firma antes de continuar.');
      return;
    }

    if (!aceptaDeclaracion) {
      alert('Debe aceptar la declaración para continuar.');
      return;
    }

    const dataUrl = signatureRef.current?.toDataURL('image/png');
    if (dataUrl) {
      onSave(dataUrl);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg mx-auto">
      <h3 className="text-lg font-semibold mb-4">{titulo}</h3>

      <div className="mb-4 p-3 bg-gray-50 rounded">
        <p className="text-sm"><strong>Nombre:</strong> {nombreFirmante}</p>
        <p className="text-sm"><strong>Cédula:</strong> {cedulaFirmante}</p>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">Dibuje su firma en el recuadro:</p>
        <div className="border-2 border-gray-300 rounded">
          <SignatureCanvas
            ref={signatureRef}
            penColor="black"
            canvasProps={{
              width: 400,
              height: 200,
              className: 'signature-canvas',
            }}
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={aceptaDeclaracion}
            onChange={(e) => setAceptaDeclaracion(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm text-gray-700">{declaracion}</span>
        </label>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={handleClear}>
          Limpiar
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={!aceptaDeclaracion}>
          Firmar
        </Button>
      </div>
    </div>
  );
}
```

#### Formulario de Revisión (`src/components/forms/RevisionForm.tsx`)
```typescript
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { EvidenciasUploader } from '@/components/revision/EvidenciasUploader';
import { SignaturePad } from '@/components/signature/SignaturePad';
import { Activo } from '@/types/activo';
import { useAuth } from '@/hooks/useAuth';
import { crearRevision, subirEvidencia, firmarComoRevisor } from '@/services/revisionService';

const revisionSchema = z.object({
  fecha: z.string().min(1, 'La fecha es requerida'),
  estadoActivo: z.enum(['excelente', 'bueno', 'regular', 'malo', 'para_baja']),
  descripcion: z.string().min(10, 'La descripción debe tener al menos 10 caracteres'),
  observaciones: z.string().optional(),
});

type RevisionFormData = z.infer<typeof revisionSchema>;

interface RevisionFormProps {
  activo: Activo;
  custodio: {
    id: string;
    nombre: string;
    cedula: string;
    cargo: string;
  };
  onSuccess: (revisionId: string) => void;
}

export function RevisionForm({ activo, custodio, onSuccess }: RevisionFormProps) {
  const { user } = useAuth();
  const [paso, setPaso] = useState<'formulario' | 'evidencias' | 'firma'>('formulario');
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [evidencias, setEvidencias] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<RevisionFormData>({
    resolver: zodResolver(revisionSchema),
    defaultValues: {
      fecha: new Date().toISOString().split('T')[0],
      estadoActivo: 'bueno',
    },
  });

  // Paso 1: Guardar datos básicos
  const onSubmitFormulario = async (data: RevisionFormData) => {
    if (!user?.usuario) return;
    setLoading(true);

    try {
      const id = await crearRevision({
        activoId: activo.id,
        codigoActivo: activo.codigo,
        descripcionActivo: activo.descripcion,
        ubicacionActivo: activo.ubicacion,

        custodioId: custodio.id,
        custodioNombre: custodio.nombre,
        custodioCedula: custodio.cedula,
        custodioCargo: custodio.cargo,

        revisorId: user.uid,
        revisorNombre: user.usuario.nombre,
        revisorCedula: user.usuario.cedula,
        revisorCargo: user.usuario.cargo,

        fecha: new Date(data.fecha),
        estadoActivo: data.estadoActivo,
        descripcion: data.descripcion,
        observaciones: data.observaciones,

        estado: 'borrador',
        creadoPor: user.uid,
      });

      setRevisionId(id);
      setPaso('evidencias');
    } catch (error) {
      console.error('Error al crear revisión:', error);
      alert('Error al crear la revisión');
    } finally {
      setLoading(false);
    }
  };

  // Paso 2: Subir evidencias
  const handleSubirEvidencias = async () => {
    if (!revisionId) return;
    setLoading(true);

    try {
      for (let i = 0; i < evidencias.length; i++) {
        await subirEvidencia(
          revisionId,
          evidencias[i],
          `Evidencia ${i + 1}`,
          `Fotografía de revisión ${i + 1}`
        );
      }
      setPaso('firma');
    } catch (error) {
      console.error('Error al subir evidencias:', error);
      alert('Error al subir las evidencias');
    } finally {
      setLoading(false);
    }
  };

  // Paso 3: Firmar como revisor
  const handleFirmaRevisor = async (firmaDataUrl: string) => {
    if (!revisionId) return;
    setLoading(true);

    try {
      const datosRevision = {
        ...getValues(),
        activo,
        custodio,
        revisor: user?.usuario,
        fecha: new Date().toISOString(),
      };

      await firmarComoRevisor(revisionId, firmaDataUrl, datosRevision);
      onSuccess(revisionId);
    } catch (error) {
      console.error('Error al firmar:', error);
      alert('Error al registrar la firma');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Indicador de pasos */}
      <div className="flex justify-between mb-8">
        {['Datos', 'Evidencias', 'Firma'].map((label, index) => (
          <div
            key={label}
            className={`flex items-center ${
              index < ['formulario', 'evidencias', 'firma'].indexOf(paso)
                ? 'text-green-600'
                : paso === ['formulario', 'evidencias', 'firma'][index]
                ? 'text-blue-600'
                : 'text-gray-400'
            }`}
          >
            <span className="w-8 h-8 rounded-full border-2 flex items-center justify-center mr-2">
              {index + 1}
            </span>
            {label}
          </div>
        ))}
      </div>

      {/* Paso 1: Formulario */}
      {paso === 'formulario' && (
        <form onSubmit={handleSubmit(onSubmitFormulario)} className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold mb-2">Activo a revisar</h3>
            <p><strong>Código:</strong> {activo.codigo}</p>
            <p><strong>Descripción:</strong> {activo.descripcion}</p>
            <p><strong>Ubicación:</strong> {activo.ubicacion}</p>
            <p><strong>Custodio:</strong> {custodio.nombre}</p>
          </div>

          <div>
            <Label htmlFor="fecha">Fecha de revisión</Label>
            <Input type="date" {...register('fecha')} />
            {errors.fecha && <p className="text-red-500 text-sm">{errors.fecha.message}</p>}
          </div>

          <div>
            <Label htmlFor="estadoActivo">Estado del activo</Label>
            <select
              {...register('estadoActivo')}
              className="w-full p-2 border rounded"
            >
              <option value="excelente">Excelente</option>
              <option value="bueno">Bueno</option>
              <option value="regular">Regular</option>
              <option value="malo">Malo</option>
              <option value="para_baja">Para baja</option>
            </select>
          </div>

          <div>
            <Label htmlFor="descripcion">Descripción de la revisión</Label>
            <Textarea
              {...register('descripcion')}
              rows={4}
              placeholder="Describa detalladamente el estado del activo y los hallazgos de la revisión..."
            />
            {errors.descripcion && <p className="text-red-500 text-sm">{errors.descripcion.message}</p>}
          </div>

          <div>
            <Label htmlFor="observaciones">Observaciones adicionales</Label>
            <Textarea
              {...register('observaciones')}
              rows={3}
              placeholder="Observaciones o recomendaciones..."
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Guardando...' : 'Continuar a Evidencias'}
          </Button>
        </form>
      )}

      {/* Paso 2: Evidencias */}
      {paso === 'evidencias' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Subir evidencias fotográficas</h3>
          <p className="text-gray-600">
            Agregue fotografías del activo revisado. Mínimo 1, máximo 5 fotografías.
          </p>

          <EvidenciasUploader
            evidencias={evidencias}
            onChange={setEvidencias}
            maxFiles={5}
          />

          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setPaso('formulario')}>
              Volver
            </Button>
            <Button
              onClick={handleSubirEvidencias}
              disabled={evidencias.length === 0 || loading}
              className="flex-1"
            >
              {loading ? 'Subiendo...' : 'Continuar a Firma'}
            </Button>
          </div>
        </div>
      )}

      {/* Paso 3: Firma */}
      {paso === 'firma' && user?.usuario && (
        <SignaturePad
          titulo="Firma del Profesional de Logística"
          nombreFirmante={user.usuario.nombre}
          cedulaFirmante={user.usuario.cedula}
          declaracion="Certifico que he realizado la revisión física del activo y que la información registrada corresponde al estado real del mismo al momento de la inspección."
          onSave={handleFirmaRevisor}
          onCancel={() => setPaso('evidencias')}
        />
      )}
    </div>
  );
}
```

---

## 7. Cloud Functions

### Estructura de Functions

**Archivo: `functions/package.json`**
```json
{
  "name": "functions",
  "scripts": {
    "build": "tsc",
    "serve": "npm run build && firebase emulators:start --only functions",
    "shell": "npm run build && firebase functions:shell",
    "deploy": "firebase deploy --only functions"
  },
  "engines": {
    "node": "18"
  },
  "main": "lib/index.js",
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^4.5.0",
    "pdfkit": "^0.14.0"
  },
  "devDependencies": {
    "@types/pdfkit": "^0.13.0",
    "typescript": "^5.3.3"
  }
}
```

### Función Principal: Generar Acta PDF

**Archivo: `functions/src/index.ts`**
```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { generarActaPDF } from './generarActaPDF';
import { generarConsecutivo } from './consecutivos';

admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();

// Trigger cuando una revisión tiene ambas firmas
export const onRevisionFirmadaCompleta = functions.firestore
  .document('revisiones/{revisionId}')
  .onUpdate(async (change, context) => {
    const antes = change.before.data();
    const despues = change.after.data();
    const revisionId = context.params.revisionId;

    // Verificar que el estado cambió a 'firmada_completa'
    if (antes.estado !== 'firmada_completa' && despues.estado === 'firmada_completa') {

      // Verificar que ambas firmas existen
      if (!despues.firmaRevisor?.url || !despues.firmaCustodio?.url) {
        console.error('Faltan firmas en la revisión', revisionId);
        return null;
      }

      try {
        // 1. Generar número de acta consecutivo
        const numeroActa = await generarConsecutivo(db);

        // 2. Generar el PDF
        const pdfBuffer = await generarActaPDF({
          numeroActa,
          revision: despues,
          storage,
        });

        // 3. Subir PDF a Storage
        const bucket = storage.bucket();
        const pdfPath = `actas/${revisionId}.pdf`;
        const file = bucket.file(pdfPath);

        await file.save(pdfBuffer, {
          metadata: {
            contentType: 'application/pdf',
          },
        });

        // Hacer el archivo público o generar URL firmada
        await file.makePublic();
        const pdfUrl = `https://storage.googleapis.com/${bucket.name}/${pdfPath}`;

        // 4. Actualizar documento con el PDF y estado final
        await change.after.ref.update({
          numeroActa,
          actaPdfUrl: pdfUrl,
          estado: 'completada',
          actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 5. Registrar en auditoría
        await db.collection('auditoria').add({
          accion: 'completar',
          modulo: 'revisiones',
          documentoId: revisionId,
          usuarioId: 'system',
          usuarioEmail: 'system@serviciudad.gov.co',
          usuarioNombre: 'Sistema',
          descripcion: `Acta ${numeroActa} generada automáticamente`,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Acta ${numeroActa} generada exitosamente para revisión ${revisionId}`);
        return { success: true, numeroActa };

      } catch (error) {
        console.error('Error al generar acta PDF:', error);

        // Marcar la revisión con error
        await change.after.ref.update({
          estado: 'error_generacion',
          errorMensaje: String(error),
          actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: false, error: String(error) };
      }
    }

    return null;
  });

// Trigger para auditoría automática
export const onDocumentoModificado = functions.firestore
  .document('{coleccion}/{docId}')
  .onWrite(async (change, context) => {
    const coleccion = context.params.coleccion;

    // Solo auditar colecciones específicas
    if (!['usuarios', 'activos', 'revisiones'].includes(coleccion)) {
      return null;
    }

    // No auditar la colección de auditoría
    if (coleccion === 'auditoria') {
      return null;
    }

    const antes = change.before.exists ? change.before.data() : null;
    const despues = change.after.exists ? change.after.data() : null;

    let accion: string;
    if (!antes && despues) {
      accion = 'crear';
    } else if (antes && !despues) {
      accion = 'eliminar';
    } else {
      accion = 'modificar';
    }

    // Obtener usuario que hizo el cambio
    const usuarioId = despues?.actualizadoPor || despues?.creadoPor || 'unknown';

    await db.collection('auditoria').add({
      accion,
      modulo: coleccion,
      documentoId: context.params.docId,
      usuarioId,
      datosAntes: antes,
      datosDespues: despues,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return null;
  });
```

### Generador de PDF

**Archivo: `functions/src/generarActaPDF.ts`**
```typescript
import PDFDocument from 'pdfkit';
import * as admin from 'firebase-admin';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface GenerarPDFParams {
  numeroActa: string;
  revision: FirebaseFirestore.DocumentData;
  storage: admin.storage.Storage;
}

export async function generarActaPDF({ numeroActa, revision, storage }: GenerarPDFParams): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Descargar imágenes de firma
      const bucket = storage.bucket();

      const [firmaRevisorBuffer] = await bucket
        .file(revision.firmaRevisor.url.replace(`https://storage.googleapis.com/${bucket.name}/`, ''))
        .download();

      const [firmaCustodioBuffer] = await bucket
        .file(revision.firmaCustodio.url.replace(`https://storage.googleapis.com/${bucket.name}/`, ''))
        .download();

      // Descargar evidencias
      const evidenciasBuffers: Buffer[] = [];
      for (const evidencia of revision.evidencias.slice(0, 4)) { // Máximo 4 para el PDF
        try {
          const [buffer] = await bucket
            .file(evidencia.url.replace(`https://storage.googleapis.com/${bucket.name}/`, ''))
            .download();
          evidenciasBuffers.push(buffer);
        } catch (e) {
          console.warn('No se pudo descargar evidencia:', evidencia.url);
        }
      }

      // ============ ENCABEZADO ============
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('SERVICIUDAD ESP', { align: 'center' });
      doc.fontSize(10).font('Helvetica');
      doc.text('NIT: 123.456.789-0', { align: 'center' });
      doc.text('Dirección de Activos Fijos', { align: 'center' });
      doc.moveDown();

      // Línea separadora
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown();

      // ============ TÍTULO DEL ACTA ============
      doc.fontSize(14).font('Helvetica-Bold');
      doc.text('ACTA DE REVISIÓN DE ACTIVO FIJO', { align: 'center' });
      doc.fontSize(12);
      doc.text(`No. ${numeroActa}`, { align: 'center' });
      doc.moveDown();

      // ============ INFORMACIÓN GENERAL ============
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('INFORMACIÓN GENERAL');
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fontSize(10).font('Helvetica');
      const fechaFormateada = format(revision.fecha.toDate(), "d 'de' MMMM 'de' yyyy", { locale: es });

      doc.text(`Fecha de revisión: ${fechaFormateada}`);
      doc.text(`Código del activo: ${revision.codigoActivo}`);
      doc.text(`Descripción: ${revision.descripcionActivo}`);
      doc.text(`Ubicación: ${revision.ubicacionActivo}`);
      doc.moveDown();

      // ============ DATOS DEL CUSTODIO ============
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('DATOS DEL CUSTODIO');
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fontSize(10).font('Helvetica');
      doc.text(`Nombre: ${revision.custodioNombre}`);
      doc.text(`Cédula: ${revision.custodioCedula}`);
      doc.text(`Cargo: ${revision.custodioCargo}`);
      doc.moveDown();

      // ============ DATOS DEL REVISOR ============
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('DATOS DEL REVISOR');
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fontSize(10).font('Helvetica');
      doc.text(`Nombre: ${revision.revisorNombre}`);
      doc.text(`Cédula: ${revision.revisorCedula}`);
      doc.text(`Cargo: ${revision.revisorCargo}`);
      doc.moveDown();

      // ============ RESULTADO DE LA REVISIÓN ============
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('RESULTADO DE LA REVISIÓN');
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fontSize(10).font('Helvetica');
      const estadosTexto: Record<string, string> = {
        excelente: 'EXCELENTE',
        bueno: 'BUENO',
        regular: 'REGULAR',
        malo: 'MALO',
        para_baja: 'PARA BAJA',
      };
      doc.text(`Estado del activo: ${estadosTexto[revision.estadoActivo] || revision.estadoActivo}`);
      doc.moveDown(0.5);

      doc.font('Helvetica-Bold').text('Descripción de la revisión:');
      doc.font('Helvetica').text(revision.descripcion);

      if (revision.observaciones) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text('Observaciones:');
        doc.font('Helvetica').text(revision.observaciones);
      }
      doc.moveDown();

      // ============ REGISTRO FOTOGRÁFICO ============
      if (evidenciasBuffers.length > 0) {
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text('REGISTRO FOTOGRÁFICO');
        doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
        doc.moveDown(0.5);

        const imageWidth = 240;
        const imageHeight = 180;
        let x = 50;
        let y = doc.y;

        for (let i = 0; i < evidenciasBuffers.length; i++) {
          if (i > 0 && i % 2 === 0) {
            y += imageHeight + 20;
            x = 50;
          }

          try {
            doc.image(evidenciasBuffers[i], x, y, {
              width: imageWidth,
              height: imageHeight,
              fit: [imageWidth, imageHeight],
            });
          } catch (e) {
            doc.rect(x, y, imageWidth, imageHeight).stroke();
            doc.text('Imagen no disponible', x + 10, y + imageHeight / 2);
          }

          x += imageWidth + 20;
        }

        doc.y = y + imageHeight + 20;
      }

      // ============ NUEVA PÁGINA PARA FIRMAS ============
      doc.addPage();

      // ============ DECLARACIÓN ============
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('DECLARACIÓN Y CONSTANCIA');
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fontSize(10).font('Helvetica');
      doc.text(
        'El profesional de logística certifica que realizó la revisión física del activo y que la información ' +
        'registrada corresponde al estado real del mismo al momento de la inspección.',
        { align: 'justify' }
      );
      doc.moveDown(0.5);
      doc.text(
        'El custodio certifica que la información registrada es veraz y acepta la responsabilidad sobre el ' +
        'activo a su cargo en el estado descrito.',
        { align: 'justify' }
      );
      doc.moveDown(2);

      // ============ FIRMAS ============
      const firmaWidth = 200;
      const firmaHeight = 80;
      const firmaY = doc.y;

      // Firma del Revisor (izquierda)
      doc.image(firmaRevisorBuffer, 80, firmaY, {
        width: firmaWidth,
        height: firmaHeight,
        fit: [firmaWidth, firmaHeight],
      });
      doc.moveTo(80, firmaY + firmaHeight + 5).lineTo(280, firmaY + firmaHeight + 5).stroke();
      doc.fontSize(9);
      doc.text(revision.revisorNombre, 80, firmaY + firmaHeight + 10, { width: firmaWidth, align: 'center' });
      doc.text(`C.C. ${revision.revisorCedula}`, 80, doc.y, { width: firmaWidth, align: 'center' });
      doc.text('Profesional Especializado en Logística', 80, doc.y, { width: firmaWidth, align: 'center' });

      const fechaFirmaRevisor = format(revision.firmaRevisor.fechaFirma.toDate(), 'dd/MM/yyyy HH:mm:ss');
      doc.fontSize(8).text(`Firmado: ${fechaFirmaRevisor}`, 80, doc.y, { width: firmaWidth, align: 'center' });

      // Firma del Custodio (derecha)
      doc.image(firmaCustodioBuffer, 320, firmaY, {
        width: firmaWidth,
        height: firmaHeight,
        fit: [firmaWidth, firmaHeight],
      });
      doc.moveTo(320, firmaY + firmaHeight + 5).lineTo(520, firmaY + firmaHeight + 5).stroke();
      doc.fontSize(9);
      doc.text(revision.custodioNombre, 320, firmaY + firmaHeight + 10, { width: firmaWidth, align: 'center' });
      doc.text(`C.C. ${revision.custodioCedula}`, 320, doc.y, { width: firmaWidth, align: 'center' });
      doc.text('Custodio del Activo', 320, doc.y, { width: firmaWidth, align: 'center' });

      const fechaFirmaCustodio = format(revision.firmaCustodio.fechaFirma.toDate(), 'dd/MM/yyyy HH:mm:ss');
      doc.fontSize(8).text(`Firmado: ${fechaFirmaCustodio}`, 320, doc.y, { width: firmaWidth, align: 'center' });

      // ============ PIE DE PÁGINA ============
      doc.fontSize(8).font('Helvetica');
      const bottomY = doc.page.height - 60;
      doc.moveTo(50, bottomY).lineTo(562, bottomY).stroke();
      doc.text('Documento generado automáticamente por el Sistema de Activos Fijos - SERVICIUDAD ESP', 50, bottomY + 5, {
        align: 'center',
        width: 512,
      });
      doc.text(`Hash de verificación: ${revision.firmaRevisor.hashDocumento.substring(0, 32)}...`, 50, doc.y, {
        align: 'center',
        width: 512,
      });

      // Finalizar documento
      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}
```

### Generador de Consecutivos

**Archivo: `functions/src/consecutivos.ts`**
```typescript
import * as admin from 'firebase-admin';

export async function generarConsecutivo(db: admin.firestore.Firestore): Promise<string> {
  const añoActual = new Date().getFullYear();
  const consecutivoRef = db.collection('consecutivos').doc('actas');

  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(consecutivoRef);

    let nuevoNumero: number;

    if (!doc.exists) {
      // Primera vez, crear documento
      nuevoNumero = 1;
      transaction.set(consecutivoRef, {
        año: añoActual,
        ultimo: nuevoNumero,
      });
    } else {
      const data = doc.data()!;

      if (data.año !== añoActual) {
        // Nuevo año, reiniciar consecutivo
        nuevoNumero = 1;
        transaction.update(consecutivoRef, {
          año: añoActual,
          ultimo: nuevoNumero,
        });
      } else {
        // Incrementar consecutivo
        nuevoNumero = data.ultimo + 1;
        transaction.update(consecutivoRef, {
          ultimo: nuevoNumero,
        });
      }
    }

    // Formato: ACTA-2024-00125
    return `ACTA-${añoActual}-${nuevoNumero.toString().padStart(5, '0')}`;
  });
}
```

---

## 8. Reglas de Seguridad

### Firestore Rules

**Archivo: `firestore.rules`**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ══════════════════════════════════════════════════════════════
    // FUNCIONES AUXILIARES
    // ══════════════════════════════════════════════════════════════

    function estaAutenticado() {
      return request.auth != null;
    }

    function obtenerUsuario() {
      return get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data;
    }

    function esAdmin() {
      return estaAutenticado() && obtenerUsuario().rol == 'admin';
    }

    function esLogistica() {
      return estaAutenticado() && obtenerUsuario().rol == 'logistica';
    }

    function esCustodio() {
      return estaAutenticado() && obtenerUsuario().rol == 'custodio';
    }

    function esElMismoUsuario(userId) {
      return estaAutenticado() && request.auth.uid == userId;
    }

    function esCustodioDelActivo(activoId) {
      return estaAutenticado() &&
        get(/databases/$(database)/documents/activos/$(activoId)).data.custodioId == request.auth.uid;
    }

    // ══════════════════════════════════════════════════════════════
    // COLECCIÓN: USUARIOS
    // ══════════════════════════════════════════════════════════════

    match /usuarios/{userId} {
      // Leer: todos los autenticados pueden ver usuarios (para selects, etc.)
      allow read: if estaAutenticado();

      // Crear: solo admin
      allow create: if esAdmin();

      // Actualizar: admin puede todo, usuario solo su perfil (sin cambiar rol)
      allow update: if esAdmin() ||
        (esElMismoUsuario(userId) &&
         !request.resource.data.diff(resource.data).affectedKeys().hasAny(['rol', 'activo']));

      // Eliminar: solo admin
      allow delete: if esAdmin();
    }

    // ══════════════════════════════════════════════════════════════
    // COLECCIÓN: ACTIVOS
    // ══════════════════════════════════════════════════════════════

    match /activos/{activoId} {
      // Leer: admin y logística ven todos, custodio solo los suyos
      allow read: if esAdmin() || esLogistica() || esCustodioDelActivo(activoId);

      // Escribir: solo admin y logística
      allow create, update: if esAdmin() || esLogistica();

      // Eliminar: solo admin
      allow delete: if esAdmin();
    }

    // ══════════════════════════════════════════════════════════════
    // COLECCIÓN: REVISIONES
    // ══════════════════════════════════════════════════════════════

    match /revisiones/{revisionId} {
      // Leer: admin ve todas, logística ve las que creó, custodio las de sus activos
      allow read: if esAdmin() ||
        resource.data.revisorId == request.auth.uid ||
        resource.data.custodioId == request.auth.uid;

      // Crear: solo logística puede crear revisiones
      allow create: if esLogistica() &&
        request.resource.data.revisorId == request.auth.uid &&
        request.resource.data.estado == 'borrador';

      // Actualizar:
      // - Logística puede actualizar borradores y agregar su firma
      // - Custodio solo puede agregar su firma cuando está pendiente
      allow update: if esAdmin() ||
        // Logística: puede editar borrador y agregar firma
        (esLogistica() &&
         resource.data.revisorId == request.auth.uid &&
         resource.data.estado in ['borrador', 'pendiente_firma_custodio']) ||
        // Custodio: solo puede agregar su firma cuando está pendiente
        (esCustodio() &&
         resource.data.custodioId == request.auth.uid &&
         resource.data.estado == 'pendiente_firma_custodio' &&
         // Solo puede modificar firmaCustodio y estado
         request.resource.data.diff(resource.data).affectedKeys().hasOnly(['firmaCustodio', 'estado', 'actualizadoEn']));

      // Eliminar: solo admin, solo borradores
      allow delete: if esAdmin() && resource.data.estado == 'borrador';
    }

    // ══════════════════════════════════════════════════════════════
    // COLECCIÓN: CONSECUTIVOS (solo Cloud Functions)
    // ══════════════════════════════════════════════════════════════

    match /consecutivos/{docId} {
      allow read, write: if false; // Solo accesible por Admin SDK
    }

    // ══════════════════════════════════════════════════════════════
    // COLECCIÓN: AUDITORÍA
    // ══════════════════════════════════════════════════════════════

    match /auditoria/{logId} {
      // Solo admin puede leer
      allow read: if esAdmin();

      // Nadie puede escribir directamente (solo Cloud Functions)
      allow write: if false;
    }
  }
}
```

### Storage Rules

**Archivo: `storage.rules`**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    function estaAutenticado() {
      return request.auth != null;
    }

    // ══════════════════════════════════════════════════════════════
    // EVIDENCIAS: Imágenes de revisiones
    // ══════════════════════════════════════════════════════════════

    match /evidencias/{revisionId}/{fileName} {
      // Leer: cualquier usuario autenticado
      allow read: if estaAutenticado();

      // Escribir: usuario autenticado, solo imágenes < 5MB
      allow write: if estaAutenticado() &&
        request.resource.size < 5 * 1024 * 1024 &&
        request.resource.contentType.matches('image/.*');
    }

    // ══════════════════════════════════════════════════════════════
    // FIRMAS: Imágenes de firmas digitales
    // ══════════════════════════════════════════════════════════════

    match /firmas/{revisionId}/{fileName} {
      // Leer: cualquier usuario autenticado
      allow read: if estaAutenticado();

      // Escribir: usuario autenticado, solo PNG < 500KB
      allow write: if estaAutenticado() &&
        request.resource.size < 500 * 1024 &&
        request.resource.contentType == 'image/png';
    }

    // ══════════════════════════════════════════════════════════════
    // ACTAS PDF: Solo Cloud Functions pueden escribir
    // ══════════════════════════════════════════════════════════════

    match /actas/{fileName} {
      // Leer: cualquier usuario autenticado
      allow read: if estaAutenticado();

      // Escribir: solo Cloud Functions (Admin SDK)
      allow write: if false;
    }

    // ══════════════════════════════════════════════════════════════
    // LOGO E IMÁGENES INSTITUCIONALES
    // ══════════════════════════════════════════════════════════════

    match /institucional/{fileName} {
      // Leer: público
      allow read: if true;

      // Escribir: nadie desde cliente
      allow write: if false;
    }
  }
}
```

---

## 9. Flujo de Doble Firma

### Diagrama Detallado

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           FLUJO COMPLETO DE DOBLE FIRMA                           │
└──────────────────────────────────────────────────────────────────────────────────┘

PROFESIONAL DE LOGÍSTICA                                           CUSTODIO
         │                                                            │
         │  ┌─────────────────────────────┐                           │
         │  │ 1. Inicia sesión            │                           │
         │  │    (rol: logistica)         │                           │
         │  └─────────────────────────────┘                           │
         │               │                                            │
         │  ┌─────────────────────────────┐                           │
         │  │ 2. Selecciona activo a      │                           │
         │  │    revisar de la lista      │                           │
         │  └─────────────────────────────┘                           │
         │               │                                            │
         │  ┌─────────────────────────────┐                           │
         │  │ 3. Completa formulario:     │                           │
         │  │    - Fecha revisión         │                           │
         │  │    - Estado del activo      │                           │
         │  │    - Descripción detallada  │                           │
         │  │    - Observaciones          │                           │
         │  └─────────────────────────────┘                           │
         │               │                                            │
         │               ▼                                            │
         │      ┌─────────────────┐                                   │
         │      │   FIRESTORE     │                                   │
         │      │   estado:       │                                   │
         │      │   "borrador"    │                                   │
         │      └─────────────────┘                                   │
         │               │                                            │
         │  ┌─────────────────────────────┐                           │
         │  │ 4. Sube fotografías del     │                           │
         │  │    activo (evidencias)      │                           │
         │  │    - Mínimo 1, máximo 5     │                           │
         │  └─────────────────────────────┘                           │
         │               │                                            │
         │               ▼                                            │
         │      ┌─────────────────┐                                   │
         │      │    STORAGE      │                                   │
         │      │  /evidencias/   │                                   │
         │      │   {revId}/      │                                   │
         │      └─────────────────┘                                   │
         │               │                                            │
         │  ┌─────────────────────────────┐                           │
         │  │ 5. FIRMA como revisor       │                           │
         │  │    - Dibuja firma           │                           │
         │  │    - Acepta declaración     │                           │
         │  │    - Se captura hash        │                           │
         │  └─────────────────────────────┘                           │
         │               │                                            │
         │               ▼                                            │
         │      ┌─────────────────┐                                   │
         │      │   FIRESTORE     │                                   │
         │      │   estado:       │──────────────────────────────────▶│
         │      │   "pendiente_   │     Notificación al custodio      │
         │      │   firma_        │     (email o dashboard)           │
         │      │   custodio"     │                                   │
         │      └─────────────────┘                                   │
         │                                                            │
         │                                   ┌─────────────────────────────┐
         │                                   │ 6. Custodio inicia sesión   │
         │                                   │    (rol: custodio)          │
         │                                   └─────────────────────────────┘
         │                                                │
         │                                   ┌─────────────────────────────┐
         │                                   │ 7. Ve notificación de       │
         │                                   │    "Acta pendiente de firma"│
         │                                   └─────────────────────────────┘
         │                                                │
         │                                   ┌─────────────────────────────┐
         │                                   │ 8. Revisa el acta:          │
         │                                   │    - Datos del activo       │
         │                                   │    - Descripción            │
         │                                   │    - Fotografías            │
         │                                   │    - Firma del revisor      │
         │                                   └─────────────────────────────┘
         │                                                │
         │                                   ┌─────────────────────────────┐
         │                                   │ 9. FIRMA como custodio      │
         │                                   │    - Dibuja firma           │
         │                                   │    - Acepta declaración     │
         │                                   │    - Se captura hash        │
         │                                   └─────────────────────────────┘
         │                                                │
         │                                                ▼
         │                                       ┌─────────────────┐
         │                                       │   FIRESTORE     │
         │◀──────────────────────────────────────│   estado:       │
         │         Notificación de               │   "firmada_     │
         │         acta completada               │   completa"     │
         │                                       └─────────────────┘
         │                                                │
         │                                                ▼
         │                               ┌────────────────────────────────┐
         │                               │      CLOUD FUNCTION            │
         │                               │      (Trigger automático)      │
         │                               │                                │
         │                               │  1. Detecta estado             │
         │                               │     "firmada_completa"         │
         │                               │                                │
         │                               │  2. Genera número consecutivo  │
         │                               │     ACTA-2024-00125            │
         │                               │                                │
         │                               │  3. Genera PDF con:            │
         │                               │     - Encabezado institucional │
         │                               │     - Datos del activo         │
         │                               │     - Datos del custodio       │
         │                               │     - Datos del revisor        │
         │                               │     - Descripción y estado     │
         │                               │     - Fotografías              │
         │                               │     - AMBAS FIRMAS             │
         │                               │     - Hash de verificación     │
         │                               │                                │
         │                               │  4. Sube PDF a Storage         │
         │                               │                                │
         │                               │  5. Actualiza estado a         │
         │                               │     "completada"               │
         │                               └────────────────────────────────┘
         │                                                │
         │                                                ▼
         │                                       ┌─────────────────┐
         │                                       │    STORAGE      │
         │                                       │   /actas/       │
         │                                       │   {revId}.pdf   │
         │                                       └─────────────────┘
         │                                                │
         ▼                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            ACTA COMPLETADA                                       │
│                                                                                  │
│  Ambos usuarios pueden:                                                          │
│  - Ver el detalle de la revisión                                                 │
│  - Descargar el PDF del acta                                                     │
│  - Consultar el histórico                                                        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Estados de la Revisión

| Estado | Descripción | Acciones Permitidas |
|--------|-------------|---------------------|
| `borrador` | Revisión creada, editando | Logística: editar, agregar fotos, eliminar |
| `pendiente_firma_custodio` | Logística firmó, esperando custodio | Custodio: revisar y firmar |
| `firmada_completa` | Ambos firmaron, procesando PDF | Sistema: generar PDF |
| `completada` | PDF generado, acta finalizada | Todos: ver y descargar |
| `anulada` | Acta invalidada por admin | Solo consulta |

---

## 10. Generación del PDF

### Estructura Visual del Acta

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│                    ┌──────────┐                                                  │
│                    │   LOGO   │                                                  │
│                    │SERVICIUDAD│                                                 │
│                    └──────────┘                                                  │
│                                                                                  │
│                         SERVICIUDAD ESP                                          │
│                       NIT: 123.456.789-0                                         │
│                    Dirección de Activos Fijos                                    │
│                                                                                  │
│  ═══════════════════════════════════════════════════════════════════════════════ │
│                                                                                  │
│                    ACTA DE REVISIÓN DE ACTIVO FIJO                               │
│                         No. ACTA-2024-00125                                      │
│                                                                                  │
│  ═══════════════════════════════════════════════════════════════════════════════ │
│                                                                                  │
│  INFORMACIÓN GENERAL                                                             │
│  ────────────────────────────────────────────────────────────────────────────── │
│  Fecha de revisión:    15 de enero de 2024                                       │
│  Código del activo:    AF-MOB-2024-0089                                          │
│  Descripción:          Escritorio ejecutivo en madera con tres cajones           │
│  Ubicación:            Oficina 301 - Edificio Principal                          │
│                                                                                  │
│  DATOS DEL CUSTODIO                                                              │
│  ────────────────────────────────────────────────────────────────────────────── │
│  Nombre:       Juan Carlos Pérez Rodríguez                                       │
│  Cédula:       1.234.567.890                                                     │
│  Cargo:        Profesional Especializado                                         │
│                                                                                  │
│  DATOS DEL REVISOR                                                               │
│  ────────────────────────────────────────────────────────────────────────────── │
│  Nombre:       María Elena García López                                          │
│  Cédula:       9.876.543.210                                                     │
│  Cargo:        Profesional Especializado en Logística                            │
│                                                                                  │
│  RESULTADO DE LA REVISIÓN                                                        │
│  ────────────────────────────────────────────────────────────────────────────── │
│  Estado del activo:  BUENO                                                       │
│                                                                                  │
│  Descripción de la revisión:                                                     │
│  Se realizó revisión física del activo encontrándose en buen estado general.     │
│  La superficie presenta desgaste normal por uso. Los cajones funcionan           │
│  correctamente. El acabado se encuentra en condiciones aceptables.               │
│                                                                                  │
│  Observaciones:                                                                  │
│  Se recomienda realizar limpieza periódica y mantenimiento preventivo del        │
│  mobiliario para garantizar su durabilidad.                                      │
│                                                                                  │
│  REGISTRO FOTOGRÁFICO                                                            │
│  ────────────────────────────────────────────────────────────────────────────── │
│                                                                                  │
│  ┌────────────────────────┐    ┌────────────────────────┐                        │
│  │                        │    │                        │                        │
│  │                        │    │                        │                        │
│  │      FOTO 1            │    │      FOTO 2            │                        │
│  │   Vista frontal        │    │   Detalle cajones      │                        │
│  │                        │    │                        │                        │
│  │                        │    │                        │                        │
│  └────────────────────────┘    └────────────────────────┘                        │
│                                                                                  │
│  ┌────────────────────────┐    ┌────────────────────────┐                        │
│  │                        │    │                        │                        │
│  │                        │    │                        │                        │
│  │      FOTO 3            │    │      FOTO 4            │                        │
│  │   Vista lateral        │    │   Estado superficie    │                        │
│  │                        │    │                        │                        │
│  │                        │    │                        │                        │
│  └────────────────────────┘    └────────────────────────┘                        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

                              --- PÁGINA 2 ---

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  DECLARACIÓN Y CONSTANCIA                                                        │
│  ────────────────────────────────────────────────────────────────────────────── │
│                                                                                  │
│  El profesional de logística certifica que realizó la revisión física del        │
│  activo y que la información registrada corresponde al estado real del           │
│  mismo al momento de la inspección.                                              │
│                                                                                  │
│  El custodio certifica que la información registrada es veraz y acepta la        │
│  responsabilidad sobre el activo a su cargo en el estado descrito.               │
│                                                                                  │
│                                                                                  │
│  FIRMAS                                                                          │
│  ────────────────────────────────────────────────────────────────────────────── │
│                                                                                  │
│                                                                                  │
│    ┌─────────────────────────┐          ┌─────────────────────────┐             │
│    │                         │          │                         │             │
│    │                         │          │                         │             │
│    │   [FIRMA REVISOR]       │          │   [FIRMA CUSTODIO]      │             │
│    │                         │          │                         │             │
│    │                         │          │                         │             │
│    └─────────────────────────┘          └─────────────────────────┘             │
│    ─────────────────────────────        ─────────────────────────────           │
│    MARÍA ELENA GARCÍA LÓPEZ             JUAN CARLOS PÉREZ RODRÍGUEZ             │
│    C.C. 9.876.543.210                   C.C. 1.234.567.890                       │
│    Profesional Especializado            Custodio del Activo                      │
│    en Logística                                                                  │
│                                                                                  │
│    Firmado: 15/01/2024 14:35:22         Firmado: 15/01/2024 15:10:45            │
│                                                                                  │
│                                                                                  │
│                                                                                  │
│  ═══════════════════════════════════════════════════════════════════════════════ │
│  Documento generado automáticamente por el Sistema de Activos Fijos              │
│  SERVICIUDAD ESP                                                                 │
│  Hash de verificación: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6...                       │
│  ═══════════════════════════════════════════════════════════════════════════════ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Despliegue

### Pasos para Despliegue

```bash
# 1. Configurar Firebase CLI
npm install -g firebase-tools
firebase login

# 2. Inicializar proyecto
firebase init
# Seleccionar: Firestore, Functions, Hosting, Storage

# 3. Construir aplicación
npm run build

# 4. Construir Cloud Functions
cd functions
npm run build
cd ..

# 5. Desplegar reglas de seguridad
firebase deploy --only firestore:rules
firebase deploy --only storage:rules

# 6. Desplegar índices
firebase deploy --only firestore:indexes

# 7. Desplegar Cloud Functions
firebase deploy --only functions

# 8. Desplegar aplicación web
firebase deploy --only hosting

# O desplegar todo junto
firebase deploy
```

### Configuración de Hosting

**Archivo: `firebase.json`**
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": {
    "source": "functions"
  },
  "hosting": {
    "public": "out",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

### Crear Usuario Administrador Inicial

Después del primer despliegue, crear el usuario admin:

```javascript
// Script para ejecutar una sola vez en la consola de Firebase
// O crear una Cloud Function HTTP para esto

const admin = require('firebase-admin');
admin.initializeApp();

async function crearUsuarioAdmin() {
  // 1. Crear usuario en Authentication
  const userRecord = await admin.auth().createUser({
    email: 'admin@serviciudad.gov.co',
    password: 'ContraseñaSegura123!',
    displayName: 'Administrador Sistema',
  });

  // 2. Crear documento en Firestore
  await admin.firestore().collection('usuarios').doc(userRecord.uid).set({
    email: 'admin@serviciudad.gov.co',
    nombre: 'Administrador del Sistema',
    cedula: '0000000000',
    cargo: 'Administrador',
    dependencia: 'Sistemas',
    rol: 'admin',
    activo: true,
    creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    creadoPor: 'system',
  });

  console.log('Usuario admin creado:', userRecord.uid);
}

crearUsuarioAdmin();
```

---

## 12. Cronograma de Desarrollo

### Fase 1: Configuración Base (Días 1-2)
- [ ] Crear proyecto en Firebase Console
- [ ] Configurar Authentication, Firestore, Storage
- [ ] Inicializar proyecto Next.js
- [ ] Configurar TailwindCSS
- [ ] Configurar Firebase en el proyecto
- [ ] Desplegar reglas de seguridad iniciales

### Fase 2: Autenticación y Usuarios (Días 3-4)
- [ ] Implementar login/logout
- [ ] Crear AuthGuard para protección de rutas
- [ ] Implementar store de autenticación (Zustand)
- [ ] Crear CRUD de usuarios (admin)
- [ ] Configurar roles y permisos

### Fase 3: Gestión de Activos (Días 5-6)
- [ ] Crear modelo y tipos de Activo
- [ ] Implementar CRUD de activos
- [ ] Implementar asignación de custodios
- [ ] Crear vistas de lista y detalle
- [ ] Implementar búsqueda y filtros

### Fase 4: Módulo de Revisiones (Días 7-10)
- [ ] Crear modelo y tipos de Revisión
- [ ] Implementar formulario de nueva revisión
- [ ] Crear componente de subida de evidencias
- [ ] Implementar compresión de imágenes
- [ ] Crear vista de lista de revisiones
- [ ] Implementar vista de detalle

### Fase 5: Sistema de Firma Digital (Días 11-13)
- [ ] Implementar componente SignaturePad
- [ ] Crear flujo de firma del revisor
- [ ] Crear página de firma para custodio
- [ ] Implementar captura de metadatos (IP, timestamp, hash)
- [ ] Almacenar firmas en Storage

### Fase 6: Cloud Functions y PDF (Días 14-16)
- [ ] Configurar Cloud Functions
- [ ] Implementar generador de consecutivos
- [ ] Crear generador de PDF con PDFKit
- [ ] Implementar trigger de generación automática
- [ ] Configurar almacenamiento de PDFs
- [ ] Implementar registro de auditoría

### Fase 7: Dashboard y Reportes (Días 17-18)
- [ ] Crear dashboard según rol
- [ ] Implementar notificaciones pendientes
- [ ] Crear vista de histórico por activo
- [ ] Implementar reportes básicos
- [ ] Crear vista de auditoría (admin)

### Fase 8: Testing y Ajustes (Días 19-20)
- [ ] Pruebas de flujo completo
- [ ] Ajustes de UI/UX
- [ ] Optimización de rendimiento
- [ ] Corrección de bugs
- [ ] Documentación final

### Fase 9: Despliegue (Día 21)
- [ ] Crear usuario administrador
- [ ] Despliegue a producción
- [ ] Configurar dominio personalizado (opcional)
- [ ] Capacitación de usuarios
- [ ] Entrega y cierre

---

## Anexos

### A. Comandos Útiles

```bash
# Desarrollo local
npm run dev

# Emuladores de Firebase
npm run firebase:emulators

# Build de producción
npm run build

# Desplegar solo functions
firebase deploy --only functions

# Ver logs de functions
firebase functions:log

# Exportar datos de Firestore (backup)
firebase firestore:export gs://bucket-name/backups/
```

### B. Checklist de Seguridad

- [ ] Variables de entorno no expuestas en el código
- [ ] Reglas de Firestore restrictivas
- [ ] Reglas de Storage restrictivas
- [ ] HTTPS habilitado
- [ ] Autenticación requerida en todas las rutas
- [ ] Validación de datos en cliente y servidor
- [ ] Logs de auditoría funcionando
- [ ] Backup automático configurado

### C. Mantenimiento

- Revisar logs de Cloud Functions semanalmente
- Backup de Firestore semanal
- Actualizar dependencias mensualmente
- Revisar métricas de uso en Firebase Console
- Monitorear costos de Firebase

---

**Documento creado para SERVICIUDAD ESP**
**Sistema de Actas de Revisión de Activos Fijos**
**Enero 2025**
