import React, { useState, useMemo } from 'react';
import { useBooking } from '../../context/BookingContext';
import { BillingItem, BillingStatus, Invoice } from '../../types';
import { InvoiceArchiveView } from '../invoicing/InvoiceArchiveView';
import { CreateInvoiceModal } from '../invoicing/CreateInvoiceModal';
import { InvoicePdfModal } from '../invoicing/InvoicePdfModal';
import { InvoiceSettingsView } from '../invoicing/InvoiceSettingsView';
import {
  Receipt,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Search,
  ArrowUpDown,
  Download,
  Printer,
  ChevronDown,
  Sparkles,
  Package,
  Calendar,
  AlertCircle,
  ExternalLink,
  Edit2,
  Check,
  X,
  Users,
  Settings,
  Plus,
  Power,
  ShieldCheck,
} from 'lucide-react';

interface BillingManagementProps {
  initialClientId?: string;
  onNavigateToClient?: (clientId: string) => void;
}

export const BillingManagement: React.FC<BillingManagementProps> = ({
  initialClientId,
  onNavigateToClient,
}) => {
  const {
    clients,
    getBillingItems,
    updateBillingItemStatus,
    bulkUpdateBillingStatus,
    invoices,
    invoiceSettings,
    updateInvoiceSettings,
    markInvoicePaid,
    formatPrice,
    t,
    language,
    currencySymbol,
  } = useBooking();

  // Navigation sub-tab: 'unbilled' | 'archive' | 'settings'
  const [subTab, setSubTab] = useState<'unbilled' | 'archive' | 'settings'>('unbilled');

  // Filters for unbilled items
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId || 'all');
  const [statusFilter, setStatusFilter] = useState<'all' | BillingStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'appointment' | 'package'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Invoice creation & PDF view states
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [createInvoiceClientId, setCreateInvoiceClientId] = useState<string | undefined>(undefined);
  const [createInvoicePreselected, setCreateInvoicePreselected] = useState<BillingItem[]>([]);
  const [pdfModalInvoice, setPdfModalInvoice] = useState<Invoice | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);

  // Manual fallback invoice modal states (when module is disabled or for manual quick reference)
  const [invoiceModalItem, setInvoiceModalItem] = useState<BillingItem | null>(null);
  const [batchInvoiceModalOpen, setBatchInvoiceModalOpen] = useState(false);
  const [invoiceNumberInput, setInvoiceNumberInput] = useState('');
  const [invoiceDateInput, setInvoiceDateInput] = useState(() => new Date().toISOString().split('T')[0]);

  // Fetch all items
  const allBillingItems = useMemo(() => {
    return getBillingItems(selectedClientId === 'all' ? undefined : selectedClientId);
  }, [getBillingItems, selectedClientId]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return allBillingItems.filter((item) => {
      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      // Type filter
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesClient = item.clientName.toLowerCase().includes(q);
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q) || false;
        const matchesInv = item.invoiceNumber?.toLowerCase().includes(q) || false;
        if (!matchesClient && !matchesTitle && !matchesDesc && !matchesInv) return false;
      }
      return true;
    });
  }, [allBillingItems, statusFilter, typeFilter, searchQuery]);

  // Calculations for KPI Cards
  const stats = useMemo(() => {
    let toInvoiceCount = 0;
    let toInvoiceTotal = 0;
    let invoicedCount = 0;
    let invoicedTotal = 0;
    let paidCount = 0;
    let paidTotal = 0;

    allBillingItems.forEach((item) => {
      if (item.status === 'to_invoice') {
        toInvoiceCount++;
        toInvoiceTotal += item.amount;
      } else if (item.status === 'invoiced') {
        invoicedCount++;
        invoicedTotal += item.amount;
      } else if (item.status === 'paid') {
        paidCount++;
        paidTotal += item.amount;
      }
    });

    return {
      toInvoiceCount,
      toInvoiceTotal,
      invoicedCount,
      invoicedTotal,
      paidCount,
      paidTotal,
      grandTotal: toInvoiceTotal + invoicedTotal + paidTotal,
    };
  }, [allBillingItems]);

  // Handle select all checkbox
  const handleSelectAll = () => {
    if (selectedItemIds.size === filteredItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredItems.map((item) => item.id)));
    }
    setSelectionNotice(null);
  };

  const toggleSelectItem = (id: string) => {
    const next = new Set(selectedItemIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedItemIds(next);
    setSelectionNotice(null);
  };

  // Generate Official Invoice from Selection
  const handleGenerateInvoiceFromSelected = () => {
    const selectedItems = filteredItems.filter((i) => selectedItemIds.has(i.id));
    if (selectedItems.length === 0) return;

    // Check if all selected items belong to the same client
    const clientIds = new Set(selectedItems.map((i) => i.clientId));
    if (clientIds.size > 1) {
      setSelectionNotice(
        language === 'nl'
          ? 'Je hebt items van meerdere verschillende klanten geselecteerd. Selecteer items van 1 klant om een verzamelfactuur aan te maken (of filter eerst op klant).'
          : 'Selected items belong to multiple clients. Please select items from a single client to generate a collective invoice.'
      );
      return;
    }

    const targetClientId = selectedItems[0].clientId;
    setCreateInvoiceClientId(targetClientId);
    setCreateInvoicePreselected(selectedItems);
    setIsCreateInvoiceOpen(true);
    setSelectionNotice(null);
  };

  // Open single invoice modal (manual fallback)
  const handleOpenInvoiceModal = (item: BillingItem) => {
    if (invoiceSettings.enabled) {
      setCreateInvoiceClientId(item.clientId);
      setCreateInvoicePreselected([item]);
      setIsCreateInvoiceOpen(true);
    } else {
      setInvoiceModalItem(item);
      setInvoiceNumberInput(item.invoiceNumber || `FACT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
      setInvoiceDateInput(item.invoicedAt || new Date().toISOString().split('T')[0]);
    }
  };

  const handleConfirmSingleInvoice = () => {
    if (!invoiceModalItem) return;
    updateBillingItemStatus(invoiceModalItem.type, invoiceModalItem.sourceId, 'invoiced', {
      invoiceNumber: invoiceNumberInput.trim() || undefined,
      invoicedAt: invoiceDateInput,
    });
    setInvoiceModalItem(null);
  };

  // Open batch invoice modal (manual fallback)
  const handleOpenBatchInvoiceModal = () => {
    setInvoiceNumberInput(`FACT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
    setInvoiceDateInput(new Date().toISOString().split('T')[0]);
    setBatchInvoiceModalOpen(true);
  };

  const handleConfirmBatchInvoice = () => {
    const itemsToUpdate = filteredItems
      .filter((item) => selectedItemIds.has(item.id))
      .map((item) => ({ type: item.type, id: item.sourceId }));

    bulkUpdateBillingStatus(itemsToUpdate, 'invoiced', {
      invoiceNumber: invoiceNumberInput.trim() || undefined,
    });
    setBatchInvoiceModalOpen(false);
    setSelectedItemIds(new Set());
  };

  const handleBatchMarkPaid = () => {
    const itemsToUpdate = filteredItems
      .filter((item) => selectedItemIds.has(item.id))
      .map((item) => ({ type: item.type, id: item.sourceId }));

    bulkUpdateBillingStatus(itemsToUpdate, 'paid');
    setSelectedItemIds(new Set());
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      language === 'nl' ? 'Datum' : 'Date',
      language === 'nl' ? 'Klant' : 'Client',
      language === 'nl' ? 'Type' : 'Type',
      language === 'nl' ? 'Omschrijving' : 'Description',
      language === 'nl' ? 'Bedrag' : 'Amount',
      language === 'nl' ? 'Status' : 'Status',
      language === 'nl' ? 'Factuurnummer' : 'Invoice Number',
      language === 'nl' ? 'Factuurdatum' : 'Invoice Date',
      language === 'nl' ? 'Betaaldatum' : 'Payment Date',
    ];

    const rows = filteredItems.map((item) => [
      item.date,
      `"${item.clientName}"`,
      item.type === 'package' ? (language === 'nl' ? 'Pakket' : 'Package') : (language === 'nl' ? 'Sessie' : 'Session'),
      `"${item.title} - ${item.description || ''}"`,
      item.amount.toFixed(2),
      item.status,
      item.invoiceNumber || '',
      item.invoicedAt || '',
      item.paidAt || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `facturatie-overzicht-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  {t.billingTitle}
                </h2>
                {/* Module status badge */}
                <span
                  onClick={() => setSubTab('settings')}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold cursor-pointer transition ${
                    invoiceSettings.enabled
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  title={
                    invoiceSettings.enabled
                      ? (language === 'nl' ? 'Factuurmodule actief - klik voor instellingen' : 'Invoice module active - click for settings')
                      : (language === 'nl' ? 'Factuurmodule uitgeschakeld - klik om in te schakelen' : 'Invoice module disabled - click to enable')
                  }
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      invoiceSettings.enabled ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  ></span>
                  <span>
                    {invoiceSettings.enabled
                      ? (language === 'nl' ? 'Factuurmodule: Actief' : 'Invoicing: Active')
                      : (language === 'nl' ? 'Factuurmodule: Uit' : 'Invoicing: Disabled')}
                  </span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.billingSubtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {invoiceSettings.enabled && (
            <button
              onClick={() => {
                setCreateInvoiceClientId(selectedClientId !== 'all' ? selectedClientId : undefined);
                setCreateInvoicePreselected([]);
                setIsCreateInvoiceOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{t.generateInvoice}</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
            title={t.exportCSV}
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>{t.exportCSV}</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
            title={t.printOverview}
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            <span>{t.printOverview}</span>
          </button>
        </div>
      </div>

      {/* 3 Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px overflow-x-auto">
        {/* Tab 1: Unbilled / Items to be billed */}
        <button
          onClick={() => setSubTab('unbilled')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 cursor-pointer whitespace-nowrap ${
            subTab === 'unbilled'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>{t.tabBillingUnbilled}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              subTab === 'unbilled'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {stats.toInvoiceCount}
          </span>
        </button>

        {/* Tab 2: Invoice Archive & Administration */}
        <button
          onClick={() => setSubTab('archive')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 cursor-pointer whitespace-nowrap ${
            subTab === 'archive'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>{t.tabBillingArchive}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              subTab === 'archive'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {invoices.length}
          </span>
        </button>

        {/* Tab 3: Invoice Settings & Numbering */}
        <button
          onClick={() => setSubTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 cursor-pointer whitespace-nowrap ${
            subTab === 'settings'
              ? 'border-slate-800 text-slate-900'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>{t.tabBillingSettings}</span>
          {!invoiceSettings.enabled && (
            <span className="rounded-full bg-slate-200 text-slate-700 px-1.5 py-0.2 text-[10px]">
              {language === 'nl' ? 'Uit' : 'Off'}
            </span>
          )}
        </button>
      </div>

      {/* Notice Banner if Invoicing Module is Disabled */}
      {!invoiceSettings.enabled && subTab !== 'settings' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-slate-100/90 p-4 border border-slate-200 text-xs text-slate-700">
          <div className="flex items-start gap-2.5">
            <Power className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900">
                {language === 'nl'
                  ? 'Factuurmodule is momenteel uitgeschakeld'
                  : 'Invoicing Module is currently disabled'}
              </span>
              <p className="text-slate-600 mt-0.5">
                {language === 'nl'
                  ? 'Je kunt voltooide sessies en gekochte pakketten hieronder blijven bijhouden en handmatig markeren. Wil je officiële opvolgende factuurnummers en PDF facturen genereren?'
                  : 'You can continue tracking delivered sessions and packages. Would you like to issue sequential official invoices and PDFs?'}
              </p>
            </div>
          </div>
          <button
            onClick={() => updateInvoiceSettings({ enabled: true })}
            className="self-start sm:self-auto shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white transition cursor-pointer shadow-2xs"
          >
            {t.enableInvoicingNow}
          </button>
        </div>
      )}

      {/* SUB-TAB 1: UNBILLED ITEMS & TRACKING */}
      {subTab === 'unbilled' && (
        <div className="space-y-6">
          {/* 3 Summary KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Card 1: Nog te factureren */}
            <div
              onClick={() => setStatusFilter(statusFilter === 'to_invoice' ? 'all' : 'to_invoice')}
              className={`cursor-pointer rounded-2xl border p-4.5 transition-all shadow-xs ${
                statusFilter === 'to_invoice'
                  ? 'border-amber-400 bg-amber-50/70 ring-2 ring-amber-400/30'
                  : 'border-amber-200/80 bg-gradient-to-br from-amber-50/50 to-white hover:border-amber-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-amber-600" />
                  {t.totalToInvoice}
                </span>
                <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-bold">
                  {stats.toInvoiceCount} {t.itemsCount}
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-extrabold text-amber-950">
                  {formatPrice(stats.toInvoiceTotal)}
                </span>
                <span className="text-[11px] font-medium text-amber-700">
                  {language === 'nl' ? 'Nog te verzenden' : 'Awaiting invoice'}
                </span>
              </div>
            </div>

            {/* Card 2: Gefactureerd (in afwachting) */}
            <div
              onClick={() => setStatusFilter(statusFilter === 'invoiced' ? 'all' : 'invoiced')}
              className={`cursor-pointer rounded-2xl border p-4.5 transition-all shadow-xs ${
                statusFilter === 'invoiced'
                  ? 'border-blue-400 bg-blue-50/70 ring-2 ring-blue-400/30'
                  : 'border-blue-200/80 bg-gradient-to-br from-blue-50/50 to-white hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-blue-600" />
                  {t.totalInvoiced}
                </span>
                <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[11px] font-bold">
                  {stats.invoicedCount} {t.itemsCount}
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-extrabold text-blue-950">
                  {formatPrice(stats.invoicedTotal)}
                </span>
                <span className="text-[11px] font-medium text-blue-700">
                  {language === 'nl' ? 'Wacht op betaling' : 'Awaiting payment'}
                </span>
              </div>
            </div>

            {/* Card 3: Voldaan */}
            <div
              onClick={() => setStatusFilter(statusFilter === 'paid' ? 'all' : 'paid')}
              className={`cursor-pointer rounded-2xl border p-4.5 transition-all shadow-xs ${
                statusFilter === 'paid'
                  ? 'border-emerald-400 bg-emerald-50/70 ring-2 ring-emerald-400/30'
                  : 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 to-white hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {t.totalPaid}
                </span>
                <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[11px] font-bold">
                  {stats.paidCount} {t.itemsCount}
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-extrabold text-emerald-950">
                  {formatPrice(stats.paidTotal)}
                </span>
                <span className="text-[11px] font-medium text-emerald-700">
                  {language === 'nl' ? 'Reeds ontvangen' : 'Settled'}
                </span>
              </div>
            </div>
          </div>

          {/* Filter and Search Bar */}
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
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-3 pr-8 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none transition cursor-pointer"
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
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-3 pr-8 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none transition cursor-pointer"
                  >
                    <option value="all">{t.all}</option>
                    <option value="to_invoice">⏱️ {t.statusToInvoice}</option>
                    <option value="invoiced">📄 {t.statusInvoiced}</option>
                    <option value="paid">✓ {t.statusPaid}</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                </div>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  {t.filterByType}
                </label>
                <div className="relative">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as any)}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-3 pr-8 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none transition cursor-pointer"
                  >
                    <option value="all">{t.allTypes}</option>
                    <option value="appointment">{t.sessionsOnly}</option>
                    <option value="package">{t.packagesOnly}</option>
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
                    placeholder={language === 'nl' ? 'Zoek klant, factuurnr, dienst...' : 'Search client, invoice #, service...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-8.5 pr-3 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none transition"
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

            {/* Selection warning if cross-client selected */}
            {selectionNotice && (
              <div className="rounded-xl bg-amber-50 p-2.5 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>{selectionNotice}</span>
                </div>
                <button
                  onClick={() => setSelectionNotice(null)}
                  className="text-amber-700 hover:text-amber-900 p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Batch Action Toolbar when items are selected */}
            {selectedItemIds.size > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 bg-slate-50/80 -mx-4 -mb-4 p-3 rounded-b-2xl">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  <span>
                    {selectedItemIds.size} {t.selectedItems}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Generate Official Invoice with PDF (if enabled) */}
                  {invoiceSettings.enabled && (
                    <button
                      onClick={handleGenerateInvoiceFromSelected}
                      className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 transition cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>{t.generateInvoiceFromSelected}</span>
                    </button>
                  )}

                  {/* Manual Mark as Invoiced */}
                  <button
                    onClick={handleOpenBatchInvoiceModal}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5 text-slate-500" />
                    <span>{t.batchMarkInvoiced}</span>
                  </button>

                  {/* Manual Mark as Paid */}
                  <button
                    onClick={handleBatchMarkPaid}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{t.batchMarkPaid}</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedItemIds(new Set());
                      setSelectionNotice(null);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    {language === 'nl' ? 'Deselecteren' : 'Deselect'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Billing Items Table */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredItems.length > 0 && selectedItemIds.size === filteredItems.length}
                        onChange={handleSelectAll}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3">{t.date}</th>
                    <th className="py-3 px-3">{t.client}</th>
                    <th className="py-3 px-3">{language === 'nl' ? 'Type & Omschrijving' : 'Type & Description'}</th>
                    <th className="py-3 px-3 text-right">{t.price}</th>
                    <th className="py-3 px-3">{t.status}</th>
                    <th className="py-3 px-3">{t.invoiceNumber}</th>
                    <th className="py-3 px-3.5 text-right">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Receipt className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                        <p className="font-medium">{t.noBillingItems}</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {language === 'nl'
                            ? 'Zodra een afspraak voltooid is of een pakket wordt gekocht, verschijnt deze automatisch hier.'
                            : 'Completed appointments and purchased packages will automatically appear here.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isSelected = selectedItemIds.has(item.id);
                      const matchingInvoice = item.invoiceNumber
                        ? invoices.find((inv) => inv.invoiceNumber === item.invoiceNumber)
                        : undefined;

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/80 transition ${
                            isSelected ? 'bg-emerald-50/30' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3.5 px-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectItem(item.id)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                            />
                          </td>

                          {/* Date */}
                          <td className="py-3.5 px-3 whitespace-nowrap font-medium text-slate-800">
                            {item.date}
                          </td>

                          {/* Client */}
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedClientId(item.clientId)}
                                className="font-bold text-slate-900 hover:text-emerald-600 transition text-left cursor-pointer"
                                title={language === 'nl' ? `Filter op ${item.clientName}` : `Filter by ${item.clientName}`}
                              >
                                {item.clientName}
                              </button>
                            </div>
                          </td>

                          {/* Type & Description */}
                          <td className="py-3.5 px-3">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                    item.type === 'package'
                                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                                  }`}
                                >
                                  {item.type === 'package' ? (
                                    <>
                                      <Package className="h-2.5 w-2.5" />
                                      <span>{t.itemPackagePurchase}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Calendar className="h-2.5 w-2.5" />
                                      <span>{t.itemDeliveredSession}</span>
                                    </>
                                  )}
                                </span>
                                <span className="font-semibold text-slate-800">
                                  {item.title}
                                </span>
                              </div>
                              {item.description && (
                                <p className="text-[11px] text-slate-500 line-clamp-1">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Amount */}
                          <td className="py-3.5 px-3 text-right whitespace-nowrap">
                            {item.isCoveredByPackage && item.amount === 0 ? (
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-slate-400">€ 0.00</span>
                                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                                  {t.statusCovered}
                                </span>
                              </div>
                            ) : (
                              <span className="font-black text-slate-900 text-sm">
                                {formatPrice(item.amount)}
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {item.status === 'to_invoice' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 px-2.5 py-1 text-[11px] font-bold border border-amber-200">
                                <Clock className="h-3 w-3 text-amber-600" />
                                <span>{t.statusToInvoice}</span>
                              </span>
                            )}
                            {item.status === 'invoiced' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-900 px-2.5 py-1 text-[11px] font-bold border border-blue-200">
                                <FileText className="h-3 w-3 text-blue-600" />
                                <span>{t.statusInvoiced}</span>
                              </span>
                            )}
                            {item.status === 'paid' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-900 px-2.5 py-1 text-[11px] font-bold border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                <span>{t.statusPaid}</span>
                              </span>
                            )}
                          </td>

                          {/* Invoice Details */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {item.invoiceNumber ? (
                              <div className="space-y-0.5">
                                {matchingInvoice ? (
                                  <button
                                    onClick={() => setPdfModalInvoice(matchingInvoice)}
                                    className="font-mono text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 transition cursor-pointer flex items-center gap-1"
                                    title={language === 'nl' ? 'Bekijk officiële PDF factuur' : 'View official PDF invoice'}
                                  >
                                    <FileText className="h-3 w-3 text-blue-500" />
                                    <span>{item.invoiceNumber}</span>
                                  </button>
                                ) : (
                                  <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 block w-fit">
                                    {item.invoiceNumber}
                                  </span>
                                )}
                                {item.invoicedAt && (
                                  <span className="text-[10px] text-slate-400 block">
                                    {item.invoicedAt}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">
                                —
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Create Invoice / Mark invoiced */}
                              {item.status === 'to_invoice' && (
                                <button
                                  onClick={() => handleOpenInvoiceModal(item)}
                                  className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-blue-700 transition cursor-pointer"
                                  title={invoiceSettings.enabled ? t.generateInvoice : t.markAsInvoiced}
                                >
                                  {invoiceSettings.enabled
                                    ? (language === 'nl' ? 'Factuur maken' : 'Invoice')
                                    : (language === 'nl' ? 'Factureren' : 'Invoice')}
                                </button>
                              )}

                              {item.status === 'invoiced' && (
                                <button
                                  onClick={() =>
                                    updateBillingItemStatus(item.type, item.sourceId, 'paid')
                                  }
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition cursor-pointer"
                                  title={t.markAsPaid}
                                >
                                  {language === 'nl' ? 'Voldaan' : 'Paid'}
                                </button>
                              )}

                              {/* Secondary options dropdown or toggle */}
                              <div className="relative group">
                                <button
                                  className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
                                  title={language === 'nl' ? 'Status wijzigen' : 'Change status'}
                                >
                                  <ArrowUpDown className="h-3 w-3" />
                                </button>
                                <div className="hidden group-hover:block absolute right-0 top-full mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg z-30 text-left">
                                  <button
                                    onClick={() =>
                                      updateBillingItemStatus(item.type, item.sourceId, 'to_invoice')
                                    }
                                    className="w-full text-left px-2.5 py-1.5 text-[11px] font-medium rounded-lg hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                                    <span>{t.revertToUnbilled}</span>
                                  </button>
                                  <button
                                    onClick={() => handleOpenInvoiceModal(item)}
                                    className="w-full text-left px-2.5 py-1.5 text-[11px] font-medium rounded-lg hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                                    <span>{t.markAsInvoiced}...</span>
                                  </button>
                                  <button
                                    onClick={() =>
                                      updateBillingItemStatus(item.type, item.sourceId, 'paid')
                                    }
                                    className="w-full text-left px-2.5 py-1.5 text-[11px] font-medium rounded-lg hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                                    <span>{t.markAsPaid}</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: INVOICE ARCHIVE & ADMINISTRATION */}
      {subTab === 'archive' && (
        <InvoiceArchiveView
          onOpenInvoicePdf={(inv) => setPdfModalInvoice(inv)}
          onCreateNewInvoice={() => {
            setCreateInvoiceClientId(selectedClientId !== 'all' ? selectedClientId : undefined);
            setCreateInvoicePreselected([]);
            setIsCreateInvoiceOpen(true);
          }}
          filterClientId={selectedClientId !== 'all' ? selectedClientId : undefined}
        />
      )}

      {/* SUB-TAB 3: INVOICE SETTINGS & FORMATTING */}
      {subTab === 'settings' && <InvoiceSettingsView />}

      {/* Official Invoice Creation Modal */}
      {isCreateInvoiceOpen && (
        <CreateInvoiceModal
          isOpen={isCreateInvoiceOpen}
          onClose={() => setIsCreateInvoiceOpen(false)}
          initialClientId={createInvoiceClientId}
          preselectedBillingItems={createInvoicePreselected}
          onInvoiceCreated={(newInvoice) => {
            setIsCreateInvoiceOpen(false);
            setSelectedItemIds(new Set());
            // Open PDF preview immediately so trainer can review/download/print!
            setPdfModalInvoice(newInvoice);
          }}
        />
      )}

      {/* Official PDF Invoice View & Print Modal */}
      {pdfModalInvoice && (
        <InvoicePdfModal
          isOpen={!!pdfModalInvoice}
          onClose={() => setPdfModalInvoice(null)}
          invoice={pdfModalInvoice}
          onMarkPaid={(invoiceId) => {
            markInvoicePaid(invoiceId);
            setPdfModalInvoice((prev) => (prev ? { ...prev, status: 'paid' } : null));
          }}
        />
      )}

      {/* Fallback Single Invoice Quick Reference Modal */}
      {invoiceModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 animate-scale-in">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {t.setInvoiceModalTitle}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {invoiceModalItem.clientName} • {formatPrice(invoiceModalItem.amount)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInvoiceModalItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              {t.setInvoiceModalDesc}
            </p>

            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.invoiceNumberLabel}
                </label>
                <input
                  type="text"
                  placeholder={t.invoiceNumberPlaceholder}
                  value={invoiceNumberInput}
                  onChange={(e) => setInvoiceNumberInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.invoiceDate}
                </label>
                <input
                  type="date"
                  value={invoiceDateInput}
                  onChange={(e) => setInvoiceDateInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setInvoiceModalItem(null)}
                className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleConfirmSingleInvoice}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
              >
                {t.confirmInvoice}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fallback Batch Invoice Modal */}
      {batchInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 animate-scale-in">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {t.batchMarkInvoiced}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedItemIds.size} {t.selectedItems}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBatchInvoiceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              {language === 'nl'
                ? 'Voer een factuurnummer in om aan alle geselecteerde posten toe te wijzen (of laat leeg):'
                : 'Enter an invoice reference number for all selected items (or leave empty):'}
            </p>

            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.invoiceNumberLabel}
                </label>
                <input
                  type="text"
                  placeholder={t.invoiceNumberPlaceholder}
                  value={invoiceNumberInput}
                  onChange={(e) => setInvoiceNumberInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.invoiceDate}
                </label>
                <input
                  type="date"
                  value={invoiceDateInput}
                  onChange={(e) => setInvoiceDateInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setBatchInvoiceModalOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleConfirmBatchInvoice}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
              >
                {t.confirmInvoice}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
