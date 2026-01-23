/**
 * Script para limpiar datos de activos y revisiones en Firestore
 * Ejecutar con: node scripts/limpiar-datos.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Inicializar Firebase Admin con Service Account Key
// La ubicación del archivo debe ser: C:\Users\<usuario>\firebase-credentials\service-account.json
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT ||
    path.join(require('os').homedir(), 'firebase-credentials', 'service-account.json');
const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'serviciudad-actas',
});

const db = admin.firestore();

async function eliminarColeccion(nombreColeccion) {
    const collectionRef = db.collection(nombreColeccion);
    const query = collectionRef.orderBy('__name__').limit(500);

    return new Promise((resolve, reject) => {
        eliminarEnLotes(query, resolve).catch(reject);
    });
}

async function eliminarEnLotes(query, resolve) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        resolve();
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    // Recursivo para procesar el resto
    process.nextTick(() => {
        eliminarEnLotes(query, resolve);
    });
}

async function limpiarDatos() {
    console.log('='.repeat(60));
    console.log('LIMPIEZA DE DATOS - SERVICIUDAD ESP');
    console.log('='.repeat(60));

    try {
        console.log('Eliminando activos...');
        await eliminarColeccion('activos');
        console.log('  Colección de activos vaciada');

        console.log('Eliminando revisiones...');
        await eliminarColeccion('revisiones');
        console.log('  Colección de revisiones vaciada');

        console.log('='.repeat(60));
        console.log('LIMPIEZA COMPLETADA');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('Error durante la limpieza:', error);
        process.exit(1);
    }
}

limpiarDatos()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error fatal:', error);
        process.exit(1);
    });
