import React, { useState } from 'react';
import { useBooking } from '../../context/BookingContext';
import {
  Clock,
  Calendar,
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  Shield,
  Tag,
  Palmtree,
  Settings,
  X,
  Sparkles,
  CalendarRange,
  AlertTriangle,
  UserX,
  Lock,
} from 'lucide-react';
import { auth } from '../../firebase';
import { DaySchedule, ScheduleException, ServiceType, SupportedCurrency } from '../../types';
import { CURRENCY_OPTIONS, getCurrencySymbol, sanitizeCurrencyCode } from '../../utils/currencyUtils';
import { formatFullHumanDate, formatHumanDate, getTodayISO } from '../../utils/dateUtils';
import { AdHocAvailabilityModal } from './AdHocAvailabilityModal';
import { FixedWeeklyScheduleModal } from './FixedWeeklyScheduleModal';

const DAYS_OF_WEEK = [
  { index: 1, label: 'Monday' },
  { index: 2, label: 'Tuesday' },
  { index: 3, label: 'Wednesday' },
  { index: 4, label: 'Thursday' },
  { index: 5, label: 'Friday' },
  { index: 6, label: 'Saturday' },
  { index: 0, label: 'Sunday' },
];

interface AvailabilitySettingsProps {
  onNavigate?: (tab: string) => void;
}

export const AvailabilitySettings: React.FC<AvailabilitySettingsProps> = ({ onNavigate }) => {
  const {
    settings,
    updateSettings,
    services,
    addService,
    updateService,
    deleteService,
    exceptions,
    addException,
    updateException,
    deleteException,
    currency,
    setCurrency,
    currencySymbol,
    formatPrice,
    availabilityMode,
    setAvailabilityMode,
    deleteAdHocBlock,
    deleteTrainerAccount,
    clearDemoData,
    resetDemoData,
    language,
    t,
  } = useBooking();

  // Demo data clear / restore state
  const [isClearDemoModalOpen, setIsClearDemoModalOpen] = useState(false);
  const [isClearingDemo, setIsClearingDemo] = useState(false);
  const [demoActionBanner, setDemoActionBanner] = useState<string | null>(null);

  // Account deletion modal state
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [requiresReauth, setRequiresReauth] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');

  const currentUser = auth.currentUser;
  const hasPasswordProvider =
    currentUser?.providerData?.some((p) => p.providerId === 'password') ?? false;
  const hasGoogleProvider =
    currentUser?.providerData?.some((p) => p.providerId === 'google.com') ?? false;
  const hasAppleProvider =
    currentUser?.providerData?.some((p) => p.providerId === 'apple.com') ?? false;

  const handleOpenDeleteAccountModal = () => {
    setDeleteConfirmText('');
    setDeleteAccountError(null);
    setRequiresReauth(false);
    setReauthPassword('');
    setIsDeleteAccountModalOpen(true);
  };

  const handleConfirmDeleteAccount = async (reauthOptions?: {
    password?: string;
    provider?: 'google' | 'apple';
  }) => {
    setDeleteAccountError(null);
    setIsDeletingAccount(true);
    try {
      await deleteTrainerAccount(reauthOptions);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/requires-recent-login') {
        setRequiresReauth(true);
        setDeleteAccountError(
          language === 'nl'
            ? 'Voor het definitief verwijderen van je account is een recente verificatie vereist. Bevestig hieronder je wachtwoord of inlogprovider om het verwijderen direct af te ronden.'
            : 'Deleting your account requires recent authentication. Please verify your password or sign-in provider below to complete deletion.'
        );
      } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setDeleteAccountError(
          language === 'nl'
            ? 'Ongeldig wachtwoord. Controleer je wachtwoord en probeer het opnieuw.'
            : 'Invalid password. Please check your password and try again.'
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setDeleteAccountError(
          language === 'nl'
            ? 'Het verificatievenster werd gesloten voordat het bevestigen was voltooid.'
            : 'The verification window was closed before confirmation completed.'
        );
      } else {
        setDeleteAccountError(
          err?.message ||
            (language === 'nl'
              ? 'Er is een fout opgetreden bij het verwijderen van je account.'
              : 'An error occurred while deleting your account.')
        );
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // Ad Hoc modal state
  const [isAdHocModalOpen, setIsAdHocModalOpen] = useState(false);
  const [adHocModalDate, setAdHocModalDate] = useState(getTodayISO());
  const [isFixedScheduleModalOpen, setIsFixedScheduleModalOpen] = useState(false);

  // Local state for profile and rates
  const [profileForm, setProfileForm] = useState<{
    name: string;
    profession: string;
    email: string;
    phone: string;
    currency: SupportedCurrency;
    standardHourlyRate: number | string;
    ratesIncludeVat: boolean;
    standardSlotDuration: number;
    bufferMinutes: number;
    cancellationPolicyHours: number | string;
    allowUnrestrictedCancellation: boolean;
  }>({
    name: settings.name,
    profession: settings.profession,
    email: settings.email,
    phone: settings.phone,
    currency: (settings.currency || 'EUR') as SupportedCurrency,
    standardHourlyRate: settings.standardHourlyRate,
    ratesIncludeVat: settings.ratesIncludeVat ?? true,
    standardSlotDuration: settings.standardSlotDuration,
    bufferMinutes: settings.bufferMinutes,
    cancellationPolicyHours: settings.cancellationPolicyHours,
    allowUnrestrictedCancellation: settings.allowUnrestrictedCancellation,
  });

  // Keep in sync when settings change externally (e.g. from navbar currency switch)
  React.useEffect(() => {
    setProfileForm({
      name: settings.name,
      profession: settings.profession,
      email: settings.email,
      phone: settings.phone,
      currency: (settings.currency || 'EUR') as SupportedCurrency,
      standardHourlyRate: settings.standardHourlyRate,
      ratesIncludeVat: settings.ratesIncludeVat ?? true,
      standardSlotDuration: settings.standardSlotDuration,
      bufferMinutes: settings.bufferMinutes,
      cancellationPolicyHours: settings.cancellationPolicyHours,
      allowUnrestrictedCancellation: settings.allowUnrestrictedCancellation,
    });
  }, [settings]);

  const [savedBanner, setSavedBanner] = useState(false);

  // New / Edit exception modal state
  const [isExceptionModalOpen, setIsExceptionModalOpen] = useState(false);
  const [editingExceptionId, setEditingExceptionId] = useState<string | null>(null);
  const [newException, setNewException] = useState<{
    title: string;
    startDate: string;
    endDate: string;
    reason: 'vacation' | 'sick' | 'personal' | 'blocked';
    notes: string;
  }>({
    title: '',
    startDate: '',
    endDate: '',
    reason: 'vacation',
    notes: '',
  });

  // Service modal state
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [serviceForm, setServiceForm] = useState<{
    name: string;
    durationMinutes: number;
    description: string;
    basePrice: number | string;
    color: string;
  }>({
    name: '',
    durationMinutes: 60,
    description: '',
    basePrice: 65,
    color: '#2563eb',
  });

  // Weekly schedule handler
  const handleScheduleToggleDay = (dayIndex: number) => {
    const updated = settings.weeklySchedule.map((d) =>
      d.dayOfWeek === dayIndex ? { ...d, enabled: !d.enabled } : d
    );
    updateSettings({ weeklySchedule: updated });
  };

  const handleScheduleTimeChange = (
    dayIndex: number,
    field: keyof DaySchedule,
    value: string
  ) => {
    const updated = settings.weeklySchedule.map((d) =>
      d.dayOfWeek === dayIndex ? { ...d, [field]: value } : d
    );
    updateSettings({ weeklySchedule: updated });
  };

  // Save General settings
  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedCurrency = sanitizeCurrencyCode(profileForm.currency) || 'EUR';
    updateSettings({
      name: profileForm.name,
      profession: profileForm.profession,
      email: profileForm.email,
      phone: profileForm.phone,
      currency: cleanedCurrency,
      standardHourlyRate: Number(profileForm.standardHourlyRate),
      ratesIncludeVat: profileForm.ratesIncludeVat,
      standardSlotDuration: Number(profileForm.standardSlotDuration),
      bufferMinutes: Number(profileForm.bufferMinutes),
      cancellationPolicyHours: Number(profileForm.cancellationPolicyHours),
      allowUnrestrictedCancellation: profileForm.allowUnrestrictedCancellation,
    });
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 3000);
  };

  // Exception handlers
  const handleOpenAddException = () => {
    setEditingExceptionId(null);
    setNewException({
      title: '',
      startDate: '',
      endDate: '',
      reason: 'vacation',
      notes: '',
    });
    setIsExceptionModalOpen(true);
  };

  const handleOpenEditException = (exc: ScheduleException) => {
    setEditingExceptionId(exc.id);
    setNewException({
      title: exc.title,
      startDate: exc.startDate,
      endDate: exc.endDate,
      reason: exc.reason,
      notes: exc.notes || '',
    });
    setIsExceptionModalOpen(true);
  };

  const handleAddException = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newException.title || !newException.startDate || !newException.endDate) return;

    if (editingExceptionId) {
      updateException(editingExceptionId, newException);
    } else {
      addException(newException);
    }
    setIsExceptionModalOpen(false);
    setEditingExceptionId(null);
    setNewException({
      title: '',
      startDate: '',
      endDate: '',
      reason: 'vacation',
      notes: '',
    });
  };

  // Service handlers
  const handleOpenAddService = () => {
    setEditingService(null);
    setServiceForm({
      name: '',
      durationMinutes: 60,
      description: '',
      basePrice: settings.standardHourlyRate,
      color: '#2563eb',
    });
    setIsServiceModalOpen(true);
  };

  const handleOpenEditService = (service: ServiceType) => {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      durationMinutes: service.durationMinutes,
      description: service.description,
      basePrice: service.basePrice || settings.standardHourlyRate,
      color: service.color,
    });
    setIsServiceModalOpen(true);
  };

  const handleSubmitService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceForm.name) return;

    if (editingService) {
      updateService(editingService.id, {
        name: serviceForm.name,
        durationMinutes: Number(serviceForm.durationMinutes),
        description: serviceForm.description,
        basePrice: Number(serviceForm.basePrice),
        color: serviceForm.color,
      });
    } else {
      addService({
        name: serviceForm.name,
        durationMinutes: Number(serviceForm.durationMinutes),
        description: serviceForm.description,
        basePrice: Number(serviceForm.basePrice),
        color: serviceForm.color,
      });
    }

    setIsServiceModalOpen(false);
  };

  const isNl = language === 'nl';

  return (
    <div className="space-y-6">
      {/* Saved Banner */}
      {savedBanner && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs font-bold text-emerald-900 shadow-xs">
          <Check className="h-4 w-4 text-emerald-600" />
          {isNl
            ? 'Instellingen succesvol opgeslagen! Beschikbaarheid en tijdsloten zijn bijgewerkt.'
            : 'Settings saved successfully! Availability & booking slots are refreshed.'}
        </div>
      )}

      {/* Top Section: Standard Rate & Slot Defaults with Geometric Balance */}
      <form onSubmit={handleSaveGeneral} className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xl shadow-slate-200/50 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {t.providerProfile} & {t.cancellationPolicy}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isNl
                ? 'Stel je standaard uurtarief, buffertijd tussen afspraken en annuleringsregels in.'
                : 'Configure your default hourly tariff, buffer between appointments, and cancellation rules.'}
            </p>
          </div>
          <button
            type="submit"
            className="rounded-xl bg-emerald-500 px-4.5 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400 transition"
          >
            {t.saveChanges}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
          {/* Business Name */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">{t.profileName}</label>
            <input
              type="text"
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              className="w-full rounded-2xl border border-slate-200 p-2.5 text-slate-900 focus:border-emerald-500 outline-none transition"
            />
          </div>

          {/* Profession */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">{t.profession}</label>
            <input
              type="text"
              value={profileForm.profession}
              onChange={(e) => setProfileForm({ ...profileForm, profession: e.target.value })}
              className="w-full rounded-2xl border border-slate-200 p-2.5 text-slate-900 focus:border-emerald-500 outline-none transition"
            />
          </div>

          {/* Currency Selection (EUR, USD, CHF or Custom Letters) */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              {t.currencySetting}
            </label>
            <div className="flex items-center gap-2">
              <select
                value={
                  CURRENCY_OPTIONS.some((opt) => opt.code === profileForm.currency)
                    ? profileForm.currency
                    : 'CUSTOM'
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'CUSTOM') {
                    const customDefault =
                      CURRENCY_OPTIONS.some((opt) => opt.code === profileForm.currency)
                        ? 'GBP'
                        : profileForm.currency || 'GBP';
                    setProfileForm({ ...profileForm, currency: customDefault });
                    setCurrency(customDefault);
                  } else {
                    setProfileForm({ ...profileForm, currency: val });
                    setCurrency(val);
                  }
                }}
                className="flex-1 min-w-0 rounded-2xl border border-slate-200 p-2.5 text-slate-900 focus:border-emerald-500 outline-none transition bg-white font-medium"
              >
                {CURRENCY_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {isNl ? opt.labelNl : opt.labelEn}
                  </option>
                ))}
                <option value="CUSTOM">
                  {isNl ? 'Eigen afkorting (letters)...' : 'Custom abbreviation (letters)...'}
                </option>
              </select>

              <input
                type="text"
                maxLength={6}
                value={profileForm.currency}
                placeholder={isNl ? 'Bijv. GBP' : 'e.g. GBP'}
                title={
                  isNl
                    ? 'Typ een eigen valuta-afkorting met letters (bijv. GBP, SRD, CAD)'
                    : 'Enter a custom currency abbreviation using letters (e.g. GBP, SRD, CAD)'
                }
                onChange={(e) => {
                  const lettersOnly = sanitizeCurrencyCode(e.target.value);
                  setProfileForm({ ...profileForm, currency: lettersOnly });
                  if (lettersOnly) {
                    setCurrency(lettersOnly);
                  }
                }}
                onBlur={() => {
                  if (!profileForm.currency) {
                    setProfileForm({ ...profileForm, currency: 'EUR' });
                    setCurrency('EUR');
                  }
                }}
                className="w-20 shrink-0 rounded-2xl border border-slate-200 p-2.5 text-center font-mono font-bold uppercase text-slate-900 focus:border-emerald-500 outline-none transition"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {isNl ? 'Actief:' : 'Active:'}{' '}
              <strong className="text-emerald-700 font-semibold">
                {profileForm.currency || 'EUR'}
              </strong>{' '}
              ({getCurrencySymbol(profileForm.currency || 'EUR')}) •{' '}
              {isNl ? 'Kies of typ letters' : 'Select or type letters'}
            </p>
          </div>

          {/* Standard Hourly Rate (FR-7.1) */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              {t.standardRate} ({getCurrencySymbol(profileForm.currency || 'EUR')})
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-400 font-semibold text-xs">
                {getCurrencySymbol(profileForm.currency || 'EUR')}
              </span>
              <input
                type="number"
                step="0.5"
                value={profileForm.standardHourlyRate}
                onChange={(e) => setProfileForm({ ...profileForm, standardHourlyRate: e.target.value })}
                className={`w-full rounded-2xl border border-slate-200 p-2.5 text-slate-900 focus:border-emerald-500 outline-none transition ${
                  getCurrencySymbol(profileForm.currency || 'EUR').length > 3
                    ? 'pl-14'
                    : getCurrencySymbol(profileForm.currency || 'EUR').length > 1
                    ? 'pl-11'
                    : 'pl-8'
                }`}
              />
            </div>
            <div className="flex items-center gap-3 mt-2">
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={profileForm.ratesIncludeVat === false}
                  onChange={() => {
                    setProfileForm({ ...profileForm, ratesIncludeVat: false });
                    updateSettings({ ratesIncludeVat: false });
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                />
                <span
                  className={`text-[11px] font-bold ${
                    profileForm.ratesIncludeVat === false ? 'text-emerald-700' : 'text-slate-600'
                  }`}
                >
                  {isNl ? 'Exclusief BTW' : 'Excl. VAT'}
                </span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={profileForm.ratesIncludeVat !== false}
                  onChange={() => {
                    setProfileForm({ ...profileForm, ratesIncludeVat: true });
                    updateSettings({ ratesIncludeVat: true });
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                />
                <span
                  className={`text-[11px] font-bold ${
                    profileForm.ratesIncludeVat !== false ? 'text-emerald-700' : 'text-slate-600'
                  }`}
                >
                  {isNl ? 'Inclusief BTW' : 'Incl. VAT'}
                </span>
              </label>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {isNl
                ? profileForm.ratesIncludeVat === false
                  ? 'BTW wordt op de factuur bovenop dit uurtarief berekend.'
                  : 'BTW zit al inbegrepen in dit uurtarief op de factuur.'
                : profileForm.ratesIncludeVat === false
                ? 'VAT is added on top of this hourly rate on invoices.'
                : 'VAT is already included in this hourly rate on invoices.'}
            </p>
          </div>

          {/* Standard Slot Duration */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              {isNl ? 'Standaard Tijdsblokduur (Sessieduur)' : 'Standard Slot Duration (Session Length)'}
            </label>
            <select
              value={profileForm.standardSlotDuration}
              onChange={(e) => setProfileForm({ ...profileForm, standardSlotDuration: Number(e.target.value) })}
              className="w-full rounded-2xl border border-slate-200 p-2.5 text-slate-900 focus:border-emerald-500 outline-none transition bg-white"
            >
              <option value="15">{isNl ? '15 minuten' : '15 minutes'}</option>
              <option value="30">{isNl ? '30 minuten' : '30 minutes'}</option>
              <option value="45">{isNl ? '45 minuten' : '45 minutes'}</option>
              <option value="60">{isNl ? '60 minuten (1 uur - standaard)' : '60 minutes (1 hour - default)'}</option>
              <option value="75">{isNl ? '75 minuten (1u 15m)' : '75 minutes (1h 15m)'}</option>
              <option value="90">{isNl ? '90 minuten (1,5 uur)' : '90 minutes (1.5 hours)'}</option>
              <option value="120">{isNl ? '120 minuten (2 uur)' : '120 minutes (2 hours)'}</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              {isNl
                ? 'Bepaalt hoe lang een standaard boekbaar tijdsblok duurt.'
                : 'Determines the length of a standard bookable time slot.'}
            </p>
          </div>

          {/* Buffer Time (FR-1.4) */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              {isNl ? 'Tussenruimte / Buffertijd tussen blokken' : 'Buffer Time Between Slots'}
            </label>
            <select
              value={profileForm.bufferMinutes}
              onChange={(e) => setProfileForm({ ...profileForm, bufferMinutes: Number(e.target.value) })}
              className="w-full rounded-2xl border border-slate-200 p-2.5 text-slate-900 focus:border-emerald-500 outline-none transition bg-white"
            >
              <option value="0">{isNl ? '0 minuten (geen tussentijd)' : '0 minutes (no buffer)'}</option>
              <option value="5">{isNl ? '5 minuten' : '5 minutes'}</option>
              <option value="10">{isNl ? '10 minuten' : '10 minutes'}</option>
              <option value="15">{isNl ? '15 minuten (aanbevolen)' : '15 minutes (recommended)'}</option>
              <option value="20">{isNl ? '20 minuten' : '20 minutes'}</option>
              <option value="30">{isNl ? '30 minuten' : '30 minutes'}</option>
              <option value="45">{isNl ? '45 minuten' : '45 minutes'}</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              {isNl
                ? 'Rust- of reistijd die automatisch tussen afzonderlijke blokken wordt vrijgehouden.'
                : 'Rest or travel time automatically reserved between consecutive slots.'}
            </p>
          </div>
        </div>

        {/* Cancellation Rules (FR-6.2 & FR-6.3) */}
        <div className="rounded-2xl bg-slate-50/80 p-4 sm:p-5 border border-slate-200/80 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-600" />
            <h4 className="text-xs font-bold text-slate-900">{t.cancellationPolicy}</h4>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-xs">
            <div className="flex-1">
              <label className="block font-semibold text-slate-700 mb-1.5">
                {t.cancellationWindow}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  disabled={profileForm.allowUnrestrictedCancellation}
                  value={profileForm.cancellationPolicyHours}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      cancellationPolicyHours: e.target.value,
                    })
                  }
                  className="w-28 rounded-xl border border-slate-200 p-2 text-slate-900 bg-white focus:border-emerald-500 outline-none disabled:bg-slate-100 disabled:text-slate-400 transition"
                />
                <span className="text-slate-500 font-medium">
                  {isNl ? 'uur vóór aanvang van de afspraak' : 'hours before appointment start'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {t.cancellationWindowHelp}
              </p>
            </div>

            <div className="sm:border-l sm:border-slate-200 sm:pl-5">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profileForm.allowUnrestrictedCancellation}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      allowUnrestrictedCancellation: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                />
                <span className="font-bold text-slate-800">
                  {t.unrestrictedCancel}
                </span>
              </label>
              <p className="text-[11px] text-slate-400 mt-1">
                {isNl
                  ? 'Indien ingeschakeld kunnen cliënten op elk moment zonder tijdslimiet annuleren.'
                  : 'When enabled, clients can cancel anytime without restriction (FR-6.3).'}
              </p>
            </div>
          </div>
        </div>
      </form>

      {/* Availability Planning Section (Default Ad Hoc + Fixed Weekly Schedule Date Range Popup) */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xl shadow-slate-200/50 space-y-5">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900">
            {t.availabilityStrategy}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {isNl
              ? 'Standaard werkt je agenda met flexibele Ad Hoc Planning. Wil je een vast weekrooster hanteren voor een bepaalde periode? Klik dan op Vast Weekrooster (Fixed Schedule) om de exacte start- en einddatum te kiezen.'
              : 'By default, your calendar uses flexible Ad Hoc Planning. Want to apply a recurring weekly schedule for a specific period? Click Fixed Weekly Schedule to choose the exact start and end dates.'}
          </p>
        </div>

        {/* Strategy Cards: Standard Ad Hoc + Fixed Weekly Schedule Popup Trigger */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Card 1: Ad Hoc Planning (Always Default Active) */}
          <div className="rounded-2xl border border-emerald-500 bg-emerald-50/40 p-4.5 shadow-sm ring-1 ring-emerald-500 flex flex-col justify-between">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl font-bold bg-emerald-500 text-white shadow-xs">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {t.adhocScheduleMode || 'Ad Hoc Planning'}
                  </h4>
                  <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                    {isNl ? 'Standaard Actief' : 'Default Active'}
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white">
                <Check className="h-3 w-3" /> {isNl ? 'Standaard' : 'Default'}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {isNl
                ? 'Je plant en wijzigt je werktijden direct op de kalender per dag of tijdvak.'
                : 'Schedule and adjust your working hours directly on the calendar by date or time block.'}
            </p>
          </div>

          {/* Card 2: Fixed Weekly Schedule (Opens Date-Range Popup) */}
          <div
            onClick={() => setIsFixedScheduleModalOpen(true)}
            className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-emerald-50/40 hover:border-emerald-400 p-4.5 transition flex flex-col justify-between group"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl font-bold bg-slate-900 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition shadow-xs">
                  <CalendarRange className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {t.weeklyScheduleMode || (isNl ? 'Vast Weekrooster (Fixed Schedule)' : 'Fixed Weekly Schedule')}
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {isNl ? 'Kies startdatum t/m einddatum' : 'Select start date to end date'}
                  </span>
                </div>
              </div>
              <span className="rounded-xl bg-slate-900 group-hover:bg-emerald-600 text-white px-3 py-1 text-[11px] font-bold transition shadow-2xs">
                {isNl ? 'Periode Kiezen →' : 'Select Range →'}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {isNl
                ? 'Klik hier om in een popupscherm aan te geven vanaf welke startdatum tot en met welke einddatum je jouw vaste weekrooster wilt toepassen.'
                : 'Click here to open a modal and select the exact start date and end date for applying your recurring weekly schedule.'}
            </p>
          </div>
        </div>

        {/* Ad Hoc Planning Overview */}
        <div className="pt-3 border-t border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shrink-0 shadow-xs">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-950">
                  {isNl ? 'Ad Hoc Planning is standaard actief' : 'Ad Hoc Planning is active by default'}
                </h4>
                <p className="text-xs text-emerald-800 mt-0.5">
                  {isNl
                    ? 'Je kunt je beschikbaarheid direct op de kalender aanpassen of met één klik een vast weekrooster uitrollen over een gekozen periode.'
                    : 'Adjust your availability directly on the calendar or roll out a fixed weekly schedule across a selected period with one click.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsFixedScheduleModalOpen(true)}
                className="rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100 shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <CalendarRange className="h-3.5 w-3.5 text-emerald-600" />
                {isNl ? 'Vast Weekrooster (Periode)' : 'Fixed Schedule (Date Range)'}
              </button>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('calendar')}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 shadow-xs transition flex items-center gap-1.5"
                >
                  <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                  {isNl ? 'Open Kalender' : 'Open Calendar'}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setAdHocModalDate(getTodayISO());
                  setIsAdHocModalOpen(true);
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-xs transition flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                {isNl ? 'Datum Toevoegen' : 'Add Date'}
              </button>
            </div>
          </div>

          {/* Configured Ad Hoc Dates Overview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {isNl
                  ? `Ingeplande Dagen & Werktijden (${settings.adHocSchedule?.length || 0})`
                  : `Scheduled Days & Working Hours (${settings.adHocSchedule?.length || 0})`}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setAdHocModalDate(getTodayISO());
                  setIsAdHocModalOpen(true);
                }}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition"
              >
                {isNl ? '+ Nieuwe datum plannen' : '+ Schedule new date'}
              </button>
            </div>

            {(!settings.adHocSchedule || settings.adHocSchedule.length === 0) ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                <p className="text-xs font-semibold text-slate-500">
                  {isNl
                    ? 'Er zijn nog geen ad hoc werkdagen ingevoerd.'
                    : 'No ad hoc working days have been scheduled yet.'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isNl
                    ? "Open de kalender, klik op 'Datum Toevoegen' of pas een Vast Weekrooster toe voor een periode."
                    : "Open the calendar, click 'Add Date', or apply a Fixed Weekly Schedule for a date range."}
                </p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdHocModalDate(getTodayISO());
                      setIsAdHocModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {isNl ? 'Vandaag Inplannen (08:30 - 17:30)' : 'Schedule Today (08:30 - 17:30)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFixedScheduleModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50 transition shadow-2xs"
                  >
                    <CalendarRange className="h-3.5 w-3.5 text-emerald-600" />
                    {isNl ? 'Vast Weekrooster Toepassen' : 'Apply Fixed Weekly Schedule'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...settings.adHocSchedule]
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((block) => (
                    <div
                      key={block.id}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-xs transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          {formatHumanDate(block.date)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setAdHocModalDate(block.date);
                              setIsAdHocModalOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-emerald-600 transition"
                            title={isNl ? 'Bewerken' : 'Edit'}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAdHocBlock(block.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition"
                            title={isNl ? 'Verwijderen' : 'Delete'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-100">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-emerald-600" />
                          {block.startTime} - {block.endTime}
                        </span>
                        {block.breakStart && (
                          <span className="text-[10px] text-slate-500 font-normal">
                            {isNl ? 'Pauze:' : 'Break:'} {block.breakStart}-{block.breakEnd}
                          </span>
                        )}
                      </div>

                      {block.notes && (
                        <div className="text-[10px] text-slate-400 italic truncate">
                          {block.notes}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Services Configuration (FR-2.2) with Geometric Balance */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xl shadow-slate-200/50 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              {t.servicesTitle}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isNl
                ? 'Definieer diensttypes met eigen duur en automatische tijdsblok-indeling.'
                : 'Define service types with distinct durations and automatic slot subdividing (FR-2.2 & FR-2.3).'}
            </p>
          </div>
          <button
            onClick={handleOpenAddService}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400 transition"
          >
            <Plus className="h-4 w-4" />
            <span>{t.addService}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {services.map((srv) => (
            <div
              key={srv.id}
              className="flex items-start justify-between rounded-2xl border border-slate-200/80 p-4.5 bg-slate-50/40 hover:bg-white hover:shadow-md hover:border-emerald-200 transition"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: srv.color }}
                  ></span>
                  <h4 className="text-sm font-bold text-slate-900">{srv.name}</h4>
                  <span className="rounded-lg bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                    {srv.durationMinutes} min
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{srv.description}</p>
                <div className="text-xs font-bold text-slate-800 pt-0.5">
                  {isNl ? 'Standaardtarief:' : 'Default Fee:'} {formatPrice(srv.basePrice || settings.standardHourlyRate)}
                </div>
              </div>

              <div className="flex items-center gap-1 text-slate-400">
                <button
                  onClick={() => handleOpenEditService(srv)}
                  className="p-1.5 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteService(srv.id)}
                  className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Date Exceptions & Blocked Periods (FR-1.3) with Geometric Balance */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xl shadow-slate-200/50 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              {t.exceptionsTitle}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isNl
                ? 'Blokkeer kalenderdagen voor vakantie, bijscholing of ziekte. Op deze dagen worden geen boekbare tijdsloten gegenereerd.'
                : 'Block calendar dates for vacations, training workshops, or sickness. No slots will be generated on these days.'}
            </p>
          </div>
          <button
            onClick={handleOpenAddException}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-xs"
          >
            <Palmtree className="h-4 w-4 text-amber-600" />
            <span>{t.addException}</span>
          </button>
        </div>

        {exceptions.length === 0 ? (
          <p className="text-xs text-slate-400 py-3">
            {isNl ? 'Geen geblokkeerde datums of vakanties ingesteld.' : 'No blocked date exceptions configured.'}
          </p>
        ) : (
          <div className="space-y-2.5">
            {exceptions.map((exc) => (
              <div
                key={exc.id}
                className="flex items-center justify-between rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3.5 text-xs text-amber-950 shadow-2xs"
              >
                <div>
                  <div className="font-bold text-sm">{exc.title}</div>
                  <div className="text-amber-800 mt-0.5">
                    {exc.startDate} {isNl ? 't/m' : 'to'} {exc.endDate} • {isNl ? 'Reden:' : 'Reason:'}{' '}
                    <span className="font-semibold">{exc.reason.toUpperCase()}</span>
                    {exc.notes && ` (${exc.notes})`}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEditException(exc)}
                    className="text-amber-700 hover:text-slate-900 p-1.5 rounded-lg hover:bg-amber-100 transition"
                    title={isNl ? 'Uitzondering bewerken' : 'Edit exception'}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteException(exc.id)}
                    className="text-amber-700 hover:text-rose-600 p-1.5 rounded-lg hover:bg-amber-100 transition"
                    title={isNl ? 'Uitzondering verwijderen' : 'Remove exception'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Exception Modal */}
      {isExceptionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-amber-400">
                  <Palmtree className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingExceptionId
                    ? isNl
                      ? 'Blokkade / Vakantie Bewerken'
                      : 'Edit Exception / Holiday'
                    : t.addException}
                </h3>
              </div>
              <button
                onClick={() => setIsExceptionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddException} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  {isNl ? 'Titel / Omschrijving' : 'Title / Description'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isNl ? 'bijv. Zomervakantie, Bijscholing' : 'e.g., Summer Holiday, Coaching Seminar'}
                  value={newException.title}
                  onChange={(e) => setNewException({ ...newException, title: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 p-2.5 text-slate-900 focus:border-emerald-500 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    {isNl ? 'Startdatum' : 'Start Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={newException.startDate}
                    onChange={(e) => setNewException({ ...newException, startDate: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-2.5 text-slate-900 focus:border-emerald-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    {isNl ? 'Einddatum' : 'End Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={newException.endDate}
                    onChange={(e) => setNewException({ ...newException, endDate: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-2.5 text-slate-900 focus:border-emerald-500 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">{t.exceptionReason}</label>
                <select
                  value={newException.reason}
                  onChange={(e) =>
                    setNewException({
                      ...newException,
                      reason: e.target.value as any,
                    })
                  }
                  className="w-full rounded-2xl border border-slate-200 p-2.5 text-slate-900 focus:border-emerald-500 outline-none transition bg-white"
                >
                  <option value="vacation">{isNl ? 'Vakantie / Verlof' : 'Vacation / Holiday'}</option>
                  <option value="sick">{isNl ? 'Ziekteverlof' : 'Sick leave'}</option>
                  <option value="personal">{isNl ? 'Persoonlijk vrij' : 'Personal time off'}</option>
                  <option value="blocked">{isNl ? 'Eenmalige blokkade' : 'One-off Blocked'}</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExceptionModalOpen(false)}
                  className="rounded-xl px-3.5 py-2 text-slate-600 hover:bg-slate-100 transition font-semibold"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4.5 py-2 font-bold text-white hover:bg-emerald-500 transition shadow-xs"
                >
                  {isNl ? 'Datums Blokkeren' : 'Block Dates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Service Modal */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-emerald-400">
                  <Tag className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingService ? (isNl ? 'Dienst Bewerken' : 'Edit Service') : t.addService}
                </h3>
              </div>
              <button
                onClick={() => setIsServiceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitService} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  {isNl ? 'Naam van Dienst' : 'Service Name'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isNl ? 'bijv. Intake — 90 min' : 'e.g., Intake — 90 min'}
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 p-2.5 text-slate-900 focus:border-emerald-500 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    {isNl ? 'Duur (Minuten)' : 'Duration (Minutes)'}
                  </label>
                  <select
                    value={serviceForm.durationMinutes}
                    onChange={(e) =>
                      setServiceForm({ ...serviceForm, durationMinutes: Number(e.target.value) })
                    }
                    className="w-full rounded-2xl border border-slate-200 p-2.5 text-slate-900 focus:border-emerald-500 outline-none transition bg-white"
                  >
                    <option value="30">30 min (Express)</option>
                    <option value="45">45 min</option>
                    <option value="60">{isNl ? '60 min (Standaard)' : '60 min (Standard)'}</option>
                    <option value="75">75 min</option>
                    <option value="90">{isNl ? '90 min (Intake/Uitgebreid)' : '90 min (Intake/Extended)'}</option>
                    <option value="120">120 min</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    {isNl ? `Basisprijs (${currencySymbol})` : `Base Price (${currencySymbol})`}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={serviceForm.basePrice}
                    onChange={(e) => setServiceForm({ ...serviceForm, basePrice: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-2.5 text-slate-900 focus:border-emerald-500 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  {isNl ? 'Omschrijving' : 'Description'}
                </label>
                <textarea
                  rows={2}
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 p-2.5 text-slate-900 focus:border-emerald-500 outline-none transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsServiceModalOpen(false)}
                  className="rounded-xl px-3.5 py-2 text-slate-600 hover:bg-slate-100 transition font-semibold"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4.5 py-2 font-bold text-white hover:bg-emerald-500 transition shadow-xs"
                >
                  {isNl ? 'Dienst Opslaan' : 'Save Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ad Hoc Availability Management Modal */}
      <AdHocAvailabilityModal
        isOpen={isAdHocModalOpen}
        onClose={() => setIsAdHocModalOpen(false)}
        initialDateStr={adHocModalDate}
      />

      {/* Fixed Weekly Schedule Date Range Popup Modal */}
      <FixedWeeklyScheduleModal
        isOpen={isFixedScheduleModalOpen}
        onClose={() => setIsFixedScheduleModalOpen(false)}
      />

      {/* Demo Data & Clean App Section */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xl shadow-slate-200/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-emerald-400 shadow-xs">
                <Sparkles className="h-4 w-4" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {isNl
                  ? 'Demodata Wissen & Schone App'
                  : 'Clear Demo Data & Start with a Clean App'}
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
              {isNl
                ? 'Nieuwe accounts starten standaard met voorbeeldgegevens (democliënten, voorbeeldafspraken, pakketten, berichten, facturen en werktijden). Wil je alle demodata wissen en met een volledig lege, schone app beginnen? Je eigen trainerprofiel en inlogaccount blijven behouden.'
                : 'New accounts start with sample data by default (demo clients, sample appointments, packages, messages, invoices, and working hours). Want to wipe all demo data and start with a completely empty, clean app? Your own trainer profile and login account will be kept.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                resetDemoData();
                setDemoActionBanner(
                  isNl
                    ? 'Voorbeeldgegevens (demodata) zijn opnieuw ingeladen.'
                    : 'Sample demo data has been restored.'
                );
                setTimeout(() => setDemoActionBanner(null), 4000);
              }}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              {isNl ? 'Demodata Herstellen' : 'Restore Demo Data'}
            </button>

            <button
              type="button"
              onClick={() => setIsClearDemoModalOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition cursor-pointer"
            >
              <Trash2 className="h-4 w-4 text-emerald-400" />
              <span>
                {isNl ? 'Demodata Wissen (Schone App)' : 'Clear Demo Data (Clean App)'}
              </span>
            </button>
          </div>
        </div>

        {demoActionBanner && (
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-900">
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{demoActionBanner}</span>
          </div>
        )}
      </div>

      {/* Clear Demo Data Confirmation Modal */}
      {isClearDemoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {isNl
                      ? 'Demodata Wissen & Schoon Beginnen?'
                      : 'Clear Demo Data & Start Clean?'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isNl
                      ? 'Je eigen trainerprofiel blijft behouden'
                      : 'Your trainer profile will be preserved'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isClearingDemo}
                onClick={() => setIsClearDemoModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              {isNl
                ? 'Alle voorbeeldcliënten (zoals Linda de Vries en Mark Jansen), afspraken, pakketten, chatberichten, facturen, werktijden en uitzonderingen worden gewist uit de app en uit Firestore zodat je met een schone lei kunt starten.'
                : 'All sample clients (such as Linda de Vries and Mark Jansen), appointments, packages, chat messages, invoices, working hours, and exceptions will be cleared from the app and Firestore so you can start with a clean slate.'}
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isClearingDemo}
                onClick={() => setIsClearDemoModalOpen(false)}
                className="rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={isClearingDemo}
                onClick={async () => {
                  setIsClearingDemo(true);
                  try {
                    await clearDemoData();
                    setIsClearDemoModalOpen(false);
                    setDemoActionBanner(
                      isNl
                        ? 'Alle demodata is gewist! Je kunt nu beginnen met een schone app.'
                        : 'All demo data has been cleared! You now have a clean app.'
                    );
                    setTimeout(() => setDemoActionBanner(null), 5000);
                  } finally {
                    setIsClearingDemo(false);
                  }
                }}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>
                  {isClearingDemo
                    ? isNl
                      ? 'Bezig met wissen...'
                      : 'Clearing...'
                    : isNl
                    ? 'Ja, Wis Demodata & Start Schoon'
                    : 'Yes, Clear Demo Data & Start Clean'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account & Data Management (Delete Account Section) */}
      <div
        id="account-danger-zone"
        className="rounded-3xl border border-rose-200/90 bg-rose-50/40 p-6 sm:p-7 shadow-xl shadow-rose-100/50 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
                <UserX className="h-4 w-4" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-rose-950">
                {language === 'nl' ? 'Account & Gegevens Verwijderen' : 'Delete Account & Data'}
              </h3>
            </div>
            <p className="text-xs text-rose-900/80 leading-relaxed max-w-3xl">
              {language === 'nl'
                ? 'Wil je jouw ProBooking75 trainer-account definitief beëindigen? Bij het verwijderen worden al jouw Firestore-documenten in de relevante collecties (profiel, cliënten, afspraken, beschikbaarheid, uitzonderingen, diensten, pakketten, berichten en facturen) én je Firebase Authentication-account permanent gewist.'
                : 'Want to permanently close your ProBooking75 trainer account? Deleting your account permanently erases all your Firestore documents across all relevant collections (profile, clients, appointments, availability, exceptions, services, packages, messages, and invoices) as well as your Firebase Authentication account.'}
            </p>
            {currentUser?.email && (
              <p className="text-[11px] font-semibold text-rose-800 pt-0.5">
                {language === 'nl' ? 'Ingelogd account:' : 'Signed-in account:'}{' '}
                <span className="font-mono bg-white/80 px-2 py-0.5 rounded-md border border-rose-200">
                  {currentUser.email}
                </span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleOpenDeleteAccountModal}
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4.5 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-600/20 hover:bg-rose-700 transition shrink-0 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            <span>
              {language === 'nl' ? 'Account Definitief Verwijderen' : 'Permanently Delete Account'}
            </span>
          </button>
        </div>
      </div>

      {/* Delete Account Confirmation & Re-authentication Modal */}
      {isDeleteAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-rose-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {language === 'nl'
                      ? 'Account Definitief Verwijderen?'
                      : 'Permanently Delete Account?'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {currentUser?.email || settings.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={() => setIsDeleteAccountModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-rose-950 space-y-2 leading-relaxed">
                <p className="font-bold text-rose-900">
                  {language === 'nl'
                    ? 'Let op: deze actie kan niet ongedaan worden gemaakt.'
                    : 'Warning: this action cannot be undone.'}
                </p>
                <p className="text-[11px] text-rose-800">
                  {language === 'nl'
                    ? 'De volgende gegevens worden direct en permanent verwijderd:'
                    : 'The following data will be immediately and permanently deleted:'}
                </p>
                <ul className="list-disc pl-4 text-[11px] text-rose-800 space-y-1">
                  <li>
                    {language === 'nl'
                      ? 'Jouw trainer-document in Firestore (trainers/' + (currentUser?.uid || '') + ')'
                      : 'Your trainer document in Firestore (trainers/' + (currentUser?.uid || '') + ')'}
                  </li>
                  <li>
                    {language === 'nl'
                      ? 'Alle gekoppelde documenten in de collecties: clients, appointments, availability, exceptions, services, packages, clientPackages, messages en invoices'
                      : 'All linked documents in collections: clients, appointments, availability, exceptions, services, packages, clientPackages, messages, and invoices'}
                  </li>
                  <li>
                    {language === 'nl'
                      ? 'Jouw Firebase Authentication inlogaccount'
                      : 'Your Firebase Authentication login account'}
                  </li>
                </ul>
              </div>

              {deleteAccountError && (
                <div className="flex items-start gap-2 rounded-2xl bg-amber-50 border border-amber-300 p-3 text-xs text-amber-950">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{deleteAccountError}</span>
                </div>
              )}

              {!requiresReauth ? (
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      {language === 'nl' ? (
                        <>
                          Typ <span className="font-mono text-rose-600">VERWIJDER</span> om te bevestigen:
                        </>
                      ) : (
                        <>
                          Type <span className="font-mono text-rose-600">DELETE</span> to confirm:
                        </>
                      )}
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={language === 'nl' ? 'VERWIJDER' : 'DELETE'}
                      disabled={isDeletingAccount}
                      className="w-full rounded-2xl border border-slate-200 p-2.5 text-slate-900 focus:border-rose-500 outline-none transition font-mono uppercase"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={isDeletingAccount}
                      onClick={() => setIsDeleteAccountModalOpen(false)}
                      className="rounded-xl px-3.5 py-2 text-slate-600 hover:bg-slate-100 transition font-semibold"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="button"
                      disabled={
                        isDeletingAccount ||
                        (deleteConfirmText.trim().toUpperCase() !== 'VERWIJDER' &&
                          deleteConfirmText.trim().toUpperCase() !== 'VERWIJDEREN' &&
                          deleteConfirmText.trim().toUpperCase() !== 'DELETE')
                      }
                      onClick={() => handleConfirmDeleteAccount()}
                      className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4.5 py-2 font-bold text-white hover:bg-rose-700 transition shadow-xs disabled:opacity-40 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>
                        {isDeletingAccount
                          ? language === 'nl'
                            ? 'Account & collecties verwijderen...'
                            : 'Deleting account & collections...'
                          : language === 'nl'
                          ? 'Account & Data Verwijderen'
                          : 'Delete Account & Data'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  {hasPasswordProvider && (
                    <div className="space-y-2">
                      <label className="block font-bold text-slate-700">
                        {language === 'nl'
                          ? 'Bevestig je wachtwoord om het verwijderen te voltooien:'
                          : 'Confirm your password to complete deletion:'}
                      </label>
                      <div className="relative">
                        <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="password"
                          value={reauthPassword}
                          onChange={(e) => setReauthPassword(e.target.value)}
                          placeholder="••••••••"
                          disabled={isDeletingAccount}
                          className="w-full rounded-2xl border border-slate-200 pl-9 pr-3 py-2.5 text-slate-900 focus:border-rose-500 outline-none transition"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={isDeletingAccount || !reauthPassword}
                        onClick={() =>
                          handleConfirmDeleteAccount({ password: reauthPassword })
                        }
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 font-bold text-white hover:bg-rose-700 transition disabled:opacity-40 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>
                          {isDeletingAccount
                            ? language === 'nl'
                              ? 'Bezig met verwijderen...'
                              : 'Deleting...'
                            : language === 'nl'
                            ? 'Bevestig Wachtwoord & Verwijder Account'
                            : 'Confirm Password & Delete Account'}
                        </span>
                      </button>
                    </div>
                  )}

                  {(hasGoogleProvider || !hasPasswordProvider) && (
                    <button
                      type="button"
                      disabled={isDeletingAccount}
                      onClick={() => handleConfirmDeleteAccount({ provider: 'google' })}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-bold text-slate-800 hover:bg-slate-50 transition disabled:opacity-40 cursor-pointer"
                    >
                      <span>
                        {language === 'nl'
                          ? 'Bevestig met Google & Verwijder Account'
                          : 'Confirm with Google & Delete Account'}
                      </span>
                    </button>
                  )}

                  {(hasAppleProvider || !hasPasswordProvider) && (
                    <button
                      type="button"
                      disabled={isDeletingAccount}
                      onClick={() => handleConfirmDeleteAccount({ provider: 'apple' })}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 font-bold text-white hover:bg-slate-800 transition disabled:opacity-40 cursor-pointer"
                    >
                      <span>
                        {language === 'nl'
                          ? 'Bevestig met Apple & Verwijder Account'
                          : 'Confirm with Apple & Delete Account'}
                      </span>
                    </button>
                  )}

                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={isDeletingAccount}
                      onClick={() => setIsDeleteAccountModalOpen(false)}
                      className="rounded-xl px-3.5 py-2 text-slate-600 hover:bg-slate-100 transition font-semibold"
                    >
                      {t.cancel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
