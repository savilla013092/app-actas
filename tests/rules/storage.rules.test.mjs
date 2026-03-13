import test, { after, before, beforeEach } from 'node:test';

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, uploadString } from 'firebase/storage';

import {
  authClaims,
  createSecurityTestEnvironment,
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

function uploadFile(storage, path, contentType = 'image/jpeg', contents = 'image-bytes') {
  return uploadString(ref(storage, path), contents, 'raw', { contentType });
}

test('evidencias: solo admin/logistica pueden subir imagenes a revisiones abiertas', async () => {
  const logisticaStorage = storageContext(testEnv, ids.logistica, authClaims.logistica);
  const custodioStorage = storageContext(testEnv, ids.custodio, authClaims.custodio);

  await assertSucceeds(
    uploadFile(logisticaStorage, `evidencias/${ids.revisionDraft}/foto-logistica.jpg`)
  );

  await assertFails(
    uploadFile(custodioStorage, `evidencias/${ids.revisionDraft}/foto-custodio.jpg`)
  );

  await assertFails(
    uploadFile(logisticaStorage, `evidencias/${ids.revisionDraft}/foto-heic.heic`, 'image/heic')
  );
});

test('firmas: revisor solo firma en borrador y custodio titular solo firma su revision pendiente', async () => {
  const logisticaStorage = storageContext(testEnv, ids.logistica, authClaims.logistica);
  const custodioStorage = storageContext(testEnv, ids.custodio, authClaims.custodio);
  const otherCustodioStorage = storageContext(testEnv, ids.otherCustodio, authClaims.custodio);

  await assertSucceeds(
    uploadFile(logisticaStorage, `firmas/${ids.revisionDraft}/revisor.png`, 'image/png', 'firma-revisor')
  );
  await assertFails(
    uploadFile(logisticaStorage, `firmas/${ids.revisionPending}/revisor.png`, 'image/png', 'firma-revisor')
  );

  await assertSucceeds(
    uploadFile(custodioStorage, `firmas/${ids.revisionPending}/custodio.png`, 'image/png', 'firma-custodio')
  );
  await assertFails(
    uploadFile(otherCustodioStorage, `firmas/${ids.revisionPending}/custodio.png`, 'image/png', 'firma-custodio')
  );
});

test('asignaciones iniciales: solo admin/logistica suben evidencias y solo el custodio titular firma', async () => {
  const logisticaStorage = storageContext(testEnv, ids.logistica, authClaims.logistica);
  const custodioStorage = storageContext(testEnv, ids.custodio, authClaims.custodio);
  const otherCustodioStorage = storageContext(testEnv, ids.otherCustodio, authClaims.custodio);

  await assertSucceeds(
    uploadFile(logisticaStorage, `asignaciones-evidencias/${ids.assignmentPending}/foto.jpg`)
  );
  await assertFails(
    uploadFile(custodioStorage, `asignaciones-evidencias/${ids.assignmentPending}/foto-custodio.jpg`)
  );
  await assertFails(
    uploadFile(logisticaStorage, `asignaciones-evidencias/${ids.assignmentPending}/foto.heic`, 'image/heic')
  );

  await assertSucceeds(
    uploadFile(custodioStorage, `asignaciones-firmas/${ids.assignmentPending}/custodio.png`, 'image/png', 'firma-custodio')
  );
  await assertFails(
    uploadFile(otherCustodioStorage, `asignaciones-firmas/${ids.assignmentPending}/custodio.png`, 'image/png', 'firma-custodio')
  );
});

test('prestamos express: solo admin/logistica pueden subir evidencias', async () => {
  const adminStorage = storageContext(testEnv, ids.admin, authClaims.admin);
  const custodioStorage = storageContext(testEnv, ids.custodio, authClaims.custodio);

  await assertSucceeds(
    uploadFile(adminStorage, `express_loans/${ids.expressLoan}/evidencia-admin.jpg`)
  );
  await assertFails(
    uploadFile(custodioStorage, `express_loans/${ids.expressLoan}/evidencia-custodio.jpg`)
  );
});

test('importaciones: solo admin puede subir excel a su propia ruta y con content-type permitido', async () => {
  const adminStorage = storageContext(testEnv, ids.admin, authClaims.admin);
  const logisticaStorage = storageContext(testEnv, ids.logistica, authClaims.logistica);

  await assertSucceeds(
    uploadFile(
      adminStorage,
      `imports/asset-imports/${ids.admin}/cargue.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'excel-bytes'
    )
  );

  await assertFails(
    uploadFile(
      adminStorage,
      `imports/asset-imports/${ids.logistica}/cargue-ajeno.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'excel-bytes'
    )
  );

  await assertFails(
    uploadFile(
      adminStorage,
      `imports/asset-imports/${ids.admin}/cargue.txt`,
      'text/plain',
      'no-valido'
    )
  );

  await assertFails(
    uploadFile(
      logisticaStorage,
      `imports/asset-imports/${ids.logistica}/cargue.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'excel-bytes'
    )
  );
});
