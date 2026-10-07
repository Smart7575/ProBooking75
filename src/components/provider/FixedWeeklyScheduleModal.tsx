import React, { useState, useEffect, useMemo } from 'react';
import { useBooking } from '../../context/BookingContext';
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  Check,
  Coffee,
  AlertCircle,
  CalendarRange,
} from 'lucide-react';
import { DaySchedule } from '../../types';
import {
  getTodayISO,
  addDaysToISO,
  parseDateISO,
  addDays,
  formatHumanDate,
  timeToMinutes,
  endTimeToMinutes,
} from '../../utils/dateUtils';

interface FixedWeeklyScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStartDate?: string;
}

const DAYS_OF_WEEK = [
  { index: 1, label: 'Monday', short: 'Mon' },
  { index: 2, label: 'Tuesday', short: 'Tue' },
  { index: 3, label: 'Wednesday', short: 'Wed' },
  { index: 4, label: 'Thursday', short: 'Thu' },
  { index: 5, label: 'Friday', short: 'Fri' },
  { index: 6, label: 'Saturday', short: 'Sat' },
  { index: 0, label: 'Sunday', short: 'Sun' },
];

export const FixedWeeklyScheduleModal: React.FC<FixedWeeklyScheduleModalProps> = ({
  isOpen,
  onClose,
  initialStartDate,
}) => {
  const { settings, applyWeeklyScheduleToDateRange } = useBooking();

  const todayStr = getTodayISO();
  const [startDate, setStartDate] = useState<string>(initialStartDate || todayStr);
  const [endDate, setEndDate] = useState<string>(addDaysToISO(initialStartDate || todayStr, 27)); // Default 4 weeks
  const [scheduleDraft, setScheduleDraft] = useState<DaySchedule[]>(() =>
    settings.weeklySchedule && settings.weeklySchedule.length > 0
      ? settings.weeklySchedule.map((d) => ({ ...d }))
      : [
          { dayOfWeek: 0, enabled: false, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 1, enabled: true, startTime: '08:30', endTime: '17:30', breakStart: '12:30', breakEnd: '13:15' },
          { dayOfWeek: 2, enabled: true, startTime: '08:30', endTime: '17:30', breakStart: '12:30', breakEnd: '13:15' },
          { dayOfWeek: 3, enabled: true, startTime: '08:30', endTime: '18:00', breakStart: '12:30', breakEnd: '13:15' },
          { dayOfWeek: 4, enabled: true, startTime: '08:30', endTime: '17:30', breakStart: '12:30', breakEnd: '13:15' },
          { dayOfWeek: 5, enabled: true, startTime: '08:00', endTime: '15:30' },
          { dayOfWeek: 6, enabled: false, startTime: '09:00', endTime: '13:00' },
        ]
  );
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    const baseStart = initialStartDate || getTodayISO();
    setStartDate(baseStart);
    setEndDate(addDaysToISO(baseStart, 27));
    if (settings.weeklySchedule && settings.weeklySchedule.length > 0) {
      setScheduleDraft(settings.weeklySchedule.map((d) => ({ ...d })));
    }
    setOverwriteExisting(true);
    setErrorMsg('');
    setSuccessMsg('');
  }, [isOpen, initialStartDate, settings.weeklySchedule]);

  // Calculate preview stats for the selected date range
  const periodStats = useMemo(() => {
    if (!startDate || !endDate || startDate > endDate) {
      return { totalDays: 0, workDaysCount: 0 };
    }
    const startObj = parseDateISO(startDate);
    const endObj = parseDateISO(endDate);
    const diffDays = Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays <= 0 || diffDays > 730) {
      return { totalDays: Math.max(0, diffDays), workDaysCount: 0 };
    }

    let workDaysCount = 0;
    for (let i = 0; i < diffDays; i++) {
      const d = addDays(startObj, i);
      const dow = d.getDay();
      const dayCfg = scheduleDraft.find((s) => s.dayOfWeek === dow);
      if (dayCfg && dayCfg.enabled) {
        workDaysCount++;
      }
    }
    return { totalDays: diffDays, workDaysCount };
  }, [startDate, endDate, scheduleDraft]);

  if (!isOpen) return null;

  const handleQuickRange = (daysToAdd: number) => {
    const base = startDate || todayStr;
    setEndDate(addDaysToISO(base, daysToAdd));
    setErrorMsg('');
  };

  const handleToggleDay = (dayOfWeek: number) => {
    setScheduleDraft((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, enabled: !d.enabled } : d))
    );
  };

  const handleUpdateDayTime = (
    dayOfWeek: number,
    field: 'startTime' | 'endTime' | 'breakStart' | 'breakEnd',
    value: string
  ) => {
    setScheduleDraft((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!startDate || !endDate) {
      setErrorMsg('Please select both a start date and an end date.');
      return;
    }

    if (startDate > endDate) {
      setErrorMsg('Start date cannot be after the end date.');
      return;
    }

    const enabledDays = scheduleDraft.filter((d) => d.enabled);
    if (enabledDays.length === 0) {
      setErrorMsg('Please enable at least one workday in the weekly schedule.');
      return;
    }

    for (const d of enabledDays) {
      const sMin = timeToMinutes(d.startTime);
      const eMin = endTimeToMinutes(d.endTime);
      if (eMin <= sMin) {
        const dayInfo = DAYS_OF_WEEK.find((item) => item.index === d.dayOfWeek);
        setErrorMsg(`End time must be after start time on ${dayInfo?.label || 'workday'}.`);
        return;
      }
    }

    const appliedCount = applyWeeklyScheduleToDateRange(
      startDate,
      endDate,
      scheduleDraft,
      overwriteExisting
    );

    setSuccessMsg(
      `Fixed weekly schedule applied from ${formatHumanDate(startDate)} to ${formatHumanDate(endDate)} (${appliedCount} workdays scheduled on the calendar)!`
    );

    setTimeout(() => {
      onClose();
    }, 950);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30">
              <CalendarRange className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Apply Fixed Weekly Schedule to Date Range
                </h3>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                  Fixed Schedule
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                Select the exact start date and end date for applying your fixed weekly schedule
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-bold text-rose-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs font-bold text-emerald-800 flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP 1: Date Range Picker */}
          <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/40 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4 text-emerald-600" />
                1. Select Date Range (Start Date to End Date)
              </span>
              {periodStats.totalDays > 0 && (
                <span className="text-xs font-bold text-emerald-900 bg-emerald-200/80 px-2.5 py-1 rounded-lg">
                  {periodStats.workDaysCount} workdays across {periodStats.totalDays} days
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-emerald-200 p-3 shadow-2xs">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Start Date (From)
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    setStartDate(nextStart);
                    if (endDate < nextStart) {
                      setEndDate(nextStart);
                    }
                  }}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-900 focus:border-emerald-500 outline-none bg-slate-50/50"
                />
                <span className="block text-[10px] text-slate-400 mt-1 font-medium">
                  {startDate ? formatHumanDate(startDate) : ''}
                </span>
              </div>

              <div className="bg-white rounded-xl border border-emerald-200 p-3 shadow-2xs">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  End Date (Up to &amp; including)
                </label>
                <input
                  type="date"
                  required
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-900 focus:border-emerald-500 outline-none bg-slate-50/50"
                />
                <span className="block text-[10px] text-slate-400 mt-1 font-medium">
                  {endDate ? formatHumanDate(endDate) : ''}
                </span>
              </div>
            </div>

            {/* Quick Period Presets */}
            <div>
              <span className="block text-[11px] font-bold text-slate-600 mb-1.5">
                Quick range (from start date):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '1 week (7d)', days: 6 },
                  { label: '2 weeks (14d)', days: 13 },
                  { label: '4 weeks (1 mo)', days: 27 },
                  { label: '2 months', days: 60 },
                  { label: '3 months (Quarter)', days: 90 },
                  { label: '6 months', days: 180 },
                ].map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => handleQuickRange(preset.days)}
                    className="rounded-lg bg-white border border-emerald-200 px-2.5 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition shadow-2xs cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* STEP 2: Weekly Schedule Configuration */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-emerald-600" />
                  2. Fixed Weekly Schedule (Monday - Sunday)
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Check your recurring workdays and configure working hours and optional break.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {DAYS_OF_WEEK.map((dayInfo) => {
                const dayConfig = scheduleDraft.find((s) => s.dayOfWeek === dayInfo.index) || {
                  dayOfWeek: dayInfo.index,
                  enabled: false,
                  startTime: '09:00',
                  endTime: '17:00',
                };

                return (
                  <div
                    key={dayInfo.index}
                    className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                  >
                    <label className="flex items-center gap-2.5 w-36 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={dayConfig.enabled}
                        onChange={() => handleToggleDay(dayInfo.index)}
                        className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                      />
                      <span
                        className={`font-bold ${
                          dayConfig.enabled ? 'text-slate-900' : 'text-slate-400'
                        }`}
                      >
                        {dayInfo.label}
                      </span>
                    </label>

                    {dayConfig.enabled ? (
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-500 font-semibold">
                            Hours:
                          </span>
                          <input
                            type="time"
                            value={dayConfig.startTime}
                            onChange={(e) =>
                              handleUpdateDayTime(dayInfo.index, 'startTime', e.target.value)
                            }
                            className="rounded-xl border border-slate-200 px-2 py-1 text-xs font-bold text-slate-800 focus:border-emerald-500 outline-none"
                          />
                          <span className="text-slate-400">-</span>
                          <input
                            type="time"
                            value={dayConfig.endTime}
                            onChange={(e) =>
                              handleUpdateDayTime(dayInfo.index, 'endTime', e.target.value)
                            }
                            className="rounded-xl border border-slate-200 px-2 py-1 text-xs font-bold text-slate-800 focus:border-emerald-500 outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 sm:border-l sm:border-slate-200 sm:pl-2.5">
                          <Coffee className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                          <span className="text-[11px] text-slate-500 font-semibold">
                            Break:
                          </span>
                          <input
                            type="time"
                            value={dayConfig.breakStart || ''}
                            onChange={(e) =>
                              handleUpdateDayTime(dayInfo.index, 'breakStart', e.target.value)
                            }
                            className="rounded-xl border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:border-emerald-500 outline-none"
                          />
                          <span className="text-slate-400">-</span>
                          <input
                            type="time"
                            value={dayConfig.breakEnd || ''}
                            onChange={(e) =>
                              handleUpdateDayTime(dayInfo.index, 'breakEnd', e.target.value)
                            }
                            className="rounded-xl border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:border-emerald-500 outline-none"
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        Closed / Off
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 3: Conflict / Overwrite Option */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={(e) => setOverwriteExisting(e.target.checked)}
                className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 mt-0.5"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Replace existing ad-hoc working hours in this date range with this weekly schedule
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Uncheck to only fill empty dates in the selected period. You can still customize any individual date ad-hoc afterwards.
                </span>
              </div>
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
            Ad Hoc planning remains active by default so you can adjust any date freely.
          </div>
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>
                Apply Fixed Weekly Schedule
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
