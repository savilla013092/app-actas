import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

import {
  authClaims,
  createSecurityTestEnvironment,
  firestoreContext,
  ids,
  seedSecurityData,
} from '../helpers/securityTestUtils.mjs';

let testEnv;

before(async () => {
  testEnv = await createSecurityTestEnvironment();
});

beforeEach(async () => {
  await seedSecurityData(testEnv);
});

after(async () => {
  await testEnv.cleanup();
});

test('usuarios: el propietario lee su perfil y no puede escribirlo desde cliente', async () => {
  const ownDb = firestoreContext(testEnv, ids.custodio, authClaims.custodio);
  const ownProfile = await assertSucceeds(getDoc(doc(ownDb, 'usuarios', ids.custodio)));
  assert.equal(ownProfile.data()?.rol, 'custodio');

  await assertFails(
    updateDoc(doc(ownDb, 'usuarios', ids.custodio), {
      nombre: 'Cambio no permitido',
    })
  );
});

test('usuarios: admin puede leer otros perfiles pero no escribir la coleccion', async () => {
  const adminDb = firestoreContext(testEnv, ids.admin, authClaims.admin);
  const logisticaProfile = await assertSucceeds(getDoc(doc(adminDb, 'usuarios', ids.logistica)));
  assert.equal(logisticaProfile.data()?.rol, 'logistica');

  await assertFails(
    setDoc(doc(adminDb, 'usuarios', 'nuevo-usuario'), {
      nombre: 'No permitido',
      rol: 'custodio',
      activo: true,
    })
  );
});

test('activos: custodio solo puede leer sus activos; admin y logistica pueden crear y editar', async () => {
  const custodioDb = firestoreContext(testEnv, ids.custodio, authClaims.custodio);
  const ownAsset = await assertSucceeds(getDoc(doc(custodioDb, 'activos', ids.activoOwn)));
  assert.equal(ownAsset.data()?.custodioId, ids.custodio);

  await assertFails(getDoc(doc(custodioDb, 'activos', ids.activoOther)));
  await assertFails(
    updateDoc(doc(custodioDb, 'activos', ids.activoOwn), {
      descripcion: 'Cambio indebido',
    })
  );

  const logisticaDb = firestoreContext(testEnv, ids.logistica, authClaims.logistica);
  await assertSucceeds(
    setDoc(doc(logisticaDb, 'activos', 'nuevo-activo'), {
      codigo: 'AF-2450-9999',
      descripcion: 'Activo nuevo',
      serial: 'SERIAL-NUEVO',
      custodioId: ids.custodio,
      custodioNombre: 'Custodio Uno',
      estado: 'activo',
      categoria: 'Muebles',
      ubicacion: 'Sede Administrativa',
    })
  );

  const adminDb = firestoreContext(testEnv, ids.admin, authClaims.admin);
  await assertSucceeds(
    updateDoc(doc(adminDb, 'activos', ids.activoOwn), {
      descripcion: 'Activo actualizado por admin',
    })
  );
});

test('revisiones: logistica puede leer todas y custodio solo la suya; las escrituras directas estan bloqueadas', async () => {
  const logisticaDb = firestoreContext(testEnv, ids.logistica, authClaims.logistica);
  const revision = await assertSucceeds(getDoc(doc(logisticaDb, 'revisiones', ids.revisionOtherPending)));
  assert.equal(revision.data()?.custodioId, ids.otherCustodio);

  const custodioDb = firestoreContext(testEnv, ids.custodio, authClaims.custodio);
  await assertSucceeds(getDoc(doc(custodioDb, 'revisiones', ids.revisionPending)));
  await assertFails(getDoc(doc(custodioDb, 'revisiones', ids.revisionOtherPending)));
  await assertFails(
    updateDoc(doc(custodioDb, 'revisiones', ids.revisionPending), {
      estado: 'completada',
    })
  );
  await assertFails(
    setDoc(doc(logisticaDb, 'revisiones', 'revision-directa'), {
      estado: 'borrador',
    })
  );
});

test('express loans, auditoria y consecutivos quedan fuera de escritura cliente', async () => {
  const adminDb = firestoreContext(testEnv, ids.admin, authClaims.admin);
  const logisticaDb = firestoreContext(testEnv, ids.logistica, authClaims.logistica);
  const custodioDb = firestoreContext(testEnv, ids.custodio, authClaims.custodio);

  await assertSucceeds(getDoc(doc(adminDb, 'express_loans', ids.expressLoan)));
  await assertSucceeds(getDoc(doc(logisticaDb, 'express_loans', ids.expressLoan)));
  await assertFails(getDoc(doc(custodioDb, 'express_loans', ids.expressLoan)));
  await assertFails(
    updateDoc(doc(adminDb, 'express_loans', ids.expressLoan), {
      status: 'devuelto',
    })
  );
  await assertFails(getDoc(doc(adminDb, 'consecutivos', 'revisiones')));
  await assertFails(getDoc(doc(logisticaDb, 'auditoria', 'audit-1')));
});

test('sin perfil o con claims inactivos no hay acceso operativo', async () => {
  const ghostDb = firestoreContext(testEnv, ids.ghost, authClaims.custodio);
  const inactiveDb = firestoreContext(testEnv, ids.inactive, authClaims.inactive);

  await assertFails(getDoc(doc(ghostDb, 'activos', ids.activoOwn)));
  await assertFails(getDoc(doc(inactiveDb, 'activos', ids.activoOwn)));
});
