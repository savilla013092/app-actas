/**
 * Script para normalizar la categoria de los activos segun
 * los primeros 4 digitos del codigo del activo.
 *
 * Uso:
 *   node scripts/actualizar-categorias-activos.js --dry-run
 *   node scripts/actualizar-categorias-activos.js --apply
 */

const admin = require('firebase-admin');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assetClassificationMap = require('../src/lib/constants/assetClassificationMap.json');

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

function resolveCategory(codigo, fallbackCategory) {
    const classificationCode = normalizeClassificationCode(codigo);
    if (classificationCode && assetClassificationMap[classificationCode]) {
        return {
            classificationCode,
            category: assetClassificationMap[classificationCode],
        };
    }

    if (fallbackCategory && String(fallbackCategory).trim()) {
        return {
            classificationCode,
            category: String(fallbackCategory).trim(),
        };
    }

    return {
        classificationCode,
        category: 'Sin clasificacion',
    };
}

async function run() {
    initializeFirebaseAdmin();

    const db = admin.firestore();
    const applyChanges = process.argv.includes('--apply');
    const snapshot = await db.collection('activos').get();

    let updated = 0;
    let unchanged = 0;
    let unresolved = 0;
    let batch = db.batch();
    let batchSize = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const { classificationCode, category } = resolveCategory(data.codigo, data.categoria);

        if (!classificationCode) {
            unresolved++;
            continue;
        }

        if (data.categoria === category) {
            unchanged++;
            continue;
        }

        updated++;

        if (!applyChanges) {
            continue;
        }

        batch.update(doc.ref, {
            categoria: category,
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
    console.log(applyChanges ? 'NORMALIZACION APLICADA' : 'NORMALIZACION EN MODO DRY-RUN');
    console.log('='.repeat(60));
    console.log(`Activos revisados: ${snapshot.size}`);
    console.log(`Activos por actualizar: ${updated}`);
    console.log(`Activos sin cambios: ${unchanged}`);
    console.log(`Activos sin clasificacion detectable: ${unresolved}`);
}

run().catch((error) => {
    console.error('Error al actualizar categorias:', error);
    process.exit(1);
});