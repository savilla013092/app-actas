import fs from 'node:fs';
import path from 'node:path';

import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, doc, setDoc } from 'firebase/firestore';

export const PROJECT_ID = 'demo-app-actas';
export const BUCKET_NAME = `${PROJECT_ID}.appspot.com`;

const [firestoreHost = '127.0.0.1', firestorePort = '8080'] =
  (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const [storageHost = '127.0.0.1', storagePort = '9199'] =
  (process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199').split(':');

export const ids = {
  admin: 'admin-user',
  logistica: 'logistica-user',
  custodio: 'custodio-user',
  otherCustodio: 'other-custodio-user',
  inactive: 'inactive-user',
  ghost: 'ghost-user',
  activoOwn: 'activo-own',
  activoOther: 'activo-other',
  revisionDraft: 'revision-draft',
  revisionPending: 'revision-pending',
  revisionOtherPending: 'revision-other-pending',
  assignmentPending: 'assignment-pending',
  assignmentOtherPending: 'assignment-other-pending',
  expressLoan: 'express-loan-1',
};

export const authClaims = {
  admin: { role: 'admin', active: true },
  logistica: { role: 'logistica', active: true },
  custodio: { role: 'custodio', active: true },
  inactive: { role: 'custodio', active: false },
};

export async function createSecurityTestEnvironment() {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: firestoreHost,
      port: Number(firestorePort),
      rules: fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8'),
    },
    storage: {
      host: storageHost,
      port: Number(storagePort),
      rules: fs.readFileSync(path.join(process.cwd(), 'storage.rules'), 'utf8'),
    },
  });
}

export async function seedSecurityData(testEnv) {
  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const now = Timestamp.fromDate(new Date('2026-03-12T12:00:00.000Z'));

    await Promise.all([
      setDoc(doc(db, 'usuarios', ids.admin), {
        nombre: 'Admin Principal',
        email: 'admin@example.com',
        rol: 'admin',
        activo: true,
      }),
      setDoc(doc(db, 'usuarios', ids.logistica), {
        nombre: 'Logistica Principal',
        email: 'logistica@example.com',
        rol: 'logistica',
        activo: true,
      }),
      setDoc(doc(db, 'usuarios', ids.custodio), {
        nombre: 'Custodio Uno',
        email: 'custodio@example.com',
        rol: 'custodio',
        activo: true,
      }),
      setDoc(doc(db, 'usuarios', ids.otherCustodio), {
        nombre: 'Custodio Dos',
        email: 'custodio2@example.com',
        rol: 'custodio',
        activo: true,
      }),
      setDoc(doc(db, 'usuarios', ids.inactive), {
        nombre: 'Usuario Inactivo',
        email: 'inactive@example.com',
        rol: 'custodio',
        activo: false,
      }),
      setDoc(doc(db, 'activos', ids.activoOwn), {
        codigo: 'AF-2420-0001',
        descripcion: 'Computador Portatil',
        serial: 'SERIAL-OWN',
        custodioId: ids.custodio,
        custodioNombre: 'Custodio Uno',
        estado: 'activo',
        estadoAsignacionInicial: 'completada',
        categoria: 'Equipos de Computo',
        ubicacion: 'Sede Administrativa',
      }),
      setDoc(doc(db, 'activos', ids.activoOther), {
        codigo: 'AF-2430-0002',
        descripcion: 'Impresora Laser',
        serial: 'SERIAL-OTHER',
        custodioId: ids.otherCustodio,
        custodioNombre: 'Custodio Dos',
        estado: 'activo',
        estadoAsignacionInicial: 'completada',
        categoria: 'Equipos de Oficina',
        ubicacion: 'Sede Operativa',
      }),
      setDoc(doc(db, 'revisiones', ids.revisionDraft), {
        activoId: ids.activoOwn,
        codigoActivo: 'AF-2420-0001',
        descripcionActivo: 'Computador Portatil',
        ubicacionActivo: 'Sede Administrativa',
        custodioId: ids.custodio,
        custodioNombre: 'Custodio Uno',
        custodioCedula: '1001',
        custodioCargo: 'Analista',
        revisorId: ids.logistica,
        revisorNombre: 'Logistica Principal',
        revisorCedula: '9001',
        revisorCargo: 'Profesional',
        fecha: now,
        estado: 'borrador',
        estadoActivo: 'bueno',
        descripcion: 'Revision inicial',
        evidencias: [],
      }),
      setDoc(doc(db, 'revisiones', ids.revisionPending), {
        activoId: ids.activoOwn,
        codigoActivo: 'AF-2420-0001',
        descripcionActivo: 'Computador Portatil',
        ubicacionActivo: 'Sede Administrativa',
        custodioId: ids.custodio,
        custodioNombre: 'Custodio Uno',
        custodioCedula: '1001',
        custodioCargo: 'Analista',
        revisorId: ids.logistica,
        revisorNombre: 'Logistica Principal',
        revisorCedula: '9001',
        revisorCargo: 'Profesional',
        fecha: now,
        estado: 'pendiente_firma_custodio',
        estadoActivo: 'bueno',
        descripcion: 'Pendiente firma custodio',
        evidencias: [],
      }),
      setDoc(doc(db, 'revisiones', ids.revisionOtherPending), {
        activoId: ids.activoOther,
        codigoActivo: 'AF-2430-0002',
        descripcionActivo: 'Impresora Laser',
        ubicacionActivo: 'Sede Operativa',
        custodioId: ids.otherCustodio,
        custodioNombre: 'Custodio Dos',
        custodioCedula: '1002',
        custodioCargo: 'Tecnico',
        revisorId: ids.logistica,
        revisorNombre: 'Logistica Principal',
        revisorCedula: '9001',
        revisorCargo: 'Profesional',
        fecha: now,
        estado: 'pendiente_firma_custodio',
        estadoActivo: 'regular',
        descripcion: 'Pendiente firma otro custodio',
        evidencias: [],
      }),
      setDoc(doc(db, 'asignaciones', ids.assignmentPending), {
        activoId: ids.activoOwn,
        codigoActivo: 'AF-2420-0001',
        descripcionActivo: 'Computador Portatil',
        ubicacionActivo: 'Sede Administrativa',
        custodioId: ids.custodio,
        custodioNombre: 'Custodio Uno',
        custodioCedula: '1001',
        custodioCargo: 'Analista',
        revisorId: ids.logistica,
        revisorNombre: 'Logistica Principal',
        revisorCedula: '9001',
        revisorCargo: 'Profesional',
        fecha: now,
        estado: 'pendiente_firma_custodio',
        descripcion: 'Pendiente firma asignacion inicial',
        evidencias: [],
      }),
      setDoc(doc(db, 'asignaciones', ids.assignmentOtherPending), {
        activoId: ids.activoOther,
        codigoActivo: 'AF-2430-0002',
        descripcionActivo: 'Impresora Laser',
        ubicacionActivo: 'Sede Operativa',
        custodioId: ids.otherCustodio,
        custodioNombre: 'Custodio Dos',
        custodioCedula: '1002',
        custodioCargo: 'Tecnico',
        revisorId: ids.logistica,
        revisorNombre: 'Logistica Principal',
        revisorCedula: '9001',
        revisorCargo: 'Profesional',
        fecha: now,
        estado: 'pendiente_firma_custodio',
        descripcion: 'Pendiente firma asignacion inicial otro custodio',
        evidencias: [],
      }),
      setDoc(doc(db, 'express_loans', ids.expressLoan), {
        status: 'activo',
        loan_date: now,
        asset_id: ids.activoOwn,
        item_type: 'activo_registrado',
        element_description: 'Computador Portatil',
      }),
      setDoc(doc(db, 'consecutivos', 'revisiones'), { current: 12 }),
      setDoc(doc(db, 'auditoria', 'audit-1'), { event: 'test' }),
    ]);
  });
}

export function firestoreContext(testEnv, userId, claims = {}) {
  return testEnv.authenticatedContext(userId, claims).firestore();
}

export function storageContext(testEnv, userId, claims = {}) {
  return testEnv.authenticatedContext(userId, claims).storage(`gs://${BUCKET_NAME}`);
}
