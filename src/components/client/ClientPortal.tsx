import React, { useState, useMemo, useEffect } from 'react';
import { useBooking } from '../../context/BookingContext';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  Download,
  Share2,
  Sparkles,
  Info,
  CalendarCheck,
  Check,
  Package as PackageIcon,
  CreditCard,
  Link2,
  Copy,
  ExternalLink,
  Edit3,
  Save,
  FileText,
  MapPin,
  Phone,
  Mail,
  CalendarDays,
  Coins,
  MessageSquare,
  X,
  ShieldAlert,
  Receipt,
} from 'lucide-react';
import { ClientChatTab } from './ClientChatTab';
import { ClientBillingTab } from './ClientBillingTab';
import { getMagicLinkDetails } from '../../utils/urlUtils';
import {
  formatDateISO,
  parseDateISO,
  formatHumanDate,
  formatFullHumanDate,
  getTodayISO,
  addDaysToISO,
  isCancellationAllowed,
  minutesToTime,
} from '../../utils/dateUtils';
import { ServiceType, TimeSlot, Appointment, ClientPackage, ServicePackage } from '../../types';
import { SupportedCurrency, CURRENCY_OPTIONS } from '../../utils/currencyUtils';

export const ClientPortal: React.FC = () => {
  const {
    currentClient,
    clients,
    activeClients,
    setActiveClientId,
    setRole,
    settings,
    services,
    appointments,
    packages,
    clientPackages,
    getClientActivePackages,
    getPackageStandardDuration,
    calculatePackageCreditsForDuration,
    purchasePackage,
    updateClientContactDetails,
    getAvailableSlotsForDate,
    calculateSessionPrice,
    bookAppointment,
    cancelAppointment,
    formatPrice,
    currency,
    setCurrency,
    currencySymbol,
    getUnreadCountForClient,
    magicLinkNotification,
    dismissMagicLinkNotification,
    isTrainerPreview,
    exitTrainerPreview,
    t,
    language,
  } = useBooking();

  // Navigation tab in Client Portal: 'book' | 'appointments' | 'packages' | 'billing' | 'chat' | 'profile'
  const [activeTab, setActiveTab] = useState<'book' | 'appointments' | 'packages' | 'billing' | 'chat' | 'profile'>('book');

  // Booking Flow Steps (1 = Service, 2 = Date & Slot, 3 = Confirmation)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Selected Service
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    services.length > 0 ? services[0].id : ''
  );

  // Selected Date (default to tomorrow or today)
  const todayStr = getTodayISO();
  const [selectedDate, setSelectedDate] = useState<string>(addDaysToISO(todayStr, 1));

  // Selected Slot
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Package payment selection in Step 3
  const [usePackagePayment, setUsePackagePayment] = useState<boolean>(true);
  const [selectedPackageToRedeem, setSelectedPackageToRedeem] = useState<string>('');

  // Completed booking notification
  const [bookedAppointment, setBookedAppointment] = useState<Appointment | null>(null);

  // Cancellation state
  const [cancelWarning, setCancelWarning] = useState<{
    apptId: string;
    message: string;
    allowed: boolean;
    restoresPackage: boolean;
  } | null>(null);
  const [cancelSuccessNotification, setCancelSuccessNotification] = useState<string | null>(null);

  // Profile Form state
  const [profileForm, setProfileForm] = useState({
    name: currentClient?.name || '',
    email: currentClient?.email || '',
    phone: currentClient?.phone || '',
    address: currentClient?.address || '',
    city: currentClient?.city || '',
    dateOfBirth: currentClient?.dateOfBirth || '',
    specialNotes: currentClient?.notes || currentClient?.specialNotes || '',
  });

  const [profileSuccessMsg, setProfileSuccessMsg] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [packagePurchaseSuccess, setPackagePurchaseSuccess] = useState<string | null>(null);

  // Sync profile form when currentClient changes
  React.useEffect(() => {
    if (currentClient) {
      setProfileForm({
        name: currentClient.name || '',
        email: currentClient.email || '',
        phone: currentClient.phone || '',
        address: currentClient.address || '',
        city: currentClient.city || '',
        dateOfBirth: currentClient.dateOfBirth || '',
        specialNotes: currentClient.notes || currentClient.specialNotes || '',
      });
    }
  }, [currentClient]);

  const selectedService = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId) || services[0];
  }, [services, selectedServiceId]);

  // Client's active packages that can cover the chosen service
  const applicableActivePackages = useMemo(() => {
    if (!currentClient || !selectedService) return [];
    return getClientActivePackages(
      currentClient.id,
      selectedService.id,
      selectedService.durationMinutes
    );
  }, [currentClient, selectedService, getClientActivePackages]);

  // Default selected package when entering step 3 (preserve pre-selected pass if valid)
  React.useEffect(() => {
    if (applicableActivePackages.length > 0) {
      setSelectedPackageToRedeem((prev) =>
        prev && applicableActivePackages.some((cp) => cp.id === prev)
          ? prev
          : applicableActivePackages[0].id
      );
      setUsePackagePayment(true);
    } else {
      setSelectedPackageToRedeem('');
      setUsePackagePayment(false);
    }
  }, [applicableActivePackages, step]);

  const selectedClientPackage = useMemo(() => {
    return (
      applicableActivePackages.find((cp) => cp.id === selectedPackageToRedeem) ||
      applicableActivePackages[0]
    );
  }, [applicableActivePackages, selectedPackageToRedeem]);

  const creditsToDeductForSelectedService = useMemo(() => {
    if (!selectedService || !selectedClientPackage) return 1;
    return calculatePackageCreditsForDuration(
      selectedService.durationMinutes,
      selectedClientPackage
    );
  }, [selectedService, selectedClientPackage, calculatePackageCreditsForDuration]);

  // Dynamic available slots calculation (auto-updates whenever appointments are booked or cancelled)
  const availableSlots = useMemo(() => {
    if (!selectedService || !selectedDate) return [];
    return getAvailableSlotsForDate(selectedDate, selectedService.durationMinutes);
  }, [selectedDate, selectedService, getAvailableSlotsForDate, appointments]);

  // If currently selected slot is no longer available (e.g. booked), deselect it
  useEffect(() => {
    if (selectedSlot && !availableSlots.some((s) => s.startTime === selectedSlot.startTime)) {
      setSelectedSlot(null);
    }
  }, [availableSlots, selectedSlot]);

  // Client's appointments
  const clientAppointments = useMemo(() => {
    if (!currentClient) return [];
    return appointments
      .filter((a) => a.clientId === currentClient.id)
      .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
  }, [appointments, currentClient]);

  const upcomingBookings = useMemo(() => {
    return clientAppointments.filter(
      (a) => a.status === 'reserved' && (a.date > todayStr || (a.date === todayStr && a.startTime > '00:00'))
    );
  }, [clientAppointments, todayStr]);

  const pastBookings = useMemo(() => {
    return clientAppointments.filter(
      (a) => a.status !== 'reserved' || a.date < todayStr
    );
  }, [clientAppointments, todayStr]);

  // Client's own purchased packages
  const myClientPackages = useMemo(() => {
    if (!currentClient) return [];
    return clientPackages.filter((cp) => cp.clientId === currentClient.id);
  }, [clientPackages, currentClient]);

  // Price for chosen service for this client
  const calculatedPrice = useMemo(() => {
    if (!currentClient || !selectedService) return 0;
    return calculateSessionPrice(currentClient.id, selectedService.id, selectedService.durationMinutes);
  }, [currentClient, selectedService, calculateSessionPrice]);

  // Date picker navigation helper (+7 days buttons, etc.)
  const next7Days = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDaysToISO(todayStr, i));
    }
    return days;
  }, [todayStr]);

  const handleConfirmBooking = () => {
    if (!currentClient || !selectedService || !selectedSlot) return;

    const packageIdToDeduct =
      usePackagePayment && selectedPackageToRedeem ? selectedPackageToRedeem : undefined;

    const res = bookAppointment(
      currentClient.id,
      selectedService.id,
      selectedDate,
      selectedSlot.startTime,
      packageIdToDeduct
    );

    if (res.success && res.appointment) {
      setBookedAppointment(res.appointment);
      setSelectedSlot(null); // Clear selected slot so it's not held in state
      setStep(3);
    }
  };

  const handleInitiateCancel = (appt: Appointment) => {
    const check = isCancellationAllowed(
      appt.date,
      appt.startTime,
      settings.cancellationPolicyHours,
      settings.allowUnrestrictedCancellation
    );

    const hasPackage = !!appt.packageId;

    if (!check.allowed) {
      setCancelWarning({
        apptId: appt.id,
        allowed: false,
        restoresPackage: hasPackage,
        message: `${t.cancelBlockedMsg} (${settings.cancellationPolicyHours} hours cutoff). Please message ${settings.name} directly.`,
      });
    } else {
      const refundedCredits = appt.packageSessionsDeducted ?? 1;
      setCancelWarning({
        apptId: appt.id,
        allowed: true,
        restoresPackage: hasPackage,
        message: `Are you sure you want to cancel your session on ${appt.date} at ${appt.startTime}? ${
          hasPackage
            ? `Because this was booked using your session bundle, ${refundedCredits} ${refundedCredits === 1 ? 'session credit' : 'session credits'} will be automatically refunded to your package balance.`
            : 'Your slot will be freed up for others.'
        }`,
      });
    }
  };

  const handleExecuteCancel = () => {
    if (cancelWarning && cancelWarning.allowed) {
      cancelAppointment(cancelWarning.apptId, 'Self-cancelled by client in portal');
      setCancelWarning(null);
      setCancelSuccessNotification(
        t.cancelSuccessMsg || 'Je afspraak is geannuleerd. Het tijdslot is direct weer vrijgekomen.'
      );
    }
  };

  // Calendar .ics download
  const handleDownloadICS = (appt: Appointment) => {
    const icsData = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ProBooking//Session//EN',
      'BEGIN:VEVENT',
      `SUMMARY:${selectedService?.name || 'Training Session'} with ${settings.name}`,
      `DESCRIPTION:Appointment fee: ${formatPrice(appt.price)}. Provider: ${settings.name} (${settings.phone})`,
      `DTSTART:${appt.date.replace(/-/g, '')}T${appt.startTime.replace(':', '')}00`,
      `DTEND:${appt.date.replace(/-/g, '')}T${appt.endTime.replace(':', '')}00`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `appointment-${appt.date}.ics`);
    link.click();
    URL.revokeObjectURL(url);
  };

  // Handle client purchasing package
  const handlePurchasePackage = (pkg: ServicePackage) => {
    if (!currentClient) return;
    const res = purchasePackage(currentClient.id, pkg.id);
    if (res.success) {
      setPackagePurchaseSuccess(
        `Successfully purchased "${pkg.name}"! ${pkg.sessionCount} sessions have been credited to your account.`
      );
      setTimeout(() => setPackagePurchaseSuccess(null), 5000);
    }
  };

  // Handle saving profile changes
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClient) return;

    updateClientContactDetails(currentClient.id, {
      name: profileForm.name,
      email: profileForm.email,
      phone: profileForm.phone,
      address: profileForm.address,
      city: profileForm.city,
      dateOfBirth: profileForm.dateOfBirth,
      notes: profileForm.specialNotes,
      specialNotes: profileForm.specialNotes,
    });

    setProfileSuccessMsg(true);
    setTimeout(() => setProfileSuccessMsg(false), 4000);
  };

  // Generate private magic link details
  const magicLinkDetails = useMemo(() => {
    if (!currentClient) return null;
    return getMagicLinkDetails(
      currentClient.magicToken,
      (currentClient as any).trainerId || (currentClient as any).userId
    );
  }, [currentClient]);

  const magicLinkUrl = magicLinkDetails ? magicLinkDetails.publicSharedUrl : '';

  const copyMagicLinkToClipboard = () => {
    if (!magicLinkUrl) return;
    navigator.clipboard.writeText(magicLinkUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  if (!currentClient) {
    return (
      <div className="p-12 text-center text-slate-500">
        {language === 'nl' ? 'Geen klantprofiel gevonden.' : 'No client profile found.'}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Trainer Test Mode Bar (ONLY visible to authenticated trainer testing as client; hidden for real clients) */}
      {isTrainerPreview && (
        <div className="rounded-2xl border border-emerald-500/40 bg-slate-900 text-white px-4 py-3 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="text-xs">
              <span className="font-bold text-white block">
                {language === 'nl'
                  ? `Testmodus Klantportaal: ${currentClient.name}`
                  : `Client Portal Test Mode: ${currentClient.name}`}
              </span>
              <span className="text-slate-400 text-[11px]">
                {language === 'nl'
                  ? 'Je bekijkt dit portaal als trainer. Echte klanten zien deze balk niet.'
                  : 'You are previewing this portal as trainer. Real clients do not see this bar.'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={exitTrainerPreview}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-sm transition shrink-0 cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>
              {language === 'nl' ? 'Terug naar Trainer Dashboard' : 'Back to Trainer Dashboard'}
            </span>
          </button>
        </div>
      )}

      {/* Cancellation Feedback Banner (Confirms slot freed up) */}
      {cancelSuccessNotification && (
        <div id="cancel-success-alert" className="rounded-2xl border border-emerald-500/40 bg-emerald-950/90 text-white p-4 shadow-lg flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="text-xs">
              <span className="font-bold text-white block">
                {language === 'nl' ? 'Afspraak geannuleerd' : 'Appointment cancelled'}
              </span>
              <span className="text-emerald-300">
                {cancelSuccessNotification}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setCancelSuccessNotification(null);
                setActiveTab('book');
                setStep(1);
                setBookedAppointment(null);
                setSelectedSlot(null);
              }}
              className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition cursor-pointer"
            >
              {language === 'nl' ? 'Nieuwe afspraak boeken' : 'Book new appointment'}
            </button>
            <button
              onClick={() => setCancelSuccessNotification(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              title={language === 'nl' ? 'Sluiten' : 'Close'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Client Identity Context Banner with Geometric Balance */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6 shadow-xl shadow-slate-200/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 font-bold text-base shadow-md shadow-emerald-500/20">
            {currentClient.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {currentClient.name}
              </h2>
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                Secure Client Portal
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {language === 'nl' ? 'Trainer:' : 'Trainer:'} <strong className="text-slate-200">{settings.name}</strong> •{' '}
              {settings.profession}
            </p>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation: 6 Core Views */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1 rounded-2xl bg-slate-100 p-1.5 border border-slate-200/80 text-xs font-bold">
        <button
          onClick={() => setActiveTab('profile')}
          className={`rounded-xl py-2.5 transition flex items-center justify-center gap-2 ${
            activeTab === 'profile'
              ? 'bg-white text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          <User className="h-4 w-4 text-emerald-600" />
          <span>{t.portalNavProfile}</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('book');
            setStep(1);
            setBookedAppointment(null);
          }}
          className={`rounded-xl py-2.5 transition flex items-center justify-center gap-2 ${
            activeTab === 'book'
              ? 'bg-white text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          <CalendarCheck className="h-4 w-4 text-emerald-600" />
          <span>{t.portalNavBook}</span>
        </button>

        <button
          onClick={() => setActiveTab('appointments')}
          className={`rounded-xl py-2.5 transition flex items-center justify-center gap-2 ${
            activeTab === 'appointments'
              ? 'bg-white text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          <Clock className="h-4 w-4 text-emerald-600" />
          <span>
            {t.portalNavAppointments} ({upcomingBookings.length})
          </span>
        </button>

        <button
          onClick={() => setActiveTab('packages')}
          className={`rounded-xl py-2.5 transition flex items-center justify-center gap-2 ${
            activeTab === 'packages'
              ? 'bg-white text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          <PackageIcon className="h-4 w-4 text-emerald-600" />
          <span>
            {t.portalNavPackages}
            {myClientPackages.length > 0 && (
              <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] text-emerald-800">
                {Math.round(myClientPackages.reduce((sum, p) => sum + p.remainingSessions, 0) * 100) / 100} left
              </span>
            )}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('billing')}
          className={`rounded-xl py-2.5 transition flex items-center justify-center gap-2 ${
            activeTab === 'billing'
              ? 'bg-white text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          <Receipt className="h-4 w-4 text-emerald-600" />
          <span>{t.portalNavBilling}</span>
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={`rounded-xl py-2.5 transition flex items-center justify-center gap-2 relative ${
            activeTab === 'chat'
              ? 'bg-white text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          <MessageSquare className="h-4 w-4 text-emerald-600" />
          <span>{t.portalNavChat}</span>
          {currentClient && getUnreadCountForClient(currentClient.id) > 0 && (
            <span className="rounded-full bg-emerald-500 px-1.5 py-0.2 text-[10px] font-bold text-white shadow-xs animate-pulse">
              {getUnreadCountForClient(currentClient.id)}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: 3-STEP BOOKING FLOW WITH AUTOMATIC PACKAGE DETECTION & DEDUCTION   */}
      {/* ========================================================================= */}
      {activeTab === 'book' && (
        <div className="space-y-6">
          {/* Step Progress Header */}
          <div className="flex items-center justify-between px-3">
            <div
              className={`flex items-center gap-2 text-xs font-bold ${
                step >= 1 ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  step >= 1 ? 'bg-slate-900 text-emerald-400' : 'bg-slate-200 text-slate-600'
                }`}
              >
                1
              </span>
              <span>{t.step1Service}</span>
            </div>

            <div className="h-0.5 flex-1 mx-3 bg-slate-200">
              <div
                className={`h-full bg-slate-900 transition-all ${
                  step === 1 ? 'w-0' : step === 2 ? 'w-1/2' : 'w-full'
                }`}
              ></div>
            </div>

            <div
              className={`flex items-center gap-2 text-xs font-bold ${
                step >= 2 ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  step >= 2 ? 'bg-slate-900 text-emerald-400' : 'bg-slate-200 text-slate-600'
                }`}
              >
                2
              </span>
              <span>{t.step2Slot}</span>
            </div>

            <div className="h-0.5 flex-1 mx-3 bg-slate-200">
              <div
                className={`h-full bg-slate-900 transition-all ${
                  step === 3 ? 'w-full' : 'w-0'
                }`}
              ></div>
            </div>

            <div
              className={`flex items-center gap-2 text-xs font-bold ${
                step === 3 ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  step === 3 ? 'bg-slate-900 text-emerald-400' : 'bg-slate-200 text-slate-600'
                }`}
              >
                3
              </span>
              <span>{t.step3Confirm}</span>
            </div>
          </div>

          {/* STEP 1: Select Service */}
          {step === 1 && (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xl shadow-slate-200/50 space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Choose a Service
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select the type of appointment or session you would like to book.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {services.map((service) => {
                  const isSelected = selectedServiceId === service.id;
                  const price = calculateSessionPrice(
                    currentClient.id,
                    service.id,
                    service.durationMinutes
                  );

                  // Check if client has a package covering this service
                  const matchingPkgs = getClientActivePackages(
                    currentClient.id,
                    service.id,
                    service.durationMinutes
                  );
                  const hasPackageCover = matchingPkgs.length > 0;
                  const activePkgForCard =
                    matchingPkgs.find((p) => p.id === selectedPackageToRedeem) || matchingPkgs[0];
                  const creditsForService = activePkgForCard
                    ? calculatePackageCreditsForDuration(service.durationMinutes, activePkgForCard)
                    : 1;
                  const totalSessionsLeft =
                    Math.round(
                      matchingPkgs.reduce((acc, p) => acc + p.remainingSessions, 0) * 100
                    ) / 100;

                  return (
                    <div
                      key={service.id}
                      onClick={() => setSelectedServiceId(service.id)}
                      className={`cursor-pointer rounded-2xl border p-4.5 transition flex flex-col justify-between ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/20 shadow-sm ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h4 className="font-bold text-sm text-slate-900">{service.name}</h4>
                          <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                            <Clock className="h-3 w-3" />
                            {service.durationMinutes} min
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 leading-relaxed">
                          {service.description || 'Standard tailored 1-on-1 coaching session.'}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          {hasPackageCover ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                                {language === 'nl'
                                  ? `Pakket (-${creditsForService} ${creditsForService === 1 ? 'sessie' : 'sessies'})`
                                  : `Package (-${creditsForService} ${creditsForService === 1 ? 'session' : 'sessions'})`}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                ({totalSessionsLeft} {language === 'nl' ? 'over' : 'remaining'})
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm font-bold text-slate-900">
                              {formatPrice(price)}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedServiceId(service.id);
                            setStep(2);
                          }}
                          className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition flex items-center gap-1.5"
                >
                  <span>Continue to Date & Time</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Select Date & Slot */}
          {step === 2 && (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xl shadow-slate-200/50 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Select Date & Time Slot
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Viewing real-time availability for{' '}
                    <strong className="text-slate-800">{selectedService.name}</strong> (
                    {selectedService.durationMinutes} min).
                  </p>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="text-xs font-semibold text-emerald-600 hover:underline"
                >
                  Change Service
                </button>
              </div>

              {/* Quick 7-Day Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Select Day
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {next7Days.map((d) => {
                    const isSelected = selectedDate === d;
                    const parsed = parseDateISO(d);
                    const dayName = parsed.toLocaleDateString(undefined, { weekday: 'short' });
                    const dayNumber = parsed.getDate();
                    const monthName = parsed.toLocaleDateString(undefined, { month: 'short' });

                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setSelectedDate(d);
                          setSelectedSlot(null);
                        }}
                        className={`rounded-2xl p-2.5 text-center border transition ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-emerald-400'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <span className="block text-[11px] uppercase tracking-wider font-semibold opacity-75">
                          {dayName}
                        </span>
                        <span className="block text-base font-bold my-0.5">{dayNumber}</span>
                        <span className="block text-[10px] opacity-75">{monthName}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Or choose specific custom date:</span>
                  <input
                    type="date"
                    min={todayStr}
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setSelectedSlot(null);
                    }}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-800 bg-white focus:border-emerald-500 outline-hidden font-medium"
                  />
                </div>
              </div>

              {/* Available Slots Grid */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2.5">
                  {t.availableSlotsFor} {formatHumanDate(selectedDate)}
                </label>

                {availableSlots.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/50 p-6 text-center text-xs text-amber-900">
                    <AlertCircle className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                    <p className="font-bold text-sm">{t.noSlotsAvailable}</p>
                    <p className="text-slate-500 mt-1 max-w-sm mx-auto">
                      {settings.name} might be fully booked, off-duty, or have a buffer block on this day.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {availableSlots.map((slot) => {
                      const isSelected = selectedSlot?.startTime === slot.startTime;
                      return (
                        <button
                          key={slot.startTime}
                          onClick={() => setSelectedSlot(slot)}
                          className={`rounded-2xl p-3 text-center border font-semibold text-xs transition ${
                            isSelected
                              ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-md ring-2 ring-emerald-300 font-bold'
                              : 'bg-slate-50/70 text-slate-800 border-slate-200/80 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-900'
                          }`}
                        >
                          <div className="font-bold text-sm tracking-tight">{slot.startTime}</div>
                          <div className="text-[10px] opacity-75">until {slot.endTime}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected slot preview & Next button */}
              {selectedSlot && (
                <div className="rounded-2xl bg-slate-900 text-white p-4.5 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-md">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                      {t.selectedSlot}
                    </span>
                    <h4 className="text-sm font-bold text-white mt-0.5">
                      {formatFullHumanDate(selectedDate)} at {selectedSlot.startTime} - {selectedSlot.endTime}
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {selectedService.name} •{' '}
                      {applicableActivePackages.length > 0 ? (
                        <strong className="text-emerald-400">Package Credit Available</strong>
                      ) : (
                        <strong className="text-emerald-400">{formatPrice(calculatedPrice)}</strong>
                      )}
                    </p>
                  </div>

                  <button
                    onClick={() => setStep(3)}
                    className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-md hover:bg-emerald-400 transition flex items-center justify-center gap-1.5"
                  >
                    <span>Proceed to Confirm</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Confirmation Summary & Package Deduction Choice */}
          {step === 3 && (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xl shadow-slate-200/50 space-y-6">
              {bookedAppointment ? (
                /* Success Screen */
                <div className="text-center py-6 space-y-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 border border-emerald-200 mx-auto shadow-sm">
                    <CheckCircle2 className="h-9 w-9" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                      {t.bookingSuccessTitle}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                      {t.bookingSuccessMsg}
                    </p>
                  </div>

                  <div className="max-w-md mx-auto rounded-3xl bg-slate-50/80 p-5 sm:p-6 border border-slate-200/80 text-left text-xs space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Service:</span>
                      <strong className="text-slate-900">{selectedService.name}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Date & Time:</span>
                      <strong className="text-slate-900">
                        {bookedAppointment.date} ({bookedAppointment.startTime} - {bookedAppointment.endTime})
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Payment / Deduction:</span>
                      {bookedAppointment.packageId ? (
                        <div className="text-right">
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                            Covered by Package (-{bookedAppointment.packageSessionsDeducted ?? 1}{' '}
                            {(bookedAppointment.packageSessionsDeducted ?? 1) === 1
                              ? 'session'
                              : 'sessions'}
                            )
                          </span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            {bookedAppointment.packageName || 'Session bundle credit deducted'}
                          </span>
                        </div>
                      ) : (
                        <strong className="text-emerald-700 font-bold text-sm">
                          {formatPrice(bookedAppointment.price)}
                        </strong>
                      )}
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                      <span className="text-slate-500 font-medium">Client Account:</span>
                      <strong className="text-slate-900 font-medium">{currentClient.name}</strong>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => handleDownloadICS(bookedAppointment)}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs"
                    >
                      <Download className="h-4 w-4 text-emerald-600" />
                      <span>{t.addToCalendar}</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('appointments');
                        setStep(1);
                        setBookedAppointment(null);
                      }}
                      className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-emerald-400 shadow-md hover:bg-slate-800 transition"
                    >
                      View in My Appointments
                    </button>
                  </div>
                </div>
              ) : (
                /* Review & Payment Method */
                <div className="space-y-5">
                  <div className="border-b border-slate-100 pb-3.5 flex items-center justify-between">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900">
                        {t.bookingSummary}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Please review your appointment details and payment preference before confirming.
                      </p>
                    </div>
                    <button
                      onClick={() => setStep(2)}
                      className="text-xs font-bold text-emerald-700 hover:underline"
                    >
                      Back to time selection
                    </button>
                  </div>

                  {/* Summary Box */}
                  <div className="rounded-3xl bg-slate-50/80 p-5 sm:p-6 border border-slate-200/80 space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-400 block font-medium">{t.service}</span>
                        <strong className="text-slate-900 text-sm">{selectedService.name}</strong>
                        <span className="text-slate-500 block mt-0.5">
                          {selectedService.durationMinutes} minutes
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">{t.date} & {t.time}</span>
                        <strong className="text-slate-900 text-sm">
                          {formatHumanDate(selectedDate)}
                        </strong>
                        <span className="text-slate-700 font-bold block mt-0.5">
                          {selectedSlot?.startTime} - {selectedSlot?.endTime}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* PACKAGE REDEMPTION vs STANDARD PAYMENT CHOOSER */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-800">
                      Payment & Deduction Method
                    </label>

                    {applicableActivePackages.length > 0 ? (
                      <div className="space-y-2.5">
                        {/* Option 1: Redeem Package */}
                        <div
                          onClick={() => setUsePackagePayment(true)}
                          className={`cursor-pointer rounded-2xl border p-4 transition ${
                            usePackagePayment
                              ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="paymentMethod"
                              checked={usePackagePayment}
                              onChange={() => setUsePackagePayment(true)}
                              className="mt-1 h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-900">
                                  {t.payWithPackage} (Recommended)
                                </span>
                                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                                  {formatPrice(0)} Today
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                {language === 'nl'
                                  ? `Schrijf ${creditsToDeductForSelectedService} ${
                                      creditsToDeductForSelectedService === 1 ? 'sessie' : 'sessies'
                                    } af van je pakket (${selectedService.durationMinutes} min sessie / ${getPackageStandardDuration(
                                      selectedClientPackage
                                    )} min standaard pakketsessie).`
                                  : `Deduct ${creditsToDeductForSelectedService} ${
                                      creditsToDeductForSelectedService === 1
                                        ? 'session credit'
                                        : 'session credits'
                                    } from your prepaid package balance (${
                                      selectedService.durationMinutes
                                    } min session / ${getPackageStandardDuration(
                                      selectedClientPackage
                                    )} min standard package session).`}
                              </p>

                              {usePackagePayment && (
                                <div className="mt-3">
                                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                    Select Package to Deduct From:
                                  </label>
                                  <select
                                    value={selectedPackageToRedeem}
                                    onChange={(e) => setSelectedPackageToRedeem(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 font-semibold focus:border-emerald-500"
                                  >
                                    {applicableActivePackages.map((cp) => {
                                      const cpStdDur = getPackageStandardDuration(cp);
                                      const cpDeduct = calculatePackageCreditsForDuration(
                                        selectedService.durationMinutes,
                                        cp
                                      );
                                      return (
                                        <option key={cp.id} value={cp.id}>
                                          {cp.packageName} — ({Number(cp.remainingSessions.toFixed(2))}{' '}
                                          sessions left • 1 session = {cpStdDur}m → -{cpDeduct}
                                          {cp.expiresAt ? `, expires ${cp.expiresAt}` : ''})
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Option 2: Pay Standard Rate */}
                        <div
                          onClick={() => setUsePackagePayment(false)}
                          className={`cursor-pointer rounded-2xl border p-4 transition ${
                            !usePackagePayment
                              ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="paymentMethod"
                              checked={!usePackagePayment}
                              onChange={() => setUsePackagePayment(false)}
                              className="mt-1 h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-900">
                                  {t.payStandard}
                                </span>
                                <span className="text-xs font-bold text-slate-900">
                                  {formatPrice(calculatedPrice)}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Pay standard single-session fee and keep your package credits for later.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* No packages available */
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-900">Standard Single Session Rate</span>
                            <p className="text-xs text-slate-500 mt-0.5">
                              No active bundle found for this service.
                            </p>
                          </div>
                          <strong className="text-sm font-bold text-slate-900">
                            {formatPrice(calculatedPrice)}
                          </strong>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-[11px] text-emerald-700 font-medium">
                            Want to save on this & future sessions?
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveTab('packages')}
                            className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-200 transition"
                          >
                            Browse Bundles
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cancellation Policy Notice */}
                  <div className="rounded-2xl bg-amber-50 p-3.5 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                    <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div className="leading-relaxed">
                      <strong>Cancellation Policy:</strong>{' '}
                      {settings.allowUnrestrictedCancellation
                        ? 'You may cancel this appointment at any time through your portal.'
                        : `${t.cancellationPolicyNotice} ${settings.cancellationPolicyHours} ${t.hoursBeforeStart}`}
                      {usePackagePayment && (
                        <span className="block text-emerald-800 font-semibold mt-0.5">
                          If cancelled in compliance with policy, your session credit is restored instantly.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => setStep(2)}
                      className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                    >
                      {t.back}
                    </button>
                    <button
                      onClick={handleConfirmBooking}
                      className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition"
                    >
                      {t.confirmBookingBtn} (
                      {usePackagePayment && selectedPackageToRedeem
                        ? `Use ${creditsToDeductForSelectedService} ${
                            creditsToDeductForSelectedService === 1 ? 'Credit' : 'Credits'
                          }`
                        : formatPrice(calculatedPrice)}
                      )
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MY APPOINTMENTS (UPCOMING & PAST WITH CANCEL & NOTES)              */}
      {/* ========================================================================= */}
      {activeTab === 'appointments' && (
        <div className="space-y-6">
          {/* Upcoming Bookings */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xl shadow-slate-200/50 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t.upcoming} ({upcomingBookings.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your scheduled appointments with {settings.name}.
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveTab('book');
                  setStep(1);
                }}
                className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition"
              >
                + {t.bookNew}
              </button>
            </div>

            {upcomingBookings.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                You have no upcoming sessions booked.
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingBookings.map((appt) => {
                  const service = services.find((s) => s.id === appt.serviceId);
                  return (
                    <div
                      key={appt.id}
                      className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:border-slate-300 transition"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-900 px-3.5 py-2.5 text-emerald-400 min-w-[76px] shadow-xs">
                          <span className="font-bold text-xs">{appt.startTime}</span>
                          <span className="text-[10px] text-slate-400">{appt.durationMinutes}m</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-900">
                              {service?.name}
                            </h4>
                            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200">
                              CONFIRMED
                            </span>
                            {appt.packageId && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                                Package Credit
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            {formatFullHumanDate(appt.date)} •{' '}
                            {appt.packageId ? (
                              <span className="text-emerald-700 font-semibold">
                                Covered by {appt.packageName || 'Bundle'}
                              </span>
                            ) : (
                              <span>
                                Fee: <strong className="text-slate-900">{formatPrice(appt.price)}</strong>
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Trainer: {settings.name} ({settings.phone})
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => handleDownloadICS(appt)}
                          className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50 transition shadow-2xs"
                          title={t.addToCalendar}
                        >
                          <Download className="h-4 w-4 text-emerald-600" />
                        </button>
                        <button
                          onClick={() => handleInitiateCancel(appt)}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
                        >
                          {t.cancelBookingBtn}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Past History */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xl shadow-slate-200/50 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {t.past} ({pastBookings.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Past delivered sessions, coach notes, and cancellation records.
              </p>
            </div>

            {pastBookings.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No past bookings found.</p>
            ) : (
              <div className="space-y-2.5">
                {pastBookings.map((appt) => {
                  const service = services.find((s) => s.id === appt.serviceId);
                  return (
                    <div
                      key={appt.id}
                      className="rounded-2xl border border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-white hover:bg-slate-50/80 transition"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">
                            {service?.name}
                          </span>
                          <span className="text-slate-500 font-medium">
                            • {appt.date} at {appt.startTime}
                          </span>
                          {appt.packageId && (
                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Bundle Credit
                            </span>
                          )}
                        </div>

                        {appt.completionNotes && (
                          <div className="mt-1 text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 leading-relaxed">
                            <strong className="text-slate-700">Coach Feedback:</strong> "{appt.completionNotes}"
                          </div>
                        )}

                        {appt.cancellationReason && (
                          <div className="text-rose-600 mt-1 font-medium">
                            Cancelled: {appt.cancellationReason}
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            appt.status === 'delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : appt.status === 'no-show'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {appt.status}
                        </span>
                        <div className="text-slate-900 font-bold mt-1">
                          {appt.packageId ? 'Covered by Package' : formatPrice(appt.price)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PACKAGES & SESSIONS BUNDLES (PURCHASE & BALANCE MONITORING)        */}
      {/* ========================================================================= */}
      {activeTab === 'packages' && (
        <div className="space-y-6">
          {packagePurchaseSuccess && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span className="font-semibold">{packagePurchaseSuccess}</span>
            </div>
          )}

          {/* Active Client Packages */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xl shadow-slate-200/50 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {t.myPackages}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Your prepaid session passes. Credits are automatically redeemed when you book sessions.
              </p>
            </div>

            {myClientPackages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
                <PackageIcon className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">{t.noActivePackages}</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Purchase a session bundle below to lock in discounted rates and simplify booking.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myClientPackages.map((cp) => {
                  const percentage = Math.round((cp.remainingSessions / cp.totalSessions) * 100);
                  const isAvailable = cp.remainingSessions > 0 && cp.status === 'active';
                  const stdDuration = getPackageStandardDuration(cp);

                  return (
                    <div
                      key={cp.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4.5 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              isAvailable
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {isAvailable ? 'Active Pass' : 'Exhausted'}
                          </span>
                          <span className="text-xs text-slate-500">
                            Purchased: {cp.purchasedAt}
                          </span>
                        </div>

                        <h4 className="font-bold text-sm text-slate-900">{cp.packageName}</h4>

                        {/* Progress Bar */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold text-slate-700">
                              {Number(cp.remainingSessions.toFixed(2))} of {cp.totalSessions} sessions remaining
                            </span>
                            <span className="font-bold text-slate-900">{percentage}%</span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                cp.remainingSessions > 2 ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="mt-3 text-xs text-slate-500 space-y-1">
                          <div>
                            {language === 'nl' ? 'Standaard sessieduur:' : 'Standard session duration:'}{' '}
                            <strong className="text-slate-700">{stdDuration} min</strong>{' '}
                            <span className="text-[11px] text-slate-400">
                              ({Math.round(stdDuration / 2)}m = 0.5 • {Math.round(stdDuration * 1.5)}m = 1.5)
                            </span>
                          </div>
                          <div>
                            Expires: <strong>{cp.expiresAt ? cp.expiresAt : t.noExpiration}</strong>
                          </div>
                        </div>
                      </div>

                      {isAvailable && (
                        <div className="mt-4 pt-3 border-t border-slate-200/80">
                          <button
                            onClick={() => {
                              setSelectedPackageToRedeem(cp.id);
                              setUsePackagePayment(true);
                              setBookedAppointment(null);
                              setActiveTab('book');
                              setStep(1);
                            }}
                            className="w-full rounded-xl bg-emerald-600 py-2 text-center text-xs font-semibold text-white hover:bg-emerald-500 transition cursor-pointer"
                          >
                            Book Session with this Pass
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Browse Available Packages for Purchase */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xl shadow-slate-200/50 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {t.buyMoreSessions}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Save on individual rates by choosing a multi-session package from {settings.name}.
              </p>
            </div>

            {packages.filter((p) => p.isActive).length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                {t.noPackagesAvailable}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {packages
                  .filter((p) => p.isActive)
                  .map((pkg) => {
                    const linkedService = services.find((s) => s.id === pkg.serviceId);
                    const stdDur = getPackageStandardDuration(undefined, pkg);
                    const perSession = pkg.sessionCount > 0 ? pkg.price / pkg.sessionCount : 0;
                    const savings =
                      pkg.originalValue && pkg.originalValue > pkg.price
                        ? Math.round(((pkg.originalValue - pkg.price) / pkg.originalValue) * 100)
                        : 0;

                    return (
                      <div
                        key={pkg.id}
                        className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1.5 mb-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                                {pkg.sessionCount} Sessions
                              </span>
                              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                                {stdDur} min / session
                              </span>
                            </div>
                            {pkg.featured && (
                              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200 flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> Popular
                              </span>
                            )}
                          </div>

                          <h4 className="font-bold text-sm text-slate-900 leading-snug">
                            {pkg.name}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                            {pkg.description || 'Prepaid coaching block.'}
                          </p>

                          <div className="mt-3 text-[11px] text-slate-500">
                            Valid for:{' '}
                            <strong className="text-slate-700">
                              {linkedService ? linkedService.name : 'All Services (Universal)'}
                            </strong>
                          </div>

                          <div className="mt-1 text-[11px] text-slate-500">
                            {language === 'nl' ? 'Geldigheid:' : 'Validity:'}{' '}
                            <strong className={pkg.validityDays && pkg.validityDays > 0 ? 'text-slate-700' : 'text-emerald-700'}>
                              {pkg.validityDays && pkg.validityDays > 0
                                ? `${pkg.validityDays} ${language === 'nl' ? 'dagen' : 'days'}`
                                : t.noExpiration}
                            </strong>
                          </div>
                        </div>

                        <div className="mt-5 pt-3 border-t border-slate-100 flex items-end justify-between">
                          <div>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xl font-bold text-slate-900">
                                {formatPrice(pkg.price)}
                              </span>
                              {pkg.originalValue && pkg.originalValue > pkg.price && (
                                <span className="text-xs text-slate-400 line-through">
                                  {formatPrice(pkg.originalValue)}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              {formatPrice(perSession)} / session
                              {savings > 0 && ` • Save ${savings}%`}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handlePurchasePackage(pkg)}
                            className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-600 transition"
                          >
                            {t.purchasePackage}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: MY PROFILE & EDIT CONTACT DETAILS & SECURE LINK                   */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Unique Magic Link Card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xl shadow-slate-200/50 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0">
                <Link2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Your Unique, Password-Free Portal Link
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed max-w-2xl">
                  {t.uniqueLinkNotice}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="font-mono text-xs text-slate-700 truncate select-all flex items-center gap-2">
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  TOKEN
                </span>
                <span className="truncate">{magicLinkUrl}</span>
              </div>

              <button
                type="button"
                onClick={copyMagicLinkToClipboard}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition shrink-0 cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Magic Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Contact Details Form */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xl shadow-slate-200/50 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {t.editProfile}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Keep your contact details and fitness background updated for {settings.name}.
              </p>
            </div>

            {profileSuccessMsg && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 flex items-center gap-2.5 animate-in fade-in">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="font-semibold">{t.profileUpdated}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.clientName} *
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.clientEmail}
                  </label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.clientPhone}
                  </label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.clientDOB}
                  </label>
                  <input
                    type="date"
                    value={profileForm.dateOfBirth}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, dateOfBirth: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.clientAddress}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Herengracht 142"
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.clientCity}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Amsterdam"
                    value={profileForm.city}
                    onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.clientSpecialNotes}
                </label>
                <textarea
                  rows={3}
                  placeholder={t.clientSpecialNotesPlaceholder}
                  value={profileForm.specialNotes}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, specialNotes: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end pt-3">
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition"
                >
                  <Save className="h-4 w-4" />
                  <span>{t.saveProfile}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: INVOICING & BILLING OVERVIEW FOR CLIENT                            */}
      {/* ========================================================================= */}
      {activeTab === 'billing' && (
        <ClientBillingTab onNavigateToChat={() => setActiveTab('chat')} />
      )}

      {/* ========================================================================= */}
      {/* TAB 6: DIRECT CHAT WITH TRAINER                                           */}
      {/* ========================================================================= */}
      {activeTab === 'chat' && <ClientChatTab />}

      {/* Cancellation Dialog / Notice */}
      {cancelWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2.5 mb-3">
              {cancelWarning.allowed ? (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <AlertCircle className="h-5 w-5" />
                </div>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <XCircle className="h-5 w-5" />
                </div>
              )}
              <h3 className="text-base font-bold text-slate-900">
                {cancelWarning.allowed ? t.cancelConfirmTitle : 'Cancellation Unavailable'}
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              {cancelWarning.message}
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setCancelWarning(null)}
                className="rounded-xl px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                {cancelWarning.allowed ? 'Keep Appointment' : t.close}
              </button>
              {cancelWarning.allowed && (
                <button
                  onClick={handleExecuteCancel}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition shadow-sm"
                >
                  Yes, Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
