import React, { useState, useMemo } from 'react';
import { useBooking } from '../../context/BookingContext';
import { Invoice, InvoiceStatus } from '../../types';
import {
  FileText,
  Search,
  ChevronDown,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  Trash2,
  Filter,
  Check,
  Calendar,
  DollarSign,
  X,
  RotateCcw,
} from 'lucide-react';

interface InvoiceArchiveViewProps {
  onOpenInvoicePdf: (invoice: Invoice) => void;
  onCreateNewInvoice: () => void;
  filterClientId?: string;
}

export const InvoiceArchiveView: React.FC<InvoiceArchiveViewProps> = ({
  onOpenInvoicePdf,
  onCreateNewInvoice,
  filterClientId,
}) => {
  const {
    invoices,
    clients,
    createCreditNote,
    markInvoicePaid,
    deleteInvoice,
    formatPrice,
    t,
    language,
  } = useBooking();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [selectedClientId, setSelectedClientId] = useState<string>(filterClientId || 'all');
  const [yearFilter, setYearFilter] = useState<string>('all');

  // Available invoice years
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.issueDate) {
        years.add(inv.issueDate.split('-')[0]);
      }
    });
    return Array.from(years).sort().reverse();
  }, [invoices]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (selectedClientId !== 'all' && inv.clientId !== selectedClientId) return false;
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (yearFilter !== 'all' && !inv.issueDate.startsWith(yearFilter)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNum = inv.invoiceNumber.toLowerCase().includes(q);
        const matchesClient = inv.clientName.toLowerCase().includes(q);
        const matchesEmail = inv.clientEmail?.toLowerCase().includes(q) || false;
        if (!matchesNum && !matchesClient && !matchesEmail) return false;
      }
      return true;
    });
  }, [invoices, selectedClientId, statusFilter, yearFilter, searchQuery]);

  // Financial Stats
  const stats = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let countPaid = 0;
    let countPending = 0;

    invoices.forEach((inv) => {
      totalInvoiced += inv.totalAmount;
      if (inv.status === 'paid') {
        totalPaid += inv.totalAmount;
        countPaid++;
      } else {
        totalPending += inv.totalAmount;
        countPending++;
      }
    });

    return {
      totalInvoiced,
      totalPaid,
      totalPending,
      countPaid,
      countPending,
      totalCount: invoices.length,
    };
  }, [invoices]);

  return (
    <div className="space-y-6">
      {/* Top Action & Stats Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
            {t.invoiceArchiveTitle}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.invoiceArchiveSubtitle}
          </p>
        </div>

        <button
          onClick={onCreateNewInvoice}
          className="flex items-center gap-1.5 self-start sm:self-auto rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{t.generateInvoice}</span>
        </button>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
            <span>{language === 'nl' ? 'Totaal Gefactureerd' : 'Total Invoiced'}</span>
            <FileText className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">
              {formatPrice(stats.totalInvoiced)}
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              {stats.totalCount} {language === 'nl' ? 'facturen' : 'invoices'}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-emerald-900 font-bold uppercase tracking-wider">
            <span>{language === 'nl' ? 'Ontvangen / Voldaan' : 'Settled / Paid'}</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-950">
              {formatPrice(stats.totalPaid)}
            </span>
            <span className="text-[11px] font-semibold text-emerald-700">
              {stats.countPaid} {t.invoiceStatusPaid.toLowerCase()}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-amber-900 font-bold uppercase tracking-wider">
            <span>{language === 'nl' ? 'Openstaand Saldo' : 'Pending Payment'}</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-950">
              {formatPrice(stats.totalPending)}
            </span>
            <span className="text-[11px] font-semibold text-amber-700">
              {stats.countPending} {language === 'nl' ? 'openstaand' : 'pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Client Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              {t.client}
            </label>
            <div className="relative">
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-3 pr-8 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:bg-white outline-none cursor-pointer"
              >
                <option value="all">{t.allClients}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              {t.status}
            </label>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-3 pr-8 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:bg-white outline-none cursor-pointer"
              >
                <option value="all">{t.all} ({invoices.length})</option>
                <option value="sent">🔵 {t.invoiceStatusSent} ({stats.countPending})</option>
                <option value="paid">🟢 {t.invoiceStatusPaid} ({stats.countPaid})</option>
                <option value="draft">⚪ {t.invoiceStatusDraft}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          {/* Year Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              {language === 'nl' ? 'Boekjaar' : 'Fiscal Year'}
            </label>
            <div className="relative">
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-3 pr-8 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:bg-white outline-none cursor-pointer"
              >
                <option value="all">{language === 'nl' ? 'Alle Jaren' : 'All Years'}</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          {/* Search Query */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              {t.search}
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder={language === 'nl' ? 'Zoek factuurnr, klant...' : 'Search invoice #, client...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-8.5 pr-3 text-xs text-slate-800 focus:border-blue-500 focus:bg-white outline-none transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Invoices List / Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">{t.invoiceNumber}</th>
                <th className="py-3 px-3">{t.invoiceIssueDate}</th>
                <th className="py-3 px-3">{t.invoiceDueDate}</th>
                <th className="py-3 px-3">{t.client}</th>
                <th className="py-3 px-3 text-right">{t.total}</th>
                <th className="py-3 px-3">{t.status}</th>
                <th className="py-3 px-4 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FileText className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">{t.noInvoicesYet}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {language === 'nl'
                        ? 'Maak een nieuwe factuur aan of selecteer voltooide sessies op het tabblad "Nog te factureren".'
                        : 'Create an invoice or select completed sessions from the "To be Invoiced" tab.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const linkedCreditNote = !inv.isCreditNote
                    ? invoices.find(
                        (other) =>
                          other.isCreditNote &&
                          (other.originalInvoiceId === inv.id ||
                            other.originalInvoiceNumber === inv.invoiceNumber)
                      )
                    : undefined;
                  const creditNoteNum = inv.creditNoteNumber || linkedCreditNote?.invoiceNumber;

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => onOpenInvoicePdf(inv)}
                    >
                      {/* Invoice Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={
                                inv.isCreditNote
                                  ? 'text-rose-700 hover:underline'
                                  : 'text-blue-600 hover:underline'
                              }
                            >
                              {inv.invoiceNumber}
                            </span>
                            {inv.isCreditNote && (
                              <span className="rounded-md bg-rose-100 text-rose-800 border border-rose-200 px-1.5 py-0.2 text-[9px] font-sans font-extrabold uppercase tracking-wider">
                                {language === 'nl' ? 'Creditnota' : 'Credit Note'}
                              </span>
                            )}
                          </div>
                          {inv.isCreditNote && inv.originalInvoiceNumber && (
                            <span className="text-[10px] font-sans font-medium text-slate-500">
                              {language === 'nl' ? 'Ref. factuur:' : 'Ref. invoice:'}{' '}
                              <strong className="font-mono text-slate-700">
                                {inv.originalInvoiceNumber}
                              </strong>
                            </span>
                          )}
                          {!inv.isCreditNote && creditNoteNum && (
                            <span className="text-[10px] font-sans font-medium text-rose-600">
                              {language === 'nl' ? 'Gecrediteerd:' : 'Credited:'}{' '}
                              <strong className="font-mono">{creditNoteNum}</strong>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Issue Date */}
                      <td className="py-3.5 px-3 text-slate-600 font-medium whitespace-nowrap">
                        {inv.issueDate}
                      </td>

                      {/* Due Date */}
                      <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap">
                        {inv.dueDate}
                      </td>

                      {/* Client */}
                      <td className="py-3.5 px-3">
                        <div>
                          <p className="font-bold text-slate-900">{inv.clientName}</p>
                          {inv.clientEmail && (
                            <p className="text-[11px] text-slate-400">{inv.clientEmail}</p>
                          )}
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td
                        className={`py-3.5 px-3 text-right font-black text-sm whitespace-nowrap ${
                          inv.isCreditNote ? 'text-rose-700' : 'text-slate-900'
                        }`}
                      >
                        {formatPrice(inv.totalAmount)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {inv.status === 'paid' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-900 px-2.5 py-0.5 text-[11px] font-bold border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            <span>{t.invoiceStatusPaid}</span>
                          </span>
                        ) : inv.isCreditNote ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 px-2.5 py-0.5 text-[11px] font-bold border border-amber-200">
                            <Clock className="h-3 w-3 text-amber-600" />
                            <span>
                              {language === 'nl' ? 'Te betalen (Credit)' : 'To be Paid (Credit)'}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-900 px-2.5 py-0.5 text-[11px] font-bold border border-blue-200">
                            <Clock className="h-3 w-3 text-blue-600" />
                            <span>{t.invoiceStatusSent}</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenInvoicePdf(inv)}
                            className="flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 transition cursor-pointer"
                            title="Bekijk & Download PDF"
                          >
                            <Download className="h-3.5 w-3.5 text-slate-600" />
                            <span>PDF</span>
                          </button>

                          {!inv.isCreditNote && !creditNoteNum && (
                            <button
                              onClick={() => {
                                const createdCn = createCreditNote(inv.id);
                                if (createdCn) {
                                  onOpenInvoicePdf(createdCn);
                                }
                              }}
                              className="flex items-center gap-1 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 transition cursor-pointer"
                              title={
                                language === 'nl'
                                  ? 'Maak automatisch een creditnota om deze factuur tegen te boeken'
                                  : 'Automatically create a credit note to reverse this invoice'
                              }
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>{language === 'nl' ? 'Creditnota' : 'Credit Note'}</span>
                            </button>
                          )}

                          {inv.status !== 'paid' && (
                            <button
                              onClick={() => markInvoicePaid(inv.id)}
                              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 text-[11px] font-bold text-white transition cursor-pointer shadow-2xs"
                              title={t.markAsPaid}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  language === 'nl'
                                    ? 'Document verwijderen uit administratie?'
                                    : 'Delete document?'
                                )
                              ) {
                                deleteInvoice(inv.id);
                              }
                            }}
                            className="rounded-xl p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                            title="Verwijder"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        {filteredInvoices.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-xs text-slate-500">
            <span>
              {language === 'nl'
                ? `Toont ${filteredInvoices.length} van ${invoices.length} facturen`
                : `Showing ${filteredInvoices.length} of ${invoices.length} invoices`}
            </span>
            <span className="font-bold text-slate-800">
              {language === 'nl' ? 'Totaal zichtbaar: ' : 'Visible total: '}
              {formatPrice(filteredInvoices.reduce((a, b) => a + b.totalAmount, 0))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
