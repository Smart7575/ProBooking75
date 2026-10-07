import React, { useState, useMemo } from 'react';
import { useBooking } from '../../context/BookingContext';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Filter,
  Download,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  AlertOctagon,
  XCircle,
  Clock,
  User,
  Search,
} from 'lucide-react';
import {
  formatHumanDate,
  getTodayISO,
  addDaysToISO,
  parseDateISO,
} from '../../utils/dateUtils';
import { Appointment, AppointmentStatus } from '../../types';
import { MonthlyRevenueDashboard } from './MonthlyRevenueDashboard';
import { SessionTypeRevenueChart } from './SessionTypeRevenueChart';
import { ClientRevenueChart } from './ClientRevenueChart';

export const ReportingView: React.FC = () => {
  const { appointments, clients, settings, currency, formatPrice, t } = useBooking();

  const [periodFilter, setPeriodFilter] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('month');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const todayStr = getTodayISO();

  // Compute period boundaries
  const periodRange = useMemo(() => {
    const now = new Date();
    switch (periodFilter) {
      case 'today':
        return { start: todayStr, end: todayStr };
      case 'week':
        return { start: addDaysToISO(todayStr, -7), end: addDaysToISO(todayStr, 7) };
      case 'month':
        return {
          start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
          end: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`,
        };
      case 'year':
        return {
          start: `${now.getFullYear()}-01-01`,
          end: `${now.getFullYear()}-12-31`,
        };
      case 'all':
      default:
        return { start: '2020-01-01', end: '2099-12-31' };
    }
  }, [periodFilter, todayStr]);

  // Filtered appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      // Period filter
      if (periodFilter !== 'all') {
        if (appt.date < periodRange.start || appt.date > periodRange.end) {
          return false;
        }
      }

      // Client filter
      if (clientFilter !== 'all' && appt.clientId !== clientFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && appt.status !== statusFilter) {
        return false;
      }

      // Search query (client name, notes, or service)
      if (searchQuery.trim()) {
        const client = clients.find((c) => c.id === appt.clientId);
        const service = settings.services.find((s) => s.id === appt.serviceId);
        const q = searchQuery.toLowerCase();
        const clientNameMatch = client?.name.toLowerCase().includes(q);
        const serviceNameMatch = service?.name.toLowerCase().includes(q);
        const notesMatch = appt.completionNotes?.toLowerCase().includes(q);
        if (!clientNameMatch && !serviceNameMatch && !notesMatch) {
          return false;
        }
      }

      return true;
    });
  }, [appointments, periodFilter, periodRange, clientFilter, statusFilter, searchQuery, clients, settings]);

  // Aggregate Metrics (FR-8.4)
  const deliveredList = filteredAppointments.filter((a) => a.status === 'delivered');
  const noShowList = filteredAppointments.filter((a) => a.status === 'no-show');
  const cancelledList = filteredAppointments.filter((a) => a.status === 'cancelled');
  const reservedList = filteredAppointments.filter((a) => a.status === 'reserved');

  const grossRevenue = deliveredList.reduce((sum, a) => sum + a.price, 0);
  const potentialRevenue = filteredAppointments.reduce((sum, a) => sum + a.price, 0);
  const deliveredCount = deliveredList.length;
  const noShowCount = noShowList.length;
  const cancelledCount = cancelledList.length;

  // Export to CSV (FR-8.5)
  const handleExportCSV = () => {
    const headers = ['ID', 'Date', 'Start Time', 'End Time', 'Client Name', 'Client Email', 'Service', 'Duration (min)', `Price (${currency})`, 'Status', 'Notes'];
    const rows = filteredAppointments.map((appt) => {
      const client = clients.find((c) => c.id === appt.clientId);
      const service = settings.services.find((s) => s.id === appt.serviceId);
      return [
        appt.id,
        appt.date,
        appt.startTime,
        appt.endTime,
        `"${client?.name || 'Unknown'}"`,
        `"${client?.email || ''}"`,
        `"${service?.name || ''}"`,
        appt.durationMinutes,
        appt.price.toFixed(2),
        appt.status,
        `"${(appt.completionNotes || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `probooking-report-${periodFilter}-${todayStr}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export to JSON (FR-8.5)
  const handleExportJSON = () => {
    const data = {
      reportPeriod: periodFilter,
      generatedAt: new Date().toISOString(),
      provider: settings.name,
      metrics: {
        grossRevenue,
        deliveredCount,
        noShowCount,
        cancelledCount,
        totalBookings: filteredAppointments.length,
      },
      appointments: filteredAppointments.map((appt) => {
        const client = clients.find((c) => c.id === appt.clientId);
        const service = settings.services.find((s) => s.id === appt.serviceId);
        return {
          ...appt,
          clientName: client?.name,
          clientEmail: client?.email,
          serviceName: service?.name,
        };
      }),
    };

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `probooking-report-${todayStr}.json`);
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Title & Export Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {t.reportsTitle}
          </h2>
          <p className="text-xs text-slate-500">
            Comprehensive audit of revenue, delivered training sessions, cancellations, and client breakdowns.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
            title="Download CSV spreadsheet"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>{t.exportCSV}</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
            title="Download JSON data"
          >
            <Download className="h-4 w-4 text-blue-600" />
            <span>{t.exportJSON}</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>{t.printReport}</span>
          </button>
        </div>
      </div>

      {/* Filter Control Bar (FR-8.2 & FR-8.3) with Geometric Balance */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xl shadow-slate-200/50">
        <div className="flex flex-wrap items-center gap-3">
          {/* Period Filter */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-1.5 rounded-2xl">
            {(
              [
                { id: 'today', label: t.rangeToday },
                { id: 'week', label: t.rangeThisWeek },
                { id: 'month', label: t.rangeThisMonth },
                { id: 'year', label: t.rangeThisYear },
                { id: 'all', label: t.rangeAll },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodFilter(p.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  periodFilter === p.id
                    ? 'bg-slate-900 text-emerald-400 shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Client Filter (FR-8.3) */}
          <div className="flex items-center gap-1.5">
            <User className="h-4 w-4 text-slate-400" />
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 transition"
            >
              <option value="all">{t.allClients}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.customHourlyRate ? `(${formatPrice(c.customHourlyRate)}/h)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 transition"
          >
            <option value="all">All Statuses</option>
            <option value="delivered">{t.statusDelivered}</option>
            <option value="reserved">{t.statusReserved}</option>
            <option value="no-show">{t.statusNoShow}</option>
            <option value="cancelled">{t.statusCancelled}</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={t.search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3.5 text-xs text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none transition"
          />
        </div>
      </div>

      {/* KPI Metric Summary (FR-8.4) with Geometric Balance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xl shadow-slate-200/50 hover:border-emerald-200 transition">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
            <span>{t.grossRevenue}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {formatPrice(grossRevenue)}
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-1.5">
            From {deliveredCount} completed sessions
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xl shadow-slate-200/50 hover:border-blue-200 transition">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
            <span>{t.completedSessions}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {deliveredCount}
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-1.5">
            {reservedList.length} upcoming scheduled
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xl shadow-slate-200/50 hover:border-rose-200 transition">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
            <span>{t.noShowCount}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <AlertOctagon className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {noShowCount}
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-1.5">
            Client did not attend session
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xl shadow-slate-200/50 hover:border-amber-200 transition">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
            <span>{t.cancellationsCount}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {cancelledCount}
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-1.5">
            Within policy or provider cancelled
          </p>
        </div>
      </div>

      {/* Recharts Monthly Revenue Trends Dashboard (Gross / Net / Tax Views) */}
      <MonthlyRevenueDashboard
        selectedClientId={clientFilter}
        onClearClientFilter={() => setClientFilter('all')}
      />

      {/* Revenue Breakdown by Session Type & Client */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SessionTypeRevenueChart
          periodRange={periodRange}
          periodLabel={
            periodFilter === 'today'
              ? t.rangeToday
              : periodFilter === 'week'
              ? t.rangeThisWeek
              : periodFilter === 'month'
              ? t.rangeThisMonth
              : periodFilter === 'year'
              ? t.rangeThisYear
              : t.rangeAll
          }
        />
        <ClientRevenueChart
          periodRange={periodRange}
          periodLabel={
            periodFilter === 'today'
              ? t.rangeToday
              : periodFilter === 'week'
              ? t.rangeThisWeek
              : periodFilter === 'month'
              ? t.rangeThisMonth
              : periodFilter === 'year'
              ? t.rangeThisYear
              : t.rangeAll
          }
          selectedClientId={clientFilter}
          onSelectClient={(cId) => setClientFilter(cId)}
        />
      </div>

      {/* Visual Analytics / Distribution Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xl shadow-slate-200/50">
        <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-4">
          Session Status Breakdown (Filtered Scope)
        </h3>
        
        {/* Progress Bar Visualizer */}
        {filteredAppointments.length > 0 ? (
          <div>
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100 p-0.5">
              <div
                style={{ width: `${(deliveredCount / filteredAppointments.length) * 100}%` }}
                className="bg-emerald-500 rounded-l-full transition-all duration-500"
                title={`Delivered: ${deliveredCount}`}
              ></div>
              <div
                style={{ width: `${(reservedList.length / filteredAppointments.length) * 100}%` }}
                className="bg-blue-500 transition-all duration-500"
                title={`Reserved: ${reservedList.length}`}
              ></div>
              <div
                style={{ width: `${(noShowCount / filteredAppointments.length) * 100}%` }}
                className="bg-rose-500 transition-all duration-500"
                title={`No-Show: ${noShowCount}`}
              ></div>
              <div
                style={{ width: `${(cancelledCount / filteredAppointments.length) * 100}%` }}
                className="bg-slate-400 rounded-r-full transition-all duration-500"
                title={`Cancelled: ${cancelledCount}`}
              ></div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 font-medium">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-emerald-500"></span>
                <span>Delivered: <strong className="text-slate-900">{deliveredCount}</strong> ({Math.round((deliveredCount / filteredAppointments.length) * 100)}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-blue-500"></span>
                <span>Reserved: <strong className="text-slate-900">{reservedList.length}</strong> ({Math.round((reservedList.length / filteredAppointments.length) * 100)}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-rose-500"></span>
                <span>No-Show: <strong className="text-slate-900">{noShowCount}</strong> ({Math.round((noShowCount / filteredAppointments.length) * 100)}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-slate-400"></span>
                <span>Cancelled: <strong className="text-slate-900">{cancelledCount}</strong> ({Math.round((cancelledCount / filteredAppointments.length) * 100)}%)</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">No data to display for this filter range.</p>
        )}
      </div>

      {/* Detailed Appointments Table (FR-8.1) */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50">
        <div className="border-b border-slate-800 bg-slate-900 px-6 py-4.5 flex items-center justify-between text-white">
          <h3 className="text-sm font-bold">
            Booking Records ({filteredAppointments.length})
          </h3>
          <span className="text-xs text-slate-400">
            Showing all matching transactions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3.5">Date & Time</th>
                <th className="px-6 py-3.5">Client</th>
                <th className="px-6 py-3.5">Service</th>
                <th className="px-6 py-3.5">Duration</th>
                <th className="px-6 py-3.5">Fee</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                    No booking records match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((appt) => {
                  const client = clients.find((c) => c.id === appt.clientId);
                  const service = settings.services.find((s) => s.id === appt.serviceId);

                  return (
                    <tr key={appt.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                        {appt.date}
                        <span className="block text-[11px] text-slate-500">
                          {appt.startTime} - {appt.endTime}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">
                          {client?.name || 'Unknown'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {client?.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-800">
                        {service?.name || 'General Session'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                        {appt.durationMinutes} min
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">
                        {formatPrice(appt.price)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`rounded-xl px-2.5 py-1 text-[10px] font-bold ${
                            appt.status === 'delivered'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : appt.status === 'reserved'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : appt.status === 'no-show'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-slate-200 text-slate-600 line-through'
                          }`}
                        >
                          {appt.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                        {appt.completionNotes || appt.cancellationReason || '-'}
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
  );
};
