import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ExpressLoan } from "@/types/expressLoan";

export const generateExpressLoanPDF = (loan: ExpressLoan) => {
  const doc = new jsPDF("p", "pt", "letter");

  let yPos = 50;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(26, 82, 118); // #1a5276
  doc.text("Soporte de Préstamo Express", 40, yPos);
  
  yPos += 40;

  // Heading details
  doc.setFontSize(12);
  doc.setTextColor(44, 62, 80); // #2c3e50
  doc.text("Detalles del Préstamo", 40, yPos);
  
  yPos += 15;

  const dateObj = new Date(loan.loan_date);
  const formattedDate = !isNaN(dateObj.getTime()) ? format(dateObj, "dd MMM yyyy HH:mm", { locale: es }) : loan.loan_date;

  // Detalles table
  autoTable(doc, {
    startY: yPos,
    theme: "plain",
    styles: { font: "helvetica", fontSize: 10, textColor: [51, 65, 85], cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 150 },
      1: { cellWidth: 350 }
    },
    body: [
      ["Fecha de Préstamo:", formattedDate],
      ["Elemento:", loan.element_description],
      ["Notas/Observaciones:", loan.notes || "Ninguna"],
      ["Estado:", loan.status.charAt(0).toUpperCase() + loan.status.slice(1)]
    ],
  });

  yPos = (doc as any).lastAutoTable.finalY + 30;

  // Partes involved
  doc.setFontSize(12);
  doc.setTextColor(44, 62, 80);
  doc.text("Información de las Partes", 40, yPos);
  
  yPos += 15;

  autoTable(doc, {
    startY: yPos,
    theme: "plain",
    styles: { font: "helvetica", fontSize: 10, textColor: [51, 65, 85], cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 180 },
      1: { cellWidth: 320 }
    },
    body: [
      ["Entregado por:", loan.lender_name || "Desconocido"],
      ["Recibido por (Nombre):", loan.borrower_name],
      ["Recibido por (Documento):", loan.borrower_document || "N/A"]
    ],
  });

  yPos = (doc as any).lastAutoTable.finalY + 50;
  
  // Footer text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    "Con la presente firma se confirma la entrega y recepción del elemento descrito anteriormente de forma conforme.",
    40,
    yPos,
    { maxWidth: 530 }
  );

  yPos += 80;

  // Signatures
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  // Line 1
  doc.text("_____________________________", 80, yPos);
  doc.text("_____________________________", 340, yPos);
  
  yPos += 15;
  
  doc.setFont("helvetica", "bold");
  doc.text("Firma quien entrega", 110, yPos);
  doc.text("Firma quien recibe", 380, yPos);
  
  yPos += 15;
  doc.setFont("helvetica", "normal");
  doc.text(loan.lender_name || "Desconocido", 110, yPos);
  doc.text(loan.borrower_name || "N/A", 380, yPos);

  // Save the PDF
  doc.save(`prestamo_express_${loan.id || Date.now()}.pdf`);
};
