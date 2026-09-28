import React, { useState } from 'react';
import { useBooking } from '../../context/BookingContext';
import { ServicePackage } from '../../types';
import {
  Package as PackageIcon,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  CreditCard,
  Gift,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Clock,
  UserCheck,
  Infinity,
} from 'lucide-react';

export const PackageManagement: React.FC = () => {
  const {
    packages,
    addPackage,
    updatePackage,
    deletePackage,
    clientPackages,
    getPackageStandardDuration,
    adjustClientPackageBalance,
    grantClientPackage,
    deleteClientPackage,
    activeClients,
    services,
    formatPrice,
    currencySymbol,
    t,
    language,
  } = useBooking();

  // Tab: 'packages' or 'balances'
  const [activeTab, setActiveTab] = useState<'packages' | 'balances'>('packages');

  // Create / Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);

  // Grant to client modal state
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [grantClientId, setGrantClientId] = useState<string>(
    activeClients.length > 0 ? activeClients[0].id : ''
  );
  const [grantPackageId, setGrantPackageId] = useState<string>(
    packages.length > 0 ? packages[0].id : ''
  );
  const [grantCustomSessions, setGrantCustomSessions] = useState<number>(10);
  const [grantSuccessMsg, setGrantSuccessMsg] = useState<string | null>(null);

  // Form state for creating / editing package
  const [formData, setFormData] = useState<Omit<ServicePackage, 'id'>>({
    name: '',
    description: '',
    serviceId: undefined, // undefined means universal
    sessionCount: 10,
    sessionDurationMinutes: 60,
    price: 550,
    originalValue: 650,
    validityDays: 120,
    color: '#10b981',
    isActive: true,
    featured: false,
  });

  const openCreateModal = () => {
    setEditingPackageId(null);
    setFormData({
      name: '',
      description: '',
      serviceId: undefined,
      sessionCount: 10,
      sessionDurationMinutes: 60,
      price: 550,
      originalValue: 650,
      validityDays: 120,
      color: '#10b981',
      isActive: true,
      featured: false,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (pkg: ServicePackage) => {
    setEditingPackageId(pkg.id);
    setFormData({
      name: pkg.name,
      description: pkg.description,
      serviceId: pkg.serviceId,
      sessionCount: pkg.sessionCount,
      sessionDurationMinutes: getPackageStandardDuration(undefined, pkg),
      price: pkg.price,
      originalValue: pkg.originalValue || pkg.price,
      validityDays: pkg.validityDays,
      color: pkg.color || '#10b981',
      isActive: pkg.isActive,
      featured: pkg.featured || false,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingPackageId) {
      updatePackage(editingPackageId, formData);
    } else {
      addPackage(formData);
    }
    setIsModalOpen(false);
  };

  const handleGrantPackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantClientId || !grantPackageId) return;

    grantClientPackage(grantClientId, grantPackageId, Number(grantCustomSessions));
    const client = activeClients.find((c) => c.id === grantClientId);
    const pkg = packages.find((p) => p.id === grantPackageId);
    setGrantSuccessMsg(`Successfully granted ${pkg?.name || 'Bundle'} to ${client?.name || 'client'}!`);
    setTimeout(() => {
      setGrantSuccessMsg(null);
      setIsGrantModalOpen(false);
    }, 2000);
  };

  // Calculate quick metrics
  const totalPackagesSold = clientPackages.length;
  const totalSessionsSold = Math.round(clientPackages.reduce((acc, cp) => acc + cp.totalSessions, 0) * 100) / 100;
  const totalRemainingSessions = Math.round(clientPackages.reduce((acc, cp) => acc + cp.remainingSessions, 0) * 100) / 100;
  const totalPackageRevenue = clientPackages.reduce((acc, cp) => acc + cp.pricePaid, 0);

  return (
    <div className="space-y-6">
      {/* Header with Geometric Balance styling */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {t.packagesTitle}
            </h1>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
              {packages.length} Configured
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            {t.packagesSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsGrantModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:border-slate-400 transition"
          >
            <Gift className="h-4 w-4 text-emerald-600" />
            <span>{t.grantPackage}</span>
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition"
          >
            <Plus className="h-4 w-4" />
            <span>{t.addPackage}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Active Packages Sold</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-bold text-slate-900">{totalPackagesSold}</span>
            <span className="text-xs text-emerald-600 font-medium">bundles</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Credits Remaining in Circulation</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-bold text-emerald-600">{totalRemainingSessions}</span>
            <span className="text-xs text-slate-400 font-normal">/ {totalSessionsSold} total</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Bundle Sales Revenue</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-bold text-slate-900">{formatPrice(totalPackageRevenue)}</span>
            <span className="text-xs text-slate-400 font-normal">upfront</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Redemption Rate</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-bold text-slate-900">
              {totalSessionsSold > 0
                ? `${Math.round(((totalSessionsSold - totalRemainingSessions) / totalSessionsSold) * 100)}%`
                : '0%'}
            </span>
            <span className="text-xs text-emerald-600 font-medium">completed</span>
          </div>
        </div>
      </div>

      {/* Sub-tabs navigation */}
      <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/80 w-fit">
        <button
          onClick={() => setActiveTab('packages')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'packages'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <PackageIcon className="h-3.5 w-3.5" />
          <span>Available Packages ({packages.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('balances')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'balances'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CreditCard className="h-3.5 w-3.5" />
          <span>Client Balances & Redemptions ({clientPackages.length})</span>
        </button>
      </div>

      {/* VIEW 1: Available Packages */}
      {activeTab === 'packages' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {packages.map((pkg) => {
            const linkedService = services.find((s) => s.id === pkg.serviceId);
            const stdDuration = getPackageStandardDuration(undefined, pkg);
            const pricePerSession = pkg.sessionCount > 0 ? pkg.price / pkg.sessionCount : 0;
            const savings =
              pkg.originalValue && pkg.originalValue > pkg.price
                ? Math.round(((pkg.originalValue - pkg.price) / pkg.originalValue) * 100)
                : 0;

            return (
              <div
                key={pkg.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition"
              >
                <div>
                  {/* Top tags */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                        {pkg.sessionCount} {language === 'nl' ? 'Sessies' : 'Sessions'}
                      </span>
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {stdDuration} min / {language === 'nl' ? 'sessie' : 'session'}
                      </span>
                      {pkg.featured && (
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Popular
                        </span>
                      )}
                      {!pkg.isActive && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 border border-slate-200">
                          Inactive
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(pkg)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                        title={t.editPackage}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${pkg.name}"?`)) {
                            deletePackage(pkg.id);
                          }
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                        title={t.deletePackage}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
                    {pkg.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                    {pkg.description || 'No description specified.'}
                  </p>

                  {/* Service & Standard Session Duration Badge */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-slate-400">
                        {language === 'nl' ? 'Standaard sessieduur:' : 'Standard session:'}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                        {stdDuration} min ({language === 'nl' ? '1 sessie' : '1 session credit'})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-slate-400">Applies to:</span>
                      <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                        {linkedService ? linkedService.name : 'Universal (All Services)'}
                      </span>
                    </div>
                  </div>

                  {/* Validity */}
                  <div className="mt-2 text-xs flex items-center gap-1.5 flex-wrap">
                    {pkg.validityDays && pkg.validityDays > 0 ? (
                      <>
                        <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-500">
                          {language === 'nl'
                            ? `${pkg.validityDays} dagen geldig na aankoop`
                            : `Valid for ${pkg.validityDays} days from purchase`}
                        </span>
                      </>
                    ) : (
                      <>
                        <Infinity className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 inline-flex items-center gap-1">
                          {t.noExpiration}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Price & Value box */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-end justify-between">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-slate-900">{formatPrice(pkg.price)}</span>
                      {pkg.originalValue && pkg.originalValue > pkg.price && (
                        <span className="text-xs text-slate-400 line-through">
                          {formatPrice(pkg.originalValue)}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {formatPrice(pricePerSession)} / session
                      {savings > 0 && ` • Save ${savings}%`}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setGrantPackageId(pkg.id);
                      setGrantCustomSessions(pkg.sessionCount);
                      setIsGrantModalOpen(true);
                    }}
                    className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition"
                  >
                    <Gift className="h-3.5 w-3.5" />
                    <span>Grant</span>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Create package prompt card */}
          <button
            onClick={openCreateModal}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-emerald-500 hover:bg-emerald-50/20 transition min-h-[260px]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-3">
              <Plus className="h-6 w-6" />
            </div>
            <span className="text-sm font-bold text-slate-800">Add Another Package</span>
            <span className="text-xs text-slate-400 mt-1 max-w-[220px]">
              Set up special packages (e.g. 10 sessions, 5 sessions, recovery cards)
            </span>
          </button>
        </div>
      )}

      {/* VIEW 2: Client Balances & Redemptions */}
      {activeTab === 'balances' && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Active Client Credits & Subscriptions
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitor remaining sessions, purchase dates, and adjust balances manually when needed.
              </p>
            </div>
            <button
              onClick={() => setIsGrantModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition self-start sm:self-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Grant Sessions</span>
            </button>
          </div>

          {clientPackages.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <CreditCard className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No client packages active yet</p>
              <p className="text-xs text-slate-400 mt-1">
                When clients purchase bundles in their portal or you grant sessions here, they will appear in this ledger.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Client</th>
                    <th className="px-5 py-3">Package</th>
                    <th className="px-5 py-3">Sessions Remaining</th>
                    <th className="px-5 py-3">Purchased</th>
                    <th className="px-5 py-3">Expiration</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Adjust Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clientPackages.map((cp) => {
                    const client = activeClients.find((c) => c.id === cp.clientId);
                    const percentage = Math.round((cp.remainingSessions / cp.totalSessions) * 100);
                    const stdDur = getPackageStandardDuration(cp);

                    return (
                      <tr key={cp.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {client ? client.name : 'Unknown Client'}
                          <span className="block text-[11px] font-normal text-slate-400">
                            {client?.email}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-semibold text-slate-800">{cp.packageName}</span>
                          <span className="block text-[11px] text-slate-400">
                            {formatPrice(cp.pricePaid)} paid • 1 {language === 'nl' ? 'sessie' : 'session'} = {stdDur}m
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  cp.remainingSessions > 3
                                    ? 'bg-emerald-500'
                                    : cp.remainingSessions > 0
                                    ? 'bg-amber-500'
                                    : 'bg-slate-300'
                                }`}
                                style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
                              ></div>
                            </div>
                            <span className="font-bold text-slate-900">
                              {Number(cp.remainingSessions.toFixed(2))} / {cp.totalSessions}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{cp.purchasedAt}</td>
                        <td className="px-5 py-4 text-slate-600">
                          {cp.expiresAt ? cp.expiresAt : 'Never'}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              cp.status === 'active' && cp.remainingSessions > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : cp.status === 'exhausted' || cp.remainingSessions === 0
                                ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                : 'bg-red-50 text-red-600 border border-red-200'
                            }`}
                          >
                            {cp.remainingSessions === 0 ? 'Exhausted' : cp.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => adjustClientPackageBalance(cp.id, -1)}
                              disabled={cp.remainingSessions <= 0}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition"
                              title="Deduct 1 session manually"
                            >
                              -1
                            </button>
                            <button
                              onClick={() => adjustClientPackageBalance(cp.id, -0.5)}
                              disabled={cp.remainingSessions <= 0}
                              className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition"
                              title="Deduct 0.5 session manually"
                            >
                              -0.5
                            </button>
                            <button
                              onClick={() => adjustClientPackageBalance(cp.id, 0.5)}
                              className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                              title="Add 0.5 session credit"
                            >
                              +0.5
                            </button>
                            <button
                              onClick={() => adjustClientPackageBalance(cp.id, 1)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                              title="Add 1 session credit"
                            >
                              +1
                            </button>
                            <button
                              onClick={() => deleteClientPackage(cp.id)}
                              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition"
                              title={language === 'nl' ? 'Pakket verwijderen' : 'Delete client package'}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT PACKAGE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingPackageId ? t.editPackage : t.addPackage}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure pricing, sessions count, and service eligibility.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Package Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 10-Session Strength & Conditioning Pack"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Details on what workouts or programming are included..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.packageSessions} *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={formData.sessionCount}
                    onChange={(e) =>
                      setFormData({ ...formData, sessionCount: parseInt(e.target.value) || 1 })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Package Price ({currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Standard Value <span className="font-normal text-slate-400">(for discount %)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="e.g. 650"
                  value={formData.originalValue || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      originalValue: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-emerald-600" />
                    <span>
                      {language === 'nl'
                        ? 'Standaard sessieduur van dit pakket (minuten) *'
                        : 'Standard Session Duration (minutes) *'}
                    </span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={15}
                    max={480}
                    step={5}
                    required
                    value={formData.sessionDurationMinutes || 60}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sessionDurationMinutes: parseInt(e.target.value) || 60,
                      })
                    }
                    className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                  <div className="flex items-center gap-1 flex-wrap">
                    {[30, 45, 60, 75, 90, 120].map((mins) => (
                      <button
                        type="button"
                        key={mins}
                        onClick={() => setFormData({ ...formData, sessionDurationMinutes: mins })}
                        className={`rounded-lg px-2 py-1 text-[10px] font-semibold border transition cursor-pointer ${
                          (formData.sessionDurationMinutes || 60) === mins
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {mins === 60
                          ? language === 'nl'
                            ? '60m (1 uur)'
                            : '60m (1 hr)'
                          : mins === 90
                          ? language === 'nl'
                            ? '90m (1,5u)'
                            : '90m (1.5h)'
                          : mins === 120
                          ? language === 'nl'
                            ? '120m (2u)'
                            : '120m (2h)'
                          : `${mins}m`}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  {language === 'nl'
                    ? `1 sessie = ${formData.sessionDurationMinutes || 60} min. Bij het plannen van een sessie van ${Math.round((formData.sessionDurationMinutes || 60) / 2)} min wordt 0,5 sessie afgeschreven; bij ${Math.round((formData.sessionDurationMinutes || 60) * 1.5)} min wordt 1,5 sessie afgeschreven.`
                    : `1 session = ${formData.sessionDurationMinutes || 60} min. Booking a ${Math.round((formData.sessionDurationMinutes || 60) / 2)}-min session deducts 0.5 session; booking a ${Math.round((formData.sessionDurationMinutes || 60) * 1.5)}-min session deducts 1.5 sessions.`}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-700">
                    {t.validityDays}
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!formData.validityDays || formData.validityDays === 0}
                      onChange={(e) => {
                        const never = e.target.checked;
                        setFormData({
                          ...formData,
                          validityDays: never ? undefined : 90,
                        });
                      }}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                    />
                    <Infinity className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{t.noExpiration}</span>
                  </label>
                </div>

                {!formData.validityDays || formData.validityDays === 0 ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-2.5 flex items-start gap-2 text-xs text-emerald-900">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">{t.neverExpiresPackage}</span>
                      <p className="text-[11px] text-emerald-700 mt-0.5 leading-snug">
                        {t.neverExpiresHelp}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={3650}
                        placeholder="e.g. 90"
                        value={formData.validityDays || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setFormData({
                            ...formData,
                            validityDays: !isNaN(val) && val > 0 ? val : undefined,
                          });
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                      />
                      <span className="text-xs text-slate-500 shrink-0 font-medium">
                        {language === 'nl' ? 'dagen' : 'days'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {language === 'nl' ? 'Snel kiezen:' : 'Presets:'}
                      </span>
                      {[30, 60, 90, 180, 365].map((days) => (
                        <button
                          type="button"
                          key={days}
                          onClick={() => setFormData({ ...formData, validityDays: days })}
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold border transition cursor-pointer ${
                            formData.validityDays === days
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {days === 365
                            ? language === 'nl'
                              ? '1 jaar (365d)'
                              : '1 year (365d)'
                            : `${days} ${language === 'nl' ? 'dg' : 'd'}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.applicableService}
                </label>
                <select
                  value={formData.serviceId || 'all'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      serviceId: e.target.value === 'all' ? undefined : e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden bg-white"
                >
                  <option value="all">{t.allServicesAllowed}</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.durationMinutes} min)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span>Active & Available for Purchase</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    className="rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span>Featured / Best Value</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition"
                >
                  {editingPackageId ? t.saveChanges : t.addPackage}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GRANT BUNDLE TO CLIENT MODAL */}
      {isGrantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t.grantPackage}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Directly credit a session bundle or complimentary card to a client.
                </p>
              </div>
              <button
                onClick={() => setIsGrantModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {grantSuccessMsg ? (
              <div className="p-6 text-center text-emerald-600">
                <Check className="h-10 w-10 mx-auto mb-2 text-emerald-500" />
                <p className="text-sm font-bold text-slate-900">{grantSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleGrantPackage} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Client *
                  </label>
                  <select
                    required
                    value={grantClientId}
                    onChange={(e) => setGrantClientId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden bg-white"
                  >
                    {activeClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Package *
                  </label>
                  <select
                    required
                    value={grantPackageId}
                    onChange={(e) => {
                      setGrantPackageId(e.target.value);
                      const pkg = packages.find((p) => p.id === e.target.value);
                      if (pkg) setGrantCustomSessions(pkg.sessionCount);
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden bg-white"
                  >
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sessionCount} sessions - {formatPrice(p.price)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Credits to Grant (Sessions)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={grantCustomSessions}
                    onChange={(e) => setGrantCustomSessions(parseInt(e.target.value) || 1)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    The session bundle will be activated immediately on the client's account.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsGrantModalOpen(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition"
                  >
                    Grant Bundle
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
