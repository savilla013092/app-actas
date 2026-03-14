import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { resolveStoredFilePath } from './security';

interface GenerarPDFParams {
  numeroActa: string;
  revision: FirebaseFirestore.DocumentData;
  storage: admin.storage.Storage;
}

function asDate(value: unknown): Date {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(value as string | number | Date);
}

export async function generarActaPDF({ numeroActa, revision, storage }: GenerarPDFParams): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const bucket = storage.bucket();
      const bucketName = bucket.name;
      const firmaRevisorPath = resolveStoredFilePath(revision.firmaRevisor, bucketName);
      const firmaCustodioPath = resolveStoredFilePath(revision.firmaCustodio, bucketName);
      const [firmaRevisorBuffer] = await bucket.file(firmaRevisorPath).download();
      const [firmaCustodioBuffer] = await bucket.file(firmaCustodioPath).download();

      const evidenciasBuffers: Buffer[] = [];
      for (const evidencia of revision.evidencias.slice(0, 4)) {
        try {
          const evidenciaPath = resolveStoredFilePath(evidencia, bucketName);
          const [buffer] = await bucket.file(evidenciaPath).download();
          evidenciasBuffers.push(buffer);
        } catch (error) {
          console.warn('No fue posible descargar una evidencia del PDF.', error);
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
      } else {
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
      doc.text('ACTA DE REVISION DE ACTIVO FIJO', { align: 'center' });
      doc.fontSize(12);
      doc.text(`No. ${numeroActa}`, { align: 'center' });
      doc.moveDown();

      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('INFORMACION GENERAL');
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown(0.5);

      const fechaRevision = asDate(revision.fecha);
      const fechaFormateada = fechaRevision.toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      doc.fontSize(10).font('Helvetica');
      doc.text(`Fecha de revision: ${fechaFormateada}`);
      doc.text(`Codigo del activo: ${revision.codigoActivo}`);
      doc.text(`Descripcion: ${revision.descripcionActivo}`);
      doc.text(`Ubicacion: ${revision.ubicacionActivo}`);
      doc.moveDown();

      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('DATOS DEL CUSTODIO');
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Nombre: ${revision.custodioNombre}`);
      doc.text(`Cedula: ${revision.custodioCedula}`);
      doc.text(`Cargo: ${revision.custodioCargo}`);
      doc.moveDown();

      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('DATOS DEL REVISOR');
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Nombre: ${revision.revisorNombre}`);
      doc.text(`Cedula: ${revision.revisorCedula}`);
      doc.text(`Cargo: ${revision.revisorCargo}`);
      doc.moveDown();

      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('RESULTADO DE LA REVISION');
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown(0.5);

      const estadosTexto: Record<string, string> = {
        excelente: 'EXCELENTE',
        bueno: 'BUENO',
        regular: 'REGULAR',
        malo: 'MALO',
        para_baja: 'PARA BAJA',
      };

      doc.fontSize(10).font('Helvetica');
      doc.text(`Estado del activo: ${estadosTexto[revision.estadoActivo] || revision.estadoActivo}`);
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('Descripcion de la revision:');
      doc.font('Helvetica').text(revision.descripcion);

      if (revision.observaciones) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text('Observaciones:');
        doc.font('Helvetica').text(revision.observaciones);
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
          } catch {
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
      doc.text(
        'El profesional de logistica certifica que realizo la revision fisica del activo y que la informacion registrada corresponde al estado real del mismo al momento de la inspeccion.',
        { align: 'justify' }
      );
      doc.moveDown(0.5);
      doc.text(
        'El custodio certifica que la informacion registrada es veraz y acepta la responsabilidad sobre el activo a su cargo en el estado descrito.',
        { align: 'justify' }
      );
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
      doc.text('Profesional Especializado en Logistica', 80, doc.y, { width: firmaWidth, align: 'center' });
      doc.fontSize(8).text(`Firmado: ${asDate(revision.firmaRevisor.fechaFirma).toLocaleString('es-CO')}`, 80, doc.y, {
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
      doc.text(revision.custodioNombre, 320, firmaY + firmaHeight + 10, { width: firmaWidth, align: 'center' });
      doc.text(`C.C. ${revision.custodioCedula}`, 320, doc.y, { width: firmaWidth, align: 'center' });
      doc.text('Custodio del Activo', 320, doc.y, { width: firmaWidth, align: 'center' });
      doc.fontSize(8).text(`Firmado: ${asDate(revision.firmaCustodio.fechaFirma).toLocaleString('es-CO')}`, 320, doc.y, {
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
      doc.text(`Hash de verificacion: ${revision.firmaRevisor.hashDocumento.substring(0, 32)}...`, 50, doc.y, {
        align: 'center',
        width: 512,
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
