/**
 * Script para recalcular el indice de busqueda de los activos.
 *
 * Uso:
 *   node scripts/actualizar-busqueda-activos.js --dry-run
 *   node scripts/actualizar-busqueda-activos.js --apply
 */

const admin = require('firebase-admin');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assetClassificationMap = require('../src/lib/constants/assetClassificationMap.json');
const locationCatalog = require('../src/lib/constants/locationCatalog.json');

const UNKNOWN_LOCATION = 'Sin asignar';

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

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeClassificationCode(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const digits = String(value).replace(/\D/g, '');
  if (!digits) {
    return undefined;
  }

  return digits.length >= 4 ? digits.slice(0, 4) : digits.padStart(4, '0');
}

function resolveClassificationName(codigo, fallbackCategory) {
  const classificationCode = normalizeClassificationCode(codigo);
  if (classificationCode && assetClassificationMap[classificationCode]) {
    return {
      classificationCode,
      classificationName: assetClassificationMap[classificationCode],
    };
  }

  if (fallbackCategory && String(fallbackCategory).trim()) {
    return {
      classificationCode,
      classificationName: String(fallbackCategory).trim(),
    };
  }

  return {
    classificationCode,
    classificationName: 'Sin clasificacion',
  };
}

function normalizeLocationText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const normalizedLocationNames = new Map();
for (const [code, name] of Object.entries(locationCatalog)) {
  const normalized = normalizeLocationText(name);
  if (!normalizedLocationNames.has(normalized)) {
    normalizedLocationNames.set(normalized, { code, name });
  }
}

function resolveLocationName(value) {
  if (value === undefined || value === null) {
    return UNKNOWN_LOCATION;
  }

  const raw = String(value).trim();
  if (!raw) {
    return UNKNOWN_LOCATION;
  }

  if (/^\d+$/.test(raw)) {
    return locationCatalog[String(Number(raw))] || UNKNOWN_LOCATION;
  }

  const normalized = normalizeLocationText(raw);
  if (normalized === normalizeLocationText(UNKNOWN_LOCATION) || normalized === 'ubicacion sin asignar') {
    return UNKNOWN_LOCATION;
  }

  const legacyMatch = normalized.match(/^ubicacion\s+(\d+)$/);
  if (legacyMatch) {
    return locationCatalog[String(Number(legacyMatch[1]))] || UNKNOWN_LOCATION;
  }

  const knownLocation = normalizedLocationNames.get(normalized);
  if (knownLocation) {
    return knownLocation.name;
  }

  return raw;
}

function tokenizeSearchParts(parts) {
  const tokenSet = new Set();

  for (const part of parts) {
    if (!part) {
      continue;
    }

    const normalized = normalizeText(part).replace(/[^a-z0-9]+/g, ' ');
    for (const token of normalized.split(/\s+/)) {
      if (token.length >= 2) {
        tokenSet.add(token);
      }
    }
  }

  return Array.from(tokenSet).slice(0, 40);
}

function buildSearchPayload(data) {
  const classification = resolveClassificationName(data.codigo, data.categoria);
  const locationName = resolveLocationName(data.ubicacion);

  return {
    codigo: normalizeText(data.codigo),
    ...(data.serial ? { serial: normalizeText(data.serial) } : {}),
    ...(classification.classificationCode
      ? { classificationCode: classification.classificationCode }
      : {}),
    classificationName: classification.classificationName,
    locationName,
    tokens: tokenizeSearchParts([
      data.codigo,
      data.descripcion,
      data.serial,
      data.marca,
      data.modelo,
      classification.classificationName,
      locationName,
    ]),
  };
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
    const nextSearch = buildSearchPayload(data);
    const currentSearch = data.search || null;

    if (JSON.stringify(currentSearch) === JSON.stringify(nextSearch)) {
      unchanged += 1;
      continue;
    }

    updated += 1;

    if (!applyChanges) {
      continue;
    }

    batch.update(doc.ref, {
      search: nextSearch,
      actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
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
  console.error('Error al actualizar el indice de busqueda:', error);
  process.exit(1);
});
