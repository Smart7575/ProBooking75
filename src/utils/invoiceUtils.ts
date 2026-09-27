import { InvoiceLineItem, InvoiceSettings, Invoice } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export function formatInvoiceNumber(
  prefix: string,
  padding: number,
  sequence: number,
  date: Date = new Date()
): string {
  const yyyy = String(date.getFullYear());
  const yy = yyyy.slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  const formattedPrefix = prefix
    .replace(/\{YYYY\}/gi, yyyy)
    .replace(/\{YY\}/gi, yy)
    .replace(/\{MM\}/gi, mm)
    .replace(/\{DD\}/gi, dd);

  const numStr = String(sequence).padStart(Math.max(1, padding), '0');
  return `${formattedPrefix}${numStr}`;
}

export function calculateInvoiceTotals(items: InvoiceLineItem[]): {
  subtotal: number;
  totalVat: number;
  totalAmount: number;
  vatBreakdown: Record<number, { base: number; vat: number }>;
} {
  let subtotal = 0;
  let totalVat = 0;
  const vatBreakdown: Record<number, { base: number; vat: number }> = {};

  items.forEach((item) => {
    const lineTotal = item.quantity * item.unitPrice;
    const vat = (lineTotal * item.vatRate) / 100;
    subtotal += lineTotal;
    totalVat += vat;

    if (!vatBreakdown[item.vatRate]) {
      vatBreakdown[item.vatRate] = { base: 0, vat: 0 };
    }
    vatBreakdown[item.vatRate].base += lineTotal;
    vatBreakdown[item.vatRate].vat += vat;
  });

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalVat: Math.round(totalVat * 100) / 100,
    totalAmount: Math.round((subtotal + totalVat) * 100) / 100,
    vatBreakdown,
  };
}

export async function downloadInvoicePdf(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id ${elementId} not found`);
  }

  // Create high-res canvas
  const canvas = await html2canvas(element, {
    scale: 2, // 2x high resolution
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: 1024,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const imgWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(`${filename}.pdf`);
}

export function getLocalizedInvoiceNote(note: string | undefined | null, language: 'en' | 'nl'): string {
  if (!note) return '';

  const trimmed = note.trim();

  // If language is English, translate known Dutch default boilerplate notes
  if (language === 'en') {
    if (
      trimmed === 'Gelieve het factuurnummer te vermelden bij de betaling. Hartelijk dank voor het vertrouwen in Jansen Performance Coaching!' ||
      trimmed.includes('Gelieve het factuurnummer te vermelden bij de betaling')
    ) {
      return 'Please quote the invoice number when making the payment. Thank you for your trust in Jansen Performance Coaching!';
    }
    if (
      trimmed === 'Gelieve het factuurnummer te vermelden bij de overschrijving.' ||
      trimmed.includes('Gelieve het factuurnummer te vermelden bij de overschrijving')
    ) {
      return 'Please quote the invoice number when making the bank transfer.';
    }
  }

  // If language is Dutch, translate known English default boilerplate notes
  if (language === 'nl') {
    if (
      trimmed === 'Please quote the invoice number when making the payment. Thank you for your trust in Jansen Performance Coaching!' ||
      trimmed.includes('Please quote the invoice number when making the payment')
    ) {
      return 'Gelieve het factuurnummer te vermelden bij de betaling. Hartelijk dank voor het vertrouwen in Jansen Performance Coaching!';
    }
    if (
      trimmed === 'Please quote the invoice number when making the bank transfer.' ||
      trimmed.includes('Please quote the invoice number when making the bank transfer')
    ) {
      return 'Gelieve het factuurnummer te vermelden bij de overschrijving.';
    }
  }

  return note;
}
