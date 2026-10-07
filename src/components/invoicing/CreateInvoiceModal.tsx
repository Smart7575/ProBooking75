import React, { useState, useEffect } from 'react';
import { useBooking } from '../../context/BookingContext';
import { BillingItem, InvoiceLineItem, Invoice } from '../../types';
import { calculateInvoiceTotals, getLocalizedInvoiceNote, isDemoTrainerName } from '../../utils/invoiceUtils';
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
    settings,
    updateSettings,
    invoiceSettings,
    updateInvoiceSettings,
    getNextInvoiceNumber,
    createInvoice,
    formatPrice,
    currency,
    currencySymbol,
    t,
    language,
  } = useBooking();

  const hasTaxId = Boolean(invoiceSettings.taxId && invoiceSettings.taxId.trim().length > 0);

  const effectiveSenderName = !isDemoTrainerName(invoiceSettings.businessName, settings.email)
    ? invoiceSettings.businessName
    : !isDemoTrainerName(settings.name, settings.email)
    ? settings.name
    : settings.email
    ? settings.email.split('@')[0]
    : settings.name;

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
  const [customVatInput, setCustomVatInput] = useState<string>('');
  const [ratesIncludeVatMode, setRatesIncludeVatMode] = useState<boolean>(
    settings.ratesIncludeVat ?? true
  );

  const computeLineFromBase = (
    baseVal: number | string,
    qtyVal: number | string,
    vatRateVal: number | string,
    isIncl: boolean
  ) => {
    const baseNum = Number(baseVal) || 0;
    const qty = Number(qtyVal) || 0;
    const vRate = Number(vatRateVal) || 0;

    if (isIncl) {
      const unitNet =
        vRate > 0 ? Math.round((baseNum / (1 + vRate / 100)) * 100) / 100 : Math.round(baseNum * 100) / 100;
      const lineGross = Math.round(qty * baseNum * 100) / 100;
      const lineNet = vRate > 0 ? Math.round((lineGross / (1 + vRate / 100)) * 100) / 100 : lineGross;
      const vatAmt = Math.round((lineGross - lineNet) * 100) / 100;
      return {
        unitPrice: unitNet,
        vatAmount: vatAmt,
        total: lineGross,
      };
    } else {
      const unitNet = Math.round(baseNum * 100) / 100;
      const lineNet = Math.round(qty * unitNet * 100) / 100;
      const vatAmt = Math.round(((lineNet * vRate) / 100) * 100) / 100;
      return {
        unitPrice: unitNet,
        vatAmount: vatAmt,
        total: Math.round((lineNet + vatAmt) * 100) / 100,
      };
    }
  };

  const handleToggleInvoiceVatMode = (isIncl: boolean) => {
    setRatesIncludeVatMode(isIncl);
    updateSettings({ ratesIncludeVat: isIncl });
    setItems((prev) =>
      prev.map((cur) => {
        const rawBase = cur.baseAmount !== undefined ? cur.baseAmount : cur.unitPrice;
        const calc = computeLineFromBase(rawBase, cur.quantity, cur.vatRate, isIncl);
        return {
          ...cur,
          baseAmount: rawBase,
          isVatInclusive: isIncl,
          unitPrice: calc.unitPrice,
          vatAmount: calc.vatAmount,
          total: calc.total,
        };
      })
    );
  };

  const availableVatRates = Array.from(
    new Set([
      0,
      ...(Array.isArray(invoiceSettings.vatRates) && invoiceSettings.vatRates.length > 0
        ? invoiceSettings.vatRates
        : [0, 9, 21]),
      Number(invoiceSettings.defaultVatRate) || 0,
      ...items.map((it) => Number(it.vatRate) || 0),
    ])
  ).sort((a, b) => a - b);

  const handleAddCustomVatRate = () => {
    const raw = customVatInput.trim().replace(',', '.');
    if (!raw) return;
    const parsed = parseFloat(raw);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) return;
    const rounded = Math.round(parsed * 100) / 100;
    const currentConfigRates =
      Array.isArray(invoiceSettings.vatRates) && invoiceSettings.vatRates.length > 0
        ? invoiceSettings.vatRates
        : [0, 9, 21];
    const nextRates = Array.from(new Set([0, ...currentConfigRates, rounded])).sort((a, b) => a - b);
    updateInvoiceSettings({
      vatRates: nextRates,
      defaultVatRate: rounded,
      isVatExempt: false,
    });
    // Also apply the newly added VAT rate to all current line items
    setItems((prev) =>
      prev.map((cur) => {
        const rawBase = cur.baseAmount !== undefined ? cur.baseAmount : cur.unitPrice;
        const isIncl = cur.isVatInclusive ?? ratesIncludeVatMode;
        const calc = computeLineFromBase(rawBase, cur.quantity, rounded, isIncl);
        return {
          ...cur,
          isVatExempt: false,
          vatRate: rounded,
          unitPrice: calc.unitPrice,
          vatAmount: calc.vatAmount,
          total: calc.total,
        };
      })
    );
    setCustomVatInput('');
  };

  const handleDeleteVatRate = (rateToDelete: number) => {
    if (rateToDelete === 0) return;
    const currentConfigRates =
      Array.isArray(invoiceSettings.vatRates) && invoiceSettings.vatRates.length > 0
        ? invoiceSettings.vatRates
        : [0, 9, 21];
    const remaining = currentConfigRates.filter((r) => r !== rateToDelete);
    const nextRates = remaining.length > 0 ? remaining : [0];
    const fallbackRate =
      invoiceSettings.defaultVatRate === rateToDelete
        ? nextRates[nextRates.length - 1] ?? 0
        : invoiceSettings.defaultVatRate;
    updateInvoiceSettings({
      vatRates: nextRates,
      defaultVatRate: fallbackRate,
    });
    // Update any line items that were using the deleted rate
    setItems((prev) =>
      prev.map((cur) => {
        if (Number(cur.vatRate) !== rateToDelete || cur.isVatExempt) return cur;
        const rawBase = cur.baseAmount !== undefined ? cur.baseAmount : cur.unitPrice;
        const isIncl = cur.isVatInclusive ?? ratesIncludeVatMode;
        const calc = computeLineFromBase(rawBase, cur.quantity, fallbackRate, isIncl);
        return {
          ...cur,
          vatRate: fallbackRate,
          unitPrice: calc.unitPrice,
          vatAmount: calc.vatAmount,
          total: calc.total,
        };
      })
    );
  };

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
      setNotes(getLocalizedInvoiceNote(invoiceSettings.invoiceNotes, language, effectiveSenderName));

      // Populate preselected items if any
      const isExempt = !hasTaxId || Boolean(invoiceSettings.isVatExempt);
      const defaultVat = isExempt ? 0 : (invoiceSettings.defaultVatRate !== undefined ? invoiceSettings.defaultVatRate : 21);

      if (preselectedBillingItems && preselectedBillingItems.length > 0) {
        const firstIncl =
          preselectedBillingItems[0].isVatInclusive ?? (settings.ratesIncludeVat ?? true);
        setRatesIncludeVatMode(firstIncl);

        const lineItems: InvoiceLineItem[] = preselectedBillingItems.map((bItem) => {
          const vatRate = defaultVat;
          const isIncl = bItem.isVatInclusive ?? (settings.ratesIncludeVat ?? true);
          const baseAmt = bItem.amount;
          const calc = computeLineFromBase(baseAmt, 1, vatRate, isIncl);

          return {
            id: `line-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            sourceType: bItem.type,
            sourceId: bItem.sourceId,
            date: bItem.date,
            description: `${bItem.title} - ${bItem.description || ''}`,
            quantity: 1,
            baseAmount: baseAmt,
            isVatInclusive: isIncl,
            isVatExempt: isExempt,
            unitPrice: calc.unitPrice,
            vatRate,
            vatAmount: calc.vatAmount,
            total: calc.total,
          };
        });
        setItems(lineItems);
      } else {
        // Default single blank line
        const chosenClient = clients.find((c) => c.id === chosenClientId);
        const hasCustomRate =
          chosenClient?.customHourlyRate !== undefined && chosenClient.customHourlyRate > 0;
        const isIncl = hasCustomRate
          ? chosenClient?.customHourlyRateIncludesVat ?? (settings.ratesIncludeVat ?? true)
          : settings.ratesIncludeVat ?? true;
        setRatesIncludeVatMode(isIncl);

        const defaultBase = hasCustomRate
          ? chosenClient!.customHourlyRate!
          : settings.standardHourlyRate || 65.0;
        const calc = computeLineFromBase(defaultBase, 1, defaultVat, isIncl);

        setItems([
          {
            id: `line-${Date.now()}`,
            description: 'Personal Training Session',
            quantity: 1,
            baseAmount: defaultBase,
            isVatInclusive: isIncl,
            isVatExempt: isExempt,
            unitPrice: calc.unitPrice,
            vatRate: defaultVat,
            vatAmount: calc.vatAmount,
            total: calc.total,
          },
        ]);
      }
    }
  }, [isOpen, initialClientId, preselectedBillingItems, invoiceSettings, settings.ratesIncludeVat, settings.standardHourlyRate, hasTaxId]);

  if (!isOpen) return null;

  const selectedClient = clients.find((c) => c.id === clientId);

  // Line item helpers
  const handleItemChange = (
    index: number,
    field: keyof InvoiceLineItem | 'baseAmountInput' | 'vatSelection',
    value: any
  ) => {
    setItems((prev) => {
      const next = [...prev];
      const existing = next[index];
      const cur: any = { ...existing };

      if (field === 'baseAmountInput') {
        cur.baseAmount = value;
        const isIncl = cur.isVatInclusive ?? ratesIncludeVatMode;
        const calc = computeLineFromBase(value, cur.quantity, cur.vatRate, isIncl);
        cur.unitPrice = calc.unitPrice;
        cur.vatAmount = calc.vatAmount;
        cur.total = calc.total;
      } else if (field === 'vatSelection') {
        const isIncl = cur.isVatInclusive ?? ratesIncludeVatMode;
        const baseVal = cur.baseAmount !== undefined ? cur.baseAmount : cur.unitPrice;
        if (value === 'exempt') {
          cur.isVatExempt = true;
          cur.vatRate = 0;
        } else {
          cur.isVatExempt = false;
          cur.vatRate = Number(value) || 0;
        }
        const calc = computeLineFromBase(baseVal, cur.quantity, cur.vatRate, isIncl);
        cur.unitPrice = calc.unitPrice;
        cur.vatAmount = calc.vatAmount;
        cur.total = calc.total;
      } else {
        cur[field] = value;
        if (field === 'quantity' || field === 'unitPrice' || field === 'vatRate') {
          const isIncl = cur.isVatInclusive ?? ratesIncludeVatMode;
          const baseVal =
            field === 'unitPrice'
              ? value
              : cur.baseAmount !== undefined
              ? cur.baseAmount
              : cur.unitPrice;
          if (field === 'unitPrice') {
            cur.baseAmount = value;
          }
          const calc = computeLineFromBase(baseVal, cur.quantity, cur.vatRate, isIncl);
          cur.unitPrice = calc.unitPrice;
          cur.vatAmount = calc.vatAmount;
          cur.total = calc.total;
        }
      }

      next[index] = cur;
      return next;
    });
  };

  const handleAddItem = () => {
    const isExempt = !hasTaxId || Boolean(invoiceSettings.isVatExempt);
    const defaultVat = isExempt ? 0 : (invoiceSettings.defaultVatRate !== undefined ? invoiceSettings.defaultVatRate : 21);

    setItems((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        description: '',
        quantity: 1,
        baseAmount: 0,
        isVatInclusive: ratesIncludeVatMode,
        isVatExempt: isExempt,
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
  const isAllExempt =
    !hasTaxId || (items.length > 0 && items.every((it) => Boolean(it.isVatExempt)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    const isDemoEmail = (em?: string) =>
      !em || em === 'mark@jansen-performance.nl' || em === 'alex@probooking.nl';
    const effectiveEmail = !isDemoEmail(invoiceSettings.email)
      ? invoiceSettings.email
      : settings.email || invoiceSettings.email;
    const effectivePhone = invoiceSettings.phone || settings.phone;
    const effectiveWebsite =
      invoiceSettings.website === 'www.jansen-performance.nl' &&
      settings.email !== 'mark@jansen-performance.nl'
        ? ''
        : invoiceSettings.website;

    const normalizedItems: InvoiceLineItem[] = items.map((it) => {
      const qty = Number(it.quantity) || 0;
      const lineExempt = !hasTaxId || Boolean(it.isVatExempt);
      const vRate = lineExempt ? 0 : Number(it.vatRate) || 0;
      const isIncl = it.isVatInclusive ?? ratesIncludeVatMode;
      const rawBase = it.baseAmount !== undefined ? Number(it.baseAmount) || 0 : Number(it.unitPrice) || 0;
      const calc = computeLineFromBase(rawBase, qty, vRate, isIncl);
      return {
        ...it,
        quantity: qty,
        baseAmount: rawBase,
        isVatInclusive: isIncl,
        isVatExempt: lineExempt,
        unitPrice: calc.unitPrice,
        vatRate: vRate,
        vatAmount: calc.vatAmount,
        total: calc.total,
      };
    });

    const finalTotals = calculateInvoiceTotals(normalizedItems);
    const trimmedTaxId = (invoiceSettings.taxId || '').trim();
    const trimmedCoc = (invoiceSettings.chamberOfCommerce || '').trim();
    const invoiceExempt =
      !hasTaxId || (normalizedItems.length > 0 && normalizedItems.every((it) => Boolean(it.isVatExempt)));

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
      items: normalizedItems,
      subtotal: finalTotals.subtotal,
      totalVat: finalTotals.totalVat,
      totalAmount: finalTotals.totalAmount,
      currency: currency || 'EUR',
      senderBusinessName: effectiveSenderName,
      senderTaxId: trimmedTaxId,
      senderChamberOfCommerce: trimmedCoc,
      senderAddress: invoiceSettings.address,
      senderPostalCode: invoiceSettings.postalCode,
      senderCity: invoiceSettings.city,
      senderCountry: invoiceSettings.country || (language === 'en' ? 'The Netherlands' : 'Nederland'),
      senderPhone: effectivePhone,
      senderEmail: effectiveEmail,
      senderWebsite: effectiveWebsite,
      senderIban: invoiceSettings.iban,
      senderBic: invoiceSettings.bic,
      senderBankName: invoiceSettings.bankName,
      isVatExempt: invoiceExempt,
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
                {'Generate a sequential, legally compliant invoice'}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                {'Invoice Line Items'}
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1">
                  <span className="text-[11px] font-bold text-slate-600">
                    {'Rate is:'}
                  </span>
                  <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!ratesIncludeVatMode}
                      onChange={() => handleToggleInvoiceVatMode(false)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                    />
                    <span
                      className={`text-[11px] font-bold ${
                        !ratesIncludeVatMode ? 'text-emerald-700' : 'text-slate-600'
                      }`}
                    >
                      {'Excl. VAT'}
                    </span>
                  </label>
                  <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={ratesIncludeVatMode}
                      onChange={() => handleToggleInvoiceVatMode(true)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                    />
                    <span
                      className={`text-[11px] font-bold ${
                        ratesIncludeVatMode ? 'text-emerald-700' : 'text-slate-600'
                      }`}
                    >
                      {'Incl. VAT'}
                    </span>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t.addNewLineItem}</span>
                </button>
              </div>
            </div>

            {/* Quick VAT Rate Add & Remove Bar */}
            {!hasTaxId ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-900 flex items-center justify-between gap-2">
                <span className="font-bold">
                  {'VAT regime: Exempt from VAT (0%) — No VAT ID is configured, so no VAT can be charged.'}
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-600 mr-1">
                    {'VAT rates:'}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/60 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                    <button
                      type="button"
                      onClick={() => {
                        setItems((prev) =>
                          prev.map((cur) => {
                            const rawBase = cur.baseAmount !== undefined ? cur.baseAmount : cur.unitPrice;
                            const isIncl = cur.isVatInclusive ?? ratesIncludeVatMode;
                            const calc = computeLineFromBase(rawBase, cur.quantity, 0, isIncl);
                            return {
                              ...cur,
                              isVatExempt: true,
                              vatRate: 0,
                              unitPrice: calc.unitPrice,
                              vatAmount: calc.vatAmount,
                              total: calc.total,
                            };
                          })
                        );
                      }}
                      className="cursor-pointer hover:text-emerald-950 transition"
                      title={
                        'Apply Exempt from VAT to all lines'
                      }
                    >
                      {'Exempt from VAT'}
                    </button>
                  </span>
                  {availableVatRates.map((rate) => (
                    <span
                      key={rate}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setItems((prev) =>
                            prev.map((cur) => {
                              const rawBase = cur.baseAmount !== undefined ? cur.baseAmount : cur.unitPrice;
                              const isIncl = cur.isVatInclusive ?? ratesIncludeVatMode;
                              const calc = computeLineFromBase(rawBase, cur.quantity, rate, isIncl);
                              return {
                                ...cur,
                                isVatExempt: false,
                                vatRate: rate,
                                unitPrice: calc.unitPrice,
                                vatAmount: calc.vatAmount,
                                total: calc.total,
                              };
                            })
                          );
                        }}
                        className="cursor-pointer hover:text-blue-600 transition"
                        title={
                          `Apply ${rate}% VAT to all lines`
                        }
                      >
                        {`${rate}% BTW`}
                      </button>
                      {availableVatRates.length > 1 && rate !== 0 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteVatRate(rate)}
                          className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition cursor-pointer"
                          title={
                            `Remove ${rate}% VAT rate`
                          }
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={customVatInput}
                      onChange={(e) => setCustomVatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomVatRate();
                        }
                      }}
                      placeholder={'Custom VAT %'}
                      className="w-28 rounded-lg border border-slate-200 bg-white pl-2 pr-5 py-1 text-[11px] font-mono font-bold text-slate-900 focus:border-blue-500 outline-none"
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                      %
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomVatRate}
                    disabled={!customVatInput.trim()}
                    className="flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 px-2.5 py-1 text-[11px] font-bold text-white transition cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>{'Add'}</span>
                  </button>
                </div>
              </div>
            )}

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
                        value={item.baseAmount !== undefined ? item.baseAmount : item.unitPrice}
                        onChange={(e) => handleItemChange(index, 'baseAmountInput', e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-right font-medium text-slate-900 focus:border-blue-500 outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="col-span-3 sm:col-span-2">
                    <div className="relative">
                      <select
                        value={!hasTaxId || item.isVatExempt ? 'exempt' : String(item.vatRate)}
                        disabled={!hasTaxId}
                        onChange={(e) => {
                          if (!hasTaxId) return;
                          handleItemChange(index, 'vatSelection', e.target.value);
                        }}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-1.5 pl-2 pr-6 text-xs text-center font-medium text-slate-900 focus:border-blue-500 outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <option value="exempt">
                          {'Exempt from VAT'}
                        </option>
                        {hasTaxId &&
                          availableVatRates.map((rate) => (
                            <option key={rate} value={String(rate)}>
                              {rate === 0
                                ? '0% VAT'
                                : `${rate}% BTW`}
                            </option>
                          ))}
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
                {t.billFrom}: <strong className="text-slate-800">{effectiveSenderName}</strong>
              </p>
              <p>
                {'CoC:'}{' '}
                <strong className="text-slate-800 font-mono">
                  {(invoiceSettings.chamberOfCommerce || '').trim() ||
                    ('Not applicable')}
                </strong>
              </p>
              <p>
                {'VAT ID:'}{' '}
                <strong className="text-slate-800 font-mono">
                  {(invoiceSettings.taxId || '').trim() ||
                    ('Not applicable')}
                </strong>
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
                  {isAllExempt ? (
                    <span className="text-emerald-700 font-bold">
                      {'Exempt'}
                    </span>
                  ) : (
                    formatPrice(totals.totalVat)
                  )}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 text-sm font-extrabold text-slate-900">
                <span>
                  {isAllExempt
                    ? 'Total (Exempt from VAT)'
                    : t.totalInclVat}
                  :
                </span>
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
