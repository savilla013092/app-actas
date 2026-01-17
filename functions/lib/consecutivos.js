"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generarConsecutivo = generarConsecutivo;
async function generarConsecutivo(db) {
    const añoActual = new Date().getFullYear();
    const consecutivoRef = db.collection('consecutivos').doc('actas');
    return db.runTransaction(async (transaction) => {
        const doc = await transaction.get(consecutivoRef);
        let nuevoNumero;
        if (!doc.exists) {
            nuevoNumero = 1;
            transaction.set(consecutivoRef, {
                año: añoActual,
                ultimo: nuevoNumero,
            });
        }
        else {
            const data = doc.data();
            if (data.año !== añoActual) {
                nuevoNumero = 1;
                transaction.update(consecutivoRef, {
                    año: añoActual,
                    ultimo: nuevoNumero,
                });
            }
            else {
                nuevoNumero = data.ultimo + 1;
                transaction.update(consecutivoRef, {
                    ultimo: nuevoNumero,
                });
            }
        }
        return `ACTA-${añoActual}-${nuevoNumero.toString().padStart(5, '0')}`;
    });
}
//# sourceMappingURL=consecutivos.js.map