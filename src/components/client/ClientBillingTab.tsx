import React, { useState, useMemo } from 'react';
import { useBooking } from '../../context/BookingContext';
import { BillingStatus, BillingItem, Invoice } from '../../types';
import { InvoicePdfModal } from '../invoicing/InvoicePdfModal';
import {
  Receipt,
  CheckCircle2,
  Clock,
  FileText,
  Package,
  Calendar,
  Sparkles,
  MessageSquare,
  AlertCircle,
  HelpCircle,
  Download,
  ExternalLink,
} from 'lucide-react';

interface ClientBillingTabProps {
  onNavigateToChat?: () => void;
}

export const ClientBillingTab: React.FC<ClientBillingTabProps> = ({ onNavigateToChat }) => {
  const {
    currentClient,
    getBillingItems,
    invoices,
    invoiceSettings,
    formatPrice,
    t,
    language,
  } = useBooking();

  const [statusFilter, setStatusFilter] = useState<'all' | BillingStatus>('all');
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  // Unbilled / Delivered items
  const clientItems = useMemo(() => {
    if (!currentClient) return [];
    return getBillingItems(currentClient.id);
  }, [currentClient, getBillingItems]);

  const filteredItems = useMemo(() => {
    if (statusFilter === 'all') return clientItems;
    return clientItems.filter((i) => i.status === statusFilter);
  }, [clientItems, statusFilter]);

  // Official Invoices for this client
  const clientInvoices = useMemo(() => {
    if (!currentClient) return [];
    return invoices.filter(
      (inv) => inv.clientId === currentClient.id && inv.status !== 'cancelled'
    );
  }, [invoices, currentClient]);

  // Summaries
  const stats = useMemo(() => {
    let toInvoiceTotal = 0;
    let toInvoiceCount = 0;
    let invoicedTotal = 0;
    let invoicedCount = 0;
    let paidTotal = 0;
    let paidCount = 0;

    clientItems.forEach((item) => {
      if (item.status === 'to_invoice') {
        toInvoiceTotal += item.amount;
        toInvoiceCount++;
      } else if (item.status === 'invoiced') {
        invoicedTotal += item.amount;
        invoicedCount++;
      } else if (item.status === 'paid') {
        paidTotal += item.amount;
        paidCount++;
      }
    });

    return {
      toInvoiceTotal,
      toInvoiceCount,
      invoicedTotal,
      invoicedCount,
      paidTotal,
      paidCount,
      grandTotal: toInvoiceTotal + invoicedTotal + paidTotal,
    };
  }, [clientItems]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {t.clientBillingTitle}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.clientBillingSubtitle}
              </p>
            </div>
          </div>
        </div>

        {onNavigateToChat && (
          <button
            onClick={onNavigateToChat}
            className="flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
          >
            <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
            <span>{t.portalNavChat}</span>
          </button>
        )}
      </div>

      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Nog te factureren */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'to_invoice' ? 'all' : 'to_invoice')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all shadow-xs ${
            statusFilter === 'to_invoice'
              ? 'border-amber-400 bg-amber-50/70 ring-2 ring-amber-400/30'
              : 'border-amber-200/80 bg-gradient-to-br from-amber-50/40 to-white hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-600" />
              {t.totalToInvoice}
            </span>
            <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-bold">
              {stats.toInvoiceCount}
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-amber-950">
              {formatPrice(stats.toInvoiceTotal)}
            </span>
            <span className="text-[11px] font-medium text-amber-700">
              {language === 'nl' ? 'Nog te factureren' : 'To be invoiced'}
            </span>
          </div>
        </div>

        {/* Gefactureerd (in afwachting) */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'invoiced' ? 'all' : 'invoiced')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all shadow-xs ${
            statusFilter === 'invoiced'
              ? 'border-blue-400 bg-blue-50/70 ring-2 ring-blue-400/30'
              : 'border-blue-200/80 bg-gradient-to-br from-blue-50/40 to-white hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-blue-600" />
              {t.totalInvoiced}
            </span>
            <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[11px] font-bold">
              {stats.invoicedCount}
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-blue-950">
              {formatPrice(stats.invoicedTotal)}
            </span>
            <span className="text-[11px] font-medium text-blue-700">
              {language === 'nl' ? 'Openstaand' : 'Pending payment'}
            </span>
          </div>
        </div>

        {/* Voldaan */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'paid' ? 'all' : 'paid')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all shadow-xs ${
            statusFilter === 'paid'
              ? 'border-emerald-400 bg-emerald-50/70 ring-2 ring-emerald-400/30'
              : 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 to-white hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {t.totalPaid}
            </span>
            <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[11px] font-bold">
              {stats.paidCount}
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-emerald-950">
              {formatPrice(stats.paidTotal)}
            </span>
            <span className="text-[11px] font-medium text-emerald-700">
              {language === 'nl' ? 'Reeds voldaan' : 'Settled'}
            </span>
          </div>
        </div>
      </div>

      {/* Official Invoices (PDF) Section (if enabled and invoices exist) */}
      {invoiceSettings.enabled && clientInvoices.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {t.clientPortalInvoices}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {language === 'nl'
                    ? 'Officiële facturen met specificatie, BTW en IBAN-betaalinstructies.'
                    : 'Official invoices with tax itemization, VAT and bank transfer instructions.'}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
              {clientInvoices.length} {language === 'nl' ? 'facturen' : 'invoices'}
            </span>
          </div>

          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
            {clientInvoices.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 hover:bg-slate-50/80 transition"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`font-mono font-bold text-xs px-2 py-1 rounded-lg shrink-0 border ${
                      inv.isCreditNote
                        ? 'text-rose-700 bg-rose-50 border-rose-200'
                        : 'text-blue-700 bg-blue-50 border-blue-200'
                    }`}
                  >
                    {inv.invoiceNumber}
                  </span>
                  <div className="text-xs">
                    <p className="font-semibold text-slate-800">
                      {inv.isCreditNote
                        ? `${language === 'nl' ? 'Creditnota datum:' : 'Credit note date:'} ${inv.issueDate}`
                        : `${language === 'nl' ? 'Factuurdatum:' : 'Issued:'} ${inv.issueDate} • ${language === 'nl' ? 'Vervalt:' : 'Due:'} ${inv.dueDate}`}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {inv.isCreditNote && inv.originalInvoiceNumber
                        ? `${language === 'nl' ? 'Tegenboeking van factuur' : 'Reversal of invoice'} ${inv.originalInvoiceNumber}`
                        : `${inv.items?.length || 1} ${language === 'nl' ? 'dienst(en) gespecificeerd' : 'line item(s)'}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                  <div className="text-right">
                    <span className="text-sm font-black text-slate-900 block">
                      {formatPrice(inv.totalAmount)}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full inline-block ${
                        inv.status === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {inv.status === 'paid' ? t.invoiceStatusPaid : t.invoiceStatusSent}
                    </span>
                  </div>

                  <button
                    onClick={() => setViewingInvoice(inv)}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 text-xs font-bold transition cursor-pointer shadow-2xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{language === 'nl' ? 'Bekijk / PDF' : 'View / PDF'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs for Items */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.all} ({clientItems.length})
          </button>
          <button
            onClick={() => setStatusFilter('to_invoice')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              statusFilter === 'to_invoice'
                ? 'bg-white text-amber-900 shadow-2xs'
                : 'text-slate-600 hover:text-amber-800'
            }`}
          >
            ⏱️ {t.statusToInvoice} ({stats.toInvoiceCount})
          </button>
          <button
            onClick={() => setStatusFilter('invoiced')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              statusFilter === 'invoiced'
                ? 'bg-white text-blue-900 shadow-2xs'
                : 'text-slate-600 hover:text-blue-800'
            }`}
          >
            📄 {t.statusInvoiced} ({stats.invoicedCount})
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              statusFilter === 'paid'
                ? 'bg-white text-emerald-900 shadow-2xs'
                : 'text-slate-600 hover:text-emerald-800'
            }`}
          >
            ✓ {t.statusPaid} ({stats.paidCount})
          </button>
        </div>

        {statusFilter !== 'all' && (
          <button
            onClick={() => setStatusFilter('all')}
            className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer whitespace-nowrap"
          >
            {language === 'nl' ? 'Filter wissen' : 'Clear filter'}
          </button>
        )}
      </div>

      {/* Delivered Sessions & Packages List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {language === 'nl' ? 'Geleverde Sessies & Pakketten' : 'Delivered Sessions & Packages'}
        </h3>

        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
            <Receipt className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700">{t.noBillingItems}</p>
            <p className="text-xs text-slate-400 mt-1">
              {language === 'nl'
                ? 'Zodra een sessie is voltooid of een pakket is gekocht, zie je die hier transparant overzichtelijk terug.'
                : 'When a session completes or bundle is bought, it will be transparently itemized here.'}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const matchingInvoice = item.invoiceNumber
              ? invoices.find((inv) => inv.invoiceNumber === item.invoiceNumber)
              : undefined;

            return (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition"
              >
                {/* Left Column: Icon & Item Info */}
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      item.type === 'package'
                        ? 'bg-purple-50 text-purple-600 border border-purple-100'
                        : 'bg-blue-50 text-blue-600 border border-blue-100'
                    }`}
                  >
                    {item.type === 'package' ? (
                      <Package className="h-5 w-5" />
                    ) : (
                      <Calendar className="h-5 w-5" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">
                        {item.title}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          item.type === 'package'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.type === 'package' ? t.itemPackagePurchase : t.itemDeliveredSession}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                      <span>{item.date}</span>
                      {item.description && (
                        <>
                          <span>•</span>
                          <span>{item.description}</span>
                        </>
                      )}
                    </div>

                    {/* Invoice / Payment notice details */}
                    <div className="text-[11px] pt-0.5">
                      {item.status === 'to_invoice' && (
                        <span className="text-amber-700 font-medium">
                          ⏱️ {t.toInvoiceNotice}
                        </span>
                      )}
                      {item.status === 'invoiced' && (
                        <span className="text-blue-700 font-medium flex items-center gap-1.5 flex-wrap">
                          <span>📄 {t.invoicedNotice}</span>
                          {item.invoiceNumber && (
                            matchingInvoice ? (
                              <button
                                onClick={() => setViewingInvoice(matchingInvoice)}
                                className="font-mono font-bold text-blue-900 bg-blue-100 hover:bg-blue-200 px-1.5 py-0.2 rounded border border-blue-300 transition cursor-pointer flex items-center gap-1"
                                title="Bekijk officiële PDF factuur"
                              >
                                <FileText className="h-3 w-3 text-blue-700" />
                                <span>{item.invoiceNumber} (PDF)</span>
                              </button>
                            ) : (
                              <strong className="font-mono font-bold text-blue-900">
                                ({item.invoiceNumber})
                              </strong>
                            )
                          )}
                        </span>
                      )}
                      {item.status === 'paid' && (
                        <span className="text-emerald-700 font-medium flex items-center gap-1.5 flex-wrap">
                          <span>✓ {t.paidNotice}</span>
                          {item.paidAt && <span>({item.paidAt})</span>}
                          {matchingInvoice && (
                            <button
                              onClick={() => setViewingInvoice(matchingInvoice)}
                              className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-1.5 py-0.2 rounded border border-emerald-300 transition cursor-pointer flex items-center gap-1"
                              title="Bekijk factuur"
                            >
                              <FileText className="h-3 w-3" />
                              <span>{item.invoiceNumber}</span>
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Price & Status Badge */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                  {item.isCoveredByPackage && item.amount === 0 ? (
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-400">€ 0.00</span>
                      <span className="block text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {t.statusCovered}
                      </span>
                    </div>
                  ) : (
                    <span className="text-base font-extrabold text-slate-900">
                      {formatPrice(item.amount)}
                    </span>
                  )}

                  <div>
                    {item.status === 'to_invoice' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 px-2.5 py-0.5 text-[11px] font-bold border border-amber-200">
                        <Clock className="h-3 w-3 text-amber-600" />
                        <span>{t.statusToInvoice}</span>
                      </span>
                    )}
                    {item.status === 'invoiced' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-900 px-2.5 py-0.5 text-[11px] font-bold border border-blue-200">
                        <FileText className="h-3 w-3 text-blue-600" />
                        <span>{t.statusInvoiced}</span>
                      </span>
                    )}
                    {item.status === 'paid' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-900 px-2.5 py-0.5 text-[11px] font-bold border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        <span>{t.statusPaid}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Info banner at bottom */}
      <div className="flex items-start gap-3 rounded-2xl bg-slate-100/80 p-4 text-xs text-slate-600 border border-slate-200">
        <HelpCircle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-slate-800">
            {language === 'nl' ? 'Vragen over je facturen of sessietegoed?' : 'Questions regarding your billing or sessions?'}
          </span>
          <p className="text-slate-500 leading-relaxed">
            {language === 'nl'
              ? 'Bij een strippenkaart of pakket wordt het bedrag van het pakket gefactureerd en worden de individuele sessies automatisch verrekend met je bundeltegoed. Neem gerust contact op via de directe chatlijn met je trainer.'
              : 'For packages, the total bundle price is billed, and individual sessions are credited against your balance. Feel free to contact your trainer via the direct chat tab.'}
          </p>
        </div>
      </div>

      {/* Official PDF Invoice Modal for Client */}
      {viewingInvoice && (
        <InvoicePdfModal
          isOpen={!!viewingInvoice}
          onClose={() => setViewingInvoice(null)}
          invoice={viewingInvoice}
        />
      )}
    </div>
  );
};
