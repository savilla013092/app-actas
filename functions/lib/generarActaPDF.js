"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generarActaPDF = generarActaPDF;
const pdfkit_1 = __importDefault(require("pdfkit"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function extractStoragePath(url, bucketName) {
    if (url.includes('firebasestorage.googleapis.com')) {
        const match = url.match(/\/o\/([^?]+)/);
        if (match) {
            return decodeURIComponent(match[1]);
        }
    }
    else if (url.includes('storage.googleapis.com')) {
        return url.replace(`https://storage.googleapis.com/${bucketName}/`, '');
    }
    return decodeURIComponent(url);
}
async function generarActaPDF({ numeroActa, revision, storage }) {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new pdfkit_1.default({
                size: 'LETTER',
                margins: { top: 50, bottom: 50, left: 50, right: 50 },
            });
            const chunks = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
            const bucket = storage.bucket();
            const bucketName = bucket.name;
            console.log('Descargando firma del revisor:', revision.firmaRevisor.url);
            const firmaRevisorPath = extractStoragePath(revision.firmaRevisor.url, bucketName);
            console.log('Path extraído:', firmaRevisorPath);
            const [firmaRevisorBuffer] = await bucket.file(firmaRevisorPath).download();
            console.log('Descargando firma del custodio:', revision.firmaCustodio.url);
            const firmaCustodioPath = extractStoragePath(revision.firmaCustodio.url, bucketName);
            console.log('Path extraído:', firmaCustodioPath);
            const [firmaCustodioBuffer] = await bucket.file(firmaCustodioPath).download();
            const evidenciasBuffers = [];
            for (const evidencia of revision.evidencias.slice(0, 4)) {
                try {
                    const evidenciaPath = extractStoragePath(evidencia.url, bucketName);
                    console.log('Descargando evidencia:', evidenciaPath);
                    const [buffer] = await bucket.file(evidenciaPath).download();
                    evidenciasBuffers.push(buffer);
                }
                catch (e) {
                    console.warn('No se pudo descargar evidencia:', evidencia.url, e);
                }
            }
            const logoPath = path.join(__dirname, 'assets', 'serviciudad.jpg');
            const logoExists = fs.existsSync(logoPath);
            if (logoExists) {
                const logoWidth = 150;
                const logoHeight = 60;
                const pageWidth = doc.page.width;
                const logoX = (pageWidth - logoWidth) / 2;
                doc.image(logoPath, logoX, 50, {
                    width: logoWidth,
                    height: logoHeight,
                    fit: [logoWidth, logoHeight],
                });
                doc.moveDown(4);
            }
            else {
                doc.fontSize(12).font('Helvetica-Bold');
                doc.text('SERVICIUDAD ESP', { align: 'center' });
            }
            doc.fontSize(10).font('Helvetica');
            doc.text('NIT: 123.456.789-0', { align: 'center' });
            doc.text('Dirección de Activos Fijos', { align: 'center' });
            doc.moveDown();
            doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
            doc.moveDown();
            doc.fontSize(14).font('Helvetica-Bold');
            doc.text('ACTA DE REVISIÓN DE ACTIVO FIJO', { align: 'center' });
            doc.fontSize(12);
            doc.text(`No. ${numeroActa}`, { align: 'center' });
            doc.moveDown();
            doc.fontSize(11).font('Helvetica-Bold');
            doc.text('INFORMACIÓN GENERAL');
            doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica');
            const fechaRevision = revision.fecha.toDate();
            const fechaFormateada = fechaRevision.toLocaleDateString('es-CO', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            doc.text(`Fecha de revisión: ${fechaFormateada}`);
            doc.text(`Código del activo: ${revision.codigoActivo}`);
            doc.text(`Descripción: ${revision.descripcionActivo}`);
            doc.text(`Ubicación: ${revision.ubicacionActivo}`);
            doc.moveDown();
            doc.fontSize(11).font('Helvetica-Bold');
            doc.text('DATOS DEL CUSTODIO');
            doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica');
            doc.text(`Nombre: ${revision.custodioNombre}`);
            doc.text(`Cédula: ${revision.custodioCedula}`);
            doc.text(`Cargo: ${revision.custodioCargo}`);
            doc.moveDown();
            doc.fontSize(11).font('Helvetica-Bold');
            doc.text('DATOS DEL REVISOR');
            doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica');
            doc.text(`Nombre: ${revision.revisorNombre}`);
            doc.text(`Cédula: ${revision.revisorCedula}`);
            doc.text(`Cargo: ${revision.revisorCargo}`);
            doc.moveDown();
            doc.fontSize(11).font('Helvetica-Bold');
            doc.text('RESULTADO DE LA REVISIÓN');
            doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica');
            const estadosTexto = {
                excelente: 'EXCELENTE',
                bueno: 'BUENO',
                regular: 'REGULAR',
                malo: 'MALO',
                para_baja: 'PARA BAJA',
            };
            doc.text(`Estado del activo: ${estadosTexto[revision.estadoActivo] || revision.estadoActivo}`);
            doc.moveDown(0.5);
            doc.font('Helvetica-Bold').text('Descripción de la revisión:');
            doc.font('Helvetica').text(revision.descripcion);
            if (revision.observaciones) {
                doc.moveDown(0.5);
                doc.font('Helvetica-Bold').text('Observaciones:');
                doc.font('Helvetica').text(revision.observaciones);
            }
            doc.moveDown();
            if (evidenciasBuffers.length > 0) {
                doc.fontSize(11).font('Helvetica-Bold');
                doc.text('REGISTRO FOTOGRÁFICO');
                doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
                doc.moveDown(0.5);
                const imageWidth = 240;
                const imageHeight = 180;
                let x = 50;
                let y = doc.y;
                for (let i = 0; i < evidenciasBuffers.length; i++) {
                    if (i > 0 && i % 2 === 0) {
                        y += imageHeight + 20;
                        x = 50;
                    }
                    try {
                        doc.image(evidenciasBuffers[i], x, y, {
                            width: imageWidth,
                            height: imageHeight,
                            fit: [imageWidth, imageHeight],
                        });
                    }
                    catch (e) {
                        doc.rect(x, y, imageWidth, imageHeight).stroke();
                        doc.text('Imagen no disponible', x + 10, y + imageHeight / 2);
                    }
                    x += imageWidth + 20;
                }
                doc.y = y + imageHeight + 20;
            }
            doc.addPage();
            doc.fontSize(11).font('Helvetica-Bold');
            doc.text('DECLARACIÓN Y CONSTANCIA');
            doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica');
            doc.text('El profesional de logística certifica que realizó la revisión física del activo y que la información ' +
                'registrada corresponde al estado real del mismo al momento de la inspección.', { align: 'justify' });
            doc.moveDown(0.5);
            doc.text('El custodio certifica que la información registrada es veraz y acepta la responsabilidad sobre el ' +
                'activo a su cargo en el estado descrito.', { align: 'justify' });
            doc.moveDown(2);
            const firmaWidth = 200;
            const firmaHeight = 80;
            const firmaY = doc.y;
            doc.image(firmaRevisorBuffer, 80, firmaY, {
                width: firmaWidth,
                height: firmaHeight,
                fit: [firmaWidth, firmaHeight],
            });
            doc.moveTo(80, firmaY + firmaHeight + 5).lineTo(280, firmaY + firmaHeight + 5).stroke();
            doc.fontSize(9);
            doc.text(revision.revisorNombre, 80, firmaY + firmaHeight + 10, { width: firmaWidth, align: 'center' });
            doc.text(`C.C. ${revision.revisorCedula}`, 80, doc.y, { width: firmaWidth, align: 'center' });
            doc.text('Profesional Especializado en Logística', 80, doc.y, { width: firmaWidth, align: 'center' });
            const fechaFirmaRevisorDate = revision.firmaRevisor.fechaFirma.toDate();
            const fechaFirmaRevisor = fechaFirmaRevisorDate.toLocaleString('es-CO');
            doc.fontSize(8).text(`Firmado: ${fechaFirmaRevisor}`, 80, doc.y, { width: firmaWidth, align: 'center' });
            doc.image(firmaCustodioBuffer, 320, firmaY, {
                width: firmaWidth,
                height: firmaHeight,
                fit: [firmaWidth, firmaHeight],
            });
            doc.moveTo(320, firmaY + firmaHeight + 5).lineTo(520, firmaY + firmaHeight + 5).stroke();
            doc.fontSize(9);
            doc.text(revision.custodioNombre, 320, firmaY + firmaHeight + 10, { width: firmaWidth, align: 'center' });
            doc.text(`C.C. ${revision.custodioCedula}`, 320, doc.y, { width: firmaWidth, align: 'center' });
            doc.text('Custodio del Activo', 320, doc.y, { width: firmaWidth, align: 'center' });
            const fechaFirmaCustodioDate = revision.firmaCustodio.fechaFirma.toDate();
            const fechaFirmaCustodio = fechaFirmaCustodioDate.toLocaleString('es-CO');
            doc.fontSize(8).text(`Firmado: ${fechaFirmaCustodio}`, 320, doc.y, { width: firmaWidth, align: 'center' });
            doc.fontSize(8).font('Helvetica');
            const bottomY = doc.page.height - 60;
            doc.moveTo(50, bottomY).lineTo(562, bottomY).stroke();
            doc.text('Documento generado automáticamente por el Sistema de Activos Fijos - SERVICIUDAD ESP', 50, bottomY + 5, {
                align: 'center',
                width: 512,
            });
            doc.text(`Hash de verificación: ${revision.firmaRevisor.hashDocumento.substring(0, 32)}...`, 50, doc.y, {
                align: 'center',
                width: 512,
            });
            doc.end();
        }
        catch (error) {
            reject(error);
        }
    });
}
//# sourceMappingURL=generarActaPDF.js.map