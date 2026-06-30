import { ActaFormal, ActaFormalDraft, FirmanteActaFormal } from '@/types/actaFormal';

const HEADER_PATH = '/actas-formales/header-serviciudad.png';
const FOOTER_PATH = '/actas-formales/footer-serviciudad.png';

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
