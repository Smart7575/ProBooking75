import React, { useState } from 'react';
import { Invoice } from '../../types';
import { useBooking } from '../../context/BookingContext';
import { downloadInvoicePdf, getLocalizedInvoiceNote } from '../../utils/invoiceUtils';
import {
  X,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  Shield,
  FileText,
  Building2,
  CreditCard,
  Mail,
  Phone,
  Globe,
  Loader2,
} from 'lucide-react';

interface InvoicePdfModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onMarkPaid?: (invoiceId: string) => void;
}

export const InvoicePdfModal: React.FC<InvoicePdfModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onMarkPaid,
}) => {
  const { formatPrice, t, language } = useBooking();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!isOpen || !invoice) return null;

  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      await downloadInvoicePdf('printable-invoice-content', `Factuur-${invoice.invoiceNumber}`);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      // Fallback to print
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-3xl bg-slate-100 p-4 sm:p-6 shadow-2xl border border-slate-200 my-8 max-h-[95vh] flex flex-col">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {invoice.invoiceNumber}
                </h3>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    invoice.status === 'paid'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-900 border border-amber-200'
                  }`}
                >
                  {invoice.status === 'paid' ? t.invoiceStatusPaid : t.invoiceStatusSent}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {invoice.clientName} • {formatPrice(invoice.totalAmount)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {invoice.status !== 'paid' && onMarkPaid && (
              <button
                onClick={() => onMarkPaid(invoice.id)}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{t.markAsPaid}</span>
              </button>
            )}

            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer"
              title={t.downloadPdf}
            >
              {isGeneratingPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span>{t.downloadPdf}</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              title={t.printPdf}
            >
              <Printer className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline">{t.printOverview}</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Container */}
        <div className="flex-1 overflow-y-auto pr-1">
          {/* A4 Printable Sheet */}
          <div
            id="printable-invoice-content"
            className="mx-auto w-full max-w-3xl bg-white p-8 sm:p-12 rounded-2xl shadow-sm border border-slate-200 text-slate-900 font-sans print:border-none print:shadow-none print:p-0"
            style={{ minHeight: '297mm' }}
          >
            {/* Header: Business & Invoice Info */}
            <div className="flex flex-col sm:flex-row items-start justify-between gap-6 pb-8 border-b border-slate-200">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-2 bg-emerald-600 rounded-full"></div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {invoice.senderBusinessName}
                  </h1>
                </div>
                <div className="text-xs text-slate-500 space-y-0.5 pt-1">
                  <p>{invoice.senderAddress}</p>
                  <p>
                    {invoice.senderPostalCode} {invoice.senderCity},{' '}
                    {invoice.senderCountry === 'Nederland' && language === 'en' ? 'The Netherlands' : invoice.senderCountry}
                  </p>
                  <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-600 flex-wrap">
                    {invoice.senderPhone && <span>Tel: {invoice.senderPhone}</span>}
                    <span>Email: {invoice.senderEmail}</span>
                  </div>
                  {invoice.senderWebsite && (
                    <p className="text-[11px] text-slate-600">Web: {invoice.senderWebsite}</p>
                  )}
                </div>
              </div>

              {/* Invoice Title & Meta */}
              <div className="sm:text-right space-y-1">
                <span className="text-2xl font-black tracking-wider text-slate-950 uppercase block">
                  {language === 'nl' ? 'FACTUUR' : 'INVOICE'}
                </span>
                <p className="font-mono text-sm font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 inline-block">
                  {invoice.invoiceNumber}
                </p>

                <div className="text-xs text-slate-600 space-y-1 pt-2">
                  <div className="flex justify-between sm:justify-end gap-3">
                    <span className="text-slate-400">{t.invoiceIssueDate}:</span>
                    <span className="font-semibold text-slate-800">{invoice.issueDate}</span>
                  </div>
                  <div className="flex justify-between sm:justify-end gap-3">
                    <span className="text-slate-400">{t.invoiceDueDate}:</span>
                    <span className="font-bold text-slate-900">{invoice.dueDate}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Client & Legal Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-8 border-b border-slate-200">
              {/* Recipient */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  {t.billTo}
                </span>
                <h4 className="text-sm font-extrabold text-slate-900">
                  {invoice.clientName}
                </h4>
                <div className="text-xs text-slate-600 space-y-0.5">
                  {invoice.clientAddress && <p>{invoice.clientAddress}</p>}
                  {(invoice.clientPostalCode || invoice.clientCity) && (
                    <p>
                      {invoice.clientPostalCode} {invoice.clientCity}
                    </p>
                  )}
                  {invoice.clientCountry && (
                    <p>
                      {invoice.clientCountry === 'Nederland' && language === 'en'
                        ? 'The Netherlands'
                        : invoice.clientCountry}
                    </p>
                  )}
                  {invoice.clientEmail && <p>{invoice.clientEmail}</p>}
                  {invoice.clientTaxId && (
                    <p className="pt-1 font-mono text-[11px]">
                      {language === 'nl' ? 'BTW-ID:' : 'VAT ID:'} {invoice.clientTaxId}
                    </p>
                  )}
                </div>
              </div>

              {/* Sender Legal Details (Compliance) */}
              <div className="sm:text-right space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  {language === 'nl' ? 'Bedrijfsgegevens & Registratie' : 'Business & Tax Registration'}
                </span>
                <div className="text-xs text-slate-600 space-y-1">
                  {invoice.senderChamberOfCommerce && (
                    <p>
                      <span className="text-slate-400">{language === 'nl' ? 'KVK:' : 'CoC:'}</span>{' '}
                      <strong className="font-mono text-slate-800">
                        {invoice.senderChamberOfCommerce}
                      </strong>
                    </p>
                  )}
                  {invoice.senderTaxId && (
                    <p>
                      <span className="text-slate-400">{language === 'nl' ? 'BTW-ID:' : 'VAT ID:'}</span>{' '}
                      <strong className="font-mono text-slate-800">
                        {invoice.senderTaxId}
                      </strong>
                    </p>
                  )}
                  {invoice.senderIban && (
                    <p>
                      <span className="text-slate-400">IBAN:</span>{' '}
                      <strong className="font-mono text-slate-900 font-bold">
                        {invoice.senderIban}
                      </strong>
                    </p>
                  )}
                  {invoice.senderBic && (
                    <p>
                      <span className="text-slate-400">BIC / SWIFT:</span>{' '}
                      <strong className="font-mono text-slate-800">
                        {invoice.senderBic}
                      </strong>
                    </p>
                  )}
                  {invoice.senderBankName && (
                    <p>
                      <span className="text-slate-400">Bank:</span>{' '}
                      <span className="text-slate-700">{invoice.senderBankName}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Itemized Line Items Table */}
            <div className="py-6">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 pr-3">{t.itemDescription}</th>
                    <th className="py-2.5 px-3 text-center w-16">{t.itemQty}</th>
                    <th className="py-2.5 px-3 text-right w-24">{t.itemRate}</th>
                    <th className="py-2.5 px-3 text-right w-24">{invoice.totalVat === 0 ? t.vat : `${t.vat} %`}</th>
                    <th className="py-2.5 pl-3 text-right w-28">{t.itemTotal}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.items.map((item, index) => (
                    <tr key={item.id || index} className="text-slate-800">
                      <td className="py-3.5 pr-3">
                        <p className="font-bold text-slate-900">{item.description}</p>
                        {item.date && (
                          <span className="text-[11px] text-slate-400">
                            {language === 'nl' ? 'Datum dienst' : 'Date of service'}: {item.date}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center font-medium">
                        {item.quantity}
                      </td>
                      <td className="py-3.5 px-3 text-right font-medium">
                        {formatPrice(item.unitPrice)}
                      </td>
                      <td className="py-3.5 px-3 text-right text-slate-500 font-medium text-[11px]">
                        {item.vatRate === 0
                          ? (language === 'nl' ? 'Vrijgesteld' : 'Exempt')
                          : `${item.vatRate}%`}
                      </td>
                      <td className="py-3.5 pl-3 text-right font-bold text-slate-900">
                        {formatPrice(item.quantity * item.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Section */}
            <div className="flex flex-col sm:flex-row justify-end pt-4 border-t border-slate-200">
              <div className="w-full sm:w-80 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>{t.subtotal}:</span>
                  <span className="font-semibold text-slate-800">
                    {formatPrice(invoice.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{t.vat}:</span>
                  <span className="font-semibold text-slate-800">
                    {invoice.totalVat === 0 ? (
                      <span className="text-emerald-700 font-bold">
                        {language === 'nl' ? 'Vrijgesteld' : 'Exempt'}
                      </span>
                    ) : (
                      formatPrice(invoice.totalVat)
                    )}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t-2 border-slate-900 text-sm font-black text-slate-950">
                  <span>
                    {invoice.totalVat === 0
                      ? (language === 'nl' ? 'Totaalbedrag (Vrijgesteld van BTW)' : 'Total (Exempt from VAT)')
                      : t.totalInclVat}:
                  </span>
                  <span className="text-base text-emerald-800 font-extrabold">
                    {formatPrice(invoice.totalAmount)}
                  </span>
                </div>

                {invoice.totalVat === 0 && (
                  <div className="pt-2 text-right">
                    <span className="text-[11px] font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 inline-block">
                      * {language === 'nl' ? 'Factuur vrijgesteld van omzetbelasting (BTW)' : 'Invoice exempt from value added tax (VAT)'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Instructions & Notes */}
            <div className="mt-10 rounded-2xl bg-slate-50 p-4 border border-slate-200 text-xs text-slate-700 space-y-2">
              <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-emerald-600" />
                {t.paymentInstructions}
              </h5>
              <p className="leading-relaxed text-slate-600">
                {language === 'nl'
                  ? `Gelieve het totaalbedrag van ${formatPrice(invoice.totalAmount)} vóór ${invoice.dueDate} over te maken naar rekening ${invoice.senderIban} t.n.v. ${invoice.senderBusinessName}, onder vermelding van factuurnummer ${invoice.invoiceNumber}.`
                  : `Please remit payment of ${formatPrice(invoice.totalAmount)} on or before ${invoice.dueDate} to bank account ${invoice.senderIban} (${invoice.senderBusinessName}) quoting invoice number ${invoice.invoiceNumber} as payment reference.`}
              </p>
              {invoice.notes && (
                <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200/60">
                  {getLocalizedInvoiceNote(invoice.notes, language)}
                </p>
              )}
            </div>

            {/* Footer with compliance acknowledgment */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 gap-2">
              <span>
                {invoice.senderBusinessName} • {language === 'nl' ? 'KVK' : 'CoC'}: {invoice.senderChamberOfCommerce} • {language === 'nl' ? 'BTW' : 'VAT ID'}: {invoice.senderTaxId}
              </span>
              <span>{language === 'nl' ? 'Geldige factuur conform Europese richtlijnen' : 'Official VAT invoice compliant with international standards'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
