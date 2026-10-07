import React, { useState, useEffect } from 'react';
import { useBooking } from '../../context/BookingContext';
import { InvoiceSettings } from '../../types';
import { formatInvoiceNumber, getLocalizedInvoiceNote, isDemoTrainerName } from '../../utils/invoiceUtils';
import {
  FileText,
  Building2,
  CreditCard,
  Hash,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Percent,
  Calendar,
  Save,
  Power,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

export const InvoiceSettingsView: React.FC = () => {
  const { settings, updateSettings, invoiceSettings, updateInvoiceSettings, t, language } = useBooking();

  const buildFormFromSettings = (inv: InvoiceSettings, lang?: string) => {
    const resolvedBizName = !isDemoTrainerName(inv.businessName, settings.email)
      ? inv.businessName
      : !isDemoTrainerName(settings.name, settings.email)
      ? settings.name
      : settings.email
      ? settings.email.split('@')[0]
      : inv.businessName;

    const isDemoEmail = (em?: string) =>
      !em || em === 'mark@jansen-performance.nl' || em === 'alex@probooking.nl';
    const resolvedEmail = !isDemoEmail(inv.email)
      ? inv.email
      : settings.email || inv.email;
    const resolvedPhone = inv.phone || settings.phone;

    const localizedNotes = getLocalizedInvoiceNote(inv.invoiceNotes, lang, resolvedBizName);
    let country = inv.country;
    if (country === 'Nederland') {
      country = 'The Netherlands';
    }
    const baseRates =
      Array.isArray(inv.vatRates) && inv.vatRates.length > 0
        ? inv.vatRates
        : [0, 9, 21];
    const mergedRates = Array.from(
      new Set([0, ...baseRates, inv.defaultVatRate ?? 21])
    ).sort((a, b) => a - b);

    const hasTaxId = Boolean(inv.taxId && inv.taxId.trim().length > 0);
    const effectiveVatExempt = !hasTaxId ? true : Boolean(inv.isVatExempt);
    const effectiveDefaultVat = effectiveVatExempt ? 0 : (inv.defaultVatRate ?? 21);

    return {
      ...inv,
      businessName: resolvedBizName,
      email: resolvedEmail,
      phone: resolvedPhone,
      invoiceNotes: localizedNotes,
      country,
      defaultVatRate: effectiveDefaultVat,
      isVatExempt: effectiveVatExempt,
      vatRates: mergedRates,
      creditNotePrefix: inv.creditNotePrefix || 'CN-{YYYY}-',
      nextCreditNoteSequenceNumber: inv.nextCreditNoteSequenceNumber ?? 1,
    };
  };

  const [form, setForm] = useState<
    Omit<
      InvoiceSettings,
      'numberPadding' | 'nextSequenceNumber' | 'nextCreditNoteSequenceNumber' | 'paymentTermDays'
    > & {
      numberPadding: number | string;
      nextSequenceNumber: number | string;
      nextCreditNoteSequenceNumber?: number | string;
      paymentTermDays: number | string;
    }
  >(() => buildFormFromSettings(invoiceSettings, language));
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [newVatRateInput, setNewVatRateInput] = useState<string>('');

  // Sync form when invoiceSettings, settings, or language changes
  useEffect(() => {
    setForm(buildFormFromSettings(invoiceSettings, language));
  }, [invoiceSettings, settings.name, settings.email, settings.phone, language]);

  const hasTaxId = Boolean(form.taxId && form.taxId.trim().length > 0);

  const handleChange = (key: keyof InvoiceSettings, value: any) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'taxId') {
        const nextHasTax = Boolean(value && String(value).trim().length > 0);
        if (!nextHasTax) {
          next.defaultVatRate = 0;
          next.isVatExempt = true;
        }
      }
      return next;
    });
    setSavedSuccess(false);
  };

  const handleToggleEnabled = () => {
    const updated = !form.enabled;
    handleChange('enabled', updated);
    updateInvoiceSettings({ enabled: updated });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const availableVatRates = Array.from(
    new Set([0, ...(form.vatRates && form.vatRates.length > 0 ? form.vatRates : [0, 9, 21]), Number(form.defaultVatRate) || 0])
  ).sort((a, b) => a - b);

  const handleAddCustomVatRate = () => {
    const raw = newVatRateInput.trim().replace(',', '.');
    if (!raw) return;
    const parsed = parseFloat(raw);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) return;
    const rounded = Math.round(parsed * 100) / 100;
    const nextRates = Array.from(new Set([0, ...availableVatRates, rounded])).sort((a, b) => a - b);
    setForm((prev) => ({
      ...prev,
      vatRates: nextRates,
      defaultVatRate: hasTaxId ? rounded : 0,
      isVatExempt: !hasTaxId ? true : false,
    }));
    updateInvoiceSettings({
      vatRates: nextRates,
      defaultVatRate: hasTaxId ? rounded : 0,
      isVatExempt: !hasTaxId ? true : false,
    });
    setNewVatRateInput('');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleDeleteVatRate = (rateToDelete: number) => {
    if (rateToDelete === 0) return;
    const remaining = availableVatRates.filter((r) => r !== rateToDelete);
    const nextRates = remaining.length > 0 ? remaining : [0];
    const nextDefault =
      Number(form.defaultVatRate) === rateToDelete
        ? nextRates[nextRates.length - 1] ?? 0
        : Number(form.defaultVatRate);
    setForm((prev) => ({
      ...prev,
      vatRates: nextRates,
      defaultVatRate: nextDefault,
    }));
    updateInvoiceSettings({
      vatRates: nextRates,
      defaultVatRate: nextDefault,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCoc = (form.chamberOfCommerce || '').trim();
    const trimmedTaxId = (form.taxId || '').trim();
    const effectiveVatExempt = trimmedTaxId ? Boolean(form.isVatExempt) : true;
    const effectiveVatRate = effectiveVatExempt ? 0 : Number(form.defaultVatRate) || 0;

    updateInvoiceSettings({
      ...form,
      chamberOfCommerce: trimmedCoc,
      taxId: trimmedTaxId,
      defaultVatRate: effectiveVatRate,
      isVatExempt: effectiveVatExempt,
      numberPadding: Math.max(1, Number(form.numberPadding) || 4),
      nextSequenceNumber: Math.max(1, Number(form.nextSequenceNumber) || 1),
      creditNotePrefix: form.creditNotePrefix || 'CN-{YYYY}-',
      nextCreditNoteSequenceNumber: Math.max(1, Number(form.nextCreditNoteSequenceNumber) || 1),
      paymentTermDays: Math.max(0, Number(form.paymentTermDays) || 0),
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  // Preview generated invoice number
  const nextInvoicePreview = formatInvoiceNumber(
    form.numberPrefix || 'FACT-{YYYY}-',
    Number(form.numberPadding) || 4,
    Number(form.nextSequenceNumber) || 1
  );

  // Preview generated credit note number
  const nextCreditNotePreview = formatInvoiceNumber(
    form.creditNotePrefix || 'CN-{YYYY}-',
    Number(form.numberPadding) || 4,
    Number(form.nextCreditNoteSequenceNumber) || 1
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h3 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
            {t.invoiceSettingsTitle}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {'Configure company information, legal compliance standards, and sequential invoice formatting.'}
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 border border-emerald-200 animate-fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{'Settings successfully saved!'}</span>
          </div>
        )}
      </div>

      {/* Module Enable / Disable Switcher */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                form.enabled
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'bg-slate-100 text-slate-400 border border-slate-200'
              }`}
            >
              <Power className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">
                  {t.enableInvoicingModule}
                </h4>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    form.enabled
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {form.enabled
                    ? ('Active')
                    : ('Disabled')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                {t.enableInvoicingModuleDesc}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleEnabled}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              form.enabled ? 'bg-emerald-600' : 'bg-slate-300'
            }`}
            role="switch"
            aria-checked={form.enabled}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                form.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {!form.enabled && (
          <div className="mt-4 rounded-xl bg-amber-50 p-3.5 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">
                {'Invoicing module is disabled'}
              </span>
              <p className="text-amber-700 mt-0.5 leading-relaxed">
                {'You can still track delivered sessions and purchased packages. Official PDF generation and numbering are paused.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sequential Numbering Format */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Hash className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              {t.numberFormatLabel}
            </h4>
            <p className="text-[11px] text-slate-500">
              {'Tax regulations require sequential, gap-free invoice numbering.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Prefix */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.numberPrefixLabel}
            </label>
            <input
              type="text"
              value={form.numberPrefix}
              onChange={(e) => handleChange('numberPrefix', e.target.value)}
              placeholder="FACT-{YYYY}-"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:bg-white outline-none"
              required
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              {'Tags: {YYYY} = year, {MM} = month'}
            </span>
          </div>

          {/* Padding */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.numberPaddingLabel}
            </label>
            <input
              type="number"
              min="1"
              max="8"
              value={form.numberPadding}
              onChange={(e) => handleChange('numberPadding', e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:bg-white outline-none"
              required
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              {'e.g. 4 digits = 0001, 0002...'}
            </span>
          </div>

          {/* Next Sequence */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.nextSequenceLabel}
            </label>
            <input
              type="number"
              min="1"
              value={form.nextSequenceNumber}
              onChange={(e) => handleChange('nextSequenceNumber', e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:bg-white outline-none"
              required
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              {'Auto-increments upon invoice creation'}
            </span>
          </div>
        </div>

        {/* Live Preview Box */}
        <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-700">{t.nextInvoiceNumberPreview}:</span>
            <span className="text-[11px] text-slate-400 ml-2">
              ({'Next issued invoice'})
            </span>
          </div>
          <div className="rounded-lg bg-white px-3 py-1.5 font-mono text-sm font-black text-blue-700 border border-blue-200 shadow-2xs">
            {nextInvoicePreview}
          </div>
        </div>

        {/* Credit Note Prefix & Sequence */}
        <div className="pt-3 border-t border-slate-100 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {'Credit Note Prefix Format'}
              </label>
              <input
                type="text"
                value={form.creditNotePrefix ?? 'CN-{YYYY}-'}
                onChange={(e) => handleChange('creditNotePrefix', e.target.value)}
                placeholder="CN-{YYYY}-"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:bg-white outline-none"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                {'Tags: {YYYY} = year, {MM} = month (e.g. CN-{YYYY}-)'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {'Next Credit Note Sequence #'}
              </label>
              <input
                type="number"
                min="1"
                value={form.nextCreditNoteSequenceNumber ?? 1}
                onChange={(e) => handleChange('nextCreditNoteSequenceNumber', e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:bg-white outline-none"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                {'Auto-increments upon credit note creation'}
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-rose-50/60 p-3.5 border border-rose-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-xs text-slate-700">
              <span className="font-semibold text-slate-800">
                {'Next credit note preview'}:
              </span>
              <span className="text-[11px] text-slate-500 ml-2">
                ({'Automated reversal'})
              </span>
            </div>
            <div className="rounded-lg bg-white px-3 py-1.5 font-mono text-sm font-black text-rose-700 border border-rose-200 shadow-2xs">
              {nextCreditNotePreview}
            </div>
          </div>
        </div>
      </div>

      {/* Business & Legal Information (Compliance) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              {'Business & Tax Registration'}
            </h4>
            <p className="text-[11px] text-slate-500">
              {'Mandatory supplier details conforming to EU and international invoicing rules.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Business Name */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.profileName}
            </label>
            <input
              type="text"
              value={form.businessName}
              onChange={(e) => handleChange('businessName', e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white outline-none"
              required
            />
          </div>

          {/* Chamber of Commerce (KVK) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.cocLabel}{' '}
              <span className="font-normal text-slate-400">
                ({'optional'})
              </span>
            </label>
            <input
              type="text"
              value={form.chamberOfCommerce}
              onChange={(e) => handleChange('chamberOfCommerce', e.target.value)}
              placeholder={
                'Leave empty if not applicable'
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:bg-white outline-none"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              {form.chamberOfCommerce.trim()
                ? `Displayed on invoice as: ${form.chamberOfCommerce.trim()}`
                : 'Invoice will state: CoC: Not applicable'}
            </span>
          </div>

          {/* Tax / VAT ID (BTW-ID) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.taxIdLabel}{' '}
              <span className="font-normal text-slate-400">
                ({'optional'})
              </span>
            </label>
            <input
              type="text"
              value={form.taxId}
              onChange={(e) => handleChange('taxId', e.target.value)}
              placeholder={
                'Leave empty if not applicable'
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:bg-white outline-none"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              {hasTaxId
                ? `Displayed on invoice as: ${form.taxId.trim()}`
                : 'Without VAT ID: "Not applicable" & VAT regime always exempt'}
            </span>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.clientAddress}
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Sportlaan 42"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white outline-none"
              required
            />
          </div>

          {/* Postal Code & City */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {'Postal Code'}
              </label>
              <input
                type="text"
                value={form.postalCode}
                onChange={(e) => handleChange('postalCode', e.target.value)}
                placeholder="1076 TR"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t.clientCity}
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="Amsterdam"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white outline-none"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.clientEmail}
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white outline-none"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.clientPhone}
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white outline-none"
            />
          </div>
        </div>
      </div>

      {/* Banking & Payment Terms */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <CreditCard className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              {'Banking & Payment Instructions'}
            </h4>
            <p className="text-[11px] text-slate-500">
              {'Bank details printed on the official invoice for client transfers.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* IBAN */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.ibanLabel}
            </label>
            <input
              type="text"
              value={form.iban}
              onChange={(e) => handleChange('iban', e.target.value.toUpperCase())}
              placeholder="NL91ABNA0417164300"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 font-mono uppercase focus:border-blue-500 focus:bg-white outline-none"
              required
            />
          </div>

          {/* BIC */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.bicLabel}
            </label>
            <input
              type="text"
              value={form.bic}
              onChange={(e) => handleChange('bic', e.target.value.toUpperCase())}
              placeholder="ABNANL2A"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 font-mono uppercase focus:border-blue-500 focus:bg-white outline-none"
            />
          </div>

          {/* Bank Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.bankNameLabel}
            </label>
            <input
              type="text"
              value={form.bankName}
              onChange={(e) => handleChange('bankName', e.target.value)}
              placeholder="ABN AMRO"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white outline-none"
            />
          </div>

          {/* Payment Term (Days) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.paymentTermDaysLabel}
            </label>
            <input
              type="number"
              min="0"
              max="90"
              value={form.paymentTermDays}
              onChange={(e) => handleChange('paymentTermDays', e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:bg-white outline-none"
              required
            />
          </div>

          {/* Default VAT Rate */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.defaultVatRateLabel}
            </label>
            <select
              value={!hasTaxId || form.isVatExempt ? 'exempt' : String(form.defaultVatRate)}
              disabled={!hasTaxId}
              onChange={(e) => {
                if (!hasTaxId) return;
                const rawVal = e.target.value;
                if (rawVal === 'exempt') {
                  handleChange('isVatExempt', true);
                  handleChange('defaultVatRate', 0);
                } else {
                  const val = Number(rawVal);
                  handleChange('isVatExempt', false);
                  handleChange('defaultVatRate', val);
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 font-bold focus:border-blue-500 focus:bg-white outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="exempt">
                {'Exempt from VAT (No VAT registration / exemption)'}
              </option>
              {hasTaxId &&
                availableVatRates.map((rate) => (
                  <option key={rate} value={String(rate)}>
                    {rate === 0
                      ? '0% VAT (Zero-rated goods/services)'
                      : rate === 21
                      ? `21% BTW (${'Standard 21%'})`
                      : rate === 9
                      ? `9% BTW (${'Reduced 9%'})`
                      : `${rate}% BTW (${'Custom VAT rate'})`}
                  </option>
                ))}
            </select>
            {!hasTaxId && (
              <span className="text-[10px] font-semibold text-amber-700 mt-1 block">
                {'Without a VAT ID, the VAT regime is automatically Exempt from VAT.'}
              </span>
            )}
          </div>
        </div>

        {/* Custom VAT Rates Management (Add & Delete) */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5 text-blue-600" />
                {'Manage VAT Rates & Exemption'}
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {'Choose between "Exempt from VAT" (no VAT ID/exemption), "0% VAT" (zero rate), or a VAT percentage.'}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={newVatRateInput}
                  onChange={(e) => setNewVatRateInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomVatRate();
                    }
                  }}
                  placeholder={'e.g. 19 or 6'}
                  className="w-32 rounded-xl border border-slate-200 bg-white pl-2.5 pr-6 py-1.5 text-xs font-mono font-bold text-slate-900 focus:border-blue-500 outline-none"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  %
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddCustomVatRate}
                disabled={!newVatRateInput.trim()}
                className="flex items-center gap-1 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 px-3 py-1.5 text-xs font-bold text-white transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{'Add'}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Dedicated Vrijgesteld van BTW chip */}
            <div
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold transition ${
                !hasTaxId || form.isVatExempt
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-2xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  handleChange('isVatExempt', true);
                  handleChange('defaultVatRate', 0);
                }}
                className="cursor-pointer"
                title={
                  'Set as Exempt from VAT'
                }
              >
                {'Exempt from VAT'}
              </button>
            </div>

            {/* Numeric VAT rate chips (including 0% BTW) */}
            {availableVatRates.map((rate) => {
              const isSelected =
                hasTaxId && !form.isVatExempt && Number(form.defaultVatRate) === rate;
              const isDisabledRate = !hasTaxId;
              return (
                <div
                  key={rate}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold transition ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-2xs'
                      : isDisabledRate
                      ? 'border-slate-200 bg-slate-100 text-slate-400 opacity-60'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    disabled={isDisabledRate}
                    onClick={() => {
                      if (isDisabledRate) return;
                      handleChange('isVatExempt', false);
                      handleChange('defaultVatRate', rate);
                    }}
                    className={isDisabledRate ? 'cursor-not-allowed' : 'cursor-pointer'}
                    title={
                      isDisabledRate
                        ? 'Enter a VAT ID first to select a VAT rate (such as 0%, 9%, or 21%)'
                        : `Click to set ${rate}% VAT as default`
                    }
                  >
                    {rate === 0
                      ? '0% VAT'
                      : `${rate}% BTW`}
                  </button>
                  {availableVatRates.length > 1 && rate !== 0 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteVatRate(rate)}
                      className="ml-0.5 rounded-md p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition cursor-pointer"
                      title={
                        `Delete ${rate}% VAT rate`
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Hourly Rate VAT Inclusion (Excl. vs Incl. VAT) */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5 text-emerald-600" />
                {'Hourly Rates VAT Calculation (Excl. or Incl. VAT)'}
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {(settings.ratesIncludeVat ?? true) === false
                  ? 'Excl. VAT: the configured hourly rate is net; VAT is added on top on the invoice.'
                  : 'Incl. VAT: VAT is already included in the configured hourly rate on the invoice.'}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={(settings.ratesIncludeVat ?? true) === false}
                  onChange={() => {
                    updateSettings({ ratesIncludeVat: false });
                    setSavedSuccess(true);
                    setTimeout(() => setSavedSuccess(false), 3000);
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                />
                <span
                  className={`text-xs font-bold ${
                    (settings.ratesIncludeVat ?? true) === false
                      ? 'text-emerald-700'
                      : 'text-slate-600'
                  }`}
                >
                  {'Excl. VAT'}
                </span>
              </label>

              <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={(settings.ratesIncludeVat ?? true) !== false}
                  onChange={() => {
                    updateSettings({ ratesIncludeVat: true });
                    setSavedSuccess(true);
                    setTimeout(() => setSavedSuccess(false), 3000);
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                />
                <span
                  className={`text-xs font-bold ${
                    (settings.ratesIncludeVat ?? true) !== false
                      ? 'text-emerald-700'
                      : 'text-slate-600'
                  }`}
                >
                  {'Incl. VAT'}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* VAT Exemption Dedicated Option Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-800">
                {t.vatExempt} ({'Exempt from VAT'})
              </span>
            </div>
            <label
              className={`relative inline-flex items-center ${
                !hasTaxId ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
              }`}
              title={
                !hasTaxId
                  ? 'Without a VAT ID, the VAT regime is always exempt'
                  : undefined
              }
            >
              <input
                type="checkbox"
                disabled={!hasTaxId}
                checked={!hasTaxId || form.isVatExempt === true}
                onChange={(e) => {
                  if (!hasTaxId) return;
                  const exempt = e.target.checked;
                  handleChange('isVatExempt', exempt);
                  if (exempt) {
                    handleChange('defaultVatRate', 0);
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {'Exempt from VAT applies when the provider is not a VAT entrepreneur and has no VAT ID (or provides exempt services). For goods or services taxed at 0%, select "0% VAT" above.'}
          </p>
          {(!hasTaxId || form.isVatExempt) && (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-lg border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>
                {!hasTaxId
                  ? 'Active (No VAT ID): Without a VAT number, no VAT can be calculated on the invoice and the VAT regime is always exempt.'
                  : 'Active: Invoices will have no VAT calculated and state "Exempt from value added tax (VAT)".'}
              </span>
            </div>
          )}
        </div>

        {/* Legal Notes / Payment Instructions */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t.invoiceNotesLabel}
          </label>
          <textarea
            rows={3}
            value={form.invoiceNotes}
            onChange={(e) => handleChange('invoiceNotes', e.target.value)}
            placeholder={t.defaultInvoiceNotes}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white outline-none leading-relaxed"
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="submit"
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
        >
          <Save className="h-4 w-4" />
          <span>{t.saveInvoiceSettings}</span>
        </button>
      </div>
    </form>
  );
};
