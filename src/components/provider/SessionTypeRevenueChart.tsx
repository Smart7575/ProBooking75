import React, { useState, useMemo } from 'react';
import { useBooking } from '../../context/BookingContext';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Dumbbell,
  PieChart as PieIcon,
  BarChart3,
  TrendingUp,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Percent,
} from 'lucide-react';

interface SessionTypeRevenueChartProps {
  periodRange?: { start: string; end: string };
  periodLabel?: string;
}

const PALETTE = [
  '#2563eb', // blue
  '#059669', // emerald
  '#d97706', // amber
  '#7c3aed', // purple
  '#db2777', // pink
  '#0891b2', // cyan
  '#ea580c', // orange
  '#4f46e5', // indigo
];

export const SessionTypeRevenueChart: React.FC<SessionTypeRevenueChartProps> = ({
  periodRange,
  periodLabel,
}) => {
  const { appointments, settings, formatPrice, currency, language } = useBooking();

  const [chartType, setChartType] = useState<'donut' | 'bar'>('donut');
  const [showTable, setShowTable] = useState<boolean>(true);

  // Calculate revenue grouped by session/service type
  const { serviceData, totalRevenue, totalSessions } = useMemo(() => {
    const delivered = appointments.filter((a) => {
      if (a.status !== 'delivered') return false;
      if (periodRange) {
        if (a.date < periodRange.start || a.date > periodRange.end) {
          return false;
        }
      }
      return true;
    });

    const groups: Record<
      string,
      {
        id: string;
        name: string;
        color: string;
        durationMinutes: number;
        revenue: number;
        sessionCount: number;
      }
    > = {};

    // Initialize with all registered services
    (settings.services || []).forEach((srv, idx) => {
      groups[srv.id] = {
        id: srv.id,
        name: srv.name,
        color: srv.color || PALETTE[idx % PALETTE.length],
        durationMinutes: srv.durationMinutes || 60,
        revenue: 0,
        sessionCount: 0,
      };
    });

    let overallRevenue = 0;
    let overallSessions = 0;

    delivered.forEach((appt) => {
      const price = Number(appt.price) || 0;
      const srvId = appt.serviceId || 'other';

      if (!groups[srvId]) {
        const found = settings.services?.find((s) => s.id === srvId);
        groups[srvId] = {
          id: srvId,
          name: found?.name || ('Other Sessions'),
          color: found?.color || PALETTE[Object.keys(groups).length % PALETTE.length],
          durationMinutes: appt.durationMinutes || 60,
          revenue: 0,
          sessionCount: 0,
        };
      }

      groups[srvId].revenue += price;
      groups[srvId].sessionCount += 1;
      overallRevenue += price;
      overallSessions += 1;
    });

    // Convert to sorted array
    const sorted = Object.values(groups)
      .filter((g) => g.sessionCount > 0 || g.revenue > 0)
      .map((g) => {
        const pct =
          overallRevenue > 0 ? Math.round((g.revenue / overallRevenue) * 1000) / 10 : 0;
        const avgPerSession =
          g.sessionCount > 0 ? Math.round((g.revenue / g.sessionCount) * 100) / 100 : 0;
        return {
          ...g,
          percentage: pct,
          avgPerSession,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    return {
      serviceData: sorted,
      totalRevenue: overallRevenue,
      totalSessions: overallSessions,
    };
  }, [appointments, settings.services, periodRange, language]);

  const topService = serviceData[0];

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
        revenue: number;
        sessionCount: number;
        percentage: number;
        color: string;
        durationMinutes: number;
        avgPerSession: number;
      };
    }>;
  }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    return (
      <div className="rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-2xl backdrop-blur-md text-xs text-slate-800 min-w-[210px] z-50">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-2">
          <span
            className="h-3 w-3 rounded-full shrink-0"
            style={{ backgroundColor: data.color }}
          ></span>
          <span className="font-extrabold text-slate-900 text-sm truncate">
            {data.name}
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">
              {'Revenue:'}
            </span>
            <strong className="text-slate-900">{formatPrice(data.revenue)}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">
              {'Sessions:'}
            </span>
            <strong className="text-slate-900">{data.sessionCount}x</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">
              {'Share:'}
            </span>
            <strong className="text-blue-600">{data.percentage}%</strong>
          </div>
          <div className="flex justify-between pt-1 border-t border-slate-100 text-[11px]">
            <span className="text-slate-400">
              {'Avg / session:'}
            </span>
            <span className="font-semibold text-slate-700">
              {formatPrice(data.avgPerSession)}
            </span>
          </div>
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
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-2xs">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  {'Revenue by Session Type'}
                </h3>
                {periodLabel && (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {periodLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {'Breakdown and share of delivered training services.'}
              </p>
            </div>
          </div>

          {/* Controls: Chart Type */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Chart type toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setChartType('donut')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  chartType === 'donut'
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Donut grafiek"
              >
                <PieIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setChartType('bar')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  chartType === 'bar'
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Kolom grafiek"
              >
                <BarChart3 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Highlight Stats Pill Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4">
          <div className="rounded-2xl bg-blue-50/70 border border-blue-200/80 p-3">
            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
              {'Total Revenue'}
            </span>
            <div className="text-lg font-black text-blue-950 mt-0.5">
              {formatPrice(totalRevenue)}
            </div>
            <span className="text-[10px] text-blue-700 font-medium">
              {totalSessions} {'completed sessions'}
            </span>
          </div>

          <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/80 p-3">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
              {'Top Service'}
            </span>
            <div className="text-lg font-black text-emerald-950 mt-0.5 truncate">
              {topService ? topService.name : '-'}
            </div>
            <span className="text-[10px] text-emerald-700 font-medium">
              {topService ? `${topService.percentage}% van omzet` : '-'}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-2xl bg-slate-50 border border-slate-200/80 p-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              {'Avg Session Price'}
            </span>
            <div className="text-lg font-black text-slate-900 mt-0.5">
              {formatPrice(totalSessions > 0 ? totalRevenue / totalSessions : 0)}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              Ø {'per appointment'}
            </span>
          </div>
        </div>

        {/* Visual Chart */}
        <div className="rounded-2xl bg-slate-50/70 p-3 border border-slate-100 min-h-[260px] flex items-center justify-center">
          {serviceData.length === 0 ? (
            <p className="text-xs text-slate-400">
              {'No delivered sessions found in this period.'}
            </p>
          ) : (
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'donut' ? (
                  <PieChart>
                    <Tooltip content={<CustomTooltip />} />
                    <Pie
                      data={serviceData}
                      dataKey="revenue"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {serviceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                ) : (
                  <BarChart
                    data={serviceData}
                    margin={{ top: 10, right: 10, left: -10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickFormatter={formatCompactTick}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                      {serviceData.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Legend & Breakdown Table Toggle */}
      <div className="mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800">
            {'Service Distribution'}
          </span>
          <button
            type="button"
            onClick={() => setShowTable((prev) => !prev)}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-900 transition cursor-pointer"
          >
            <span>
              {showTable
                ? 'Hide details'
                : 'Show details'}
            </span>
            {showTable ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        {showTable && serviceData.length > 0 && (
          <div className="mt-3 space-y-2">
            {serviceData.map((srv) => (
              <div
                key={srv.id}
                className="flex items-center justify-between p-2 rounded-xl border border-slate-100 hover:bg-slate-50/80 transition text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: srv.color }}
                  ></span>
                  <div className="truncate">
                    <p className="font-bold text-slate-900 truncate">{srv.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {srv.sessionCount}x ({srv.durationMinutes} min) • Ø{' '}
                      {formatPrice(srv.avgPerSession)}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-extrabold text-slate-900">{formatPrice(srv.revenue)}</p>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">
                    {srv.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
