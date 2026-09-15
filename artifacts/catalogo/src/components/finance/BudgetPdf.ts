import { jsPDF } from 'jspdf';
import type { QuoteCurrency } from './types';

export interface BudgetPdfLine {
  quantity: number;
  productName: string;
  category: string;
  sizeName: string;
  description: string;
  unitPrice: string;
  total: string;
  discount: string;
  image: string | null;
}

export interface BudgetPdfData {
  logo: string | null;
  clientName: string;
  rifCedula: string;
  city: string;
  issueDate: string;
  quoteNumber: string;
  currency: QuoteCurrency;
  exchangeRate: number | null;
  lines: BudgetPdfLine[];
  subtotal: string;
  discount: string;
  iva: string;
  total: string;
  ivaEnabled: boolean;
  ivaPercent: number;
  deliveryTime: string;
  paymentMethod: string;
  advance: string;
  notes: string;
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const colors = {
  navy: [34, 36, 157] as const,
  ink: [31, 41, 55] as const,
  muted: [91, 100, 112] as const,
  pale: [242, 245, 248] as const,
  line: [216, 222, 231] as const,
  green: [226, 240, 228] as const,
  greenInk: [33, 75, 43] as const,
};

function setTextColor(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function setFillColor(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setDrawColor(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function normalizePdfText(value: string): string {
  return value
    .replace(/\uFFFD/gu, '')
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function drawContainedImage(doc: jsPDF, source: string | null, x: number, y: number, width: number, height: number): boolean {
  if (!source) return false;
  try {
    const properties = doc.getImageProperties(source);
    const scale = Math.min(width / properties.width, height / properties.height);
    const renderedWidth = properties.width * scale;
    const renderedHeight = properties.height * scale;
    doc.addImage(
      source,
      properties.fileType,
      x + (width - renderedWidth) / 2,
      y + (height - renderedHeight) / 2,
      renderedWidth,
      renderedHeight,
      undefined,
      'FAST',
    );
    return true;
  } catch {
    return false;
  }
}

function drawHeader(doc: jsPDF, data: BudgetPdfData) {
  setFillColor(doc, colors.navy);
  doc.rect(0, 0, PAGE_WIDTH, 10, 'F');

  drawContainedImage(doc, data.logo, MARGIN, 28, 42, 42);
  setTextColor(doc, colors.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('PUBLICIDAD EXTERIOR MARACAIBO', 91, 43);
  setTextColor(doc, colors.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('RIF: V303101361', 91, 57);

  setTextColor(doc, colors.muted);
  doc.setFontSize(8);
  doc.text('PRESUPUESTO', PAGE_WIDTH - MARGIN, 37, { align: 'right' });
  setTextColor(doc, colors.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Nº ${data.quoteNumber}`, PAGE_WIDTH - MARGIN, 51, { align: 'right' });
  setTextColor(doc, colors.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`FECHA: ${data.issueDate}`, PAGE_WIDTH - MARGIN, 64, { align: 'right' });

  setDrawColor(doc, colors.line);
  doc.line(MARGIN, 80, PAGE_WIDTH - MARGIN, 80);
}

function drawFooter(doc: jsPDF) {
  setDrawColor(doc, colors.line);
  doc.line(MARGIN, PAGE_HEIGHT - 32, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 32);
  setTextColor(doc, colors.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('PUBLICIDAD EXTERIOR MARACAIBO · RIF: V303101361', MARGIN, PAGE_HEIGHT - 20);
  doc.text('(0414) 6453876 · publicidadexteriormaracaibo@gmail.com', PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 20, { align: 'right' });
}

function drawClientDetails(doc: jsPDF, data: BudgetPdfData): number {
  const y = 98;
  setFillColor(doc, colors.pale);
  doc.roundedRect(MARGIN, y, 306, 68, 4, 4, 'F');
  setTextColor(doc, colors.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DATOS DEL CLIENTE', MARGIN + 10, y + 15);
  setTextColor(doc, colors.ink);
  doc.setFontSize(11);
  doc.text(data.clientName || 'Cliente no especificado', MARGIN + 10, y + 31);
  setTextColor(doc, colors.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`RIF / Cédula: ${data.rifCedula || '—'}`, MARGIN + 10, y + 45);
  doc.text(`Ciudad: ${data.city || '—'}`, MARGIN + 10, y + 57);

  const sideX = MARGIN + 330;
  setTextColor(doc, colors.navy);
  doc.setFont('helvetica', 'bold');
  doc.text('MONEDA DEL PRESUPUESTO', sideX, y + 15);
  setTextColor(doc, colors.ink);
  doc.setFontSize(11);
  doc.text(data.currency, sideX, y + 32);
  if (data.currency === 'Bs' && data.exchangeRate) {
    setTextColor(doc, colors.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Tasa de cambio: ${data.exchangeRate.toFixed(2)} Bs/USD`, sideX, y + 47);
  }
  return y + 84;
}

function drawTableHeader(doc: jsPDF, y: number): number {
  setFillColor(doc, colors.navy);
  doc.rect(MARGIN, y, CONTENT_WIDTH, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Cant.', MARGIN + 24, y + 15, { align: 'center' });
  doc.text('Descripción', MARGIN + 56, y + 15);
  doc.text('Precio unitario', MARGIN + 424, y + 15, { align: 'right' });
  doc.text('Precio total', PAGE_WIDTH - MARGIN - 8, y + 15, { align: 'right' });
  return y + 24;
}

function drawQuoteLines(doc: jsPDF, data: BudgetPdfData, startY: number): number {
  let y = drawTableHeader(doc, startY);
  for (const line of data.lines) {
    const detailParts = [
      line.sizeName,
      normalizePdfText(line.description),
      line.discount ? 'Desc. aplicado: ' + line.discount : '',
    ].filter(Boolean);
    const detailLines = detailParts.flatMap((part) => doc.splitTextToSize(part, 260) as string[]);
    const rowHeight = Math.max(34, 26 + detailLines.length * 9);
    if (y + rowHeight > 535) {
      drawFooter(doc);
      doc.addPage('letter', 'portrait');
      drawHeader(doc, data);
      y = drawTableHeader(doc, 98);
    }

    setFillColor(doc, colors.pale);
    doc.rect(MARGIN, y, CONTENT_WIDTH, 16, 'F');
    setTextColor(doc, colors.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text((line.category || 'PRODUCTO').toUpperCase(), MARGIN + 8, y + 11);
    y += 16;

    setDrawColor(doc, colors.line);
    doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight);
    setTextColor(doc, colors.ink);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(String(line.quantity), MARGIN + 24, y + 16, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(line.productName, MARGIN + 56, y + 15);
    doc.setFont('helvetica', 'normal');
    setTextColor(doc, colors.muted);
    if (detailLines.length) {
      doc.setCharSpace(0);
      doc.text(detailLines, MARGIN + 56, y + 27);
    }
    setTextColor(doc, colors.ink);
    doc.text(line.unitPrice, MARGIN + 424, y + 16, { align: 'right' });
    doc.text(line.total, PAGE_WIDTH - MARGIN - 8, y + 16, { align: 'right' });
    y += rowHeight;
  }
  return y;
}

function drawNotesAndTotals(doc: jsPDF, data: BudgetPdfData, requestedY: number) {
  let y = requestedY + 16;
  if (y > 545) {
    drawFooter(doc);
    doc.addPage('letter', 'portrait');
    drawHeader(doc, data);
    y = 102;
  }

  const leftWidth = 300;
  const rightX = MARGIN + 326;
  const noteSections = [
    ['Forma de pago', data.paymentMethod || 'Por acordar con el cliente.'],
    ['Tiempo de entrega', data.deliveryTime || 'Por confirmar.'],
    ['Condiciones', [data.advance, data.notes].filter(Boolean).join(' ') || 'Por acordar.'],
  ];
  let noteY = y;
  for (const [title, value] of noteSections) {
    setTextColor(doc, colors.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(title, MARGIN, noteY);
    setTextColor(doc, colors.muted);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value, leftWidth) as string[];
    doc.text(lines, MARGIN, noteY + 12);
    noteY += 19 + lines.length * 8;
  }

  const rows = [
    ['SUBTOTAL', data.subtotal],
    ['DESCUENTOS', `-${data.discount}`],
    ...(data.ivaEnabled ? [[`IVA ${data.ivaPercent}%`, data.iva]] : []),
    ['TOTAL', data.total],
  ];
  rows.forEach(([label, value], index) => {
    const rowY = y + index * 28;
    const isFinal = index === rows.length - 1;
    setFillColor(doc, isFinal ? colors.green : [255, 255, 255]);
    setDrawColor(doc, colors.line);
    doc.rect(rightX, rowY, CONTENT_WIDTH - 326, 28, 'FD');
    setTextColor(doc, isFinal ? colors.greenInk : colors.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isFinal ? 10 : 8);
    doc.text(label, rightX + 9, rowY + 18);
    doc.text(value, PAGE_WIDTH - MARGIN - 8, rowY + 18, { align: 'right' });
  });

  const paymentY = Math.max(noteY + 4, y + rows.length * 28 + 14);
  setDrawColor(doc, colors.line);
  doc.line(MARGIN, paymentY, PAGE_WIDTH - MARGIN, paymentY);
  setTextColor(doc, colors.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DATOS PARA EL PAGO', MARGIN, paymentY + 14);
  setTextColor(doc, colors.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Banco Banesco. 0134-0195-15-1951024164 · Titular: Cristhian Garcia · C.I.: 30.310.136', MARGIN, paymentY + 27);
  doc.text('Pago Móvil Banesco · Tlf: 0424 618 6305 · C.I.: 30.310.136', MARGIN, paymentY + 39);
  drawFooter(doc);
}

function drawReferencePages(doc: jsPDF, data: BudgetPdfData) {
  const linesPerPage = 2;
  for (let offset = 0; offset < data.lines.length; offset += linesPerPage) {
    doc.addPage('letter', 'portrait');
    drawHeader(doc, data);
    setTextColor(doc, colors.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('Diseño Referencial', PAGE_WIDTH / 2, 112, { align: 'center' });
    setTextColor(doc, colors.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Imágenes de referencia de los productos incluidos en este presupuesto.', PAGE_WIDTH / 2, 128, { align: 'center' });

    data.lines.slice(offset, offset + linesPerPage).forEach((line, index) => {
      const x = index === 0 ? MARGIN : PAGE_WIDTH / 2 + 7;
      const cardWidth = 258;
      const imageY = 154;
      const imageHeight = 430;
      setFillColor(doc, colors.pale);
      setDrawColor(doc, colors.line);
      doc.roundedRect(x, imageY, cardWidth, imageHeight, 4, 4, 'FD');
      const rendered = drawContainedImage(doc, line.image, x + 10, imageY + 10, cardWidth - 20, imageHeight - 20);
      if (!rendered) {
        setTextColor(doc, colors.muted);
        doc.setFontSize(9);
        doc.text('Sin imagen de referencia', x + cardWidth / 2, imageY + imageHeight / 2, { align: 'center' });
      }
      setTextColor(doc, colors.navy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const caption = `${line.productName}${line.sizeName ? ` · ${line.sizeName}` : ''}`;
      doc.text(doc.splitTextToSize(caption, cardWidth) as string[], x, imageY + imageHeight + 18);
    });
    drawFooter(doc);
  }
}

export async function generateBudgetPdf(data: BudgetPdfData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
    compress: true,
  });
  doc.setProperties({
    title: `Presupuesto ${data.quoteNumber}`,
    subject: 'Presupuesto comercial',
    author: 'Publicidad Exterior Maracaibo',
    creator: 'Publiex Maracaibo',
  });

  drawHeader(doc, data);
  const tableY = drawClientDetails(doc, data);
  const afterTableY = drawQuoteLines(doc, data, tableY);
  drawNotesAndTotals(doc, data, afterTableY);
  drawReferencePages(doc, data);
  return doc.output('blob');
}
