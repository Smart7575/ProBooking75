import React, { useState } from 'react';
import { Invoice } from '../../types';
import { useBooking } from '../../context/BookingContext';
import { downloadInvoicePdf, getLocalizedInvoiceNote, isDemoTrainerName } from '../../utils/invoiceUtils';
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
  RotateCcw,
} from 'lucide-react';

interface InvoicePdfModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onMarkPaid?: (invoiceId: string) => void;
  onSelectInvoice?: (invoice: Invoice) => void;
}

export const InvoicePdfModal: React.FC<InvoicePdfModalProps> = ({
  invoice: initialInvoice,
  isOpen,
  onClose,
  onMarkPaid,
  onSelectInvoice,
}) => {
  const {
    role,
    invoices,
    createCreditNote,
    settings,
    invoiceSettings,
    formatPrice,
    t,
    language,
  } = useBooking();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [overrideInvoice, setOverrideInvoice] = useState<Invoice | null>(null);

  React.useEffect(() => {
    setOverrideInvoice(null);
  }, [initialInvoice?.id, isOpen]);

  const baseInvoice = overrideInvoice || initialInvoice;
  const invoice = baseInvoice
    ? invoices.find((inv) => inv.id === baseInvoice.id) || baseInvoice
    : null;

  if (!isOpen || !invoice) return null;

  const existingCreditNote = !invoice.isCreditNote
    ? invoices.find(
        (other) =>
          other.isCreditNote &&
          (other.originalInvoiceId === invoice.id ||
            other.originalInvoiceNumber === invoice.invoiceNumber)
      )
    : undefined;
  const creditNoteNum = invoice.creditNoteNumber || existingCreditNote?.invoiceNumber;
  const canCreateCreditNote =
    role === 'provider' && !invoice.isCreditNote && !creditNoteNum;

  const trainerName = !isDemoTrainerName(settings.name, settings.email)
    ? settings.name
    : settings.email
    ? settings.email.split('@')[0]
    : settings.name;

  const configuredBusinessName = !isDemoTrainerName(invoiceSettings.businessName, settings.email)
    ? invoiceSettings.businessName
    : '';
  const invoiceBusinessName = !isDemoTrainerName(invoice.senderBusinessName, settings.email)
    ? invoice.senderBusinessName
    : '';

  const effectiveSenderName =
    configuredBusinessName || trainerName || invoiceBusinessName || invoice.senderBusinessName;

  const isDemoEmail = (em?: string) =>
    !em || em === 'mark@jansen-performance.nl' || em === 'alex@probooking.nl';

  const effectiveSenderEmail = !isDemoEmail(invoiceSettings.email)
    ? invoiceSettings.email
    : !isDemoEmail(settings.email)
    ? settings.email
    : !isDemoEmail(invoice.senderEmail)
    ? invoice.senderEmail
    : settings.email || invoice.senderEmail;

  const effectiveSenderPhone =
    invoiceSettings.phone || settings.phone || invoice.senderPhone || '';

  const effectiveSenderAddress =
    invoiceSettings.address || invoice.senderAddress || '';
  const effectiveSenderPostalCode =
    invoiceSettings.postalCode || invoice.senderPostalCode || '';
  const effectiveSenderCity =
    invoiceSettings.city || invoice.senderCity || '';
  const effectiveSenderCountry =
    invoiceSettings.country || invoice.senderCountry || 'Nederland';

  const rawWebsite = invoiceSettings.website ?? invoice.senderWebsite ?? '';
  const effectiveSenderWebsite =
    rawWebsite === 'www.jansen-performance.nl' &&
    settings.email !== 'mark@jansen-performance.nl'
      ? ''
      : rawWebsite;

  const effectiveSenderCoc = (
    invoiceSettings.chamberOfCommerce !== undefined
      ? invoiceSettings.chamberOfCommerce
      : invoice.senderChamberOfCommerce || ''
  ).trim();
  const effectiveSenderTaxId = (
    invoiceSettings.taxId !== undefined
      ? invoiceSettings.taxId
      : invoice.senderTaxId || ''
  ).trim();
  const isVatExemptRegime =
    !effectiveSenderTaxId ||
    Boolean(invoice.isVatExempt) ||
    (invoice.items.length > 0 && invoice.items.every((it) => Boolean(it.isVatExempt)));
  const effectiveTotalVat = isVatExemptRegime ? 0 : invoice.totalVat;
  const effectiveSubtotal = isVatExemptRegime
    ? invoice.items.reduce((sum, it) => {
        const rawUnit = it.baseAmount !== undefined ? Number(it.baseAmount) : Number(it.unitPrice);
        return Math.round((sum + (Number(it.quantity) || 0) * (rawUnit || 0)) * 100) / 100;
      }, 0) || invoice.subtotal
    : invoice.subtotal;
  const effectiveTotalAmount = isVatExemptRegime ? effectiveSubtotal : invoice.totalAmount;
  const effectiveSenderIban =
    invoiceSettings.iban || invoice.senderIban || '';
  const effectiveSenderBic =
    invoiceSettings.bic ?? invoice.senderBic ?? '';
  const effectiveSenderBankName =
    invoiceSettings.bankName ?? invoice.senderBankName ?? '';

  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const docPrefix = invoice.isCreditNote
        ? 'CreditNote'
        : 'Invoice';
      await downloadInvoicePdf('printable-invoice-content', `${docPrefix}-${invoice.invoiceNumber}`);
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
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-xs ${
                invoice.isCreditNote ? 'bg-rose-600' : 'bg-blue-600'
              }`}
            >
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900">
                  {invoice.invoiceNumber}
                </h3>
                {invoice.isCreditNote && (
                  <span className="rounded-full bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    {'Credit Note'}
                  </span>
                )}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    invoice.status === 'paid'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-900 border border-amber-200'
                  }`}
                >
                  {invoice.status === 'paid'
                    ? t.invoiceStatusPaid
                    : invoice.isCreditNote
                    ? 'To be Paid (Credit)'
                    : t.invoiceStatusSent}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {invoice.clientName} • {formatPrice(effectiveTotalAmount)}
                {invoice.isCreditNote && invoice.originalInvoiceNumber
                  ? ` • ${'Ref:'} ${invoice.originalInvoiceNumber}`
                  : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canCreateCreditNote && (
              <button
                onClick={() => {
                  const createdCn = createCreditNote(invoice.id);
                  if (createdCn) {
                    setOverrideInvoice(createdCn);
                    onSelectInvoice?.(createdCn);
                  }
                }}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition cursor-pointer"
                title={
                  'Automatically create a credit note to reverse all invoice amounts'
                }
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{'Create Credit Note'}</span>
              </button>
            )}

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
          >
            {/* Header: Business & Invoice Info */}
            <div className="flex flex-col sm:flex-row items-start justify-between gap-6 pb-8 border-b border-slate-200">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-2 bg-emerald-600 rounded-full"></div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {effectiveSenderName}
                    </h1>
                    {trainerName && effectiveSenderName !== trainerName ? (
                      <p className="text-xs font-bold text-slate-700 mt-0.5">
                        {trainerName}
                        {settings.profession ? ` • ${settings.profession}` : ''}
                      </p>
                    ) : settings.profession ? (
                      <p className="text-xs font-semibold text-slate-600 mt-0.5">
                        {settings.profession}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="text-xs text-slate-500 space-y-0.5 pt-1">
                  {effectiveSenderAddress && <p>{effectiveSenderAddress}</p>}
                  {(effectiveSenderPostalCode || effectiveSenderCity) && (
                    <p>
                      {effectiveSenderPostalCode} {effectiveSenderCity},{' '}
                      {effectiveSenderCountry === 'Nederland' && language === 'en'
                        ? 'The Netherlands'
                        : effectiveSenderCountry}
                    </p>
                  )}
                  <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-600 flex-wrap">
                    {effectiveSenderPhone && <span>Tel: {effectiveSenderPhone}</span>}
                    {effectiveSenderEmail && <span>Email: {effectiveSenderEmail}</span>}
                  </div>
                  {effectiveSenderWebsite && (
                    <p className="text-[11px] text-slate-600">Web: {effectiveSenderWebsite}</p>
                  )}
                </div>
              </div>

              {/* Invoice Title & Meta */}
              <div className="sm:text-right space-y-1">
                <span
                  className={`text-2xl font-black tracking-wider uppercase block ${
                    invoice.isCreditNote ? 'text-rose-800' : 'text-slate-950'
                  }`}
                >
                  {invoice.isCreditNote
                    ? 'CREDIT NOTE'
                    : 'INVOICE'}
                </span>
                <p
                  className={`font-mono text-sm font-bold px-2.5 py-0.5 rounded-lg border inline-block ${
                    invoice.isCreditNote
                      ? 'text-rose-800 bg-rose-50 border-rose-200'
                      : 'text-emerald-800 bg-emerald-50 border-emerald-200'
                  }`}
                >
                  {invoice.invoiceNumber}
                </p>

                <div className="text-xs text-slate-600 space-y-1 pt-2">
                  <div className="flex justify-between sm:justify-end gap-3">
                    <span className="text-slate-400">
                      {invoice.isCreditNote
                        ? 'Credit note date'
                        : t.invoiceIssueDate}
                      :
                    </span>
                    <span className="font-semibold text-slate-800">{invoice.issueDate}</span>
                  </div>
                  {!invoice.isCreditNote && (
                    <div className="flex justify-between sm:justify-end gap-3">
                      <span className="text-slate-400">{t.invoiceDueDate}:</span>
                      <span className="font-bold text-slate-900">{invoice.dueDate}</span>
                    </div>
                  )}
                  {invoice.isCreditNote && invoice.originalInvoiceNumber && (
                    <div className="flex justify-between sm:justify-end gap-3 pt-0.5">
                      <span className="text-rose-600 font-semibold">
                        {'Original invoice #:'}
                      </span>
                      <span className="font-mono font-bold text-rose-800">
                        {invoice.originalInvoiceNumber}
                      </span>
                    </div>
                  )}
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
                      {'VAT ID:'} {invoice.clientTaxId}
                    </p>
                  )}
                </div>
              </div>

              {/* Sender Legal Details (Compliance) */}
              <div className="sm:text-right space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  {'Business & Tax Registration'}
                </span>
                <div className="text-xs text-slate-600 space-y-1">
                  {trainerName && (
                    <p>
                      <span className="text-slate-400">{'Trainer:'}</span>{' '}
                      <strong className="font-semibold text-slate-900">
                        {trainerName}
                      </strong>
                    </p>
                  )}
                  <p>
                    <span className="text-slate-400">{'CoC:'}</span>{' '}
                    <strong
                      className={
                        effectiveSenderCoc
                          ? 'font-mono text-slate-800'
                          : 'font-medium text-slate-600 italic'
                      }
                    >
                      {effectiveSenderCoc ||
                        ('Not applicable')}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-400">{'VAT ID:'}</span>{' '}
                    <strong
                      className={
                        effectiveSenderTaxId
                          ? 'font-mono text-slate-800'
                          : 'font-medium text-slate-600 italic'
                      }
                    >
                      {effectiveSenderTaxId ||
                        ('Not applicable')}
                    </strong>
                  </p>
                  {effectiveSenderIban && (
                    <p>
                      <span className="text-slate-400">IBAN:</span>{' '}
                      <strong className="font-mono text-slate-900 font-bold">
                        {effectiveSenderIban}
                      </strong>
                    </p>
                  )}
                  {effectiveSenderBic && (
                    <p>
                      <span className="text-slate-400">BIC / SWIFT:</span>{' '}
                      <strong className="font-mono text-slate-800">
                        {effectiveSenderBic}
                      </strong>
                    </p>
                  )}
                  {effectiveSenderBankName && (
                    <p>
                      <span className="text-slate-400">Bank:</span>{' '}
                      <span className="text-slate-700">{effectiveSenderBankName}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Original Invoice Reference Banner for Credit Notes */}
            {invoice.isCreditNote && invoice.originalInvoiceNumber && (
              <div className="mt-6 rounded-xl bg-rose-50/80 px-4 py-3 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="font-bold text-rose-900">
                  {`Credit Note — Reversal of original invoice ${invoice.originalInvoiceNumber}`}
                </span>
                <span className="font-mono font-bold text-rose-700">
                  {'Reference:'} {invoice.originalInvoiceNumber}
                </span>
              </div>
            )}

            {/* Itemized Line Items Table */}
            <div className="py-6">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 pr-3">{t.itemDescription}</th>
                    <th className="py-2.5 px-3 text-center w-16">{t.itemQty}</th>
                    <th className="py-2.5 px-3 text-right w-24">{t.itemRate}</th>
                    <th className="py-2.5 px-3 text-right w-24">
                      {isVatExemptRegime ? t.vat : `${t.vat} %`}
                    </th>
                    <th className="py-2.5 pl-3 text-right w-28">{t.itemTotal}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.items.map((item, index) => {
                    const effectiveItemUnitPrice = isVatExemptRegime
                      ? item.baseAmount !== undefined
                        ? Number(item.baseAmount)
                        : Number(item.unitPrice)
                      : Number(item.unitPrice);
                    const effectiveItemLineTotal = isVatExemptRegime
                      ? Math.round(item.quantity * effectiveItemUnitPrice * 100) / 100
                      : item.isVatInclusive && item.baseAmount !== undefined && item.vatRate > 0
                      ? Math.round(
                          ((item.quantity * Number(item.baseAmount)) /
                            (1 + item.vatRate / 100)) *
                            100
                        ) / 100
                      : item.quantity * item.unitPrice;

                    return (
                      <tr key={item.id || index} className="text-slate-800">
                        <td className="py-3.5 pr-3">
                          <p className="font-bold text-slate-900">{item.description}</p>
                          {item.date && (
                            <span className="text-[11px] text-slate-400">
                              {'Date of service'}: {item.date}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center font-medium">
                          {item.quantity}
                        </td>
                        <td className="py-3.5 px-3 text-right font-medium">
                          {formatPrice(effectiveItemUnitPrice)}
                        </td>
                        <td className="py-3.5 px-3 text-right text-slate-500 font-medium text-[11px]">
                          {isVatExemptRegime || item.isVatExempt
                            ? 'Exempt'
                            : `${item.vatRate}%`}
                        </td>
                        <td className="py-3.5 pl-3 text-right font-bold text-slate-900">
                          {formatPrice(effectiveItemLineTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals Section */}
            <div className="flex flex-col sm:flex-row justify-end pt-4 border-t border-slate-200">
              <div className="w-full sm:w-80 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>{t.subtotal}:</span>
                  <span className="font-semibold text-slate-800">
                    {formatPrice(effectiveSubtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{t.vat}:</span>
                  <span className="font-semibold text-slate-800">
                    {isVatExemptRegime ? (
                      <span className="text-emerald-700 font-bold">
                        {'Exempt'}
                      </span>
                    ) : (
                      formatPrice(effectiveTotalVat)
                    )}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t-2 border-slate-900 text-sm font-black text-slate-950">
                  <span>
                    {isVatExemptRegime
                      ? 'Total (Exempt from VAT)'
                      : t.totalInclVat}:
                  </span>
                  <span className="text-base text-emerald-800 font-extrabold">
                    {formatPrice(effectiveTotalAmount)}
                  </span>
                </div>

                {isVatExemptRegime && (
                  <div className="pt-2 text-right">
                    <span className="text-[11px] font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 inline-block">
                      * {'Invoice exempt from value added tax (VAT)'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Instructions & Notes */}
            <div className="mt-10 rounded-2xl bg-slate-50 p-4 border border-slate-200 text-xs text-slate-700 space-y-2">
              <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                <CreditCard
                  className={`h-4 w-4 ${
                    invoice.isCreditNote ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                />
                {invoice.isCreditNote
                  ? 'Credit Note & Settlement Details'
                  : t.paymentInstructions}
              </h5>
              <p className="leading-relaxed text-slate-600">
                {invoice.isCreditNote
                  ? invoice.status === 'paid'
                    ? `This credit note (${invoice.invoiceNumber}) for ${formatPrice(effectiveTotalAmount)} reverses original invoice ${invoice.originalInvoiceNumber || ''} in full and is settled.`
                    : `This credit note (${invoice.invoiceNumber}) for ${formatPrice(effectiveTotalAmount)} credits already-paid invoice ${invoice.originalInvoiceNumber || ''}. This credit amount is pending refund/settlement.`
                  : `Please remit payment of ${formatPrice(effectiveTotalAmount)} on or before ${invoice.dueDate} to bank account ${effectiveSenderIban} (${effectiveSenderName}) quoting invoice number ${invoice.invoiceNumber} as payment reference.`}
              </p>
              {invoice.notes && (
                <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200/60">
                  {getLocalizedInvoiceNote(invoice.notes, language, effectiveSenderName)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
