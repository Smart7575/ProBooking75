import React, { useState, useEffect } from 'react';
import { useBooking } from '../../context/BookingContext';
import { BillingItem, InvoiceLineItem, Invoice } from '../../types';
import { calculateInvoiceTotals, getLocalizedInvoiceNote } from '../../utils/invoiceUtils';
import {
  X,
  FileText,
  Plus,
  Trash2,
  Calendar,
  Building2,
  DollarSign,
  Check,
  ChevronDown,
} from 'lucide-react';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialClientId?: string;
  preselectedBillingItems?: BillingItem[];
  onInvoiceCreated: (newInvoice: Invoice) => void;
}

export const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
  isOpen,
  onClose,
  initialClientId,
  preselectedBillingItems = [],
  onInvoiceCreated,
}) => {
  const {
    clients,
    invoiceSettings,
    getNextInvoiceNumber,
    createInvoice,
    formatPrice,
    currencySymbol,
    t,
    language,
  } = useBooking();

  const [clientId, setClientId] = useState<string>(initialClientId || (clients[0]?.id ?? ''));
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + (invoiceSettings.paymentTermDays || 14));
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState<string>(invoiceSettings.invoiceNotes || '');

  // Line items
  const [items, setItems] = useState<InvoiceLineItem[]>([]);

  // Initialize or update fields when modal opens
  useEffect(() => {
    if (isOpen) {
      setInvoiceNumber(getNextInvoiceNumber());

      const chosenClientId = initialClientId || (clients[0]?.id ?? '');
      setClientId(chosenClientId);

      const d = new Date();
      setIssueDate(d.toISOString().split('T')[0]);
      const due = new Date();
      due.setDate(due.getDate() + (invoiceSettings.paymentTermDays || 14));
      setDueDate(due.toISOString().split('T')[0]);
      setNotes(getLocalizedInvoiceNote(invoiceSettings.invoiceNotes, language));

      // Populate preselected items if any
      const isExempt = invoiceSettings.isVatExempt || invoiceSettings.defaultVatRate === 0;
      const defaultVat = isExempt ? 0 : (invoiceSettings.defaultVatRate !== undefined ? invoiceSettings.defaultVatRate : 21);

      if (preselectedBillingItems && preselectedBillingItems.length > 0) {
        const lineItems: InvoiceLineItem[] = preselectedBillingItems.map((bItem) => {
          // If amount is gross, compute net based on default VAT
          const vatRate = defaultVat;
          const gross = bItem.amount;
          const net = vatRate > 0 ? Math.round((gross / (1 + vatRate / 100)) * 100) / 100 : gross;
          const vatAmt = Math.round((gross - net) * 100) / 100;

          return {
            id: `line-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            sourceType: bItem.type,
            sourceId: bItem.sourceId,
            date: bItem.date,
            description: `${bItem.title} - ${bItem.description || ''}`,
            quantity: 1,
            unitPrice: net,
            vatRate,
            vatAmount: vatAmt,
            total: gross,
          };
        });
        setItems(lineItems);
      } else {
        // Default single blank line
        const defaultGross = 65.0;
        const net = defaultVat > 0 ? Math.round((defaultGross / (1 + defaultVat / 100)) * 100) / 100 : defaultGross;
        const vatAmt = Math.round((defaultGross - net) * 100) / 100;

        setItems([
          {
            id: `line-${Date.now()}`,
            description: language === 'nl' ? 'Personal Training Sessie' : 'Personal Training Session',
            quantity: 1,
            unitPrice: net,
            vatRate: defaultVat,
            vatAmount: vatAmt,
            total: defaultGross,
          },
        ]);
      }
    }
  }, [isOpen, initialClientId, preselectedBillingItems, invoiceSettings]);

  if (!isOpen) return null;

  const selectedClient = clients.find((c) => c.id === clientId);

  // Line item helpers
  const handleItemChange = (index: number, field: keyof InvoiceLineItem, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      const cur = { ...next[index], [field]: value };

      if (field === 'quantity' || field === 'unitPrice' || field === 'vatRate') {
        const qty = Number(cur.quantity) || 0;
        const rate = Number(cur.unitPrice) || 0;
        const vRate = Number(cur.vatRate) || 0;
        const lineNet = qty * rate;
        const vatAmt = (lineNet * vRate) / 100;
        cur.vatAmount = Math.round(vatAmt * 100) / 100;
        cur.total = Math.round((lineNet + vatAmt) * 100) / 100;
      }

      next[index] = cur;
      return next;
    });
  };

  const handleAddItem = () => {
    const isExempt = invoiceSettings.isVatExempt || invoiceSettings.defaultVatRate === 0;
    const defaultVat = isExempt ? 0 : (invoiceSettings.defaultVatRate !== undefined ? invoiceSettings.defaultVatRate : 21);

    setItems((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        description: '',
        quantity: 1,
        unitPrice: 0,
        vatRate: defaultVat,
        vatAmount: 0,
        total: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const totals = calculateInvoiceTotals(items);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    const newInvoice = createInvoice({
      invoiceNumber: invoiceNumber.trim() || getNextInvoiceNumber(),
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      clientEmail: selectedClient.email,
      clientAddress: selectedClient.address,
      clientPostalCode: selectedClient.postalCode,
      clientCity: selectedClient.city,
      clientCountry: selectedClient.country || (language === 'en' ? 'The Netherlands' : 'Nederland'),
      issueDate,
      dueDate,
      status: 'sent',
      items,
      subtotal: totals.subtotal,
      totalVat: totals.totalVat,
      totalAmount: totals.totalAmount,
      currency: invoiceSettings.iban ? 'EUR' : 'EUR',
      senderBusinessName: invoiceSettings.businessName,
      senderTaxId: invoiceSettings.taxId,
      senderChamberOfCommerce: invoiceSettings.chamberOfCommerce,
      senderAddress: invoiceSettings.address,
      senderPostalCode: invoiceSettings.postalCode,
      senderCity: invoiceSettings.city,
      senderCountry: invoiceSettings.country || (language === 'en' ? 'The Netherlands' : 'Nederland'),
      senderPhone: invoiceSettings.phone,
      senderEmail: invoiceSettings.email,
      senderWebsite: invoiceSettings.website,
      senderIban: invoiceSettings.iban,
      senderBic: invoiceSettings.bic,
      senderBankName: invoiceSettings.bankName,
      isVatExempt: totals.totalVat === 0,
      notes: notes.trim() || undefined,
    });

    onInvoiceCreated(newInvoice);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 my-8 max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {t.invoiceModalTitle}
              </h3>
              <p className="text-xs text-slate-500">
                {language === 'nl'
                  ? 'Maak een opvolgend genummerde, internationaal conforme factuur'
                  : 'Generate a sequential, legally compliant invoice'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-5">
          {/* Metadata Row: Client, Invoice #, Issue Date, Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
            {/* Client */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                {t.client}
              </label>
              <div className="relative">
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-xs font-semibold text-slate-900 focus:border-blue-500 outline-none"
                  required
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            {/* Sequential Invoice # */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                {t.invoiceNumberLabel}
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-mono font-bold text-emerald-800 focus:border-blue-500 outline-none"
                required
              />
            </div>

            {/* Issue Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                {t.invoiceIssueDate}
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-medium text-slate-800 focus:border-blue-500 outline-none"
                required
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                {t.invoiceDueDate}
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-medium text-slate-800 focus:border-blue-500 outline-none"
                required
              />
            </div>
          </div>

          {/* Line Items Editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                {language === 'nl' ? 'Factuurregels' : 'Invoice Line Items'}
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t.addNewLineItem}</span>
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div
                  key={item.id || index}
                  className="grid grid-cols-12 gap-2 items-center rounded-2xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs"
                >
                  <div className="col-span-12 sm:col-span-5">
                    <input
                      type="text"
                      placeholder={t.itemDescription}
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 outline-none"
                      required
                    />
                  </div>

                  <div className="col-span-3 sm:col-span-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 sm:hidden">Qty:</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-center font-medium text-slate-900 focus:border-blue-500 outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="col-span-4 sm:col-span-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 sm:hidden">€:</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Price"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-right font-medium text-slate-900 focus:border-blue-500 outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="col-span-3 sm:col-span-2">
                    <div className="relative">
                      <select
                        value={item.vatRate}
                        onChange={(e) => handleItemChange(index, 'vatRate', Number(e.target.value))}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-1.5 pl-2 pr-6 text-xs text-center font-medium text-slate-900 focus:border-blue-500 outline-none cursor-pointer"
                      >
                        <option value="0">{language === 'nl' ? 'Vrijgesteld van BTW' : 'Exempt from VAT'}</option>
                        <option value="21">21%</option>
                        <option value="9">9%</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                    </div>
                  </div>

                  <div className="col-span-2 sm:col-span-1 flex items-center justify-end gap-1">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                        title="Verwijder regel"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Summary */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="text-xs text-slate-500 space-y-1">
              <p>
                {t.billFrom}: <strong className="text-slate-800">{invoiceSettings.businessName}</strong>
              </p>
              <p>
                IBAN: <strong className="text-slate-800 font-mono">{invoiceSettings.iban}</strong>
              </p>
            </div>

            <div className="w-full sm:w-64 space-y-1.5 text-xs text-right">
              <div className="flex justify-between text-slate-600">
                <span>{t.subtotal}:</span>
                <span className="font-semibold text-slate-800">{formatPrice(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{t.vat}:</span>
                <span className="font-semibold text-slate-800">
                  {totals.totalVat === 0 ? (
                    <span className="text-emerald-700 font-bold">
                      {language === 'nl' ? 'Vrijgesteld' : 'Exempt'}
                    </span>
                  ) : (
                    formatPrice(totals.totalVat)
                  )}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 text-sm font-extrabold text-slate-900">
                <span>{totals.totalVat === 0 ? (language === 'nl' ? 'Totaalbedrag (Vrijgesteld van BTW)' : 'Total (Exempt from VAT)') : t.totalInclVat}:</span>
                <span className="text-base text-emerald-800 font-black">{formatPrice(totals.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Default Notes / Payment terms */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.invoiceNotesLabel}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 outline-none"
              placeholder="Betalingsinstructie of notitie..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>{t.saveAndGeneratePdf}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
