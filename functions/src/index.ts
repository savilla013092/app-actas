import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { generarActaPDF } from './generarActaPDF';
import { generarConsecutivo } from './consecutivos';

admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();

// Trigger cuando una revisión tiene ambas firmas
export const onRevisionFirmadaCompleta = functions.firestore
    .document('revisiones/{revisionId}')
    .onUpdate(async (change, context) => {
        const antes = change.before.data();
        const despues = change.after.data();
        const revisionId = context.params.revisionId;

        // Verificar que el estado cambió a 'firmada_completa'
        if (antes.estado !== 'firmada_completa' && despues.estado === 'firmada_completa') {

            // Verificar que ambas firmas existen
            if (!despues.firmaRevisor?.url || !despues.firmaCustodio?.url) {
                console.error('Faltan firmas en la revisión', revisionId);
                return null;
            }

            try {
                // 1. Generar número de acta consecutivo
                const numeroActa = await generarConsecutivo(db);

                // 2. Generar el PDF
                const pdfBuffer = await generarActaPDF({
                    numeroActa,
                    revision: despues,
                    storage,
                });

                // 3. Subir PDF a Storage
                const bucket = storage.bucket();
                const pdfPath = `actas/${revisionId}.pdf`;
                const file = bucket.file(pdfPath);

                await file.save(pdfBuffer, {
                    metadata: {
                        contentType: 'application/pdf',
                    },
                });

                // Hacer el archivo público o generar URL firmada
                await file.makePublic();
                const pdfUrl = `https://storage.googleapis.com/${bucket.name}/${pdfPath}`;

                // 4. Actualizar documento con el PDF y estado final
                await change.after.ref.update({
                    numeroActa,
                    actaPdfUrl: pdfUrl,
                    estado: 'completada',
                    actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
                });

                // 5. Registrar en auditoría
                await db.collection('auditoria').add({
                    accion: 'completar',
                    modulo: 'revisiones',
                    documentoId: revisionId,
                    usuarioId: 'system',
                    usuarioEmail: 'system@serviciudad.gov.co',
                    usuarioNombre: 'Sistema',
                    descripcion: `Acta ${numeroActa} generada automáticamente`,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                });

                console.log(`Acta ${numeroActa} generada exitosamente para revisión ${revisionId}`);
                return { success: true, numeroActa };

            } catch (error) {
                console.error('Error al generar acta PDF:', error);

                // Marcar la revisión con error
                await change.after.ref.update({
                    estado: 'error_generacion',
                    errorMensaje: String(error),
                    actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
                });

                return { success: false, error: String(error) };
            }
        }

        return null;
    });

// Trigger para auditoría automática
export const onDocumentoModificado = functions.firestore
    .document('{coleccion}/{docId}')
    .onWrite(async (change, context) => {
        const coleccion = context.params.coleccion;

        // Solo auditar colecciones específicas
        if (!['usuarios', 'activos', 'revisiones'].includes(coleccion)) {
            return null;
        }

        // No auditar la colección de auditoría
        if (coleccion === 'auditoria') {
            return null;
        }

        const antes = change.before.exists ? change.before.data() : null;
        const despues = change.after.exists ? change.after.data() : null;

        let accion: string;
        if (!antes && despues) {
            accion = 'crear';
        } else if (antes && !despues) {
            accion = 'eliminar';
        } else {
            accion = 'modificar';
        }

        // Obtener usuario que hizo el cambio
        const usuarioId = despues?.actualizadoPor || despues?.creadoPor || 'unknown';

        await db.collection('auditoria').add({
            accion,
            modulo: coleccion,
            documentoId: context.params.docId,
            usuarioId,
            datosAntes: antes,
            datosDespues: despues,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        return null;
    });
