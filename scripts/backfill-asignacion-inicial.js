/**
 * Script para completar el estado inicial de asignacion en activos existentes.
 *
 * Uso:
 *   node scripts/backfill-asignacion-inicial.js --dry-run
 *   node scripts/backfill-asignacion-inicial.js --apply
 */

const admin = require('firebase-admin');
const fs = require('fs');
const os = require('os');
const path = require('path');

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    path.join(os.homedir(), 'firebase-credentials', 'service-account.json');

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'serviciudad-actas',
    });
  }

  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'serviciudad-actas',
  });
}

function resolveInitialAssignmentStatus(asset) {
  if (asset.estadoAsignacionInicial) {
    return asset.estadoAsignacionInicial;
  }

  return asset.custodioId ? 'completada' : 'no_requerida';
}

async function run() {
  initializeFirebaseAdmin();

  const db = admin.firestore();
  const applyChanges = process.argv.includes('--apply');
  const snapshot = await db.collection('activos').get();

  let updated = 0;
  let unchanged = 0;
  let batch = db.batch();
  let batchSize = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const nextStatus = resolveInitialAssignmentStatus(data);
    const nextAssignmentDate =
      nextStatus === 'completada' ? data.asignacionInicialCompletadaEn || data.actualizadoEn || data.creadoEn : null;

    const needsUpdate =
      data.estadoAsignacionInicial !== nextStatus ||
      (nextStatus === 'completada' && !data.asignacionInicialCompletadaEn) ||
      (nextStatus !== 'completada' && data.asignacionInicialCompletadaEn);

    if (!needsUpdate) {
      unchanged += 1;
      continue;
    }

    updated += 1;

    if (!applyChanges) {
      continue;
    }

    batch.set(
      doc.ref,
      {
        estadoAsignacionInicial: nextStatus,
        asignacionInicialCompletadaEn:
          nextStatus === 'completada'
            ? nextAssignmentDate || admin.firestore.FieldValue.serverTimestamp()
            : admin.firestore.FieldValue.delete(),
        asignacionInicialId:
          nextStatus === 'completada' ? data.asignacionInicialId || admin.firestore.FieldValue.delete() : admin.firestore.FieldValue.delete(),
        actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    batchSize += 1;

    if (batchSize === 350) {
      await batch.commit();
      batch = db.batch();
      batchSize = 0;
    }
  }

  if (applyChanges && batchSize > 0) {
    await batch.commit();
  }

  console.log('='.repeat(60));
  console.log(applyChanges ? 'BACKFILL APLICADO' : 'BACKFILL EN MODO DRY-RUN');
  console.log('='.repeat(60));
  console.log(`Activos revisados: ${snapshot.size}`);
  console.log(`Activos por actualizar: ${updated}`);
  console.log(`Activos sin cambios: ${unchanged}`);
}

run().catch((error) => {
  console.error('Error al actualizar el estado inicial de asignacion:', error);
  process.exit(1);
});
