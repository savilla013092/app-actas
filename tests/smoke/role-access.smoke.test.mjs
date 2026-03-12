import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadString } from 'firebase/storage';

import {
  authClaims,
  createSecurityTestEnvironment,
  firestoreContext,
  ids,
  seedSecurityData,
  storageContext,
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

test('smoke: admin crea activo, logistica trabaja revisiones y custodio opera solo sobre lo propio', async () => {
  const adminDb = firestoreContext(testEnv, ids.admin, authClaims.admin);
  await assertSucceeds(
    setDoc(doc(adminDb, 'activos', 'smoke-asset'), {
      codigo: 'AF-2440-7777',
      descripcion: 'Activo smoke',
      serial: 'SMOKE-7777',
      custodioId: ids.custodio,
      custodioNombre: 'Custodio Uno',
      estado: 'activo',
      categoria: 'Muebles',
      ubicacion: 'Sede Administrativa',
    })
  );

  const logisticaDb = firestoreContext(testEnv, ids.logistica, authClaims.logistica);
  const smokeAsset = await assertSucceeds(getDoc(doc(logisticaDb, 'activos', 'smoke-asset')));
  assert.equal(smokeAsset.data()?.descripcion, 'Activo smoke');

  const logisticaStorage = storageContext(testEnv, ids.logistica, authClaims.logistica);
  await assertSucceeds(
    uploadString(
      ref(logisticaStorage, `evidencias/${ids.revisionDraft}/smoke-logistica.jpg`),
      'img',
      'raw',
      { contentType: 'image/jpeg' }
    )
  );

  const custodioDb = firestoreContext(testEnv, ids.custodio, authClaims.custodio);
  await assertSucceeds(getDoc(doc(custodioDb, 'activos', ids.activoOwn)));
  await assertFails(getDoc(doc(custodioDb, 'activos', ids.activoOther)));

  const custodioStorage = storageContext(testEnv, ids.custodio, authClaims.custodio);
  await assertSucceeds(
    uploadString(
      ref(custodioStorage, `firmas/${ids.revisionPending}/custodio.png`),
      'firma',
      'raw',
      { contentType: 'image/png' }
    )
  );
});

test('smoke: usuario autenticado sin perfil operativo queda bloqueado por reglas', async () => {
  const ghostDb = firestoreContext(testEnv, ids.ghost, authClaims.custodio);
  await assertFails(getDoc(doc(ghostDb, 'activos', ids.activoOwn)));
});
