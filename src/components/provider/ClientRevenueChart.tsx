import React, { useState, useMemo } from 'react';
import { useBooking } from '../../context/BookingContext';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import {
  Users,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Receipt,
  CalendarCheck,
} from 'lucide-react';

interface ClientRevenueChartProps {
  periodRange?: { start: string; end: string };
  periodLabel?: string;
  selectedClientId?: string;
  onSelectClient?: (clientId: string) => void;
}

const CLIENT_PALETTE = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6366f1', // indigo
];

export const ClientRevenueChart: React.FC<ClientRevenueChartProps> = ({
  periodRange,
  periodLabel,
  selectedClientId = 'all',
  onSelectClient,
}) => {
  const { clients, appointments, invoices, clientPackages, packages, formatPrice, currency } = useBooking();

  const [limitCount, setLimitCount] = useState<number>(6); // Top 6 by default
  const [metricSource, setMetricSource] = useState<'sessions' | 'invoices'>('sessions');
  const [showTable, setShowTable] = useState<boolean>(true);

  // Aggregate revenue per client
  const { clientRankings, totalRevenue, totalPayingClients } = useMemo(() => {
    // 1. Relevant appointments (completed/delivered sessions)
    const filteredAppts = appointments.filter((a) => {
      if (a.status !== 'delivered') return false;
      if (periodRange) {
        if (a.date < periodRange.start || a.date > periodRange.end) {
          return false;
        }
      }
      return true;
    });

    // 2. Relevant invoices (valid issued invoices)
    const filteredInvoices = invoices.filter((inv) => {
      if (inv.status === 'cancelled') return false;
      if (periodRange) {
        const d = inv.issueDate || inv.createdAt;
        if (d && (d < periodRange.start || d > periodRange.end)) {
          return false;
        }
      }
      return true;
    });

    const clientMap: Record<
      string,
      {
        id: string;
        name: string;
        email?: string;
        color: string;
        revenue: number;
        sessionCount: number;
        invoiceCount: number;
      }
    > = {};

    // Initialize all existing clients
    clients.forEach((c, idx) => {
      clientMap[c.id] = {
        id: c.id,
        name: c.name,
        email: c.email,
        color: CLIENT_PALETTE[idx % CLIENT_PALETTE.length],
        revenue: 0,
        sessionCount: 0,
        invoiceCount: 0,
      };
    });

    // Populate session counts and session revenue
    filteredAppts.forEach((appt) => {
      const cId = appt.clientId;
      if (!cId) return;

      if (!clientMap[cId]) {
        const found = clients.find((c) => c.id === cId);
        clientMap[cId] = {
          id: cId,
          name: found?.name || 'Unknown Client',
          email: found?.email,
          color: CLIENT_PALETTE[Object.keys(clientMap).length % CLIENT_PALETTE.length],
          revenue: 0,
          sessionCount: 0,
          invoiceCount: 0,
        };
      }

      clientMap[cId].sessionCount += 1;

      // When in 'sessions' mode, revenue is realized from delivered sessions
      if (metricSource === 'sessions') {
        let sessionRevenue = Number(appt.price) || 0;
        // If appointment used package credits with price 0, attribute proportional package credit value
        if (sessionRevenue === 0 && appt.packageId) {
          const cp = clientPackages.find((p) => p.id === appt.packageId);
          if (cp && cp.totalSessions > 0 && cp.pricePaid > 0) {
            sessionRevenue = Math.round((cp.pricePaid / cp.totalSessions) * 100) / 100;
          } else {
            const pkg = packages.find((p) => p.id === appt.packageId);
            if (pkg && pkg.sessionCount > 0 && pkg.price > 0) {
              sessionRevenue = Math.round((pkg.price / pkg.sessionCount) * 100) / 100;
            }
          }
        }
        clientMap[cId].revenue += sessionRevenue;
      }
    });

    // Populate invoice counts and invoice revenue
    filteredInvoices.forEach((inv) => {
      const cId = inv.clientId;
      if (!cId) return;

      if (!clientMap[cId]) {
        clientMap[cId] = {
          id: cId,
          name: inv.clientName || 'Unknown Client',
          email: inv.clientEmail,
          color: CLIENT_PALETTE[Object.keys(clientMap).length % CLIENT_PALETTE.length],
          revenue: 0,
          sessionCount: 0,
          invoiceCount: 0,
        };
      }

      clientMap[cId].invoiceCount += 1;

      // When in 'invoices' mode, revenue is calculated strictly from issued invoices
      if (metricSource === 'invoices') {
        clientMap[cId].revenue += Number(inv.totalAmount) || 0;
      }
    });

    // Calculate overall revenue & rank clients
    let overall = 0;
    const activeList = Object.values(clientMap).filter(
      (c) => c.revenue > 0 || c.sessionCount > 0 || c.invoiceCount > 0
    );

    activeList.forEach((c) => {
      overall += c.revenue;
    });

    const list = activeList
      .sort((a, b) => b.revenue - a.revenue || b.sessionCount - a.sessionCount)
      .map((c, rankIdx) => {
        const percentage =
          overall > 0 ? Math.round((c.revenue / overall) * 1000) / 10 : 0;
        const avgPerSession =
          c.sessionCount > 0
            ? Math.round((c.revenue / c.sessionCount) * 100) / 100
            : c.revenue;

        return {
          ...c,
          rank: rankIdx + 1,
          percentage,
          avgPerSession,
        };
      });

    return {
      clientRankings: list,
      totalRevenue: overall,
      totalPayingClients: list.filter((c) => c.revenue > 0).length,
    };
  }, [appointments, invoices, clients, clientPackages, packages, periodRange, metricSource]);

  const displayedList = limitCount > 0 ? clientRankings.slice(0, limitCount) : clientRankings;
  const topClient = clientRankings[0];
  const avgClientSpend =
    totalPayingClients > 0 ? Math.round((totalRevenue / totalPayingClients) * 100) / 100 : 0;

  const formatCompactTick = (val: number): string => {
    if (val === 0) return `${currency} 0`;
    if (Math.abs(val) >= 1000) {
      return `${currency} ${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
    }
    return `${currency} ${Math.round(val)}`;
  };

  // Custom Tooltip
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{
      payload?: {
        name: string;
        email?: string;
        revenue: number;
        sessionCount: number;
        invoiceCount: number;
        percentage: number;
        rank: number;
        color: string;
        avgPerSession: number;
      };
    }>;
  }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    return (
      <div className="rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-2xl backdrop-blur-md text-xs text-slate-800 min-w-[220px] z-50">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: data.color }}
            />
            <span className="font-extrabold text-slate-900 text-sm truncate">{data.name}</span>
          </div>
          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black text-emerald-800 uppercase">
            #{data.rank}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">
              {metricSource === 'sessions' ? 'Session revenue:' : 'Invoiced amount:'}
            </span>
            <strong className="text-slate-900 font-extrabold">{formatPrice(data.revenue)}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Revenue share:</span>
            <strong className="text-emerald-700 font-bold">{data.percentage}%</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Delivered sessions:</span>
            <strong className="text-slate-700">{data.sessionCount}x</strong>
          </div>
          {data.sessionCount > 0 && metricSource === 'sessions' && (
            <div className="flex justify-between">
              <span className="text-slate-500">Avg per session:</span>
              <strong className="text-slate-700">{formatPrice(data.avgPerSession)}</strong>
            </div>
          )}
          {data.invoiceCount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">Invoices:</span>
              <strong className="text-slate-700">{data.invoiceCount}x</strong>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xl shadow-slate-200/50 flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-2xs">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Revenue by Client
                </h3>
                {periodLabel && (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {periodLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {metricSource === 'sessions'
                  ? 'Realized revenue from completed sessions per client.'
                  : 'Total official invoiced amounts per client.'}
              </p>
            </div>
          </div>

          {/* Controls: Metric Source & Limit */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* Metric Mode Toggle: Sessions vs Invoices */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMetricSource('sessions')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 transition cursor-pointer ${
                  metricSource === 'sessions'
                    ? 'bg-white font-bold text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Revenue from delivered sessions (matches Gross Revenue)"
              >
                <CalendarCheck className="h-3 w-3 text-emerald-600" />
                <span>Sessions</span>
              </button>
              <button
                type="button"
                onClick={() => setMetricSource('invoices')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 transition cursor-pointer ${
                  metricSource === 'invoices'
                    ? 'bg-white font-bold text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Revenue from issued invoices"
              >
                <Receipt className="h-3 w-3 text-blue-600" />
                <span>Invoices</span>
              </button>
            </div>

            {/* Limit toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLimitCount(5)}
                className={`rounded-lg px-2 py-1 transition cursor-pointer ${
                  limitCount === 5
                    ? 'bg-white font-bold text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Top 5
              </button>
              <button
                type="button"
                onClick={() => setLimitCount(10)}
                className={`rounded-lg px-2 py-1 transition cursor-pointer ${
                  limitCount === 10
                    ? 'bg-white font-bold text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Top 10
              </button>
              <button
                type="button"
                onClick={() => setLimitCount(0)}
                className={`rounded-lg px-2 py-1 transition cursor-pointer ${
                  limitCount === 0
                    ? 'bg-white font-bold text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
            </div>
          </div>
        </div>

        {/* Highlight Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4">
          <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/80 p-3">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
              Top Client
            </span>
            <div className="text-lg font-black text-emerald-950 mt-0.5 truncate">
              {topClient ? topClient.name : '-'}
            </div>
            <span className="text-[10px] text-emerald-700 font-medium">
              {topClient ? `${formatPrice(topClient.revenue)} (${topClient.percentage}%)` : '-'}
            </span>
          </div>

          <div className="rounded-2xl bg-purple-50/70 border border-purple-200/80 p-3">
            <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">
              Paying Clients
            </span>
            <div className="text-lg font-black text-purple-950 mt-0.5">
              {totalPayingClients}
            </div>
            <span className="text-[10px] text-purple-700 font-medium">
              {metricSource === 'sessions' ? 'with completed sessions' : 'with issued invoices'}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-2xl bg-slate-50 border border-slate-200/80 p-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Avg Spend / Client
            </span>
            <div className="text-lg font-black text-slate-900 mt-0.5">
              {formatPrice(avgClientSpend)}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              Ø per paying client
            </span>
          </div>
        </div>

        {/* Horizontal Bar Chart */}
        <div className="rounded-2xl bg-slate-50/70 p-3 border border-slate-100 min-h-[260px] flex items-center justify-center">
          {displayedList.length === 0 ? (
            <p className="text-xs text-slate-400">
              No client revenue found in this period.
            </p>
          ) : (
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={displayedList}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={formatCompactTick}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                    {displayedList.map((entry, index) => {
                      const isSelected = selectedClientId === entry.id;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={isSelected ? '#059669' : entry.color}
                          opacity={selectedClientId !== 'all' && !isSelected ? 0.45 : 1}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Client List Breakdown */}
      <div className="mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">
              Client Rankings
            </span>
            <span className="text-[11px] text-slate-400">
              (Total: {formatPrice(totalRevenue)})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowTable((prev) => !prev)}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-900 transition cursor-pointer"
          >
            <span>{showTable ? 'Hide list' : 'Show list'}</span>
            {showTable ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        {showTable && displayedList.length > 0 && (
          <div className="mt-3 space-y-2">
            {displayedList.map((c) => {
              const isSelected = selectedClientId === c.id;
              const initials = c.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <div
                  key={c.id}
                  onClick={() => onSelectClient?.(c.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition text-xs cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/70 shadow-xs'
                      : 'border-slate-100 hover:bg-slate-50/80 hover:border-slate-200'
                  }`}
                  title={`Click to filter report for ${c.name}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className="font-mono text-[10px] font-extrabold text-slate-400 w-4">
                      #{c.rank}
                    </span>
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-white font-bold text-[10px] shrink-0 shadow-2xs"
                      style={{ backgroundColor: c.color }}
                    >
                      {initials}
                    </div>
                    <div className="truncate">
                      <p className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                        <span>{c.name}</span>
                        {isSelected && (
                          <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-bold">
                            Active filter
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {c.sessionCount} sessions
                        {c.sessionCount > 0 && metricSource === 'sessions' && (
                          <span> • Ø {formatPrice(c.avgPerSession)}/sessie</span>
                        )}
                        {c.invoiceCount > 0 && (
                          <span> • {c.invoiceCount} invoices</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <p className="font-extrabold text-slate-900">{formatPrice(c.revenue)}</p>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                        {c.percentage}%
                      </span>
                    </div>
                    <ArrowRight className="h-3 w-3 text-slate-300" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
