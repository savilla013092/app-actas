/**
 * Script para normalizar la ubicacion de los activos segun
 * el catalogo oficial de sitios.
 *
 * Uso:
 *   node scripts/actualizar-ubicaciones-activos.js --dry-run
 *   node scripts/actualizar-ubicaciones-activos.js --apply
 */

const admin = require('firebase-admin');
const fs = require('fs');
const os = require('os');
const path = require('path');
const locationCatalog = require('../src/lib/constants/locationCatalog.json');

const UNKNOWN_LOCATION = 'Sin asignar';

function initializeFirebaseAdmin() {
    if (admin.apps.length > 0) {
        return admin.app();
    }

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT ||
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

function normalizeLocationText(value) {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function normalizeLocationCode(value) {
    if (value === undefined || value === null) {
        return undefined;
    }

    const raw = String(value).trim();
    if (!raw) {
        return undefined;
    }

    if (/^\d+$/.test(raw)) {
        return String(Number(raw));
    }

    const normalizedText = normalizeLocationText(raw);
    const legacyMatch = normalizedText.match(/^ubicacion\s+(\d+)$/);
    if (legacyMatch) {
        return String(Number(legacyMatch[1]));
    }

    return undefined;
}

const normalizedNameToLocation = new Map();
for (const [code, name] of Object.entries(locationCatalog)) {
    const normalizedName = normalizeLocationText(name);
    if (!normalizedNameToLocation.has(normalizedName)) {
        normalizedNameToLocation.set(normalizedName, { code, name });
    }
}

function resolveLocation(value) {
    if (value === undefined || value === null) {
        return { locationName: UNKNOWN_LOCATION, isMapped: true };
    }

    const raw = String(value).trim();
    if (!raw) {
        return { locationName: UNKNOWN_LOCATION, isMapped: true };
    }

    const normalizedText = normalizeLocationText(raw);
    if (normalizedText === normalizeLocationText(UNKNOWN_LOCATION) || normalizedText === 'ubicacion sin asignar') {
        return { locationName: UNKNOWN_LOCATION, isMapped: true };
    }

    const locationCode = normalizeLocationCode(raw);
    if (locationCode) {
        if (locationCatalog[locationCode]) {
            return {
                locationCode,
                locationName: locationCatalog[locationCode],
                isMapped: true,
            };
        }

        return {
            locationCode,
            locationName: UNKNOWN_LOCATION,
            isMapped: false,
        };
    }

    const knownLocation = normalizedNameToLocation.get(normalizedText);
    if (knownLocation) {
        return {
            locationCode: knownLocation.code,
            locationName: knownLocation.name,
            isMapped: true,
        };
    }

    return {
        locationName: raw,
        isMapped: false,
    };
}

async function run() {
    initializeFirebaseAdmin();

    const db = admin.firestore();
    const applyChanges = process.argv.includes('--apply');
    const snapshot = await db.collection('activos').get();

    let updated = 0;
    let unchanged = 0;
    let preservedFreeText = 0;
    let batch = db.batch();
    let batchSize = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const currentLocation = data.ubicacion;
        const resolvedLocation = resolveLocation(currentLocation);
        const currentValue = currentLocation === undefined || currentLocation === null
            ? ''
            : String(currentLocation).trim();

        if (!resolvedLocation.isMapped && currentValue === resolvedLocation.locationName) {
            preservedFreeText++;
            unchanged++;
            continue;
        }

        if (currentValue === resolvedLocation.locationName) {
            unchanged++;
            continue;
        }

        updated++;

        if (!applyChanges) {
            continue;
        }

        batch.update(doc.ref, {
            ubicacion: resolvedLocation.locationName,
            actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
        });
        batchSize++;

        if (batchSize === 400) {
            await batch.commit();
            batch = db.batch();
            batchSize = 0;
        }
    }

    if (applyChanges && batchSize > 0) {
        await batch.commit();
    }

    console.log('='.repeat(60));
    console.log(applyChanges ? 'NORMALIZACION DE UBICACIONES APLICADA' : 'NORMALIZACION DE UBICACIONES EN MODO DRY-RUN');
    console.log('='.repeat(60));
    console.log(`Activos revisados: ${snapshot.size}`);
    console.log(`Activos por actualizar: ${updated}`);
    console.log(`Activos sin cambios: ${unchanged}`);
    console.log(`Ubicaciones libres conservadas: ${preservedFreeText}`);
}

run().catch((error) => {
    console.error('Error al actualizar ubicaciones:', error);
    process.exit(1);
});