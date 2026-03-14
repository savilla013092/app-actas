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
exports.generarActaAsignacionPDF = generarActaAsignacionPDF;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const security_1 = require("./security");
function asDate(value) {
    if (value && typeof value === 'object' && 'toDate' in value) {
        return value.toDate();
    }
    return new Date(value);
}
async function generarActaAsignacionPDF({ numeroActa, asignacion, storage, }) {
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
            const firmaRevisorPath = (0, security_1.resolveStoredFilePath)(asignacion.firmaRevisor, bucketName);
            const firmaCustodioPath = (0, security_1.resolveStoredFilePath)(asignacion.firmaCustodio, bucketName);
            const [firmaRevisorBuffer] = await bucket.file(firmaRevisorPath).download();
            const [firmaCustodioBuffer] = await bucket.file(firmaCustodioPath).download();
            const evidenciasBuffers = [];
            for (const evidencia of asignacion.evidencias.slice(0, 4)) {
                try {
                    const evidenciaPath = (0, security_1.resolveStoredFilePath)(evidencia, bucketName);
                    const [buffer] = await bucket.file(evidenciaPath).download();
                    evidenciasBuffers.push(buffer);
                }
                catch (error) {
                    console.warn('No fue posible descargar una evidencia de asignación para el PDF.', error);
                }
            }
            const logoPath = path.join(__dirname, 'assets', 'serviciudad.jpg');
            if (fs.existsSync(logoPath)) {
                const logoWidth = 150;
                const logoHeight = 60;
                const logoX = (doc.page.width - logoWidth) / 2;
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
            doc.text('NIT: 816.001.609-1', { align: 'center' });
            doc.text('Direccion de Activos Fijos', { align: 'center' });
            doc.moveDown();
            doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
            doc.moveDown();
            doc.fontSize(14).font('Helvetica-Bold');
            doc.text('ACTA DE ASIGNACION INICIAL DE ACTIVO FIJO', { align: 'center' });
            doc.fontSize(12);
            doc.text(`No. ${numeroActa}`, { align: 'center' });
            doc.moveDown();
            doc.fontSize(11).font('Helvetica-Bold');
            doc.text('INFORMACION GENERAL');
            doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
            doc.moveDown(0.5);
            const fechaAsignacion = asDate(asignacion.fecha);
            const fechaFormateada = fechaAsignacion.toLocaleDateString('es-CO', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
            doc.fontSize(10).font('Helvetica');
            doc.text(`Fecha de asignacion: ${fechaFormateada}`);
            doc.text(`Codigo del activo: ${asignacion.codigoActivo}`);
            doc.text(`Descripcion: ${asignacion.descripcionActivo}`);
            doc.text(`Ubicacion: ${asignacion.ubicacionActivo}`);
            doc.moveDown();
            doc.fontSize(11).font('Helvetica-Bold');
            doc.text('DATOS DEL CUSTODIO');
            doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica');
            doc.text(`Nombre: ${asignacion.custodioNombre}`);
            doc.text(`Cedula: ${asignacion.custodioCedula}`);
            doc.text(`Cargo: ${asignacion.custodioCargo}`);
            doc.moveDown();
            doc.fontSize(11).font('Helvetica-Bold');
            doc.text('DATOS DEL REVISOR');
            doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica');
            doc.text(`Nombre: ${asignacion.revisorNombre}`);
            doc.text(`Cedula: ${asignacion.revisorCedula}`);
            doc.text(`Cargo: ${asignacion.revisorCargo}`);
            doc.moveDown();
            doc.fontSize(11).font('Helvetica-Bold');
            doc.text('ENTREGA Y RECIBO');
            doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica');
            doc.font('Helvetica-Bold').text('Descripcion de entrega/recibo:');
            doc.font('Helvetica').text(asignacion.descripcion);
            if (asignacion.observaciones) {
                doc.moveDown(0.5);
                doc.font('Helvetica-Bold').text('Observaciones:');
                doc.font('Helvetica').text(asignacion.observaciones);
            }
            doc.moveDown();
            if (evidenciasBuffers.length > 0) {
                doc.fontSize(11).font('Helvetica-Bold');
                doc.text('REGISTRO FOTOGRAFICO');
                doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
                doc.moveDown(0.5);
                const imageWidth = 240;
                const imageHeight = 180;
                let x = 50;
                let y = doc.y;
                for (let index = 0; index < evidenciasBuffers.length; index += 1) {
                    if (index > 0 && index % 2 === 0) {
                        y += imageHeight + 20;
                        x = 50;
                    }
                    try {
                        doc.image(evidenciasBuffers[index], x, y, {
                            width: imageWidth,
                            height: imageHeight,
                            fit: [imageWidth, imageHeight],
                        });
                    }
                    catch (_a) {
                        doc.rect(x, y, imageWidth, imageHeight).stroke();
                        doc.text('Imagen no disponible', x + 10, y + imageHeight / 2);
                    }
                    x += imageWidth + 20;
                }
                doc.y = y + imageHeight + 20;
            }
            doc.addPage();
            doc.fontSize(11).font('Helvetica-Bold');
            doc.text('DECLARACION Y CONSTANCIA');
            doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica');
            doc.text('El profesional de logistica certifica que realizó la entrega inicial del activo descrito y que la información registrada corresponde al estado en que fue entregado.', { align: 'justify' });
            doc.moveDown(0.5);
            doc.text('El custodio certifica que recibe el activo descrito, acepta la responsabilidad sobre su uso y conservación, y declara que la información registrada es veraz.', { align: 'justify' });
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
            doc.text(asignacion.revisorNombre, 80, firmaY + firmaHeight + 10, { width: firmaWidth, align: 'center' });
            doc.text(`C.C. ${asignacion.revisorCedula}`, 80, doc.y, { width: firmaWidth, align: 'center' });
            doc.text('Profesional Especializado en Logistica', 80, doc.y, { width: firmaWidth, align: 'center' });
            doc.fontSize(8).text(`Firmado: ${asDate(asignacion.firmaRevisor.fechaFirma).toLocaleString('es-CO')}`, 80, doc.y, {
                width: firmaWidth,
                align: 'center',
            });
            doc.image(firmaCustodioBuffer, 320, firmaY, {
                width: firmaWidth,
                height: firmaHeight,
                fit: [firmaWidth, firmaHeight],
            });
            doc.moveTo(320, firmaY + firmaHeight + 5).lineTo(520, firmaY + firmaHeight + 5).stroke();
            doc.fontSize(9);
            doc.text(asignacion.custodioNombre, 320, firmaY + firmaHeight + 10, { width: firmaWidth, align: 'center' });
            doc.text(`C.C. ${asignacion.custodioCedula}`, 320, doc.y, { width: firmaWidth, align: 'center' });
            doc.text('Custodio del Activo', 320, doc.y, { width: firmaWidth, align: 'center' });
            doc.fontSize(8).text(`Firmado: ${asDate(asignacion.firmaCustodio.fechaFirma).toLocaleString('es-CO')}`, 320, doc.y, {
                width: firmaWidth,
                align: 'center',
            });
            doc.fontSize(8).font('Helvetica');
            const bottomY = doc.page.height - 60;
            doc.moveTo(50, bottomY).lineTo(562, bottomY).stroke();
            doc.text('Documento generado automaticamente por el Sistema de Activos Fijos - SERVICIUDAD ESP', 50, bottomY + 5, {
                align: 'center',
                width: 512,
            });
            doc.text(`Hash de verificacion: ${asignacion.firmaRevisor.hashDocumento.substring(0, 32)}...`, 50, doc.y, {
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
//# sourceMappingURL=generarActaAsignacionPDF.js.map