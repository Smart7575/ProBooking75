import React, { useState } from 'react';
import { useBooking } from '../../context/BookingContext';
import {
  DollarSign,
  CheckCircle2,
  AlertOctagon,
  TrendingUp,
  Cake,
  Calendar,
  Clock,
  User,
  Plus,
  ArrowRight,
  Sparkles,
  Check,
  X,
  FileText,
  MessageSquare,
  Receipt,
  LogOut,
  Trash2,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { formatFullHumanDate, isUpcomingBirthday, getTodayISO } from '../../utils/dateUtils';
import { Appointment } from '../../types';

interface ProviderDashboardProps {
  onNavigate: (tab: string) => void;
}

export const ProviderDashboard: React.FC<ProviderDashboardProps> = ({ onNavigate }) => {
  const {
    settings,
    clients,
    appointments,
    updateAppointmentStatus,
    formatPrice,
    t,
    language,
    setRole,
    setActiveClientId,
    getUnreadCountForProvider,
    unbilledItemsCount,
    totalUnbilledAmount,
    clearDemoData,
  } = useBooking();

  const providerUnread = getUnreadCountForProvider();

  const today = getTodayISO();

  // Selected appointment for completion note modal
  const [completingAppt, setCompletingAppt] = useState<Appointment | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [showClearDemoModal, setShowClearDemoModal] = useState(false);
  const [isClearingDemo, setIsClearingDemo] = useState(false);

  // Calculate KPIs
  const deliveredAppts = appointments.filter((a) => a.status === 'delivered');
  const noShowAppts = appointments.filter((a) => a.status === 'no-show');
  const cancelledAppts = appointments.filter((a) => a.status === 'cancelled');
  const reservedAppts = appointments.filter((a) => a.status === 'reserved');

  const totalRevenue = deliveredAppts.reduce((sum, a) => sum + a.price, 0);
  const totalCompletedCount = deliveredAppts.length;
  const noShowCount = noShowAppts.length;
  const noShowRate =
    totalCompletedCount + noShowCount > 0
      ? Math.round((noShowCount / (totalCompletedCount + noShowCount)) * 100)
      : 0;

  // Today's appointments sorted by start time
  const todayAppointments = appointments
    .filter((a) => a.date === today && a.status !== 'cancelled')
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Upcoming appointments (after today)
  const upcomingAppointments = appointments
    .filter((a) => a.date > today && a.status === 'reserved')
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .slice(0, 5);

  // Check for client birthdays coming up within 7 days (PRD Section 7)
  const upcomingBirthdays = clients
    .map((c) => ({
      client: c,
      bdayInfo: isUpcomingBirthday(c.dateOfBirth),
    }))
    .filter((item) => item.bdayInfo.isSoon);

  const handleOpenCompleteModal = (appt: Appointment) => {
    setCompletingAppt(appt);
    setCompletionNotes(appt.completionNotes || '');
  };

  const handleConfirmComplete = () => {
    if (completingAppt) {
      updateAppointmentStatus(completingAppt.id, 'delivered', completionNotes);
      setCompletingAppt(null);
      setCompletionNotes('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner styled with Geometric Balance (Slate-900 + Emerald) */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 text-white shadow-xl shadow-slate-900/10 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"></div>

        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
              {settings.profession}
            </span>
            <span className="text-xs text-slate-400">
              {formatFullHumanDate(today)}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {language === 'nl' ? `Welkom terug, ${settings.name}` : `Welcome back, ${settings.name}`}
          </h1>
          <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
            {language === 'nl'
              ? `Je hebt vandaag ${todayAppointments.length} sessies gepland en ${reservedAppts.length} actieve reserveringen in je agenda.`
              : `You have ${todayAppointments.length} sessions scheduled for today and ${reservedAppts.length} active reservations on your calendar.`}
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5 self-start md:self-center shrink-0">
          {(clients.length > 0 || appointments.length > 0) && (
            <button
              type="button"
              onClick={() => setShowClearDemoModal(true)}
              className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 hover:border-emerald-500/40 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-200 hover:text-white shadow-lg transition cursor-pointer"
            >
              <Trash2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                {language === 'nl' ? 'Demodata Wissen' : 'Clear Demo Data'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="flex items-center gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-600 hover:border-rose-500 px-4 py-2.5 text-xs sm:text-sm font-bold text-rose-200 hover:text-white shadow-lg shadow-rose-950/30 transition cursor-pointer"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>{language === 'nl' ? 'Uitloggen' : 'Sign Out'}</span>
          </button>
        </div>
      </div>

      {/* Unread Chat Messages Notification Banner */}
      {providerUnread > 0 && (
        <div className="rounded-3xl border border-emerald-300 bg-emerald-50/80 p-4 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-sm">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-emerald-950">
                {t.unreadMessagesCount.replace('{count}', String(providerUnread))}
              </h4>
              <p className="text-[11px] text-emerald-800">
                {t.chatSubtitle}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('chat')}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-xs shrink-0"
          >
            <span>{t.openChat}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Birthday Alert Notification (PRD Section 7) with Geometric Balance */}
      {upcomingBirthdays.length > 0 && (
        <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/60 p-5 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
              <Cake className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-amber-950">
                {t.birthdayAlertTitle}
              </h4>
              <div className="text-xs text-amber-800 mt-0.5 space-y-0.5">
                {upcomingBirthdays.map(({ client, bdayInfo }) => (
                  <p key={client.id}>
                    <strong>{client.name}</strong> {t.birthdayAlertDesc}{' '}
                    <span className="font-semibold">{bdayInfo.daysAway === 0 ? 'today!' : `${bdayInfo.daysAway} ${t.days}`}</span>
                    {bdayInfo.formattedAge ? ` (${t.turnsAge} ${bdayInfo.formattedAge})` : ''}. A personal message builds great client rapport!
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Te Factureren Alert / Quick Access Banner */}
      {unbilledItemsCount > 0 && (
        <div
          onClick={() => onNavigate('billing')}
          className="rounded-3xl border border-amber-200/80 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white p-4.5 sm:p-5 shadow-lg shadow-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:border-amber-300 transition"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-amber-950">
                  {t.billingTitle}: {formatPrice(totalUnbilledAmount)}
                </h4>
                <span className="rounded-full bg-amber-500 text-white px-2 py-0.5 text-[10px] font-bold">
                  {unbilledItemsCount} {t.itemsCount}
                </span>
              </div>
              <p className="text-xs text-amber-900/80 mt-0.5">
                {unbilledItemsCount} {t.unbilledAlertMsg}.
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('billing');
            }}
            className="flex items-center gap-1.5 self-start sm:self-auto rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition cursor-pointer"
          >
            <span>{t.viewBillingOverview}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* KPI Cards Grid with Geometric Balance rounded-3xl and shadow-xl */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Gross Revenue */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t.kpiRevenue}</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1.5">
              {formatPrice(totalRevenue)}
            </h3>
            <p className="text-xs text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>{totalCompletedCount} delivered sessions</span>
            </p>
          </div>
          <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>

        {/* Delivered Sessions */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t.kpiDelivered}</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1.5">
              {totalCompletedCount}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5">
              Standard rate: {formatPrice(settings.standardHourlyRate)}/hr
            </p>
          </div>
          <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 border border-blue-500/20">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>

        {/* No-Shows */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t.kpiNoShow}</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1.5">
              {noShowCount}{' '}
              <span className="text-sm font-normal text-slate-400">
                ({noShowRate}%)
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-1.5">
              {cancelledAppts.length} cancellations logged
            </p>
          </div>
          <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 border border-rose-500/20">
            <AlertOctagon className="h-6 w-6" />
          </div>
        </div>

        {/* Active Clients */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t.totalClients}</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1.5">
              {clients.filter((c) => !c.isArchived).length}
            </h3>
            <button
              onClick={() => onNavigate('clients')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold mt-1.5 flex items-center gap-1 transition"
            >
              <span>Manage clients</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-slate-900 text-slate-100">
            <User className="h-6 w-6 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* Main Row: Today's Schedule + Upcoming Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xl shadow-slate-200/50">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Calendar className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                {t.todaySchedule}
              </h2>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 font-semibold">
              {todayAppointments.length} sessions
            </span>
          </div>

          {todayAppointments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
              <Clock className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">
                {t.noAppointmentsToday}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Your available slots are live for clients to book via self-service.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayAppointments.map((appt) => {
                const client = clients.find((c) => c.id === appt.clientId);
                const service = settings.services.find((s) => s.id === appt.serviceId);

                return (
                  <div
                    key={appt.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 hover:border-slate-300 hover:bg-white transition"
                  >
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="flex flex-col items-center justify-center rounded-xl bg-slate-900 px-3.5 py-2 text-center text-white min-w-[72px]">
                        <span className="text-xs font-bold tracking-tight text-emerald-400">{appt.startTime}</span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {appt.durationMinutes}m
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">
                            {client?.name || 'Unknown Client'}
                          </h4>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              appt.status === 'delivered'
                                ? 'bg-emerald-100 text-emerald-800'
                                : appt.status === 'no-show'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {appt.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {service?.name} •{' '}
                          {appt.packageId ? (
                            <span className="text-emerald-700 font-semibold">
                              Package Credit ({appt.packageName || 'Bundle'})
                            </span>
                          ) : (
                            formatPrice(appt.price)
                          )}
                        </p>
                        {appt.completionNotes && (
                          <p className="text-xs italic text-slate-500 mt-1 line-clamp-1">
                            Note: {appt.completionNotes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Quick Status Handler (FR-5.1, FR-5.2, FR-5.3) */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {appt.status === 'reserved' && (
                        <>
                          <button
                            onClick={() => handleOpenCompleteModal(appt)}
                            className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition"
                            title="Mark Delivered with session notes"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>{t.markDelivered}</span>
                          </button>
                          <button
                            onClick={() => updateAppointmentStatus(appt.id, 'no-show')}
                            className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                            title="Mark No-show"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>{t.markNoShow}</span>
                          </button>
                        </>
                      )}
                      {appt.status === 'delivered' && (
                        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4" />
                          Session Completed
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Bookings Widget */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xl shadow-slate-200/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-900">
                {t.upcomingAppointments}
              </h3>
              <button
                onClick={() => onNavigate('calendar')}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
              >
                View all
              </button>
            </div>

            {upcomingAppointments.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No future reservations yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {upcomingAppointments.map((appt) => {
                  const client = clients.find((c) => c.id === appt.clientId);
                  const service = settings.services.find((s) => s.id === appt.serviceId);
                  return (
                    <div
                      key={appt.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-900">
                          {client?.name}
                        </div>
                        <div className="text-slate-500">
                          {appt.date} • {appt.startTime} ({service?.name})
                        </div>
                      </div>
                      <span className="font-bold text-slate-900">
                        {appt.packageId ? (
                          <span className="text-emerald-700 text-[11px] font-bold">Package Credit</span>
                        ) : (
                          formatPrice(appt.price)
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick links box with Geometric Balance slate-900 */}
          <div className="mt-6 rounded-2xl bg-slate-900 p-5 text-white border border-slate-800">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              <h4 className="text-xs font-bold text-white">
                Client Self-Service Booking Link
              </h4>
            </div>
            <p className="text-[11px] text-slate-300 mb-3.5 leading-relaxed">
              Clients can book directly in 3 easy steps with your buffer time & durations enforced.
            </p>
            <button
              onClick={() => onNavigate('availability')}
              className="w-full rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400 transition"
            >
              Configure Availability & Rules
            </button>
          </div>
        </div>
      </div>

      {/* Completion Modal with Notes (FR-5.2) with Geometric Balance rounded-3xl */}
      {completingAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {t.addCompletionNotes}
                </h3>
              </div>
              <button
                onClick={() => setCompletingAppt(null)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-3.5 text-xs text-slate-700 space-y-1 border border-slate-100">
                <div>
                  <strong>Client:</strong>{' '}
                  {clients.find((c) => c.id === completingAppt.clientId)?.name}
                </div>
                <div>
                  <strong>Session:</strong> {completingAppt.durationMinutes} min •{' '}
                  {formatPrice(completingAppt.price)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Training / Treatment Notes (Private to provider / In client file)
                </label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder={t.completionNotesPlaceholder}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 p-3 text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setCompletingAppt(null)}
                  className="rounded-xl px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleConfirmComplete}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition"
                >
                  {t.saveNotes}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Demo Data Confirmation Modal */}
      {showClearDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {language === 'nl'
                      ? 'Demodata Wissen & Schone App?'
                      : 'Clear Demo Data & Start Clean?'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {language === 'nl'
                      ? 'Je eigen trainerprofiel blijft behouden'
                      : 'Your trainer profile will be preserved'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isClearingDemo}
                onClick={() => setShowClearDemoModal(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              {language === 'nl'
                ? 'Alle voorbeeldcliënten, afspraken, pakketten, berichten, facturen en werktijden worden gewist zodat je met een volledig schone app kunt beginnen.'
                : 'All sample clients, appointments, packages, messages, invoices, and working hours will be cleared so you can start with a completely clean app.'}
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isClearingDemo}
                onClick={() => setShowClearDemoModal(false)}
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
                    setShowClearDemoModal(false);
                  } finally {
                    setIsClearingDemo(false);
                  }
                }}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>
                  {isClearingDemo
                    ? language === 'nl'
                      ? 'Bezig met wissen...'
                      : 'Clearing...'
                    : language === 'nl'
                    ? 'Ja, Wis Demodata & Start Schoon'
                    : 'Yes, Clear Demo Data & Start Clean'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
