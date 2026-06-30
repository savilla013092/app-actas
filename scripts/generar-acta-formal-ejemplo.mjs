import fs from 'node:fs';
import path from 'node:path';

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const root = process.cwd();
const outputDir = path.join(root, 'docs', 'ejemplos');
const headerPath = path.join(root, 'public', 'actas-formales', 'header-serviciudad.png');
const footerPath = path.join(root, 'public', 'actas-formales', 'footer-serviciudad.png');

fs.mkdirSync(outputDir, { recursive: true });

const acta = {
  fecha: '2026-06-30',
  hora: '09:00 a.m. - 10:30 a.m.',
  lugar: 'Sala de juntas SERVICIUDAD ESP',
  tipoReunion: 'Comite de seguimiento de activos fijos',
  objetivo:
    'Revisar el avance de la digitalizacion de actas y definir compromisos para el flujo de firma remota.',
  asistentes: [
    { id: 'a1', nombre: 'Sandra Milena Torres', cargo: 'Profesional de Logistica' },
    { id: 'a2', nombre: 'Carlos Andres Mejia', cargo: 'Custodio de Activos' },
    { id: 'a3', nombre: 'Laura Vanessa Rios', cargo: 'Apoyo Administrativo' },
  ],
  ordenDia: [
    'Validacion del formato institucional de acta.',
    'Revision del flujo de captura de firmas desde celular.',
    'Definicion de responsables y fechas de entrega.',
  ],
  desarrollo: [
    'Se reviso el membrete institucional disponible en el repositorio y se acordo usarlo como base visual para las actas formales.',
    'Se valido que cada asistente debe recibir un enlace individual de firma para registrar su aprobacion desde el navegador del celular.',
    'Se definio que el acta solo puede cerrarse cuando todos los asistentes registrados hayan firmado.',
  ],
  conclusiones: [
    'El nuevo modulo debe conservar trazabilidad por autor, fecha y estado de firmas.',
    'El documento final debe generarse en Word y PDF con las firmas incrustadas.',
  ],
  compromisos: [
    {
      descripcion: 'Publicar el agente de actas en ambiente accesible desde celular.',
      responsable: 'Profesional de Logistica',
      fechaLimite: '2026-07-05',
    },
    {
      descripcion: 'Validar una prueba de firma con tres asistentes.',
      responsable: 'Apoyo Administrativo',
      fechaLimite: '2026-07-08',
    },
  ],
};

const firmantes = acta.asistentes.map((asistente, index) => ({
  ...asistente,
  fechaFirma: new Date(Date.UTC(2026, 5, 30, 15, 20 + index * 4)),
  firmaSimulada: `Firma simulada - ${asistente.nombre}`,
}));

const contentWidth = 8838;
const border = { style: BorderStyle.SINGLE, size: 1, color: 'B7C4D4' };
const borders = { top: border, bottom: border, left: border, right: border };

const paragraph = (text, options = {}) =>
  new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 20 })],
    ...options,
  });

const sectionTitle = (text) =>
  new Paragraph({
    spacing: { before: 220, after: 120 },
    children: [new TextRun({ text, bold: true, size: 22, color: '004A7C' })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '0099CC', space: 1 } },
  });

const cell = (text, width, options = {}) =>
  new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    shading: options.fill ? { fill: options.fill, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: options.bold, size: 19 })],
      }),
    ],
  });

const headerBytes = fs.readFileSync(headerPath);
const footerBytes = fs.readFileSync(footerPath);

const docx = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 20 } } },
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1417, right: 1701, bottom: 1417, left: 1701, header: 708, footer: 708 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  type: 'png',
                  data: headerBytes,
                  transformation: { width: 510, height: 89 },
                  altText: {
                    title: 'Encabezado SERVICIUDAD ESP',
                    description: 'Membrete institucional',
                    name: 'header',
                  },
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  type: 'png',
                  data: footerBytes,
                  transformation: { width: 510, height: 62 },
                  altText: {
                    title: 'Pie SERVICIUDAD ESP',
                    description: 'Pie institucional',
                    name: 'footer',
                  },
                }),
              ],
            }),
          ],
        }),
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 220, after: 180 },
          children: [new TextRun({ text: 'ACTA FORMAL', bold: true, size: 28 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          children: [new TextRun({ text: acta.tipoReunion.toUpperCase(), bold: true, size: 22 })],
        }),
        sectionTitle('1. INFORMACION GENERAL'),
        new Table({
          width: { size: contentWidth, type: WidthType.DXA },
          columnWidths: [1700, 2719, 1700, 2719],
          rows: [
            new TableRow({
              children: [
                cell('Fecha', 1700, { bold: true, fill: 'EAF5FA' }),
                cell(acta.fecha, 2719),
                cell('Hora', 1700, { bold: true, fill: 'EAF5FA' }),
                cell(acta.hora, 2719),
              ],
            }),
            new TableRow({
              children: [
                cell('Lugar', 1700, { bold: true, fill: 'EAF5FA' }),
                cell(acta.lugar, 2719),
                cell('Tipo', 1700, { bold: true, fill: 'EAF5FA' }),
                cell(acta.tipoReunion, 2719),
              ],
            }),
          ],
        }),
        sectionTitle('2. ASISTENTES'),
        new Table({
          width: { size: contentWidth, type: WidthType.DXA },
          columnWidths: [4500, 4338],
          rows: [
            new TableRow({
              children: [
                cell('Nombre', 4500, { bold: true, fill: 'EAF5FA' }),
                cell('Cargo', 4338, { bold: true, fill: 'EAF5FA' }),
              ],
            }),
            ...acta.asistentes.map(
              (asistente) =>
                new TableRow({
                  children: [cell(asistente.nombre, 4500), cell(asistente.cargo, 4338)],
                })
            ),
          ],
        }),
        sectionTitle('3. OBJETIVO'),
        paragraph(acta.objetivo, { alignment: AlignmentType.JUSTIFIED }),
        sectionTitle('4. ORDEN DEL DIA'),
        ...acta.ordenDia.map((item, index) => paragraph(`${index + 1}. ${item}`)),
        sectionTitle('5. DESARROLLO DE LA REUNION'),
        ...acta.desarrollo.map((item) => paragraph(item, { alignment: AlignmentType.JUSTIFIED })),
        sectionTitle('6. CONCLUSIONES'),
        ...acta.conclusiones.map((item, index) => paragraph(`${index + 1}. ${item}`)),
        sectionTitle('7. COMPROMISOS'),
        new Table({
          width: { size: contentWidth, type: WidthType.DXA },
          columnWidths: [4600, 2200, 2038],
          rows: [
            new TableRow({
              children: [
                cell('Compromiso', 4600, { bold: true, fill: 'EAF5FA' }),
                cell('Responsable', 2200, { bold: true, fill: 'EAF5FA' }),
                cell('Fecha limite', 2038, { bold: true, fill: 'EAF5FA' }),
              ],
            }),
            ...acta.compromisos.map(
              (compromiso) =>
                new TableRow({
                  children: [
                    cell(compromiso.descripcion, 4600),
                    cell(compromiso.responsable, 2200),
                    cell(compromiso.fechaLimite, 2038),
                  ],
                })
            ),
          ],
        }),
        sectionTitle('8. FIRMAS'),
        new Table({
          width: { size: contentWidth, type: WidthType.DXA },
          columnWidths: [contentWidth],
          rows: firmantes.map(
            (firmante) =>
              new TableRow({
                children: [
                  new TableCell({
                    borders,
                    width: { size: contentWidth, type: WidthType.DXA },
                    margins: { top: 160, bottom: 160, left: 120, right: 120 },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: firmante.firmaSimulada,
                            italics: true,
                            size: 20,
                            color: '0F172A',
                          }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: firmante.nombre, bold: true, size: 18 })],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: firmante.cargo, size: 17 })],
                      }),
                    ],
                  }),
                ],
              })
          ),
        }),
      ],
    },
  ],
});

const docxBuffer = await Packer.toBuffer(docx);
fs.writeFileSync(path.join(outputDir, 'acta-formal-ejemplo-firmas-simuladas.docx'), docxBuffer);

const toDataUrl = (filePath) => {
  const ext = path.extname(filePath).slice(1);
  return `data:image/${ext};base64,${fs.readFileSync(filePath).toString('base64')}`;
};

const pdf = new jsPDF('p', 'pt', 'letter');
const pageWidth = pdf.internal.pageSize.getWidth();
const pageHeight = pdf.internal.pageSize.getHeight();
const headerDataUrl = toDataUrl(headerPath);
const footerDataUrl = toDataUrl(footerPath);
let y = 126;

const setYAfterTable = () => {
  y = Math.max(pdf.lastAutoTable.finalY + 18, 148);
};

const addTitle = (text) => {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(0, 74, 124);
  pdf.text(text, 48, y);
  pdf.setDrawColor(0, 153, 204);
  pdf.line(48, y + 6, pageWidth - 48, y + 6);
  y += 24;
};

const addText = (text) => {
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(31, 41, 55);
  const lines = pdf.splitTextToSize(text, pageWidth - 96);
  pdf.text(lines, 48, y);
  y += lines.length * 13 + 10;
};

pdf.setFont('helvetica', 'bold');
pdf.setFontSize(15);
pdf.text('ACTA FORMAL', pageWidth / 2, y, { align: 'center' });
y += 18;
pdf.setFontSize(11);
pdf.text(acta.tipoReunion.toUpperCase(), pageWidth / 2, y, { align: 'center' });
y += 28;

addTitle('1. INFORMACION GENERAL');
autoTable(pdf, {
  startY: y,
  margin: { left: 48, right: 48 },
  styles: { font: 'helvetica', fontSize: 9, cellPadding: 5 },
  theme: 'grid',
  body: [
    ['Fecha', acta.fecha, 'Hora', acta.hora],
    ['Lugar', acta.lugar, 'Tipo', acta.tipoReunion],
  ],
  columnStyles: {
    0: { fontStyle: 'bold', fillColor: [234, 245, 250], cellWidth: 90 },
    2: { fontStyle: 'bold', fillColor: [234, 245, 250], cellWidth: 90 },
  },
});
setYAfterTable();

addTitle('2. ASISTENTES');
autoTable(pdf, {
  startY: y,
  margin: { left: 48, right: 48 },
  styles: { font: 'helvetica', fontSize: 9, cellPadding: 5 },
  head: [['Nombre', 'Cargo']],
  headStyles: { fillColor: [234, 245, 250], textColor: [17, 24, 39] },
  body: acta.asistentes.map((asistente) => [asistente.nombre, asistente.cargo]),
});
setYAfterTable();

addTitle('3. OBJETIVO');
addText(acta.objetivo);
addTitle('4. ORDEN DEL DIA');
acta.ordenDia.forEach((item, index) => addText(`${index + 1}. ${item}`));
addTitle('5. DESARROLLO DE LA REUNION');
acta.desarrollo.forEach(addText);
addTitle('6. CONCLUSIONES');
acta.conclusiones.forEach((item, index) => addText(`${index + 1}. ${item}`));

addTitle('7. COMPROMISOS');
autoTable(pdf, {
  startY: y,
  margin: { left: 48, right: 48 },
  styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5 },
  head: [['Compromiso', 'Responsable', 'Fecha limite']],
  headStyles: { fillColor: [234, 245, 250], textColor: [17, 24, 39] },
  body: acta.compromisos.map((compromiso) => [
    compromiso.descripcion,
    compromiso.responsable,
    compromiso.fechaLimite,
  ]),
});
setYAfterTable();

addTitle('8. FIRMAS SIMULADAS');
firmantes.forEach((firmante) => {
  if (y > pageHeight - 150) {
    pdf.addPage();
    y = 126;
  }
  pdf.setDrawColor(183, 196, 212);
  pdf.roundedRect(48, y, pageWidth - 96, 92, 3, 3);
  pdf.setFont('times', 'italic');
  pdf.setFontSize(12);
  pdf.setTextColor(15, 23, 42);
  pdf.text(firmante.firmaSimulada, 70, y + 30);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(firmante.nombre, 70, y + 54);
  pdf.setFont('helvetica', 'normal');
  pdf.text(firmante.cargo, 70, y + 69);
  y += 106;
});

const pageCount = pdf.getNumberOfPages();
for (let page = 1; page <= pageCount; page += 1) {
  pdf.setPage(page);
  pdf.addImage(headerDataUrl, 'PNG', 38, 22, 536, 94, undefined, 'FAST');
  pdf.addImage(footerDataUrl, 'PNG', 52, pageHeight - 58, 508, 62, undefined, 'FAST');
}

fs.writeFileSync(
  path.join(outputDir, 'acta-formal-ejemplo-firmas-simuladas.pdf'),
  Buffer.from(pdf.output('arraybuffer'))
);

console.log(`Ejemplo generado en ${outputDir}`);
