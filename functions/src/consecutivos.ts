import * as admin from 'firebase-admin';

export async function generarConsecutivo(db: admin.firestore.Firestore): Promise<string> {
    const añoActual = new Date().getFullYear();
    const consecutivoRef = db.collection('consecutivos').doc('actas');

    return db.runTransaction(async (transaction) => {
        const doc = await transaction.get(consecutivoRef);

        let nuevoNumero: number;

        if (!doc.exists) {
            // Primera vez, crear documento
            nuevoNumero = 1;
            transaction.set(consecutivoRef, {
                año: añoActual,
                ultimo: nuevoNumero,
            });
        } else {
            const data = doc.data()!;

            if (data.año !== añoActual) {
                // Nuevo año, reiniciar consecutivo
                nuevoNumero = 1;
                transaction.update(consecutivoRef, {
                    año: añoActual,
                    ultimo: nuevoNumero,
                });
            } else {
                // Incrementar consecutivo
                nuevoNumero = data.ultimo + 1;
                transaction.update(consecutivoRef, {
                    ultimo: nuevoNumero,
                });
            }
        }

        // Formato: ACTA-2024-00125
        return `ACTA-${añoActual}-${nuevoNumero.toString().padStart(5, '0')}`;
    });
}
