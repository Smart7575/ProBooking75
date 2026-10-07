import React, { useState, useMemo } from 'react';
import { useBooking } from '../../context/BookingContext';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Percent,
  Layers,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  FileText,
  Filter,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Invoice, Appointment } from '../../types';

export type RevenueViewMode = 'gross' | 'net' | 'tax' | 'all';
export type TimeframeMode = '6m' | '12m' | 'ytd' | 'all';
export type ChartDisplayType = 'area' | 'bar';

export interface MonthlyDataPoint {
  monthKey: string; // YYYY-MM
  label: string; // "Okt 2026" / "Oct 2026"
  fullLabel: string; // "Oktober 2026" / "October 2026"
  year: number;
  monthIndex: number; // 0-11
  gross: number;
  net: number;
  tax: number;
  invoiceCount: number;
  sessionCount: number;
  effectiveTaxRate: number; // %
  momGrowthGross?: number | null;
  momGrowthNet?: number | null;
  momGrowthTax?: number | null;
}

interface MonthlyRevenueDashboardProps {
  selectedClientId?: string;
  onClearClientFilter?: () => void;
}

const MONTH_NAMES_NL = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
const MONTH_NAMES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const FULL_MONTHS_NL = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
];
const FULL_MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MonthlyRevenueDashboard: React.FC<MonthlyRevenueDashboardProps> = ({
  selectedClientId = 'all',
  onClearClientFilter,
}) => {
  const {
    invoices,
    appointments,
    invoiceSettings,
    settings,
    clients,
    currency,
    formatPrice,
    language,
  } = useBooking();

  const [viewMode, setViewMode] = useState<RevenueViewMode>('gross');
  const [timeframe, setTimeframe] = useState<TimeframeMode>('12m');
  const [chartType, setChartType] = useState<ChartDisplayType>('area');
  const [showTableBreakdown, setShowTableBreakdown] = useState<boolean>(true);

  const selectedClient = useMemo(() => {
    if (!selectedClientId || selectedClientId === 'all') return null;
    return clients.find((c) => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  // Generate continuous month ranges and aggregate revenue data
  const monthlyData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11

    // Determine target start month based on timeframe
    let startYear = currentYear;
    let startMonth = currentMonth;

    if (timeframe === '6m') {
      const d = new Date(currentYear, currentMonth - 5, 1);
      startYear = d.getFullYear();
      startMonth = d.getMonth();
    } else if (timeframe === '12m') {
      const d = new Date(currentYear, currentMonth - 11, 1);
      startYear = d.getFullYear();
      startMonth = d.getMonth();
    } else if (timeframe === 'ytd') {
      startYear = currentYear;
      startMonth = 0; // January
    } else {
      // 'all': find earliest invoice or appointment date
      let earliestYear = currentYear;
      let earliestMonth = currentMonth;

      invoices.forEach((inv) => {
        if (inv.issueDate) {
          const parts = inv.issueDate.split('-');
          if (parts.length >= 2) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            if (y < earliestYear || (y === earliestYear && m < earliestMonth)) {
              earliestYear = y;
              earliestMonth = m;
            }
          }
        }
      });

      appointments.forEach((appt) => {
        if (appt.date) {
          const parts = appt.date.split('-');
          if (parts.length >= 2) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            if (y < earliestYear || (y === earliestYear && m < earliestMonth)) {
              earliestYear = y;
              earliestMonth = m;
            }
          }
        }
      });

      startYear = Math.max(earliestYear, currentYear - 3); // limit to max 3 years back
      startMonth = earliestMonth;
    }

    // Build the month sequence
    const monthKeys: string[] = [];
    let iterDate = new Date(startYear, startMonth, 1);
    const endDate = new Date(currentYear, currentMonth, 1);

    while (iterDate <= endDate) {
      const y = iterDate.getFullYear();
      const m = String(iterDate.getMonth() + 1).padStart(2, '0');
      monthKeys.push(`${y}-${m}`);
      iterDate = new Date(y, iterDate.getMonth() + 1, 1);
    }

    // Group invoices by month
    const invoiceBuckets: Record<
      string,
      { gross: number; net: number; tax: number; count: number }
    > = {};

    // Group standalone delivered appointments (not yet invoiced) by month
    const appointmentBuckets: Record<
      string,
      { gross: number; net: number; tax: number; count: number }
    > = {};

    monthKeys.forEach((mk) => {
      invoiceBuckets[mk] = { gross: 0, net: 0, tax: 0, count: 0 };
      appointmentBuckets[mk] = { gross: 0, net: 0, tax: 0, count: 0 };
    });

    // 1. Process Invoices (including credit notes which offset revenue)
    invoices.forEach((inv) => {
      if (inv.status === 'cancelled') return;
      if (selectedClientId && selectedClientId !== 'all' && inv.clientId !== selectedClientId) {
        return;
      }

      const dateStr = inv.issueDate || inv.createdAt;
      if (!dateStr) return;
      const mk = dateStr.substring(0, 7);

      if (!invoiceBuckets[mk]) {
        invoiceBuckets[mk] = { gross: 0, net: 0, tax: 0, count: 0 };
      }

      const invSubtotal = Number(inv.subtotal) || 0;
      const invTax = Number(inv.totalVat) || 0;
      const invTotal = Number(inv.totalAmount) || 0;

      invoiceBuckets[mk].net += invSubtotal;
      invoiceBuckets[mk].tax += invTax;
      invoiceBuckets[mk].gross += invTotal;
      invoiceBuckets[mk].count += 1;
    });

    // 2. Process Delivered Appointments that have NOT been invoiced yet
    const vatRate =
      !invoiceSettings.taxId || !invoiceSettings.taxId.trim() || invoiceSettings.isVatExempt
        ? 0
        : invoiceSettings.defaultVatRate !== undefined
        ? invoiceSettings.defaultVatRate
        : 21;
    const ratesIncludeVat = settings.ratesIncludeVat ?? true;

    appointments.forEach((appt) => {
      if (appt.status !== 'delivered') return;
      if (selectedClientId && selectedClientId !== 'all' && appt.clientId !== selectedClientId) {
        return;
      }
      // If already invoiced, it is covered by the invoice ledger above
      if (appt.billingStatus === 'invoiced' || Boolean(appt.invoiceNumber)) {
        return;
      }

      const price = Number(appt.price) || 0;
      if (price <= 0) return;

      const mk = appt.date ? appt.date.substring(0, 7) : '';
      if (!mk) return;

      if (!appointmentBuckets[mk]) {
        appointmentBuckets[mk] = { gross: 0, net: 0, tax: 0, count: 0 };
      }

      let net = price;
      let tax = 0;
      let gross = price;

      if (vatRate === 0) {
        net = price;
        tax = 0;
        gross = price;
      } else if (ratesIncludeVat) {
        gross = price;
        net = Math.round((price / (1 + vatRate / 100)) * 100) / 100;
        tax = Math.round((gross - net) * 100) / 100;
      } else {
        net = price;
        tax = Math.round(price * (vatRate / 100) * 100) / 100;
        gross = Math.round((net + tax) * 100) / 100;
      }

      appointmentBuckets[mk].net += net;
      appointmentBuckets[mk].tax += tax;
      appointmentBuckets[mk].gross += gross;
      appointmentBuckets[mk].count += 1;
    });

    // Assemble final chronological series
    const points: MonthlyDataPoint[] = monthKeys.map((mk, idx) => {
      const [yStr, mStr] = mk.split('-');
      const y = parseInt(yStr, 10);
      const mIdx = parseInt(mStr, 10) - 1;

      const invData = invoiceBuckets[mk] || { gross: 0, net: 0, tax: 0, count: 0 };
      const apptData = appointmentBuckets[mk] || { gross: 0, net: 0, tax: 0, count: 0 };

      const totalGross = Math.round((invData.gross + apptData.gross) * 100) / 100;
      const totalNet = Math.round((invData.net + apptData.net) * 100) / 100;
      const totalTax = Math.round((invData.tax + apptData.tax) * 100) / 100;

      const shortName = MONTH_NAMES_EN[mIdx];
      const fullName = FULL_MONTHS_EN[mIdx];

      const effRate =
        totalNet > 0 ? Math.round((totalTax / totalNet) * 1000) / 10 : 0;

      return {
        monthKey: mk,
        label: `${shortName} '${String(y).slice(-2)}`,
        fullLabel: `${fullName} ${y}`,
        year: y,
        monthIndex: mIdx,
        gross: totalGross,
        net: totalNet,
        tax: totalTax,
        invoiceCount: invData.count,
        sessionCount: apptData.count,
        effectiveTaxRate: effRate,
      };
    });

    // Compute Month-over-Month (MoM) growth rates
    points.forEach((p, i) => {
      if (i > 0) {
        const prev = points[i - 1];
        p.momGrowthGross =
          prev.gross > 0 ? Math.round(((p.gross - prev.gross) / prev.gross) * 1000) / 10 : null;
        p.momGrowthNet =
          prev.net > 0 ? Math.round(((p.net - prev.net) / prev.net) * 1000) / 10 : null;
        p.momGrowthTax =
          prev.tax > 0 ? Math.round(((p.tax - prev.tax) / prev.tax) * 1000) / 10 : null;
      } else {
        p.momGrowthGross = null;
        p.momGrowthNet = null;
        p.momGrowthTax = null;
      }
    });

    return points;
  }, [
    invoices,
    appointments,
    selectedClientId,
    timeframe,
    invoiceSettings,
    settings.ratesIncludeVat,
    language,
  ]);

  // Aggregate summary totals for the active timeframe
  const summary = useMemo(() => {
    const totalGross = monthlyData.reduce((sum, d) => sum + d.gross, 0);
    const totalNet = monthlyData.reduce((sum, d) => sum + d.net, 0);
    const totalTax = monthlyData.reduce((sum, d) => sum + d.tax, 0);
    const totalInvoices = monthlyData.reduce((sum, d) => sum + d.invoiceCount, 0);
    const totalSessions = monthlyData.reduce((sum, d) => sum + d.sessionCount, 0);

    const monthCount = Math.max(monthlyData.length, 1);
    const avgGross = Math.round((totalGross / monthCount) * 100) / 100;
    const avgNet = Math.round((totalNet / monthCount) * 100) / 100;
    const avgTax = Math.round((totalTax / monthCount) * 100) / 100;

    // Peak month for each metric
    const peakGrossMonth = [...monthlyData].sort((a, b) => b.gross - a.gross)[0];
    const peakNetMonth = [...monthlyData].sort((a, b) => b.net - a.net)[0];
    const peakTaxMonth = [...monthlyData].sort((a, b) => b.tax - a.tax)[0];

    // Current vs previous month growth for active metric
    const currentMonthData = monthlyData[monthlyData.length - 1];
    const prevMonthData = monthlyData.length > 1 ? monthlyData[monthlyData.length - 2] : null;

    let activeMetricTotal = totalGross;
    let activeMetricAvg = avgGross;
    let activePeak = peakGrossMonth;
    let activeMomGrowth = currentMonthData?.momGrowthGross ?? null;

    if (viewMode === 'net') {
      activeMetricTotal = totalNet;
      activeMetricAvg = avgNet;
      activePeak = peakNetMonth;
      activeMomGrowth = currentMonthData?.momGrowthNet ?? null;
    } else if (viewMode === 'tax') {
      activeMetricTotal = totalTax;
      activeMetricAvg = avgTax;
      activePeak = peakTaxMonth;
      activeMomGrowth = currentMonthData?.momGrowthTax ?? null;
    }

    const netMarginRatio =
      totalGross > 0 ? Math.round((totalNet / totalGross) * 1000) / 10 : 0;
    const effectiveOverallTaxRate =
      totalNet > 0 ? Math.round((totalTax / totalNet) * 1000) / 10 : 0;

    return {
      totalGross,
      totalNet,
      totalTax,
      totalInvoices,
      totalSessions,
      avgGross,
      avgNet,
      avgTax,
      peakGrossMonth,
      peakNetMonth,
      peakTaxMonth,
      activeMetricTotal,
      activeMetricAvg,
      activePeak,
      activeMomGrowth,
      netMarginRatio,
      effectiveOverallTaxRate,
      currentMonthData,
      prevMonthData,
    };
  }, [monthlyData, viewMode]);

  // Color config based on active view mode
  const themeConfig = useMemo(() => {
    switch (viewMode) {
      case 'gross':
        return {
          primaryColor: '#10b981', // emerald-500
          lightBg: 'bg-emerald-50',
          borderColor: 'border-emerald-200',
          textColor: 'text-emerald-700',
          badgeBg: 'bg-emerald-100 text-emerald-800',
          label: 'Gross Revenue',
          subLabel: 'Incl. VAT',
          gradientId: 'grossGradient',
        };
      case 'net':
        return {
          primaryColor: '#3b82f6', // blue-500
          lightBg: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-700',
          badgeBg: 'bg-blue-100 text-blue-800',
          label: 'Net Revenue',
          subLabel: 'Excl. VAT',
          gradientId: 'netGradient',
        };
      case 'tax':
        return {
          primaryColor: '#f59e0b', // amber-500
          lightBg: 'bg-amber-50',
          borderColor: 'border-amber-200',
          textColor: 'text-amber-700',
          badgeBg: 'bg-amber-100 text-amber-800',
          label: 'Tax Collected',
          subLabel: 'Value Added Tax',
          gradientId: 'taxGradient',
        };
      case 'all':
      default:
        return {
          primaryColor: '#8b5cf6', // purple-500
          lightBg: 'bg-purple-50',
          borderColor: 'border-purple-200',
          textColor: 'text-purple-700',
          badgeBg: 'bg-purple-100 text-purple-800',
          label: 'Gross, Net & Tax',
          subLabel: 'Comparison view',
          gradientId: 'grossGradient',
        };
    }
  }, [viewMode, language]);

  // Compact currency formatter for Y-axis ticks
  const formatYAxisTick = (val: number): string => {
    if (val === 0) return `${currency} 0`;
    if (Math.abs(val) >= 1000) {
      return `${currency} ${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
    }
    return `${currency} ${Math.round(val)}`;
  };

  // Custom high-fidelity Recharts tooltip
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{
      name?: string;
      value?: number;
      payload?: MonthlyDataPoint;
    }>;
  }) => {
    if (!active || !payload || !payload.length) return null;
    const data: MonthlyDataPoint | undefined = payload[0]?.payload;
    if (!data) return null;

    return (
      <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-md text-xs text-slate-800 min-w-[240px] z-50">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
          <span className="font-extrabold text-slate-900 text-sm">{data.fullLabel}</span>
          <span className="text-[10px] font-bold text-slate-400 font-mono">
            {data.monthKey}
          </span>
        </div>

        {/* Data Rows */}
        <div className="space-y-2">
          {/* Gross */}
          <div
            className={`flex items-center justify-between p-1.5 rounded-xl transition ${
              viewMode === 'gross' || viewMode === 'all'
                ? 'bg-emerald-50/80 font-bold text-emerald-950'
                : 'text-slate-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="text-[11px]">
                {'Gross (incl. VAT)'}
              </span>
            </div>
            <span className="font-extrabold">{formatPrice(data.gross)}</span>
          </div>

          {/* Net */}
          <div
            className={`flex items-center justify-between p-1.5 rounded-xl transition ${
              viewMode === 'net' || viewMode === 'all'
                ? 'bg-blue-50/80 font-bold text-blue-950'
                : 'text-slate-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0"></span>
              <span className="text-[11px]">
                {'Net (excl. VAT)'}
              </span>
            </div>
            <span className="font-extrabold">{formatPrice(data.net)}</span>
          </div>

          {/* Tax */}
          <div
            className={`flex items-center justify-between p-1.5 rounded-xl transition ${
              viewMode === 'tax' || viewMode === 'all'
                ? 'bg-amber-50/80 font-bold text-amber-950'
                : 'text-slate-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0"></span>
              <span className="text-[11px]">
                {'Tax Collected'}
              </span>
            </div>
            <span className="font-extrabold">{formatPrice(data.tax)}</span>
          </div>
        </div>

        {/* Footer with activity and MoM trend */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-medium">
          <span>
            {data.invoiceCount} {'invoices'}
            {data.sessionCount > 0 &&
              ` • ${data.sessionCount} ${'sessions'}`}
          </span>
          {data.momGrowthGross !== null && (
            <span
              className={`font-bold flex items-center gap-0.5 ${
                data.momGrowthGross >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {data.momGrowthGross >= 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {data.momGrowthGross > 0 ? `+${data.momGrowthGross}%` : `${data.momGrowthGross}%`}{' '}
              MoM
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Main Dashboard Card */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-xl shadow-slate-200/50">
        {/* Header & View Mode Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-emerald-400 shadow-sm">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {'Monthly Revenue Trends'}
                </h3>
                <p className="text-xs text-slate-500">
                  {'Analyze monthly gross billing, net earnings, and VAT collected over time.'}
                </p>
              </div>
            </div>

            {selectedClient && (
              <div className="mt-2.5 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-1 text-xs text-emerald-900 font-semibold border border-emerald-200">
                <Filter className="h-3.5 w-3.5 text-emerald-600" />
                <span>
                  {'Filtered for client:'}{' '}
                  <strong>{selectedClient.name}</strong>
                </span>
                {onClearClientFilter && (
                  <button
                    onClick={onClearClientFilter}
                    className="ml-1 text-[11px] underline hover:text-emerald-950 cursor-pointer"
                  >
                    ({'clear filter'})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Metric View Mode Toggles (Gross / Net / Tax / Combined) */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100/90 border border-slate-200/60 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('gross')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                viewMode === 'gross'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title={
                'View Gross Revenue (including VAT)'
              }
            >
              <DollarSign className="h-3.5 w-3.5" />
              <span>{'Gross Revenue'}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('net')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                viewMode === 'net'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title={
                'View Net Revenue (excluding VAT)'
              }
            >
              <Receipt className="h-3.5 w-3.5" />
              <span>{'Net Revenue'}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('tax')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                viewMode === 'tax'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title={
                'View Tax Collected (VAT)'
              }
            >
              <Percent className="h-3.5 w-3.5" />
              <span>{'Tax Collected'}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                viewMode === 'all'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title={
                'Compare Gross, Net, and Tax together'
              }
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{'All'}</span>
            </button>
          </div>
        </div>

        {/* Secondary Control Bar: Timeframe & Chart Style */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {'Period:'}
            </span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              {(
                [
                  { id: '6m', label: '6 mo' },
                  { id: '12m', label: '12 mo' },
                  { id: 'ytd', label: 'YTD' },
                  { id: 'all', label: 'All' },
                ] as const
              ).map((tf) => (
                <button
                  key={tf.id}
                  onClick={() => setTimeframe(tf.id)}
                  className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                    timeframe === tf.id
                      ? 'bg-white font-bold text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">
              {'Chart:'}
            </span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setChartType('area')}
                className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                  chartType === 'area'
                    ? 'bg-white font-bold text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {'Area'}
              </button>
              <button
                type="button"
                onClick={() => setChartType('bar')}
                className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                  chartType === 'bar'
                    ? 'bg-white font-bold text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {'Bar'}
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Metric Stat Cards (Tailored to active view) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
          {/* Card 1: Total for active view */}
          <div
            className={`rounded-2xl border p-4.5 transition ${themeConfig.lightBg} ${themeConfig.borderColor}`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5">
              <span>
                {viewMode === 'gross'
                  ? 'Total Gross Revenue'
                  : viewMode === 'net'
                  ? 'Total Net Revenue'
                  : viewMode === 'tax'
                  ? 'Total Tax Collected'
                  : 'Total Gross Invoiced'}
              </span>
              <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${themeConfig.badgeBg}`}>
                {themeConfig.subLabel}
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatPrice(summary.activeMetricTotal)}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
              <span>{monthlyData.length} {'months'}</span>
              {summary.activeMomGrowth !== null && (
                <span
                  className={`font-bold flex items-center gap-0.5 ${
                    summary.activeMomGrowth >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {summary.activeMomGrowth >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {summary.activeMomGrowth > 0 ? `+${summary.activeMomGrowth}%` : `${summary.activeMomGrowth}%`}{' '}
                  vs {'prev mo'}
                </span>
              )}
            </div>
          </div>

          {/* Card 2: Monthly Average */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5">
              <span>
                {'Monthly Average'}
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                Ø / {'mo'}
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatPrice(summary.activeMetricAvg)}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              {'Mean output over selected period'}
            </p>
          </div>

          {/* Card 3: Peak Month */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5">
              <span>{'Peak Month'}</span>
              <Sparkles className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatPrice(
                viewMode === 'gross' || viewMode === 'all'
                  ? summary.peakGrossMonth?.gross || 0
                  : viewMode === 'net'
                  ? summary.peakNetMonth?.net || 0
                  : summary.peakTaxMonth?.tax || 0
              )}
            </div>
            <p className="mt-1.5 text-[11px] font-bold text-slate-600">
              {viewMode === 'gross' || viewMode === 'all'
                ? summary.peakGrossMonth?.fullLabel
                : viewMode === 'net'
                ? summary.peakNetMonth?.fullLabel
                : summary.peakTaxMonth?.fullLabel}
            </p>
          </div>

          {/* Card 4: View-specific context insight */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5">
              <span>
                {viewMode === 'gross'
                  ? 'Invoices & Sessions'
                  : viewMode === 'net'
                  ? 'Net Ratio'
                  : viewMode === 'tax'
                  ? 'Effective Tax Rate'
                  : 'Net / Tax Split'}
              </span>
              <FileText className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {viewMode === 'gross'
                ? `${summary.totalInvoices} / ${summary.totalSessions}`
                : viewMode === 'net'
                ? `${summary.netMarginRatio}%`
                : viewMode === 'tax'
                ? `${summary.effectiveOverallTaxRate}%`
                : `${summary.netMarginRatio}% / ${Math.round((100 - summary.netMarginRatio) * 10) / 10}%`}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400 truncate">
              {viewMode === 'gross'
                ? `${summary.totalInvoices} invoices, ${summary.totalSessions} sessions`
                : viewMode === 'net'
                ? 'Net share of gross billings'
                : viewMode === 'tax'
                ? !invoiceSettings.taxId || invoiceSettings.isVatExempt
                  ? 'Exempt from VAT'
                  : `Standard rate: ${invoiceSettings.defaultVatRate ?? 21}% VAT`
                : 'Ratio of net retained to tax'}
            </p>
          </div>
        </div>

        {/* Visual Chart Container */}
        <div className="rounded-2xl bg-slate-50/70 p-3 sm:p-5 border border-slate-100">
          {monthlyData.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-xs text-slate-400">
              {'No revenue records available for this period.'}
            </div>
          ) : (
            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'area' ? (
                  <AreaChart
                    data={monthlyData}
                    margin={{ top: 10, right: 15, left: 0, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="grossGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="taxGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={formatYAxisTick}
                    />
                    <Tooltip content={<CustomTooltip />} />

                    {viewMode === 'gross' && (
                      <Area
                        type="monotone"
                        dataKey="gross"
                        name={'Gross Revenue'}
                        stroke="#10b981"
                        strokeWidth={3}
                        fill="url(#grossGradient)"
                        activeDot={{
                          r: 6,
                          fill: '#10b981',
                          stroke: '#ffffff',
                          strokeWidth: 2,
                        }}
                      />
                    )}

                    {viewMode === 'net' && (
                      <Area
                        type="monotone"
                        dataKey="net"
                        name={'Net Revenue'}
                        stroke="#3b82f6"
                        strokeWidth={3}
                        fill="url(#netGradient)"
                        activeDot={{
                          r: 6,
                          fill: '#3b82f6',
                          stroke: '#ffffff',
                          strokeWidth: 2,
                        }}
                      />
                    )}

                    {viewMode === 'tax' && (
                      <Area
                        type="monotone"
                        dataKey="tax"
                        name={'Tax Collected'}
                        stroke="#f59e0b"
                        strokeWidth={3}
                        fill="url(#taxGradient)"
                        activeDot={{
                          r: 6,
                          fill: '#f59e0b',
                          stroke: '#ffffff',
                          strokeWidth: 2,
                        }}
                      />
                    )}

                    {viewMode === 'all' && (
                      <>
                        <Area
                          type="monotone"
                          dataKey="gross"
                          name={'Gross'}
                          stroke="#10b981"
                          strokeWidth={2.5}
                          fill="url(#grossGradient)"
                        />
                        <Area
                          type="monotone"
                          dataKey="net"
                          name={'Net'}
                          stroke="#3b82f6"
                          strokeWidth={2.5}
                          fill="url(#netGradient)"
                        />
                        <Area
                          type="monotone"
                          dataKey="tax"
                          name={'Tax'}
                          stroke="#f59e0b"
                          strokeWidth={2}
                          fill="url(#taxGradient)"
                        />
                      </>
                    )}
                  </AreaChart>
                ) : (
                  <BarChart
                    data={monthlyData}
                    margin={{ top: 10, right: 15, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={formatYAxisTick}
                    />
                    <Tooltip content={<CustomTooltip />} />

                    {viewMode === 'gross' && (
                      <Bar
                        dataKey="gross"
                        name={'Gross Revenue'}
                        fill="#10b981"
                        radius={[8, 8, 0, 0]}
                      />
                    )}

                    {viewMode === 'net' && (
                      <Bar
                        dataKey="net"
                        name={'Net Revenue'}
                        fill="#3b82f6"
                        radius={[8, 8, 0, 0]}
                      />
                    )}

                    {viewMode === 'tax' && (
                      <Bar
                        dataKey="tax"
                        name={'Tax Collected'}
                        fill="#f59e0b"
                        radius={[8, 8, 0, 0]}
                      />
                    )}

                    {viewMode === 'all' && (
                      <>
                        <Bar
                          dataKey="net"
                          name={'Net Revenue'}
                          fill="#3b82f6"
                          stackId="revenue"
                          radius={[0, 0, 0, 0]}
                        />
                        <Bar
                          dataKey="tax"
                          name={'Tax Collected'}
                          fill="#f59e0b"
                          stackId="revenue"
                          radius={[8, 8, 0, 0]}
                        />
                      </>
                    )}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          {/* Chart Legend / Footnote */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/60 text-xs text-slate-500 font-medium">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-emerald-500"></span>
                <span>
                  {'Gross (incl. VAT)'}:{' '}
                  <strong className="text-slate-800">{formatPrice(summary.totalGross)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-blue-500"></span>
                <span>
                  {'Net (excl. VAT)'}:{' '}
                  <strong className="text-slate-800">{formatPrice(summary.totalNet)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-amber-500"></span>
                <span>
                  {'Tax Collected'}:{' '}
                  <strong className="text-slate-800">{formatPrice(summary.totalTax)}</strong>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowTableBreakdown((prev) => !prev)}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
            >
              <span>
                {showTableBreakdown
                  ? 'Hide monthly table'
                  : 'Show monthly table'}
              </span>
              {showTableBreakdown ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Detailed Monthly Breakdown Table */}
        {showTableBreakdown && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">
                {'Monthly Ledger & Tax Audit'}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {monthlyData.length} {'periods'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-4">{'Month'}</th>
                    <th
                      className={`py-2.5 px-4 text-right ${
                        viewMode === 'net' ? 'text-blue-700 font-black' : ''
                      }`}
                    >
                      {'Net Revenue'}
                    </th>
                    <th
                      className={`py-2.5 px-4 text-right ${
                        viewMode === 'tax' ? 'text-amber-700 font-black' : ''
                      }`}
                    >
                      {'Tax (VAT)'}
                    </th>
                    <th
                      className={`py-2.5 px-4 text-right ${
                        viewMode === 'gross' ? 'text-emerald-700 font-black' : ''
                      }`}
                    >
                      {'Gross Revenue'}
                    </th>
                    <th className="py-2.5 px-4 text-right">
                      {'Eff. Tax %'}
                    </th>
                    <th className="py-2.5 px-4 text-center">
                      {'MoM Trend'}
                    </th>
                    <th className="py-2.5 px-4 text-right">
                      {'Activity'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyData.map((m) => {
                    const isPeak =
                      viewMode === 'gross' || viewMode === 'all'
                        ? m.gross === summary.peakGrossMonth?.gross && m.gross > 0
                        : viewMode === 'net'
                        ? m.net === summary.peakNetMonth?.net && m.net > 0
                        : m.tax === summary.peakTaxMonth?.tax && m.tax > 0;

                    return (
                      <tr
                        key={m.monthKey}
                        className={`hover:bg-slate-50/80 transition ${
                          isPeak ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-900 flex items-center gap-2">
                          <span>{m.fullLabel}</span>
                          {isPeak && (
                            <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-800 uppercase tracking-wider">
                              {'Peak'}
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-medium whitespace-nowrap ${
                            viewMode === 'net'
                              ? 'text-blue-700 font-bold bg-blue-50/30'
                              : 'text-slate-700'
                          }`}
                        >
                          {formatPrice(m.net)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-medium whitespace-nowrap ${
                            viewMode === 'tax'
                              ? 'text-amber-700 font-bold bg-amber-50/30'
                              : 'text-slate-700'
                          }`}
                        >
                          {formatPrice(m.tax)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                            viewMode === 'gross'
                              ? 'text-emerald-700 font-black bg-emerald-50/30'
                              : 'text-slate-900'
                          }`}
                        >
                          {formatPrice(m.gross)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap text-slate-500 font-medium">
                          {m.effectiveTaxRate > 0 ? (
                            `${m.effectiveTaxRate}%`
                          ) : (
                            <span className="text-slate-400">
                              {'Exempt'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {m.momGrowthGross !== null && m.momGrowthGross !== undefined ? (
                            <span
                              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                m.momGrowthGross >= 0
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {m.momGrowthGross >= 0 ? '+' : ''}
                              {m.momGrowthGross}%
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap text-[11px] text-slate-500">
                          {m.invoiceCount > 0 && (
                            <span className="font-semibold text-slate-700">
                              {m.invoiceCount} {'inv.'}
                            </span>
                          )}
                          {m.sessionCount > 0 && (
                            <span>
                              {m.invoiceCount > 0 ? ' • ' : ''}
                              {m.sessionCount} {'sess.'}
                            </span>
                          )}
                          {m.invoiceCount === 0 && m.sessionCount === 0 && (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
