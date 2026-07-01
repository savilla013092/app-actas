import { ActaEntregaDotacionData, ActaFormal, ActaFormalDraft, FirmanteActaFormal } from '@/types/actaFormal';

const HEADER_PATH = '/actas-formales/header-serviciudad.png';
const FOOTER_PATH = '/actas-formales/footer-serviciudad.png';
const ENTREGA_TEMPLATE_PATH = '/actas-formales/formato-acta-entrega.docx';
const ENTREGA_FIXED_SIGNATURE_PATH = '/actas-formales/firma-santiago-villa.png';

const CONTENT_WIDTH = 8838;
const THIN_BORDER = { style: 'single', size: 1, color: 'B7C4D4' };

const safeFileName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const monthNames = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const parseLocalDate = (value: string) => {
  const [year, month, day] = value.split('-').map((item) => Number(item));
  if (year && month && day) {
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const formatEntregaDate = (value: string) => {
  const date = parseLocalDate(value);
  return `${date.getDate()} de ${monthNames[date.getMonth()]} de ${date.getFullYear()}`;
};

const formatEntregaMonthYear = (value: string) => {
  const date = parseLocalDate(value);
  return `${monthNames[date.getMonth()]} de ${date.getFullYear()}`;
};

const formatEntregaSemester = (value: string) => {
  const date = parseLocalDate(value);
  return `${date.getFullYear()}-${date.getMonth() < 6 ? '1' : '2'}`;
};

const readBlobAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const fetchDataUrl = async (path: string) => {
  const response = await fetch(path);
  const blob = await response.blob();
  return readBlobAsDataUrl(blob);
};

const fetchBytes = async (path: string) => {
  const response = await fetch(path);
  return new Uint8Array(await response.arrayBuffer());
};

const dataUrlToBytes = (dataUrl: string) => {
  const [, meta = '', raw = ''] = dataUrl.match(/^data:([^;]+);base64,(.+)$/) || [];
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return {
    bytes,
    type: meta.includes('jpeg') || meta.includes('jpg') ? 'jpg' : 'png',
  } as const;
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const textOrPending = (value: string | undefined) => value?.trim() || 'Pendiente';

const formatDateTime = (date?: Date) =>
  date
    ? date.toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

const buildFirmantes = (draft: ActaFormalDraft, firmantes: FirmanteActaFormal[]) =>
  draft.asistentes.map((asistente) => {
    const firmante = firmantes.find((item) => item.asistenteId === asistente.id);
    return {
      asistente,
      firmante,
    };
  });

export async function generarActaFormalDocx({
  acta,
  firmantes,
}: {
  acta: ActaFormal | ActaFormalDraft;
  firmantes: FirmanteActaFormal[];
}) {
  const docx = await import('docx');
  const {
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
  } = docx;

  const headerBytes = await fetchBytes(HEADER_PATH);
  const footerBytes = await fetchBytes(FOOTER_PATH);
  const border = { ...THIN_BORDER, style: BorderStyle.SINGLE };
  const borders = { top: border, bottom: border, left: border, right: border };

  const paragraph = (text: string, options: Record<string, unknown> = {}) =>
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text, size: 20 })],
      ...options,
    });

  const sectionTitle = (text: string) =>
    new Paragraph({
      spacing: { before: 220, after: 120 },
      children: [new TextRun({ text, bold: true, size: 22, color: '004A7C' })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '0099CC', space: 1 } },
    });

  const tableCell = (
    text: string,
    width: number,
    options: { bold?: boolean; fill?: string; align?: typeof AlignmentType[keyof typeof AlignmentType] } = {}
  ) =>
    new TableCell({
      borders,
      width: { size: width, type: WidthType.DXA },
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      shading: options.fill ? { fill: options.fill, type: ShadingType.CLEAR } : undefined,
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: options.align,
          children: [new TextRun({ text, bold: options.bold, size: 19 })],
        }),
      ],
    });

  const infoRows = [
    ['Fecha', textOrPending(acta.fecha), 'Hora', textOrPending(acta.hora)],
    ['Lugar', textOrPending(acta.lugar), 'Tipo', textOrPending(acta.tipoReunion)],
  ];

  const infoTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [1700, 2719, 1700, 2719],
    rows: infoRows.map(
      ([labelA, valueA, labelB, valueB]) =>
        new TableRow({
          children: [
            tableCell(labelA, 1700, { bold: true, fill: 'EAF5FA' }),
            tableCell(valueA, 2719),
            tableCell(labelB, 1700, { bold: true, fill: 'EAF5FA' }),
            tableCell(valueB, 2719),
          ],
        })
    ),
  });

  const asistentesRows = [
    new TableRow({
      children: [
        tableCell('Nombre', 4500, { bold: true, fill: 'EAF5FA' }),
        tableCell('Cargo', 4338, { bold: true, fill: 'EAF5FA' }),
      ],
    }),
    ...acta.asistentes.map(
      (asistente) =>
        new TableRow({
          children: [tableCell(asistente.nombre, 4500), tableCell(asistente.cargo, 4338)],
        })
    ),
  ];

  const compromisosRows = [
    new TableRow({
      children: [
        tableCell('Compromiso', 4600, { bold: true, fill: 'EAF5FA' }),
        tableCell('Responsable', 2200, { bold: true, fill: 'EAF5FA' }),
        tableCell('Fecha limite', 2038, { bold: true, fill: 'EAF5FA' }),
      ],
    }),
    ...acta.compromisos.map(
      (compromiso) =>
        new TableRow({
          children: [
            tableCell(compromiso.descripcion, 4600),
            tableCell(compromiso.responsable, 2200),
            tableCell(compromiso.fechaLimite, 2038),
          ],
        })
    ),
  ];

  const signatureRows = await Promise.all(
    buildFirmantes(acta, firmantes).map(async ({ asistente, firmante }) => {
      const children = [];

      if (firmante?.firmaDataUrl) {
        const signature = dataUrlToBytes(firmante.firmaDataUrl);
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                type: signature.type,
                data: signature.bytes,
                transformation: { width: 155, height: 58 },
                altText: {
                  title: `Firma de ${asistente.nombre}`,
                  description: `Firma digital de ${asistente.nombre}`,
                  name: `firma-${asistente.id}`,
                },
              }),
            ],
          })
        );
      } else {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 240 },
            children: [new TextRun({ text: '____________________________', size: 18 })],
          })
        );
      }

      if (firmante?.metodoFirma === 'clave') {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Firma con clave: ${firmante.claveFirma || asistente.nombre}`, size: 16 })],
          })
        );
      }

      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: asistente.nombre, bold: true, size: 18 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: asistente.cargo, size: 17 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: firmante?.fechaFirma ? `Firmado: ${formatDateTime(firmante.fechaFirma)}` : 'Firma pendiente',
              size: 15,
              color: firmante?.estado === 'firmada' ? '047857' : 'B45309',
            }),
          ],
        })
      );

      return new TableRow({
        children: [
          new TableCell({
            borders,
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            margins: { top: 160, bottom: 160, left: 120, right: 120 },
            children,
          }),
        ],
      });
    })
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 20 },
        },
      },
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
                      description: 'Membrete institucional de SERVICIUDAD ESP',
                      name: 'header-serviciudad',
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
                      title: 'Pie de pagina SERVICIUDAD ESP',
                      description: 'Pie institucional de SERVICIUDAD ESP',
                      name: 'footer-serviciudad',
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
            children: [new TextRun({ text: textOrPending(acta.tipoReunion).toUpperCase(), bold: true, size: 22 })],
          }),
          sectionTitle('1. INFORMACION GENERAL'),
          infoTable,
          sectionTitle('2. ASISTENTES'),
          new Table({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            columnWidths: [4500, 4338],
            rows: asistentesRows,
          }),
          sectionTitle('3. OBJETIVO'),
          paragraph(textOrPending(acta.objetivo), { alignment: AlignmentType.JUSTIFIED }),
          sectionTitle('4. ORDEN DEL DIA'),
          ...acta.ordenDia.map((item, index) => paragraph(`${index + 1}. ${item}`)),
          sectionTitle('5. DESARROLLO DE LA REUNION'),
          ...acta.desarrollo.map((item) => paragraph(item, { alignment: AlignmentType.JUSTIFIED })),
          sectionTitle('6. CONCLUSIONES'),
          ...acta.conclusiones.map((item, index) => paragraph(`${index + 1}. ${item}`)),
          sectionTitle('7. COMPROMISOS'),
          new Table({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            columnWidths: [4600, 2200, 2038],
            rows: compromisosRows,
          }),
          sectionTitle('8. FIRMAS'),
          new Table({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            columnWidths: [CONTENT_WIDTH],
            rows: signatureRows,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${safeFileName('acta-formal-' + (acta.tipoReunion || 'reunion') + '-' + (acta.fecha || 'borrador'))}.docx`;
  downloadBlob(blob, fileName);
  return blob;
}

export async function generarActaFormalPdf({
  acta,
  firmantes,
}: {
  acta: ActaFormal | ActaFormalDraft;
  firmantes: FirmanteActaFormal[];
}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const headerDataUrl = await fetchDataUrl(HEADER_PATH);
  const footerDataUrl = await fetchDataUrl(FOOTER_PATH);
  const doc = new jsPDF('p', 'pt', 'letter');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 126;
  const setYAfterTable = () => {
    const finalY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y) + 18;
    y = Math.max(finalY, 148);
  };

  const ensureSpace = (height: number) => {
    if (y + height < pageHeight - 90) return;
    doc.addPage();
    y = 126;
  };

  const sectionTitle = (title: string) => {
    ensureSpace(28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 74, 124);
    doc.text(title, 48, y);
    doc.setDrawColor(0, 153, 204);
    doc.line(48, y + 6, pageWidth - 48, y + 6);
    y += 24;
  };

  const textBlock = (text: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    const lines = doc.splitTextToSize(textOrPending(text), pageWidth - 96);
    ensureSpace(lines.length * 13 + 10);
    doc.text(lines, 48, y);
    y += lines.length * 13 + 10;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(17, 24, 39);
  doc.text('ACTA FORMAL', pageWidth / 2, y, { align: 'center' });
  y += 18;
  doc.setFontSize(11);
  doc.text(textOrPending(acta.tipoReunion).toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 28;

  sectionTitle('1. INFORMACION GENERAL');
  autoTable(doc, {
    startY: y,
    margin: { left: 48, right: 48 },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, lineColor: [183, 196, 212], lineWidth: 0.5 },
    theme: 'grid',
    body: [
      ['Fecha', textOrPending(acta.fecha), 'Hora', textOrPending(acta.hora)],
      ['Lugar', textOrPending(acta.lugar), 'Tipo', textOrPending(acta.tipoReunion)],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [234, 245, 250], cellWidth: 90 },
      2: { fontStyle: 'bold', fillColor: [234, 245, 250], cellWidth: 90 },
    },
  });
  setYAfterTable();

  sectionTitle('2. ASISTENTES');
  autoTable(doc, {
    startY: y,
    margin: { left: 48, right: 48 },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, lineColor: [183, 196, 212], lineWidth: 0.5 },
    head: [['Nombre', 'Cargo']],
    headStyles: { fillColor: [234, 245, 250], textColor: [17, 24, 39] },
    body: acta.asistentes.map((asistente) => [asistente.nombre, asistente.cargo]),
  });
  setYAfterTable();

  sectionTitle('3. OBJETIVO');
  textBlock(acta.objetivo);
  sectionTitle('4. ORDEN DEL DIA');
  acta.ordenDia.forEach((item, index) => textBlock(`${index + 1}. ${item}`));
  sectionTitle('5. DESARROLLO DE LA REUNION');
  acta.desarrollo.forEach(textBlock);
  sectionTitle('6. CONCLUSIONES');
  acta.conclusiones.forEach((item, index) => textBlock(`${index + 1}. ${item}`));

  sectionTitle('7. COMPROMISOS');
  autoTable(doc, {
    startY: y,
    margin: { left: 48, right: 48 },
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, lineColor: [183, 196, 212], lineWidth: 0.5 },
    head: [['Compromiso', 'Responsable', 'Fecha limite']],
    headStyles: { fillColor: [234, 245, 250], textColor: [17, 24, 39] },
    body: acta.compromisos.map((compromiso) => [
      compromiso.descripcion,
      compromiso.responsable,
      compromiso.fechaLimite,
    ]),
  });
  setYAfterTable();

  sectionTitle('8. FIRMAS');
  buildFirmantes(acta, firmantes).forEach(({ asistente, firmante }) => {
    ensureSpace(116);
    doc.setDrawColor(183, 196, 212);
    doc.roundedRect(48, y, pageWidth - 96, 102, 3, 3);

    if (firmante?.firmaDataUrl) {
      doc.addImage(firmante.firmaDataUrl, 'PNG', 70, y + 10, 145, 50, undefined, 'FAST');
    } else {
      doc.setTextColor(107, 114, 128);
      doc.text('____________________________', 70, y + 44);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    doc.text(asistente.nombre, 250, y + 30);
    doc.setFont('helvetica', 'normal');
    doc.text(asistente.cargo, 250, y + 45);
    doc.setFontSize(8);
    doc.setTextColor(firmante?.estado === 'firmada' ? 4 : 180, firmante?.estado === 'firmada' ? 120 : 83, 9);
    doc.text(
      firmante?.fechaFirma ? `Firmado: ${formatDateTime(firmante.fechaFirma)}` : 'Firma pendiente',
      250,
      y + 62
    );
    if (firmante?.metodoFirma === 'clave') {
      doc.text(`Metodo: firma con clave (${firmante.claveFirma || asistente.nombre})`, 250, y + 78);
    }

    y += 116;
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.addImage(headerDataUrl, 'PNG', 38, 22, 536, 94, undefined, 'FAST');
    doc.addImage(footerDataUrl, 'PNG', 52, pageHeight - 58, 508, 62, undefined, 'FAST');
  }

  const fileName = `${safeFileName('acta-formal-' + (acta.tipoReunion || 'reunion') + '-' + (acta.fecha || 'borrador'))}.pdf`;
  doc.save(fileName);
}

function buildEntregaReceiverSignatureRun(firmante?: FirmanteActaFormal) {
  if (!firmante || firmante.estado !== 'firmada') {
    return '';
  }

  if (firmante.firmaDataUrl) {
    return `
      <w:r><w:tab/></w:r>
      <w:r>
        <w:rPr><w:noProof/></w:rPr>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="1184522" cy="511175"/>
            <wp:effectExtent l="0" t="0" r="0" b="0"/>
            <wp:docPr id="9131001" name="Firma recibe"/>
            <wp:cNvGraphicFramePr>
              <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
            </wp:cNvGraphicFramePr>
            <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:nvPicPr>
                    <pic:cNvPr id="9131001" name="Firma recibe"/>
                    <pic:cNvPicPr/>
                  </pic:nvPicPr>
                  <pic:blipFill>
                    <a:blip r:embed="rIdFirmaRecibe"/>
                    <a:stretch><a:fillRect/></a:stretch>
                  </pic:blipFill>
                  <pic:spPr>
                    <a:xfrm><a:off x="0" y="0"/><a:ext cx="1184522" cy="511175"/></a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>`;
  }

  if (firmante.metodoFirma === 'clave') {
    return `<w:r><w:tab/></w:r><w:r><w:rPr><w:i/><w:sz w:val="20"/></w:rPr><w:t>${xmlEscape(
      firmante.claveFirma || 'Firma con clave'
    )}</w:t></w:r>`;
  }

  return '';
}

/**
 * Quita la segunda columna ("IMAGEN") de la tabla de dotacion de la plantilla,
 * incluyendo la imagen que contiene, para que quede una tabla limpia
 * (No | CANTIDAD | DESCRIPCION). Opera en tiempo de ejecucion sobre el XML.
 */
function removeEntregaImageColumn(documentXml: string): string {
  const tablaMatch = documentXml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/);
  if (!tablaMatch) return documentXml;

  let tabla = tablaMatch[0];

  const gridMatch = tabla.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/);
  if (gridMatch) {
    const cols = gridMatch[0].match(/<w:gridCol[^>]*\/?>/g) || [];
    if (cols.length >= 2) {
      tabla = tabla.replace(gridMatch[0], gridMatch[0].replace(cols[1], ''));
    }
  }

  tabla = tabla.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, (fila) => {
    const celdas = fila.match(/<w:tc>[\s\S]*?<\/w:tc>/g);
    if (!celdas || celdas.length < 2) return fila;
    return fila.replace(celdas[1], '');
  });

  return documentXml.replace(tablaMatch[0], tabla);
}

export async function generarActaEntregaDotacionDocx({
  data,
  firmantes,
}: {
  data: ActaEntregaDotacionData;
  firmantes: FirmanteActaFormal[];
}) {
  const { default: JSZip } = await import('jszip');
  const response = await fetch(ENTREGA_TEMPLATE_PATH);
  const templateBuffer = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(templateBuffer);
  const documentFile = zip.file('word/document.xml');
  const relsFile = zip.file('word/_rels/document.xml.rels');
  const contentTypesFile = zip.file('[Content_Types].xml');

  if (!documentFile || !relsFile || !contentTypesFile) {
    throw new Error('La plantilla de acta de entrega no tiene la estructura esperada.');
  }

  const receptorNombre = data.receptorNombre.toUpperCase();
  const receptorDocumento = data.receptorDocumento.trim();
  const fechaCompleta = formatEntregaDate(data.fecha);
  const mesAnio = formatEntregaMonthYear(data.fecha);
  const semestre = formatEntregaSemester(data.fecha);

  let documentXml = await documentFile.async('string');
  documentXml = documentXml
    .replace(/Dosquebradas, mayo de 2026/g, `Dosquebradas, ${xmlEscape(fechaCompleta)}`)
    .replace(/PANTALON TALLA 36/g, `PANTALON TALLA ${xmlEscape(data.tallaPantalon.toUpperCase())}`)
    .replace(/CAMISA TALLA L/g, `CAMISA TALLA ${xmlEscape(data.tallaCamisa.toUpperCase())}`)
    .replace(/CALZADO TALLA 40 2026-1/g, `CALZADO TALLA ${xmlEscape(data.tallaBota.toUpperCase())} ${semestre}`)
    .replace(/LUIS MIGUEL ACEVEDO GALLO/g, xmlEscape(receptorNombre))
    .replace(/1088022678/g, xmlEscape(receptorDocumento))
    .replace(/a partir de mayo de 2026/g, `a partir de ${xmlEscape(mesAnio)}`);

  const firmante = firmantes.find((item) => item.estado === 'firmada');
  const receiverSignatureRun = buildEntregaReceiverSignatureRun(firmante);
  if (receiverSignatureRun) {
    documentXml = documentXml.replace(
      /<w:pPr><w:spacing w:before="250" w:after="250"\/><\/w:pPr>/,
      '<w:pPr><w:tabs><w:tab w:val="left" w:pos="5500"/></w:tabs><w:spacing w:before="250" w:after="250"/></w:pPr>'
    );
    documentXml = documentXml.replace(
      /(<w:p w14:paraId="592E4073"[\s\S]*?<\/w:drawing><\/w:r>)(<\/w:p>)/,
      `$1${receiverSignatureRun}$2`
    );

    if (firmante?.firmaDataUrl) {
      const signature = dataUrlToBytes(firmante.firmaDataUrl);
      zip.file(`word/media/firma-recibe.${signature.type}`, signature.bytes);

      let relsXml = await relsFile.async('string');
      if (!relsXml.includes('rIdFirmaRecibe')) {
        relsXml = relsXml.replace(
          '</Relationships>',
          `<Relationship Id="rIdFirmaRecibe" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/firma-recibe.${signature.type}"/></Relationships>`
        );
        zip.file('word/_rels/document.xml.rels', relsXml);
      }

      let contentTypesXml = await contentTypesFile.async('string');
      if (signature.type === 'jpg' && !contentTypesXml.includes('Extension="jpg"')) {
        contentTypesXml = contentTypesXml.replace(
          '</Types>',
          '<Default Extension="jpg" ContentType="image/jpeg"/></Types>'
        );
      }
      if (signature.type === 'png' && !contentTypesXml.includes('Extension="png"')) {
        contentTypesXml = contentTypesXml.replace(
          '</Types>',
          '<Default Extension="png" ContentType="image/png"/></Types>'
        );
      }
      zip.file('[Content_Types].xml', contentTypesXml);
    }
  }

  documentXml = removeEntregaImageColumn(documentXml);

  zip.file('word/document.xml', documentXml);
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  downloadBlob(blob, `${safeFileName(`acta-entrega-${receptorNombre}-${data.fecha}`)}.docx`);
  return blob;
}

export async function generarActaEntregaDotacionPdf({
  data,
  firmantes,
}: {
  data: ActaEntregaDotacionData;
  firmantes: FirmanteActaFormal[];
}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const [headerDataUrl, footerDataUrl, fixedSignatureDataUrl] = await Promise.all([
    fetchDataUrl(HEADER_PATH),
    fetchDataUrl(FOOTER_PATH),
    fetchDataUrl(ENTREGA_FIXED_SIGNATURE_PATH),
  ]);
  const doc = new jsPDF('p', 'pt', 'letter');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const receptorNombre = data.receptorNombre.toUpperCase();
  const receptorDocumento = data.receptorDocumento.trim();
  const firmante = firmantes.find((item) => item.estado === 'firmada');
  let y = 130;

  doc.addImage(headerDataUrl, 'PNG', 38, 22, 536, 94, undefined, 'FAST');
  doc.addImage(footerDataUrl, 'PNG', 52, pageHeight - 58, 508, 62, undefined, 'FAST');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('ACTA DE ENTREGA', pageWidth / 2, y, { align: 'center' });
  y += 28;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(`Dosquebradas, ${formatEntregaDate(data.fecha)}`, 58, y);
  y += 22;

  autoTable(doc, {
    startY: y,
    margin: { left: 58, right: 58 },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10, lineColor: [0, 0, 0], lineWidth: 0.4, cellPadding: 6 },
    head: [['No', 'CANTIDAD', 'DESCRIPCION']],
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    body: [
      ['1', '1', `PANTALON TALLA ${data.tallaPantalon.toUpperCase()}`],
      ['2', '1', `CAMISA TALLA ${data.tallaCamisa.toUpperCase()}`],
      ['3', '1', `CALZADO TALLA ${data.tallaBota.toUpperCase()} ${formatEntregaSemester(data.fecha)}`],
    ],
    columnStyles: {
      0: { halign: 'center', cellWidth: 40 },
      1: { halign: 'center', cellWidth: 90 },
      2: { cellWidth: 366 },
    },
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y) + 22;

  doc.setFont('helvetica', 'bold');
  doc.text('DESTINO:', 58, y);
  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const body = [
    `Se hace entrega Al funcionario ${receptorNombre} identificado con C.C ${receptorDocumento} del elemento que se relaciona en el cuadro anterior y en las mismas condiciones debera ser devuelto al Almacen de SERVICIUDAD, salvo el deterioro normal por su uso.`,
    'Si se presenta desperfecto por manejo inapropiado dentro del uso normal, perdida, hurto o dano sera responsabilidad de quien lo recibe.',
    `Nota: La bota tiene una garantia de cuatro (3) meses a partir de ${formatEntregaMonthYear(data.fecha)}; despues de este periodo no se aceptan reclamos ni devoluciones`,
    'Recibida la dotacion se tiene 15 dias calendario para realizar cualquier reclamo',
    'En caso de cambio de destino o funcionario de estos elementos, debera ser notificado por escrito al area de talento humano por la persona a cargo del mismo.',
  ];
  body.forEach((paragraphText) => {
    const lines = doc.splitTextToSize(paragraphText, pageWidth - 116);
    doc.text(lines, 58, y);
    y += lines.length * 13 + 8;
  });

  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Entrega', 96, y);
  doc.text('Recibe', 360, y);
  y += 16;
  doc.addImage(fixedSignatureDataUrl, 'PNG', 82, y, 118, 52, undefined, 'FAST');
  if (firmante?.firmaDataUrl) {
    doc.addImage(firmante.firmaDataUrl, 'PNG', 346, y, 118, 52, undefined, 'FAST');
  } else if (firmante?.metodoFirma === 'clave') {
    doc.setFont('times', 'italic');
    doc.setFontSize(10);
    doc.text(firmante.claveFirma || receptorNombre, 346, y + 28);
  }
  y += 62;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('SANTIAGO VILLA ROMERO', 58, y);
  doc.text(receptorNombre, 322, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.text('Profesional Especializado Logistica', 58, y);
  doc.text(`C.C ${receptorDocumento}`, 322, y);

  doc.save(`${safeFileName(`acta-entrega-${receptorNombre}-${data.fecha}`)}.pdf`);
}
