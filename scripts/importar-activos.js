/**
 * Script para importar activos desde el archivo Excel a Firestore
 * Ejecutar con: node scripts/importar-activos.js
 */

const admin = require('firebase-admin');
const XLSX = require('xlsx');
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

// Mapeo de categorías basado en el código de clasificación
function obtenerCategoria(codigoClasificacion) {
    const categorias = {
        '2420': 'Equipo de Cómputo',
        '2430': 'Mobiliario',
        '2440': 'Vehículos',
        '2450': 'Maquinaria',
    };
    const codigo = String(codigoClasificacion).substring(0, 4);
    return categorias[codigo] || 'Equipo de Cómputo';
}

// Convertir fecha de Excel a Date
function convertirFechaExcel(fechaExcel) {
    if (!fechaExcel || fechaExcel === '30/12/1899') return null;
    if (typeof fechaExcel === 'number') {
        // Fecha en formato numérico de Excel
        const fecha = new Date((fechaExcel - 25569) * 86400 * 1000);
        return fecha;
    }
    return null;
}

async function crearUsuarioAdmin() {
    // Crear usuario admin por defecto si no existe
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
        console.log('✓ Usuario admin creado');
    }

    // Crear usuario logística por defecto
    const logisticaId = 'logistica-sistema';
    const logisticaRef = db.collection('usuarios').doc(logisticaId);
    const logisticaDoc = await logisticaRef.get();

    if (!logisticaDoc.exists) {
        await logisticaRef.set({
            email: 'logistica@serviciudad.gov.co',
            nombre: 'Profesional Logística',
            cedula: '1111111111',
            cargo: 'Profesional Logística',
            dependencia: 'Logística',
            rol: 'logistica',
            activo: true,
            creadoEn: admin.firestore.FieldValue.serverTimestamp(),
            actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
            creadoPor: 'importacion-inicial',
        });
        console.log('✓ Usuario logística creado');
    }

    // Crear usuario custodio de ejemplo
    const custodioId = 'custodio-sistema';
    const custodioRef = db.collection('usuarios').doc(custodioId);
    const custodioDoc = await custodioRef.get();

    if (!custodioDoc.exists) {
        await custodioRef.set({
            email: 'custodio@serviciudad.gov.co',
            nombre: 'Custodio General',
            cedula: '2222222222',
            cargo: 'Custodio de Activos',
            dependencia: 'Dirección Administrativa',
            rol: 'custodio',
            activo: true,
            creadoEn: admin.firestore.FieldValue.serverTimestamp(),
            actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
            creadoPor: 'importacion-inicial',
        });
        console.log('✓ Usuario custodio creado');
    }

    return { adminId, logisticaId, custodioId };
}

async function importarActivos() {
    console.log('='.repeat(60));
    console.log('IMPORTACIÓN DE ACTIVOS - SERVICIUDAD ESP');
    console.log('='.repeat(60));

    try {
        // Crear usuarios por defecto
        const { custodioId } = await crearUsuarioAdmin();

        // Leer archivo Excel desde carpeta data/
        const archivoExcel = path.join(__dirname, '..', 'data', 'Listado_activos.xlsx');
        console.log(`\nLeyendo archivo: ${archivoExcel}`);

        const workbook = XLSX.readFile(archivoExcel);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const datos = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Obtener encabezados
        const encabezados = datos[0];
        console.log(`Total de filas: ${datos.length - 1}`);

        // Índices de columnas importantes
        const COL = {
            CODIGO: 0,           // Codigo Activo
            PLACA: 1,            // Placa Inventario Activo
            DESCRIPCION: 2,      // Descripción Activo
            CLASIFICACION: 3,    // Codigo Clasificación
            UBICACION: 7,        // Codigo Ubicación
            REFERENCIA: 8,       // Referencia
            SERIAL: 9,           // Serial
            DESC_TECNICA: 10,    // Descripcion Tecnica
            MARCA: 48,           // Marca
            MODELO: 50,          // Modelo
            FECHA_ADQ: 63,       // Fecha Adquisición
            VALOR: 64,           // Valor Costo Adquisición
            RETIRADO: 76,        // Retirado
            DEPRECIADO: 77,      // Depreciado
        };

        // Importar activos en lotes
        const BATCH_SIZE = 500;
        let importados = 0;
        let omitidos = 0;
        let batch = db.batch();
        let batchCount = 0;

        for (let i = 1; i < datos.length; i++) {
            const fila = datos[i];

            // Omitir activos sin código
            if (!fila[COL.CODIGO]) {
                omitidos++;
                continue;
            }

            // Determinar estado del activo
            let estado = 'activo';
            if (fila[COL.RETIRADO] === true) {
                estado = 'baja';
            }

            const activo = {
                codigo: `AF-${String(fila[COL.CODIGO])}`,
                descripcion: fila[COL.DESCRIPCION] || 'Sin descripción',
                categoria: obtenerCategoria(fila[COL.CLASIFICACION]),
                marca: fila[COL.MARCA] || undefined,
                modelo: fila[COL.MODELO] || undefined,
                serial: fila[COL.SERIAL] || undefined,
                ubicacion: `Ubicación ${fila[COL.UBICACION] || 'Sin asignar'}`,
                dependencia: 'Dirección Administrativa',
                custodioId: custodioId,
                custodioNombre: 'Custodio General',
                estado: estado,
                valorAdquisicion: fila[COL.VALOR] || 0,
                fechaAdquisicion: convertirFechaExcel(fila[COL.FECHA_ADQ]),
                observaciones: fila[COL.DESC_TECNICA] || undefined,
                creadoEn: admin.firestore.FieldValue.serverTimestamp(),
                actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
                creadoPor: 'importacion-excel',
            };

            // Limpiar valores undefined
            Object.keys(activo).forEach(key => {
                if (activo[key] === undefined) {
                    delete activo[key];
                }
            });

            const docRef = db.collection('activos').doc();
            batch.set(docRef, activo);
            batchCount++;
            importados++;

            // Commit batch si llega al límite
            if (batchCount >= BATCH_SIZE) {
                await batch.commit();
                console.log(`  Importados ${importados} activos...`);
                batch = db.batch();
                batchCount = 0;
            }
        }

        // Commit batch final
        if (batchCount > 0) {
            await batch.commit();
        }

        console.log('\n' + '='.repeat(60));
        console.log('RESUMEN DE IMPORTACIÓN');
        console.log('='.repeat(60));
        console.log(`✓ Activos importados: ${importados}`);
        console.log(`- Activos omitidos: ${omitidos}`);
        console.log('\n¡Importación completada exitosamente!');

    } catch (error) {
        console.error('Error durante la importación:', error);
        process.exit(1);
    }
}

// Ejecutar importación
importarActivos()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error fatal:', error);
        process.exit(1);
    });
