import React, { useState } from 'react';
import { useBooking } from '../../context/BookingContext';
import {
  UserPlus,
  Search,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Share2,
  Edit2,
  Trash2,
  Archive,
  RotateCcw,
  Check,
  Copy,
  Cake,
  FileDown,
  ExternalLink,
  Shield,
  X,
  Plus,
  MessageSquare,
  Link2,
  Sparkles,
  Info,
  Receipt,
  Package as PackageIcon,
  Megaphone,
} from 'lucide-react';
import { isUpcomingBirthday } from '../../utils/dateUtils';
import { Client } from '../../types';
import { MagicLinkModal } from './MagicLinkModal';
import { BulkMessageModal } from './BulkMessageModal';
import { getMagicLinkDetails } from '../../utils/urlUtils';

interface ClientManagementProps {
  onNavigateToChat?: (clientId: string) => void;
  onNavigateToBilling?: (clientId: string) => void;
}

export const ClientManagement: React.FC<ClientManagementProps> = ({
  onNavigateToChat,
  onNavigateToBilling,
}) => {
  const {
    clients,
    activeClients,
    addClient,
    updateClient,
    archiveClient,
    deleteClient,
    exportClientGDPR,
    settings,
    setRole,
    setActiveClientId,
    setSelectedChatClientId,
    getUnreadCountForProvider,
    getBillingItems,
    clientPackages,
    getClientActivePackages,
    packages,
    grantClientPackage,
    formatPrice,
    simulateMagicLink,
    t,
    language,
  } = useBooking();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterArchived, setFilterArchived] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedMagicLinkClient, setSelectedMagicLinkClient] = useState<Client | null>(null);
  const [showExplanationBanner, setShowExplanationBanner] = useState(true);

  // Grant Package modal state
  const [grantModalClient, setGrantModalClient] = useState<Client | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [customSessions, setCustomSessions] = useState<number | string>(10);

  // Bulk selection & messaging state
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [isBulkMessageModalOpen, setIsBulkMessageModalOpen] = useState(false);

  const toggleSelectClient = (clientId: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]
    );
  };

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    postalCode: '',
    city: '',
    country: 'Nederland',
    dateOfBirth: '',
    notes: '',
    customHourlyRate: '',
    customHourlyRateIncludesVat: settings.ratesIncludeVat ?? true,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      postalCode: '',
      city: '',
      country: 'Nederland',
      dateOfBirth: '',
      notes: '',
      customHourlyRate: '',
      customHourlyRateIncludesVat: settings.ratesIncludeVat ?? true,
    });
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address || '',
      postalCode: client.postalCode || '',
      city: client.city || '',
      country: client.country || 'Nederland',
      dateOfBirth: client.dateOfBirth || '',
      notes: client.notes || '',
      customHourlyRate: client.customHourlyRate !== undefined ? String(client.customHourlyRate) : '',
      customHourlyRateIncludesVat:
        client.customHourlyRateIncludesVat ?? (settings.ratesIncludeVat ?? true),
    });
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    addClient({
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone || '',
      address: formData.address,
      postalCode: formData.postalCode,
      city: formData.city,
      country: formData.country,
      dateOfBirth: formData.dateOfBirth || undefined,
      notes: formData.notes,
      customHourlyRate: formData.customHourlyRate ? Number(formData.customHourlyRate) : undefined,
      customHourlyRateIncludesVat: formData.customHourlyRateIncludesVat,
    });

    setIsAddModalOpen(false);
    resetForm();
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    updateClient(editingClient.id, {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      postalCode: formData.postalCode,
      city: formData.city,
      country: formData.country,
      dateOfBirth: formData.dateOfBirth || undefined,
      notes: formData.notes,
      customHourlyRate: formData.customHourlyRate ? Number(formData.customHourlyRate) : undefined,
      customHourlyRateIncludesVat: formData.customHourlyRateIncludesVat,
    });

    setEditingClient(null);
    resetForm();
  };

  const handleCopyMagicLink = (client: Client) => {
    const details = getMagicLinkDetails(
      client.magicToken,
      (client as any).trainerId || (client as any).userId
    );
    const linkToCopy = details.publicSharedUrl;
    navigator.clipboard?.writeText(linkToCopy);
    setCopiedTokenId(client.id);
    setTimeout(() => setCopiedTokenId(null), 2500);
  };

  const handleExportGDPR = (client: Client) => {
    const jsonStr = exportClientGDPR(client.id);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gdpr-data-${client.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenGrantModal = (client: Client) => {
    setGrantModalClient(client);
    if (packages.length > 0) {
      setSelectedPackageId(packages[0].id);
      setCustomSessions(packages[0].sessionCount);
    } else {
      setSelectedPackageId('');
      setCustomSessions(10);
    }
  };

  const handleConfirmGrant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantModalClient || !selectedPackageId) return;
    grantClientPackage(grantModalClient.id, selectedPackageId, Math.max(1, Number(customSessions) || 1));
    setGrantModalClient(null);
  };

  // Filtered clients list
  const displayedClients = clients.filter((c) => {
    const matchesArchived = filterArchived ? c.isArchived : !c.isArchived;
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.city && c.city.toLowerCase().includes(q));
    return matchesArchived && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Actions with Geometric Balance */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {t.tabClients} ({clients.filter((c) => !c.isArchived).length} {t.activeClients.toLowerCase()})
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {t.clientsSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setIsBulkMessageModalOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-xs hover:border-emerald-500 hover:bg-emerald-50/40 transition cursor-pointer"
          >
            <Megaphone className="h-4 w-4 text-emerald-600" />
            <span>
              {selectedClientIds.length > 0
                ? `Bulk Message (${selectedClientIds.length})`
                : 'Bulk Message'}
            </span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4.5 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400 transition cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>{t.addNewClient}</span>
          </button>
        </div>
      </div>

      {/* Bulk Selection Action Bar */}
      {selectedClientIds.length > 0 && (
        <div className="rounded-2xl border border-emerald-300 bg-slate-900 text-white px-4 py-3 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-scale-in">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 font-black text-xs">
              {selectedClientIds.length}
            </span>
            <div>
              <span className="text-xs font-bold block">
                {`${selectedClientIds.length} ${
                      selectedClientIds.length === 1 ? 'client' : 'clients'
                    } selected`}
              </span>
              <span className="text-[11px] text-slate-400">
                {'Send a broadcast chat message (e.g. holiday closure or policy update)'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() =>
                setSelectedClientIds(displayedClients.map((c) => c.id))
              }
              className="rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition cursor-pointer"
            >
              {'Select all'} ({displayedClients.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedClientIds([])}
              className="rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition cursor-pointer"
            >
              {'Clear'}
            </button>
            <button
              type="button"
              onClick={() => setIsBulkMessageModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-1.5 text-xs font-bold text-slate-950 shadow-sm transition cursor-pointer"
            >
              <Megaphone className="h-3.5 w-3.5" />
              <span>
                {'Send Message'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar with Geometric Balance */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3.5 rounded-3xl border border-slate-200/80 bg-white p-3.5 shadow-xl shadow-slate-200/50">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={t.searchClients}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-2 pl-9.5 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => setFilterArchived(false)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              !filterArchived
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.activeClients} ({activeClients.length})
          </button>
          <button
            onClick={() => setFilterArchived(true)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              filterArchived
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.archivedClients} ({clients.filter((c) => c.isArchived).length})
          </button>
        </div>
      </div>

      {/* Magic Link & 403 Information Banner */}
      {showExplanationBanner && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="text-xs space-y-0.5">
              <span className="font-bold text-emerald-950 block">
                {t.magicLinkBannerTitle}
              </span>
              <p className="text-emerald-800 leading-relaxed max-w-3xl">
                {t.magicLinkBannerDesc}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowExplanationBanner(false)}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-bold px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition shrink-0 cursor-pointer"
          >
            {t.gotIt}
          </button>
        </div>
      )}

      {/* Client Cards List with Geometric Balance */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {displayedClients.map((client) => {
          const bdayInfo = isUpcomingBirthday(client.dateOfBirth);
          const clientBillingItems = getBillingItems(client.id);
          const clientUnbilledItems = clientBillingItems.filter((i) => i.status === 'to_invoice' && i.amount > 0);
          const clientUnbilledTotal = clientUnbilledItems.reduce((acc, curr) => acc + curr.amount, 0);

          // Active package & open session status
          const clientActivePackages = getClientActivePackages(client.id);
          const totalRemainingSessions =
            Math.round(
              clientActivePackages.reduce((acc, cp) => acc + cp.remainingSessions, 0) * 100
            ) / 100;
          const isClientSelected = selectedClientIds.includes(client.id);

          return (
            <div
              key={client.id}
              className={`flex flex-col justify-between rounded-3xl border bg-white p-6 shadow-xl shadow-slate-200/50 transition hover:shadow-2xl hover:border-emerald-300 ${
                isClientSelected
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : client.isArchived
                  ? 'border-slate-200 opacity-60 bg-slate-50/40'
                  : 'border-slate-200/80'
              }`}
            >
              <div>
                {/* Header with Name, Status and Birthday alert */}
                <div className="flex items-start justify-between gap-2 mb-3.5">
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSelectClient(client.id)}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition cursor-pointer ${
                        isClientSelected
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                          : 'border-slate-300 bg-slate-50 hover:border-emerald-500'
                      }`}
                      title={
                        'Select client for bulk message'
                      }
                    >
                      {isClientSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900">
                          {client.name}
                        </h3>
                      {client.customHourlyRate && (
                        <span className="rounded-lg bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200" title={'Custom override rate'}>
                          {formatPrice(client.customHourlyRate)}/h{' '}
                          <span className="font-normal opacity-80">
                            ({(client.customHourlyRateIncludesVat ?? settings.ratesIncludeVat ?? true)
                              ? 'incl. VAT'
                              : 'excl. VAT'})
                          </span>
                        </span>
                      )}
                      {totalRemainingSessions > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200"
                          title={
                            `${totalRemainingSessions} open sessions in active package`
                          }
                        >
                          <PackageIcon className="h-3 w-3 text-indigo-600" />
                          <span>
                            {totalRemainingSessions}{' '}
                            {totalRemainingSessions === 1
                              ? 'session open'
                              : 'sessions open'}
                          </span>
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100/70 px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-200"
                          title={'No active package'}
                        >
                          <PackageIcon className="h-3 w-3 text-slate-400" />
                          <span>{'No package'}</span>
                        </span>
                      )}
                    </div>
                      {client.email && (
                        <span className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                          <Mail className="h-3 w-3 text-slate-400" />
                          {client.email}
                        </span>
                      )}
                    </div>
                  </div>

                  {bdayInfo.isSoon && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800" title={'Birthday coming up!'}>
                      <Cake className="h-3 w-3 text-amber-600" />
                      {bdayInfo.daysAway === 0 ? ('Today!') : `${bdayInfo.daysAway}d`}
                    </span>
                  )}
                </div>

                {/* Details list (FR-4.4) */}
                <div className="space-y-2 text-xs text-slate-600 mb-4">
                  {client.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {(client.address || client.city) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        {[client.address, client.city].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  {client.dateOfBirth && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>{t.clientBorn} {client.dateOfBirth}</span>
                    </div>
                  )}
                  {client.notes && (
                    <div className="mt-2.5 rounded-2xl bg-slate-50 p-3 text-xs text-slate-700 border border-slate-100">
                      <span className="font-bold text-slate-800 block text-[11px] mb-0.5">{t.specialNotesLabel}</span>
                      {client.notes}
                    </div>
                  )}

                  {/* Active Packages / Strippenkaart Section */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-lg ${
                            totalRemainingSessions > 0
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          <PackageIcon className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">
                          {'Package & Session Pass'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {totalRemainingSessions > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                            {totalRemainingSessions}{' '}
                            {totalRemainingSessions === 1
                              ? 'session open'
                              : 'sessions open'}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenGrantModal(client)}
                          className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200/70 px-2 py-0.5 rounded-lg transition cursor-pointer"
                          title={'Grant package'}
                        >
                          <Plus className="h-3 w-3" />
                          <span>{'Package'}</span>
                        </button>
                      </div>
                    </div>

                    {clientActivePackages.length > 0 ? (
                      <div className="space-y-2">
                        {clientActivePackages.map((cp) => {
                          const percentRemaining = Math.min(
                            100,
                            Math.max(0, Math.round((cp.remainingSessions / cp.totalSessions) * 100))
                          );
                          const isLow = cp.remainingSessions <= 2;

                          return (
                            <div
                              key={cp.id}
                              className={`rounded-2xl border p-2.5 transition ${
                                isLow
                                  ? 'bg-amber-50/70 border-amber-200/90 text-amber-950'
                                  : 'bg-indigo-50/50 border-indigo-100/90 text-slate-900'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-1 mb-1">
                                <span className="font-bold text-xs text-slate-800 truncate" title={cp.packageName}>
                                  {cp.packageName}
                                </span>
                                <span className="shrink-0 text-xs font-black text-indigo-700 ml-1">
                                  {Number(cp.remainingSessions.toFixed(2))} / {cp.totalSessions} {'left'}
                                </span>
                              </div>

                              {/* Progress bar */}
                              <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden my-1.5">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isLow ? 'bg-amber-500' : 'bg-indigo-600'
                                  }`}
                                  style={{ width: `${percentRemaining}%` }}
                                />
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5 flex-wrap gap-1">
                                <span>
                                  {Number((cp.totalSessions - cp.remainingSessions).toFixed(2))} {'used'} •{' '}
                                  <strong className="text-slate-800 font-semibold">
                                    {Number(cp.remainingSessions.toFixed(2))} {'remaining'}
                                  </strong>
                                </span>
                                {cp.expiresAt ? (
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    {t.expiresOn} {cp.expiresAt}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-emerald-600 font-medium">
                                    {t.noExpiration}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-2.5 text-center text-xs text-slate-500 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-400">
                          {'No active package'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenGrantModal(client)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition underline underline-offset-2 cursor-pointer"
                        >
                          {'+ Grant package'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons & Magic Link sharing */}
              <div className="border-t border-slate-100 pt-3.5 mt-2 space-y-2.5">
                {/* Magic Link Bar with Direct Test & Info */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    {/* Direct Test in App (Recommended for Preview, avoids 403) */}
                    <button
                      onClick={() => simulateMagicLink(client.magicToken)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-[0.98] transition cursor-pointer"
                      title={t.testAsClientTitle}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{t.testAsClient}</span>
                    </button>

                    {/* Open Modal with public share link & 403 explanation */}
                    <button
                      onClick={() => setSelectedMagicLinkClient(client)}
                      className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
                      title={t.viewMagicLinkTitle}
                    >
                      <Link2 className="h-3.5 w-3.5 text-slate-500" />
                      <span className="hidden sm:inline">Link</span>
                    </button>

                    {/* Quick copy link */}
                    <button
                      onClick={() => handleCopyMagicLink(client)}
                      className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
                      title={t.copyPublicShareLinkTitle}
                    >
                      {copiedTokenId === client.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-slate-500" />
                      )}
                    </button>
                  </div>
                  {copiedTokenId === client.id && (
                    <div className="text-[11px] font-bold text-emerald-700 text-center animate-fade-in">
                      {t.publicBookingLinkCopied}
                    </div>
                  )}
                </div>

                {/* Management row: Edit, Archive, GDPR Export, Delete */}
                <div className="flex items-center justify-between text-xs pt-1 text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedChatClientId(client.id);
                        if (onNavigateToChat) {
                          onNavigateToChat(client.id);
                        }
                      }}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 hover:bg-emerald-100 transition cursor-pointer"
                      title={t.chatWithClient}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Chat</span>
                      {getUnreadCountForProvider(client.id) > 0 && (
                        <span className="rounded-full bg-emerald-500 text-white px-1 text-[9px] font-bold">
                          {getUnreadCountForProvider(client.id)}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        if (onNavigateToBilling) {
                          onNavigateToBilling(client.id);
                        }
                      }}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold border transition cursor-pointer ${
                        clientUnbilledTotal > 0
                          ? 'text-amber-800 bg-amber-50 border-amber-300 hover:bg-amber-100 shadow-2xs'
                          : 'text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                      title={
                        `Billing overview for ${client.name}`
                      }
                    >
                      <Receipt className="h-3.5 w-3.5 text-amber-600" />
                      <span>
                        {clientUnbilledTotal > 0
                          ? `${formatPrice(clientUnbilledTotal)}`
                          : t.tabBilling}
                      </span>
                      {clientUnbilledItems.length > 0 && (
                        <span className="rounded-full bg-amber-500 text-white px-1 text-[9px] font-bold">
                          {clientUnbilledItems.length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(client)}
                      className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-900 transition"
                      title={t.edit}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => archiveClient(client.id)}
                      className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-900 transition"
                      title={client.isArchived ? t.restore : t.archive}
                    >
                      {client.isArchived ? (
                        <RotateCcw className="h-3.5 w-3.5" />
                      ) : (
                        <Archive className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleExportGDPR(client)}
                      className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-900 transition"
                      title={t.exportClientGDPR}
                    >
                      <FileDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => setDeleteConfirmId(client.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                    title={t.delete}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {displayedClients.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-200 p-12 text-center text-slate-400 text-sm bg-slate-50/50">
          {t.noClientsFound}
        </div>
      )}

      {/* Add Client Modal (FR-4.1, FR-4.2, FR-4.4) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-emerald-400">
                  <UserPlus className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {t.addNewClient}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.clientName} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={'Sarah Connor'}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t.clientEmail}
                  </label>
                  <input
                    type="email"
                    placeholder="client@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    {t.autoInviteNotice}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t.clientPhone}
                  </label>
                  <input
                    type="tel"
                    placeholder="+31 6 12345678"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.clientAddress}
                </label>
                <input
                  type="text"
                  placeholder={'123 Market Street'}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-emerald-500 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {'Postal Code'}
                  </label>
                  <input
                    type="text"
                    placeholder={'EC1A 1BB'}
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-emerald-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t.clientCity}
                  </label>
                  <input
                    type="text"
                    placeholder={'London'}
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-emerald-500 outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t.clientDOB}
                  </label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-emerald-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t.customRate}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder={`${'Standard'}: ${formatPrice(settings.standardHourlyRate)}`}
                    value={formData.customHourlyRate}
                    onChange={(e) => setFormData({ ...formData, customHourlyRate: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-emerald-500 outline-none transition"
                  />
                  <div className="flex items-center gap-3 mt-1.5">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.customHourlyRateIncludesVat === false}
                        onChange={() =>
                          setFormData({ ...formData, customHourlyRateIncludesVat: false })
                        }
                        className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                      />
                      <span
                        className={`text-[11px] font-bold ${
                          formData.customHourlyRateIncludesVat === false
                            ? 'text-emerald-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {'Excl. VAT'}
                      </span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.customHourlyRateIncludesVat !== false}
                        onChange={() =>
                          setFormData({ ...formData, customHourlyRateIncludesVat: true })
                        }
                        className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                      />
                      <span
                        className={`text-[11px] font-bold ${
                          formData.customHourlyRateIncludesVat !== false
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.clientSpecialNotes}
                </label>
                <textarea
                  rows={3}
                  placeholder={t.clientSpecialNotesPlaceholder}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-emerald-500 outline-none transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 transition"
                >
                  {t.saveAndDispatch}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-emerald-400">
                  <Edit2 className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {t.editClientTitle} {editingClient.name}
                </h3>
              </div>
              <button
                onClick={() => setEditingClient(null)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t.clientName} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-emerald-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t.clientEmail}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-emerald-500 outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t.clientPhone}
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-emerald-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t.customRate}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder={`Standard: ${formatPrice(settings.standardHourlyRate)}`}
                    value={formData.customHourlyRate}
                    onChange={(e) => setFormData({ ...formData, customHourlyRate: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-emerald-500 outline-none transition"
                  />
                  <div className="flex items-center gap-3 mt-1.5">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.customHourlyRateIncludesVat === false}
                        onChange={() =>
                          setFormData({ ...formData, customHourlyRateIncludesVat: false })
                        }
                        className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                      />
                      <span
                        className={`text-[11px] font-bold ${
                          formData.customHourlyRateIncludesVat === false
                            ? 'text-emerald-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {'Excl. VAT'}
                      </span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.customHourlyRateIncludesVat !== false}
                        onChange={() =>
                          setFormData({ ...formData, customHourlyRateIncludesVat: true })
                        }
                        className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                      />
                      <span
                        className={`text-[11px] font-bold ${
                          formData.customHourlyRateIncludesVat !== false
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.clientAddress}
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-emerald-500 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {'Postal Code'}
                  </label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-emerald-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t.clientCity}
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-emerald-500 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.clientDOB}
                </label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-emerald-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.clientSpecialNotes}
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-emerald-500 outline-none transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 transition"
                >
                  {t.saveChanges}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (GDPR FR-8) */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2.5 text-rose-600 mb-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {t.eraseClientData}
              </h3>
            </div>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              {t.deleteClientConfirm}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  deleteClient(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="rounded-xl bg-rose-600 px-4.5 py-2 text-xs font-bold text-white hover:bg-rose-700 transition"
              >
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Magic Link Details & Testing Modal */}
      {selectedMagicLinkClient && (
        <MagicLinkModal
          client={selectedMagicLinkClient}
          isOpen={!!selectedMagicLinkClient}
          onClose={() => setSelectedMagicLinkClient(null)}
        />
      )}

      {/* Grant Package Modal */}
      {grantModalClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 animate-scale-in">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <PackageIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {'Grant Package'}
                  </h3>
                  <p className="text-xs text-slate-500">{grantModalClient.name}</p>
                </div>
              </div>
              <button
                onClick={() => setGrantModalClient(null)}
                className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmGrant} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {'Select Package / Pass'}
                </label>
                <select
                  value={selectedPackageId}
                  onChange={(e) => {
                    const pkgId = e.target.value;
                    setSelectedPackageId(pkgId);
                    const found = packages.find((p) => p.id === pkgId);
                    if (found) {
                      setCustomSessions(found.sessionCount);
                    }
                  }}
                  required
                  className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-indigo-500 outline-none transition font-medium"
                >
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.sessionCount} {'sessions'} • {formatPrice(pkg.price)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {'Number of Open Sessions'}
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={customSessions}
                  onChange={(e) => setCustomSessions(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-indigo-500 outline-none transition font-medium"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  {'Defaults to package sessions, but can be customized.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setGrantModalClient(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{'Grant to Client'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Bulk Message Modal */}
      <BulkMessageModal
        isOpen={isBulkMessageModalOpen}
        onClose={() => setIsBulkMessageModalOpen(false)}
        initialSelectedIds={selectedClientIds}
        onSuccess={() => setSelectedClientIds([])}
      />
    </div>
  );
};
