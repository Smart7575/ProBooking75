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
  Calculator,
  RefreshCw,
} from 'lucide-react';

export const PackageManagement: React.FC = () => {
  const {
    packages,
    addPackage,
    updatePackage,
    deletePackage,
    clientPackages,
    getPackageStandardDuration,
    getPackageRemainingValue,
    getPackageTotalValue,
    adjustClientPackageBalance,
    grantClientPackage,
    deleteClientPackage,
    activeClients,
    services,
    formatPrice,
    currencySymbol,
    t,
    language,
    settings,
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
  const [grantCustomSessions, setGrantCustomSessions] = useState<number | string>(10);
  const [grantSuccessMsg, setGrantSuccessMsg] = useState<string | null>(null);

  // Manual Euro adjustment modal state
  const [adjustModalCp, setAdjustModalCp] = useState<any | null>(null);
  const [adjustEuroAmount, setAdjustEuroAmount] = useState<string>('65');
  const [adjustAction, setAdjustAction] = useState<'deduct' | 'add'>('deduct');

  const isNl = language === 'nl';
  const standardHourlyRate = settings.standardHourlyRate || 65;

  // Calculates standard value: sessionCount * (sessionDurationMinutes / 60) * standardHourlyRate
  const calculateStandardValue = (
    sessions: number | string,
    durationMins: number | string,
    hourlyRate: number = standardHourlyRate
  ): number => {
    const count = Math.max(0, parseInt(String(sessions), 10) || 0);
    const mins = Math.max(0, parseInt(String(durationMins), 10) || 0);
    const durationHours = mins / 60;
    return Math.round(count * durationHours * hourlyRate * 100) / 100;
  };

  // Calculates default package price with 20% discount on standard value
  const calculateDefaultPackagePrice = (standardValue: number): number => {
    return Math.round(standardValue * 0.8 * 100) / 100;
  };

  // Tracks if trainer entered a custom package price differing from 20% discount
  const [isPriceCustom, setIsPriceCustom] = useState<boolean>(false);

  // Form state for creating / editing package
  const [neverExpires, setNeverExpires] = useState<boolean>(false);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    serviceId?: string;
    sessionCount: number | string;
    sessionDurationMinutes: number | string;
    price: number | string;
    originalValue?: number | string;
    validityDays?: number | string;
    color: string;
    isActive: boolean;
    featured: boolean;
  }>({
    name: '',
    description: '',
    serviceId: undefined, // undefined means universal
    sessionCount: 4,
    sessionDurationMinutes: settings.standardSlotDuration || 60,
    price: 0,
    originalValue: 0,
    validityDays: 120,
    color: '#10b981',
    isActive: true,
    featured: false,
  });

  const openCreateModal = () => {
    setEditingPackageId(null);
    setNeverExpires(false);
    setIsPriceCustom(false);
    const initialSessions = 4;
    const initialDuration = settings.standardSlotDuration || 60;
    const initialStdVal = calculateStandardValue(initialSessions, initialDuration, standardHourlyRate);
    const initialPrice = calculateDefaultPackagePrice(initialStdVal);

    setFormData({
      name: '',
      description: '',
      serviceId: undefined,
      sessionCount: initialSessions,
      sessionDurationMinutes: initialDuration,
      price: initialPrice,
      originalValue: initialStdVal,
      validityDays: 120,
      color: '#10b981',
      isActive: true,
      featured: false,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (pkg: ServicePackage) => {
    setEditingPackageId(pkg.id);
    const isUnrestricted = !pkg.validityDays || pkg.validityDays === 0;
    setNeverExpires(isUnrestricted);

    const sessionCount = pkg.sessionCount || 1;
    const sessionDurationMinutes = getPackageStandardDuration(undefined, pkg);
    // Calculated as: sessionCount * (sessionDurationMinutes / 60) * standardHourlyRate
    const calculatedStandardValue = calculateStandardValue(
      sessionCount,
      sessionDurationMinutes,
      standardHourlyRate
    );
    const expectedDiscountPrice = calculateDefaultPackagePrice(calculatedStandardValue);
    const hasCustomPrice = Math.abs(Number(pkg.price) - expectedDiscountPrice) > 0.01;
    setIsPriceCustom(hasCustomPrice);

    setFormData({
      name: pkg.name,
      description: pkg.description,
      serviceId: pkg.serviceId,
      sessionCount: sessionCount,
      sessionDurationMinutes: sessionDurationMinutes,
      price: pkg.price,
      originalValue: calculatedStandardValue,
      validityDays: isUnrestricted ? 90 : pkg.validityDays,
      color: pkg.color || '#10b981',
      isActive: pkg.isActive,
      featured: pkg.featured || false,
    });
    setIsModalOpen(true);
  };

  const handleSessionCountChange = (val: string | number) => {
    const stdVal = calculateStandardValue(val, formData.sessionDurationMinutes, standardHourlyRate);
    setFormData((prev) => ({
      ...prev,
      sessionCount: val,
      originalValue: stdVal,
      price: isPriceCustom ? prev.price : calculateDefaultPackagePrice(stdVal),
    }));
  };

  const handleDurationChange = (val: string | number) => {
    const stdVal = calculateStandardValue(formData.sessionCount, val, standardHourlyRate);
    setFormData((prev) => ({
      ...prev,
      sessionDurationMinutes: val,
      originalValue: stdVal,
      price: isPriceCustom ? prev.price : calculateDefaultPackagePrice(stdVal),
    }));
  };

  const handlePriceChange = (val: string) => {
    const stdVal = Number(formData.originalValue) || 0;
    const expectedDiscountPrice = calculateDefaultPackagePrice(stdVal);
    const numVal = parseFloat(val);
    const isCustom = !isNaN(numVal) && Math.abs(numVal - expectedDiscountPrice) > 0.01;
    setIsPriceCustom(isCustom);
    setFormData((prev) => ({
      ...prev,
      price: val,
    }));
  };

  const applyStandard20Percent = () => {
    const stdVal = Number(formData.originalValue) || 0;
    const discPrice = calculateDefaultPackagePrice(stdVal);
    setIsPriceCustom(false);
    setFormData((prev) => ({
      ...prev,
      price: discPrice,
    }));
  };

  const handleRecalculateStandardValue = () => {
    const stdVal = calculateStandardValue(formData.sessionCount, formData.sessionDurationMinutes, standardHourlyRate);
    setFormData((prev) => ({
      ...prev,
      originalValue: stdVal,
      price: isPriceCustom ? prev.price : calculateDefaultPackagePrice(stdVal),
    }));
  };

  const handleOriginalValueChange = (val: string) => {
    setFormData((prev) => {
      const numVal = parseFloat(val);
      const newStdVal = isNaN(numVal) ? 0 : numVal;
      return {
        ...prev,
        originalValue: val,
        price: isPriceCustom ? prev.price : calculateDefaultPackagePrice(newStdVal),
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const parsedSessions = Math.max(1, parseInt(String(formData.sessionCount), 10) || 1);
    const parsedDuration = Math.max(5, parseInt(String(formData.sessionDurationMinutes), 10) || 60);
    const parsedPrice = Math.max(0, parseFloat(String(formData.price)) || 0);
    const calculatedStd = calculateStandardValue(parsedSessions, parsedDuration, standardHourlyRate);
    const parsedOriginal =
      formData.originalValue !== '' && formData.originalValue !== undefined && !isNaN(parseFloat(String(formData.originalValue)))
        ? parseFloat(String(formData.originalValue))
        : calculatedStd;
    const parsedValidity = neverExpires
      ? undefined
      : Math.max(1, parseInt(String(formData.validityDays), 10) || 90);

    const payload: Omit<ServicePackage, 'id'> = {
      name: formData.name.trim(),
      description: formData.description,
      serviceId: formData.serviceId,
      sessionCount: parsedSessions,
      sessionDurationMinutes: parsedDuration,
      price: parsedPrice,
      originalValue: parsedOriginal !== undefined && !isNaN(parsedOriginal) ? parsedOriginal : calculatedStd,
      validityDays: parsedValidity,
      color: formData.color,
      isActive: formData.isActive,
      featured: formData.featured,
    };

    if (editingPackageId) {
      updatePackage(editingPackageId, payload);
    } else {
      addPackage(payload);
    }
    setIsModalOpen(false);
  };

  const handleGrantPackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantClientId || !grantPackageId) return;

    grantClientPackage(grantClientId, grantPackageId, Math.max(1, Number(grantCustomSessions) || 1));
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
            const stdValue =
              pkg.originalValue && pkg.originalValue > 0
                ? pkg.originalValue
                : calculateStandardValue(pkg.sessionCount, stdDuration, standardHourlyRate);
            const savings =
              stdValue > pkg.price
                ? Math.round(((stdValue - pkg.price) / stdValue) * 100)
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
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-emerald-600" />
                        Value: {formatPrice(stdValue)}
                      </span>
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        ca. {pkg.sessionCount}x ({stdDuration}m)
                      </span>
                      {pkg.featured && (
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200 flex items-center gap-1">
                          Popular
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

                  {/* Service & Standard Value Breakdown */}
                  <div className="mt-4 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[11px] font-medium text-slate-500">
                        Standard Value:
                      </span>
                      <strong className="text-slate-900 font-bold">{formatPrice(stdValue)}</strong>
                    </div>
                    <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[11px] font-medium text-slate-500">
                        Applies to:
                      </span>
                      <span className="text-slate-700 font-semibold text-[11px]">
                        {linkedService ? linkedService.name : 'Universal (All Services)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[11px] font-medium text-slate-500">
                        Session deduction:
                      </span>
                      <span className="text-emerald-700 font-bold text-[11px]">
                        In € per session cost
                      </span>
                    </div>
                  </div>

                  {/* Validity */}
                  <div className="mt-2 text-xs flex items-center gap-1.5 flex-wrap">
                    {pkg.validityDays && pkg.validityDays > 0 ? (
                      <>
                        <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-500">
                          {`Valid for ${pkg.validityDays} days from purchase`}
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
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Package Value
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900">{formatPrice(stdValue)}</span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          Price: {formatPrice(pkg.price)}
                          {savings > 0 && ` (-${savings}%)`}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Session cost in EUR is deducted from this value upon booking.
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
                    <th className="px-5 py-3">Package & Standard Value</th>
                    <th className="px-5 py-3">Remaining Value / Balance (€)</th>
                    <th className="px-5 py-3">Purchased</th>
                    <th className="px-5 py-3">Expiration</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Adjust Balance (€)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clientPackages.map((cp) => {
                    const client = activeClients.find((c) => c.id === cp.clientId);
                    const remVal = getPackageRemainingValue(cp);
                    const totVal = getPackageTotalValue(cp);
                    const percentage = Math.min(100, Math.max(0, Math.round((remVal / (totVal || 1)) * 100)));
                    const isAvailable = remVal > 0 && cp.status === 'active';

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
                          <span className="block text-[11px] text-slate-500 mt-0.5">
                            Standard value: <strong>{formatPrice(totVal)}</strong> • {formatPrice(cp.pricePaid)} paid
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden shrink-0">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  percentage > 25
                                    ? 'bg-emerald-500'
                                    : percentage > 0
                                    ? 'bg-amber-500'
                                    : 'bg-slate-300'
                                }`}
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900">
                                {formatPrice(remVal)}{' '}
                                <span className="font-normal text-[11px] text-slate-400">
                                  / {formatPrice(totVal)}
                                </span>
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {percentage}% value left • deducted per session cost
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{cp.purchasedAt}</td>
                        <td className="px-5 py-4 text-slate-600">
                          {cp.expiresAt ? cp.expiresAt : 'Never'}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              isAvailable
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {isAvailable ? 'Active' : 'Exhausted'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => adjustClientPackageBalance(cp.id, -65)}
                              disabled={remVal <= 0}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
                              title="Deduct €65"
                            >
                              -€65
                            </button>
                            <button
                              onClick={() => adjustClientPackageBalance(cp.id, -30)}
                              disabled={remVal <= 0}
                              className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
                              title="Deduct €30"
                            >
                              -€30
                            </button>
                            <button
                              onClick={() => adjustClientPackageBalance(cp.id, 30)}
                              className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                              title="Add €30"
                            >
                              +€30
                            </button>
                            <button
                              onClick={() => adjustClientPackageBalance(cp.id, 65)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                              title="Add €65"
                            >
                              +€65
                            </button>
                            <button
                              onClick={() => {
                                setAdjustModalCp(cp);
                                setAdjustEuroAmount('65');
                                setAdjustAction('deduct');
                              }}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                              title="Custom euro adjustment"
                            >
                              ± €
                            </button>
                            <button
                              onClick={() => deleteClientPackage(cp.id)}
                              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition cursor-pointer"
                              title={'Delete client package'}
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
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingPackageId ? t.editPackage : t.addPackage}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure package value, session count, and pricing.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
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

              {/* SESSIONS & DURATION CONFIGURATION */}
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      {t.packageSessions} *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      required
                      value={formData.sessionCount}
                      onChange={(e) => handleSessionCountChange(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Standard Session Duration (min) *</span>
                    </label>
                    <input
                      type="number"
                      min={15}
                      max={480}
                      step={5}
                      required
                      value={formData.sessionDurationMinutes}
                      onChange={(e) => handleDurationChange(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Duration Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Presets:
                  </span>
                  {[30, 45, 60, 75, 90, 120].map((mins) => {
                    const isSelected = (Number(formData.sessionDurationMinutes) || 60) === mins;
                    const label =
                      mins === 30
                        ? '30m (0.5h)'
                        : mins === 45
                        ? '45m (0.75h)'
                        : mins === 60
                        ? '60m (1h)'
                        : mins === 90
                        ? '90m (1.5h)'
                        : mins === 120
                        ? '120m (2h)'
                        : `${mins}m`;
                    return (
                      <button
                        type="button"
                        key={mins}
                        onClick={() => handleDurationChange(mins)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* DYNAMIC CALCULATION BREAKDOWN BOX */}
                {(() => {
                  const count = Math.max(0, parseInt(String(formData.sessionCount), 10) || 0);
                  const mins = Math.max(0, parseInt(String(formData.sessionDurationMinutes), 10) || 0);
                  const hours = mins / 60;
                  const hoursFormatted = String(Math.round(hours * 100) / 100);
                  const stdVal = calculateStandardValue(count, mins, standardHourlyRate);
                  const default20Price = calculateDefaultPackagePrice(stdVal);

                  return (
                    <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/70 p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                          <Calculator className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>Standard Value Calculation</span>
                        </span>
                        <span className="text-[11px] font-bold text-emerald-800 bg-white/90 px-2 py-0.5 rounded-md border border-emerald-200/70">
                          {formatPrice(standardHourlyRate)}/hr
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] bg-white/90 rounded-lg px-2.5 py-1.5 border border-emerald-100">
                        <span className="text-slate-600 font-medium">
                          <span className="font-bold text-slate-900">{count}</span> sessions ×{' '}
                          <span className="font-bold text-slate-900">{hoursFormatted} hours</span> ({mins} min) ×{' '}
                          <span className="font-bold text-slate-900">{formatPrice(standardHourlyRate)}</span>
                        </span>
                        <span className="font-bold text-emerald-700 text-xs">
                          = {formatPrice(stdVal)}
                        </span>
                      </div>

                      <div className="text-[11px] text-emerald-800 flex items-center justify-between gap-1 pt-0.5">
                        <span>
                          Standard 20% volume discount:{' '}
                          <strong className="font-bold text-emerald-900">{formatPrice(default20Price)}</strong>
                        </span>
                        {isPriceCustom && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-200">
                            Custom price active
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <p className="text-[11px] text-slate-500 leading-snug">
                  {`1 session = ${Number(formData.sessionDurationMinutes) || 60} min. A booking of ${Math.round((Number(formData.sessionDurationMinutes) || 60) / 2)} min uses 0.5 sessions; a booking of ${Math.round((Number(formData.sessionDurationMinutes) || 60) * 1.5)} min uses 1.5 sessions.`}
                </p>
              </div>

              {/* PRICING FIELDS (STANDARD VALUE & PACKAGE PRICE) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Standard Value */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      Standard Value ({currencySymbol}) *
                    </label>
                    <button
                      type="button"
                      onClick={handleRecalculateStandardValue}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                      title="Recalculate standard value"
                    >
                      <RefreshCw className="h-2.5 w-2.5" />
                      <span>Recalculate</span>
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={formData.originalValue ?? ''}
                    onChange={(e) => handleOriginalValueChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                  <span className="block text-[10px] text-slate-400 mt-1">
                    Sessions × duration × standard rate
                  </span>
                </div>

                {/* Package Price (with trainer override) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      Package Price ({currencySymbol}) *
                    </label>
                    {isPriceCustom ? (
                      <button
                        type="button"
                        onClick={applyStandard20Percent}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                        title="Apply standard 20% discount"
                      >
                        Reset 20%
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        -20% discount
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={formData.price}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    className={`w-full rounded-xl border px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-hidden ${
                      isPriceCustom
                        ? 'border-amber-300 bg-amber-50/30 focus:border-amber-500'
                        : 'border-slate-200 bg-white focus:border-emerald-500'
                    }`}
                  />
                  <div className="mt-1 flex items-center justify-between text-[10px]">
                    {isPriceCustom ? (
                      <span className="text-amber-700 font-semibold flex items-center gap-1">
                        <span>●</span> Custom price by trainer
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium">
                        ✓ 20% discount on standard value
                      </span>
                    )}
                    {(() => {
                      const numPrice = parseFloat(String(formData.price)) || 0;
                      const numOrig = parseFloat(String(formData.originalValue)) || 0;
                      if (numOrig > 0 && numPrice < numOrig) {
                        const disc = Math.round(((numOrig - numPrice) / numOrig) * 100);
                        return <span className="text-slate-500 font-semibold">({disc}% off)</span>;
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-snug bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                💡 Package price is automatically calculated with a 20% discount on the standard value. You can freely enter any custom package price.
              </p>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-700">
                    {t.validityDays}
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={neverExpires}
                      onChange={(e) => {
                        const never = e.target.checked;
                        setNeverExpires(never);
                        if (!never && (!formData.validityDays || Number(formData.validityDays) <= 0)) {
                          setFormData({
                            ...formData,
                            validityDays: 90,
                          });
                        }
                      }}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                    />
                    <Infinity className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{t.noExpiration}</span>
                  </label>
                </div>

                {neverExpires ? (
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
                        value={formData.validityDays ?? ''}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            validityDays: e.target.value,
                          });
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                      />
                      <span className="text-xs text-slate-500 shrink-0 font-medium">
                        {'days'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {'Presets:'}
                      </span>
                      {[30, 60, 90, 180, 365].map((days) => (
                        <button
                          type="button"
                          key={days}
                          onClick={() => setFormData({ ...formData, validityDays: days })}
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold border transition cursor-pointer ${
                            Number(formData.validityDays) === days
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {days === 365
                            ? '1 year (365d)'
                            : `${days} ${'d'}`}
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
                    onChange={(e) => setGrantCustomSessions(e.target.value)}
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

      {/* CUSTOM EURO ADJUSTMENT MODAL */}
      {adjustModalCp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Adjust Package Value
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {adjustModalCp.packageName}
                </p>
              </div>
              <button
                onClick={() => setAdjustModalCp(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Standard Value:</span>
                  <strong className="text-slate-900">{formatPrice(getPackageTotalValue(adjustModalCp))}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Current balance:</span>
                  <strong className="text-emerald-700">{formatPrice(getPackageRemainingValue(adjustModalCp))}</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Action:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustAction('deduct')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs border transition cursor-pointer ${
                      adjustAction === 'deduct'
                        ? 'border-rose-400 bg-rose-50 text-rose-800'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    - Deduct (€)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustAction('add')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs border transition cursor-pointer ${
                      adjustAction === 'add'
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    + Add (€)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount in Euro (€) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={adjustEuroAmount}
                    onChange={(e) => setAdjustEuroAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 pl-8 pr-3.5 py-2 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdjustModalCp(null)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const amt = parseFloat(adjustEuroAmount) || 0;
                    if (amt > 0) {
                      const delta = adjustAction === 'deduct' ? -amt : amt;
                      adjustClientPackageBalance(adjustModalCp.id, delta);
                    }
                    setAdjustModalCp(null);
                  }}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition cursor-pointer"
                >
                  Update Balance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
