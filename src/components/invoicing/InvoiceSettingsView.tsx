import React, { useState, useEffect } from 'react';
import { useBooking } from '../../context/BookingContext';
import { InvoiceSettings } from '../../types';
import { formatInvoiceNumber, getLocalizedInvoiceNote } from '../../utils/invoiceUtils';
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
} from 'lucide-react';

export const InvoiceSettingsView: React.FC = () => {
  const { invoiceSettings, updateInvoiceSettings, t, language } = useBooking();

  const [form, setForm] = useState<InvoiceSettings>(() => {
    const localizedNotes = getLocalizedInvoiceNote(invoiceSettings.invoiceNotes, language);
    let country = invoiceSettings.country;
    if (language === 'en' && country === 'Nederland') {
      country = 'The Netherlands';
    } else if (language === 'nl' && (country === 'Netherlands' || country === 'The Netherlands')) {
      country = 'Nederland';
    }
    return {
      ...invoiceSettings,
      invoiceNotes: localizedNotes,
      country,
    };
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Automatically adapt default invoice notes and country when the user changes language
  useEffect(() => {
    setForm((prev) => {
      const localizedNotes = getLocalizedInvoiceNote(prev.invoiceNotes, language);
      let country = prev.country;
      if (language === 'en' && country === 'Nederland') {
        country = 'The Netherlands';
      } else if (language === 'nl' && (country === 'Netherlands' || country === 'The Netherlands')) {
        country = 'Nederland';
      }
      return {
        ...prev,
        invoiceNotes: localizedNotes,
        country,
      };
    });
  }, [language]);

  const handleChange = <K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSavedSuccess(false);
  };

  const handleToggleEnabled = () => {
    const updated = !form.enabled;
    handleChange('enabled', updated);
    updateInvoiceSettings({ enabled: updated });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateInvoiceSettings(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  // Preview generated invoice number
  const nextInvoicePreview = formatInvoiceNumber(
    form.numberPrefix || 'FACT-{YYYY}-',
    form.numberPadding || 4,
    form.nextSequenceNumber || 1
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
            {language === 'nl'
              ? 'Beheer bedrijfsgegevens, internationale factuurregels en de opvolgende nummering.'
              : 'Configure company information, legal compliance standards, and sequential invoice formatting.'}
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 border border-emerald-200 animate-fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{language === 'nl' ? 'Instellingen succesvol opgeslagen!' : 'Settings successfully saved!'}</span>
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
                    ? (language === 'nl' ? 'Actief' : 'Active')
                    : (language === 'nl' ? 'Uitgeschakeld' : 'Disabled')}
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
                {language === 'nl' ? 'Factuurmodule is uitgeschakeld' : 'Invoicing module is disabled'}
              </span>
              <p className="text-amber-700 mt-0.5 leading-relaxed">
                {language === 'nl'
                  ? 'Je kunt nog steeds voltooide sessies en gekochte pakketten inzien en handmatig markeren. Officiële PDF-factuurgeneratie en archivering zijn momenteel gepauzeerd.'
                  : 'You can still track delivered sessions and purchased packages. Official PDF generation and numbering are paused.'}
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
              {language === 'nl'
                ? 'Facturen moeten volgens de belastingwetgeving opvolgend en sluitend genummerd zijn.'
                : 'Tax regulations require sequential, gap-free invoice numbering.'}
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
              {language === 'nl' ? 'Tags: {YYYY} = jaar, {MM} = maand' : 'Tags: {YYYY} = year, {MM} = month'}
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
              onChange={(e) => handleChange('numberPadding', Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:bg-white outline-none"
              required
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              {language === 'nl' ? 'Bijv. 4 cijfers = 0001, 0002...' : 'e.g. 4 digits = 0001, 0002...'}
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
              onChange={(e) => handleChange('nextSequenceNumber', Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:bg-white outline-none"
              required
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              {language === 'nl' ? 'Wordt automatisch met 1 opgehoogd' : 'Auto-increments upon invoice creation'}
            </span>
          </div>
        </div>

        {/* Live Preview Box */}
        <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-700">{t.nextInvoiceNumberPreview}:</span>
            <span className="text-[11px] text-slate-400 ml-2">
              ({language === 'nl' ? 'Eerstvolgende nieuwe factuur' : 'Next issued invoice'})
            </span>
          </div>
          <div className="rounded-lg bg-white px-3 py-1.5 font-mono text-sm font-black text-blue-700 border border-blue-200 shadow-2xs">
            {nextInvoicePreview}
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
              {language === 'nl' ? 'Bedrijfsgegevens & Fiscale Registratie' : 'Business & Tax Registration'}
            </h4>
            <p className="text-[11px] text-slate-500">
              {language === 'nl'
                ? 'Verplichte leveranciersgegevens conform de Europese factuurrichtlijnen.'
                : 'Mandatory supplier details conforming to EU and international invoicing rules.'}
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
              {t.cocLabel}
            </label>
            <input
              type="text"
              value={form.chamberOfCommerce}
              onChange={(e) => handleChange('chamberOfCommerce', e.target.value)}
              placeholder="78392019"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:bg-white outline-none"
              required
            />
          </div>

          {/* Tax / VAT ID (BTW-ID) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.taxIdLabel}
            </label>
            <input
              type="text"
              value={form.taxId}
              onChange={(e) => handleChange('taxId', e.target.value)}
              placeholder="NL849204912B01"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:bg-white outline-none"
              required
            />
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
                {language === 'nl' ? 'Postcode' : 'Postal Code'}
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
              {language === 'nl' ? 'Bankrekening & Betalingsinstructies' : 'Banking & Payment Instructions'}
            </h4>
            <p className="text-[11px] text-slate-500">
              {language === 'nl'
                ? 'Deze betaalgegevens worden op de officiële PDF-factuur getoond aan de klant.'
                : 'Bank details printed on the official invoice for client transfers.'}
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
              onChange={(e) => handleChange('paymentTermDays', Number(e.target.value))}
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
              value={form.defaultVatRate}
              onChange={(e) => {
                const val = Number(e.target.value);
                handleChange('defaultVatRate', val);
                handleChange('isVatExempt', val === 0);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 font-bold focus:border-blue-500 focus:bg-white outline-none cursor-pointer"
            >
              <option value="0">{t.vatExemptOption}</option>
              <option value="21">21% ({language === 'nl' ? 'Standaard hoog' : 'Standard 21%'})</option>
              <option value="9">9% ({language === 'nl' ? 'Verlaagd tarief' : 'Reduced 9%'})</option>
            </select>
          </div>
        </div>

        {/* VAT Exemption Dedicated Option Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-800">
                {t.vatExempt} ({language === 'nl' ? 'Vrijgesteld van BTW' : 'Exempt from VAT'})
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.defaultVatRate === 0 || form.isVatExempt === true}
                onChange={(e) => {
                  const exempt = e.target.checked;
                  handleChange('isVatExempt', exempt);
                  handleChange('defaultVatRate', exempt ? 0 : 21);
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {t.vatExemptDescription}
          </p>
          {(form.defaultVatRate === 0 || form.isVatExempt) && (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-lg border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>
                {language === 'nl'
                  ? 'Actief: Op facturen wordt geen BTW berekend en staat de vermelding "Vrijgesteld van omzetbelasting (BTW)".'
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
