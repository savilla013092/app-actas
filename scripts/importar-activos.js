/**
 * Script para importar activos desde el archivo Excel a Firestore.
 * Ejecutar con: node scripts/importar-activos.js
 */

const admin = require('firebase-admin');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const os = require('os');
const assetClassificationMap = require('../src/lib/constants/assetClassificationMap.json');
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

initializeFirebaseAdmin();
const db = admin.firestore();

function normalizarCodigoClasificacion(value) {
    if (value === undefined || value === null) {
        return undefined;
    }

    const digits = String(value).replace(/\D/g, '');
    if (!digits) {
        return undefined;
    }

    return digits.length >= 4 ? digits.slice(0, 4) : digits.padStart(4, '0');
}

function obtenerCategoria(codigoActivo, categoriaFallback) {
    const codigoClasificacion = normalizarCodigoClasificacion(codigoActivo);
    if (codigoClasificacion && assetClassificationMap[codigoClasificacion]) {
        return assetClassificationMap[codigoClasificacion];
    }

    if (categoriaFallback && String(categoriaFallback).trim()) {
        return String(categoriaFallback).trim();
    }

    return 'Sin clasificacion';
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

function obtenerUbicacion(value) {
    if (value === undefined || value === null) {
        return UNKNOWN_LOCATION;
    }

    const raw = String(value).trim();
    if (!raw) {
        return UNKNOWN_LOCATION;
    }

    const normalizedText = normalizeLocationText(raw);
    if (normalizedText === normalizeLocationText(UNKNOWN_LOCATION) || normalizedText === 'ubicacion sin asignar') {
        return UNKNOWN_LOCATION;
    }

    const locationCode = normalizeLocationCode(raw);
    if (locationCode) {
        if (locationCatalog[locationCode]) {
            return locationCatalog[locationCode];
        }

        return UNKNOWN_LOCATION;
    }

    const knownLocation = normalizedNameToLocation.get(normalizedText);
    if (knownLocation) {
        return knownLocation.name;
    }

    return raw;
}

function convertirFechaExcel(fechaExcel) {
    if (!fechaExcel || fechaExcel === '30/12/1899') return null;
    if (typeof fechaExcel === 'number') {
        return new Date((fechaExcel - 25569) * 86400 * 1000);
    }
    return null;
}

async function crearUsuariosBase() {
    const adminId = 'admin-sistema';
    const adminRef = db.collection('usuarios').doc(adminId);
    const adminDoc = await adminRef.get();

    if (!adminDoc.exists) {
        await adminRef.set({
            email: 'admin@serviciudad.gov.co',
            nombre: 'Administrador Sistema',
            cedula: '0000000000',
            cargo: 'Administrador',
            dependencia: 'Sistemas',
            rol: 'admin',
            activo: true,
            creadoEn: admin.firestore.FieldValue.serverTimestamp(),
            actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
            creadoPor: 'importacion-inicial',
        });
        console.log('Usuario admin creado');
    }

    const logisticaId = 'logistica-sistema';
    const logisticaRef = db.collection('usuarios').doc(logisticaId);
    const logisticaDoc = await logisticaRef.get();

    if (!logisticaDoc.exists) {
        await logisticaRef.set({
            email: 'logistica@serviciudad.gov.co',
            nombre: 'Profesional Logistica',
            cedula: '1111111111',
            cargo: 'Profesional Logistica',
            dependencia: 'Logistica',
            rol: 'logistica',
            activo: true,
            creadoEn: admin.firestore.FieldValue.serverTimestamp(),
            actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
            creadoPor: 'importacion-inicial',
        });
        console.log('Usuario logistica creado');
    }

    const custodioId = 'custodio-sistema';
    const custodioRef = db.collection('usuarios').doc(custodioId);
    const custodioDoc = await custodioRef.get();

    if (!custodioDoc.exists) {
        await custodioRef.set({
            email: 'custodio@serviciudad.gov.co',
            nombre: 'Custodio General',
            cedula: '2222222222',
            cargo: 'Custodio de Activos',
            dependencia: 'Direccion Administrativa',
            rol: 'custodio',
            activo: true,
            creadoEn: admin.firestore.FieldValue.serverTimestamp(),
            actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
            creadoPor: 'importacion-inicial',
        });
        console.log('Usuario custodio creado');
    }

    return { custodioId };
}

async function importarActivos() {
    console.log('='.repeat(60));
    console.log('IMPORTACION DE ACTIVOS - SERVICIUDAD ESP');
    console.log('='.repeat(60));

    try {
        const { custodioId } = await crearUsuariosBase();

        const archivoExcel = path.join(__dirname, '..', 'data', 'Listado_activos.xlsx');
        console.log(`\nLeyendo archivo: ${archivoExcel}`);

        const workbook = XLSX.readFile(archivoExcel);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const datos = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log(`Total de filas: ${datos.length - 1}`);

        const COL = {
            CODIGO: 0,
            DESCRIPCION: 2,
            UBICACION: 7,
            SERIAL: 9,
            DESC_TECNICA: 10,
            MARCA: 48,
            MODELO: 50,
            FECHA_ADQ: 63,
            VALOR: 64,
            RETIRADO: 76,
        };

        const BATCH_SIZE = 500;
        let importados = 0;
        let omitidos = 0;
        let batch = db.batch();
        let batchCount = 0;

        for (let i = 1; i < datos.length; i++) {
            const fila = datos[i];

            if (!fila[COL.CODIGO]) {
                omitidos++;
                continue;
            }

            const estado = fila[COL.RETIRADO] === true ? 'baja' : 'activo';

            const activo = {
                codigo: `AF-${String(fila[COL.CODIGO])}`,
                descripcion: fila[COL.DESCRIPCION] || 'Sin descripcion',
                categoria: obtenerCategoria(fila[COL.CODIGO]),
                marca: fila[COL.MARCA] || undefined,
                modelo: fila[COL.MODELO] || undefined,
                serial: fila[COL.SERIAL] || undefined,
                ubicacion: obtenerUbicacion(fila[COL.UBICACION]),
                dependencia: 'Direccion Administrativa',
                custodioId,
                custodioNombre: 'Custodio General',
                estado,
                valorAdquisicion: fila[COL.VALOR] || 0,
                fechaAdquisicion: convertirFechaExcel(fila[COL.FECHA_ADQ]),
                observaciones: fila[COL.DESC_TECNICA] || undefined,
                creadoEn: admin.firestore.FieldValue.serverTimestamp(),
                actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
                creadoPor: 'importacion-excel',
            };

            Object.keys(activo).forEach((key) => {
                if (activo[key] === undefined) {
                    delete activo[key];
                }
            });

            const docRef = db.collection('activos').doc();
            batch.set(docRef, activo);
            batchCount++;
            importados++;

            if (batchCount >= BATCH_SIZE) {
                await batch.commit();
                console.log(`Importados ${importados} activos...`);
                batch = db.batch();
                batchCount = 0;
            }
        }

        if (batchCount > 0) {
            await batch.commit();
        }

        console.log('\n' + '='.repeat(60));
        console.log('RESUMEN DE IMPORTACION');
        console.log('='.repeat(60));
        console.log(`Activos importados: ${importados}`);
        console.log(`Activos omitidos: ${omitidos}`);
        console.log('\nImportacion completada exitosamente.');
    } catch (error) {
        console.error('Error durante la importacion:', error);
        process.exit(1);
    }
}

importarActivos()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error fatal:', error);
        process.exit(1);
    });