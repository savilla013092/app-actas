import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { ExpressLoan } from '@/types/expressLoan';

const formatLoanDate = (value?: string) => {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return format(date, 'dd MMM yyyy HH:mm', { locale: es });
};

const getItemTypeLabel = (loan: ExpressLoan) =>
  loan.item_type === 'activo_registrado' ? 'Activo registrado' : 'Ítem comodín';

export const generateExpressLoanPDF = async (loan: ExpressLoan) => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF('p', 'pt', 'letter');
  const getLastAutoTableY = () =>
    ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 0);

  let yPos = 50;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(26, 82, 118);
  doc.text('Soporte de préstamo express', 40, yPos);

  yPos += 40;

  doc.setFontSize(12);
  doc.setTextColor(44, 62, 80);
  doc.text('Detalles del préstamo', 40, yPos);

  yPos += 15;

  autoTable(doc, {
    startY: yPos,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      textColor: [51, 65, 85],
      cellPadding: 3,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 150 },
      1: { cellWidth: 350 },
    },
    body: [
      ['Fecha de préstamo:', formatLoanDate(loan.loan_date)],
      ['Tipo de ítem:', getItemTypeLabel(loan)],
      ['Elemento:', loan.element_description],
      ['Código activo:', loan.asset_code || 'No aplica'],
      ['Evidencias registradas:', `${loan.evidences.length}`],
      ['Notas/Observaciones:', loan.notes || 'Ninguna'],
      ['Estado:', loan.status.charAt(0).toUpperCase() + loan.status.slice(1)],
      ['Fecha de devolución:', loan.return_date ? formatLoanDate(loan.return_date) : 'Pendiente'],
    ],
  });

  yPos = getLastAutoTableY() + 30;

  doc.setFontSize(12);
  doc.setTextColor(44, 62, 80);
  doc.text('Información de las partes', 40, yPos);

  yPos += 15;

  autoTable(doc, {
    startY: yPos,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      textColor: [51, 65, 85],
      cellPadding: 3,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 180 },
      1: { cellWidth: 320 },
    },
    body: [
      ['Entregado por:', loan.lender_name || 'Desconocido'],
      ['Recibido por (Nombre):', loan.borrower_name],
      ['Recibido por (Documento):', loan.borrower_document || 'N/A'],
    ],
  });

  yPos = getLastAutoTableY() + 50;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    'Con la presente firma se confirma la entrega y recepción del elemento descrito anteriormente de forma conforme.',
    40,
    yPos,
    { maxWidth: 530 }
  );

  yPos += 80;

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('_____________________________', 80, yPos);
  doc.text('_____________________________', 340, yPos);

  yPos += 15;

  doc.setFont('helvetica', 'bold');
  doc.text('Firma quien entrega', 110, yPos);
  doc.text('Firma quien recibe', 380, yPos);

  yPos += 15;
  doc.setFont('helvetica', 'normal');
  doc.text(loan.lender_name || 'Desconocido', 110, yPos);
  doc.text(loan.borrower_name || 'N/A', 380, yPos);

  doc.save(`prestamo_express_${loan.id || Date.now()}.pdf`);
};
