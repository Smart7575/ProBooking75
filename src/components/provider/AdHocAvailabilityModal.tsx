import React, { useState, useEffect, useMemo } from 'react';
import { useBooking } from '../../context/BookingContext';
import {
  X,
  Clock,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Check,
  Copy,
  AlertCircle,
  Coffee,
  Palmtree,
} from 'lucide-react';
import {
  formatFullHumanDate,
  formatHumanDate,
  parseDateISO,
  addDays,
  formatDateISO,
  addDaysToISO,
  timeToMinutes,
  endTimeToMinutes,
} from '../../utils/dateUtils';

interface AdHocAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDateStr?: string;
  initialTab?: 'availability' | 'vacation';
}

interface BlockDraft {
  startTime: string;
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
  notes?: string;
  slotDuration?: number;
  bufferMinutes?: number;
}

export const AdHocAvailabilityModal: React.FC<AdHocAvailabilityModalProps> = ({
  isOpen,
  onClose,
  initialDateStr,
  initialTab = 'availability',
}) => {
  const {
    settings,
    setAdHocBlocksForDate,
    exceptions,
    addException,
    deleteException,
    t,
  } = useBooking();

  const [activeTab, setActiveTab] = useState<'availability' | 'vacation'>(initialTab);
  const [dateStr, setDateStr] = useState(initialDateStr || formatDateISO(new Date()));
  const [blocks, setBlocks] = useState<BlockDraft[]>([]);
  const [copyToWholeWeek, setCopyToWholeWeek] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Vacation / Exception state
  const [vacationTitle, setVacationTitle] = useState('Holiday');
  const [vacationStartDate, setVacationStartDate] = useState(dateStr);
  const [vacationEndDate, setVacationEndDate] = useState(dateStr);
  const [vacationReason, setVacationReason] = useState<'vacation' | 'sick' | 'personal' | 'blocked'>('vacation');
  const [vacationNotes, setVacationNotes] = useState('');
  const [vacationError, setVacationError] = useState('');

  // Sync props when opening
  useEffect(() => {
    if (initialDateStr) {
      setDateStr(initialDateStr);
      setVacationStartDate(initialDateStr);
      setVacationEndDate(initialDateStr);
    }
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialDateStr, initialTab, isOpen]);

  // Keep vacation start date in sync if user changes date in availability view
  useEffect(() => {
    setVacationStartDate(dateStr);
    if (vacationEndDate < dateStr) {
      setVacationEndDate(dateStr);
    }
  }, [dateStr]);

  // Check if current date is covered by any existing exception
  const activeExceptionsOnDate = useMemo(() => {
    return (exceptions || []).filter((exc) => dateStr >= exc.startDate && dateStr <= exc.endDate);
  }, [exceptions, dateStr]);

  // Load existing blocks when date changes or modal opens
  useEffect(() => {
    if (!isOpen) return;
    const existing = (settings.adHocSchedule || []).filter((b) => b.date === dateStr);
    if (existing.length > 0) {
      setBlocks(
        existing.map((b) => ({
          startTime: b.startTime,
          endTime: b.endTime,
          breakStart: b.breakStart || '',
          breakEnd: b.breakEnd || '',
          notes: b.notes || '',
          slotDuration: b.slotDuration,
          bufferMinutes: b.bufferMinutes,
        }))
      );
    } else {
      // Default to standard full day
      setBlocks([
        {
          startTime: '08:30',
          endTime: '17:30',
          breakStart: '12:30',
          breakEnd: '13:15',
          notes: '',
          slotDuration: settings.standardSlotDuration || 60,
          bufferMinutes: settings.bufferMinutes !== undefined ? settings.bufferMinutes : 15,
        },
      ]);
    }
    setSuccessMsg('');
    setVacationError('');
    setCopyToWholeWeek(false);
  }, [dateStr, isOpen, settings.adHocSchedule, settings.standardSlotDuration, settings.bufferMinutes]);

  if (!isOpen) return null;

  const handleAddBlock = () => {
    setBlocks((prev) => [
      ...prev,
      {
        startTime: '13:30',
        endTime: '18:00',
        breakStart: '',
        breakEnd: '',
        notes: '',
        slotDuration: settings.standardSlotDuration || 60,
        bufferMinutes: settings.bufferMinutes !== undefined ? settings.bufferMinutes : 15,
      },
    ]);
  };

  const handleUpdateBlock = (index: number, field: keyof BlockDraft, value: any) => {
    setBlocks((prev) =>
      prev.map((b, idx) => (idx === index ? { ...b, [field]: value } : b))
    );
  };

  const handleRemoveBlock = (index: number) => {
    setBlocks((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Quick preset shortcuts
  const applyPreset = (preset: 'full' | 'morning' | 'afternoon' | 'long' | 'clear') => {
    switch (preset) {
      case 'full':
        setBlocks([
          {
            startTime: '09:00',
            endTime: '17:00',
            breakStart: '12:30',
            breakEnd: '13:15',
            notes: '',
          },
        ]);
        break;
      case 'morning':
        setBlocks([
          {
            startTime: '08:30',
            endTime: '12:30',
            breakStart: '',
            breakEnd: '',
            notes: '',
          },
        ]);
        break;
      case 'afternoon':
        setBlocks([
          {
            startTime: '13:00',
            endTime: '18:00',
            breakStart: '',
            breakEnd: '',
            notes: '',
          },
        ]);
        break;
      case 'long':
        setBlocks([
          {
            startTime: '08:00',
            endTime: '20:00',
            breakStart: '12:30',
            breakEnd: '13:30',
            notes: '',
          },
        ]);
        break;
      case 'clear':
        setBlocks([]);
        break;
    }
  };

  const handleSaveAvailability = () => {
    // Validate blocks
    const validBlocks = blocks.filter(
      (b) => b.startTime && b.endTime && timeToMinutes(b.startTime) < endTimeToMinutes(b.endTime)
    );

    const normalizeBlocks = (list: BlockDraft[]) =>
      list.map((b) => {
        const sMin = timeToMinutes(b.startTime);
        const eMin = endTimeToMinutes(b.endTime);
        const blockDur = Math.max(15, eMin - sMin);
        const rawSlotDur = b.slotDuration || settings.standardSlotDuration || 60;
        const effectiveSlotDur = Math.min(rawSlotDur, blockDur);
        const bsMin = b.breakStart ? timeToMinutes(b.breakStart) : null;
        const beMin = b.breakEnd ? endTimeToMinutes(b.breakEnd) : null;
        const validBreak =
          bsMin !== null && beMin !== null && beMin > bsMin && bsMin > sMin && beMin < eMin;

        return {
          startTime: b.startTime,
          endTime: b.endTime,
          breakStart: validBreak ? b.breakStart : undefined,
          breakEnd: validBreak ? b.breakEnd : undefined,
          slotDuration: effectiveSlotDur,
          bufferMinutes: b.bufferMinutes,
          notes: b.notes || undefined,
        };
      });

    const normalized = normalizeBlocks(validBlocks);

    // Set for current day
    setAdHocBlocksForDate(dateStr, normalized);

    // If copy to whole week is selected: copy to Monday-Friday of this week
    if (copyToWholeWeek && normalized.length > 0) {
      const baseDate = parseDateISO(dateStr);
      const dayOfWeek = baseDate.getDay(); // 0 = Sun, 1 = Mon...
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = addDays(baseDate, -diffToMonday);

      for (let i = 0; i < 5; i++) {
        const targetD = addDays(monday, i);
        const targetStr = formatDateISO(targetD);
        if (targetStr !== dateStr) {
          setAdHocBlocksForDate(targetStr, normalized);
        }
      }
    }

    setSuccessMsg(
      validBlocks.length > 0
        ? `Availability saved successfully for ${formatHumanDate(dateStr)}!`
        : `Date ${formatHumanDate(dateStr)} has been marked as off / unavailable.`
    );

    setTimeout(() => {
      onClose();
    }, 900);
  };

  // Handle Save Vacation Exception
  const handleSaveVacation = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!vacationTitle.trim()) {
      setVacationError('Please enter a title or description for the holiday.');
      return;
    }
    if (!vacationStartDate || !vacationEndDate) {
      setVacationError('Please select a start and end date.');
      return;
    }
    if (vacationStartDate > vacationEndDate) {
      setVacationError('The start date cannot be after the end date.');
      return;
    }

    // Call addException from BookingContext
    addException({
      title: vacationTitle.trim(),
      startDate: vacationStartDate,
      endDate: vacationEndDate,
      reason: vacationReason,
      notes: vacationNotes.trim() || undefined,
    });

    setSuccessMsg(
      vacationStartDate === vacationEndDate
        ? `🌴 ${vacationTitle} scheduled for ${formatHumanDate(vacationStartDate)}! This date is now blocked.`
        : `🌴 ${vacationTitle} scheduled from ${formatHumanDate(vacationStartDate)} to ${formatHumanDate(vacationEndDate)}! This period is now blocked.`
    );

    setTimeout(() => {
      onClose();
    }, 1100);
  };

  // Vacation duration shortcuts
  const handleSetVacationDuration = (daysToAdd: number) => {
    const endStr = addDaysToISO(vacationStartDate, daysToAdd);
    setVacationEndDate(endStr);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-100 my-8">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                activeTab === 'vacation'
                  ? 'bg-amber-50 text-amber-600 border-amber-200'
                  : 'bg-emerald-50 text-emerald-600 border-emerald-100/80'
              }`}
            >
              {activeTab === 'vacation' ? (
                <Palmtree className="h-5 w-5" />
              ) : (
                <CalendarIcon className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {activeTab === 'vacation'
                  ? '🌴 Schedule Holiday & Time Off (Ad Hoc)'
                  : t.manageAdHocTitle || 'Manage Daily Availability'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {activeTab === 'vacation'
                  ? 'Block dates for holiday, sick leave, or time off on the calendar'
                  : 'Ad Hoc Planning • Flexibly customize working hours per date'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selection Header */}
        <div className="mt-4 flex rounded-2xl bg-slate-100/90 p-1 border border-slate-200/80">
          <button
            type="button"
            onClick={() => {
              setActiveTab('availability');
              setSuccessMsg('');
            }}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition ${
              activeTab === 'availability'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="h-3.5 w-3.5 text-emerald-600" />
            <span>Set Working Hours</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('vacation');
              setSuccessMsg('');
            }}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition ${
              activeTab === 'vacation'
                ? 'bg-white text-amber-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Palmtree className="h-3.5 w-3.5 text-amber-600" />
            <span>🌴 Schedule Holiday</span>
            {activeExceptionsOnDate.length > 0 && (
              <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                Active
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: WORKING HOURS */}
        {activeTab === 'availability' && (
          <div className="mt-4 space-y-4">
            {/* Warning if already on vacation */}
            {activeExceptionsOnDate.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <Palmtree className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold">
                    Note: This date is blocked due to a scheduled holiday
                  </div>
                  <div className="text-[11px] text-amber-800 mt-0.5">
                    {activeExceptionsOnDate[0].title} ({activeExceptionsOnDate[0].startDate}{' '}
                    to {activeExceptionsOnDate[0].endDate})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('vacation')}
                  className="rounded-lg bg-amber-200/80 hover:bg-amber-200 px-2 py-1 text-[11px] font-bold text-amber-900 transition"
                >
                  Manage
                </button>
              </div>
            )}

            {/* Date Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Selected Date
                </label>
                <div className="text-sm font-bold text-slate-900">
                  {formatFullHumanDate(dateStr)}
                </div>
              </div>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 transition shadow-2xs"
              />
            </div>

            {/* Quick Presets */}
            <div>
              <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                <span>Quick Presets</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  1-click templates
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset('full')}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition text-left"
                >
                  ☀️ 09:00 - 17:00 (Full day)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('morning')}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition text-left"
                >
                  🌅 08:30 - 12:30 (Morning)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('afternoon')}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition text-left"
                >
                  🌆 13:00 - 18:00 (Afternoon)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('long')}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition text-left"
                >
                  ⚡ 08:00 - 20:00 (Long day)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('clear')}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-700 transition text-left"
                >
                  🚫 Day off / Clear
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('vacation')}
                  className="rounded-xl border border-amber-200 bg-amber-50/70 px-2.5 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition text-left flex items-center gap-1.5"
                >
                  <Palmtree className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span>🌴 Schedule holiday</span>
                </button>
              </div>
            </div>

            {/* Time Blocks List */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">
                  Working Time Blocks for this Date ({blocks.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddBlock}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t.addBlock || 'Add Time Block'}
                </button>
              </div>

              {blocks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-center">
                  <p className="text-xs font-semibold text-slate-500">
                    {t.noAvailabilitySet || 'No working hours set for this date.'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Clients cannot book appointments on this date.
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyPreset('full')}
                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-xs"
                    >
                      <Plus className="h-3 w-3" />
                      Set 09:00 - 17:00
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('vacation')}
                      className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition"
                    >
                      <Palmtree className="h-3.5 w-3.5 text-amber-600" />
                      Schedule Holiday
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[190px] overflow-y-auto pr-1">
                  {blocks.map((block, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-emerald-600" />
                          <span className="text-xs font-bold text-slate-800">
                            Time Block #{index + 1}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveBlock(index)}
                          className="text-slate-400 hover:text-rose-600 transition p-1"
                          title="Remove time block"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                            {t.timeBlockFrom || 'Start Time'}
                          </label>
                          <input
                            type="time"
                            value={block.startTime}
                            onChange={(e) =>
                              handleUpdateBlock(index, 'startTime', e.target.value)
                            }
                            className="w-full rounded-xl border border-slate-200 p-2 text-slate-800 focus:border-emerald-500 outline-none transition"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                            {t.timeBlockTo || 'End Time'}
                          </label>
                          <input
                            type="time"
                            value={block.endTime}
                            onChange={(e) =>
                              handleUpdateBlock(index, 'endTime', e.target.value)
                            }
                            className="w-full rounded-xl border border-slate-200 p-2 text-slate-800 focus:border-emerald-500 outline-none transition"
                          />
                        </div>
                      </div>

                      {/* Optional Break */}
                      <div className="pt-1.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
                        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                          <Coffee className="h-3 w-3" /> Break:
                        </span>
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="time"
                            placeholder="From"
                            value={block.breakStart || ''}
                            onChange={(e) =>
                              handleUpdateBlock(index, 'breakStart', e.target.value)
                            }
                            className="w-24 rounded-lg border border-slate-200 p-1.5 text-xs text-slate-700 outline-none focus:border-emerald-500"
                          />
                          <span className="text-slate-300">-</span>
                          <input
                            type="time"
                            placeholder="To"
                            value={block.breakEnd || ''}
                            onChange={(e) =>
                              handleUpdateBlock(index, 'breakEnd', e.target.value)
                            }
                            className="w-24 rounded-lg border border-slate-200 p-1.5 text-xs text-slate-700 outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      {/* Slot Duration & Buffer per block */}
                      <div className="pt-1.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            Session Duration (min)
                          </label>
                          <select
                            value={block.slotDuration || settings.standardSlotDuration || 60}
                            onChange={(e) =>
                              handleUpdateBlock(index, 'slotDuration', Number(e.target.value))
                            }
                            className="w-full rounded-lg border border-slate-200 p-1 text-xs text-slate-700 outline-none focus:border-emerald-500 bg-white font-bold"
                          >
                            <option value="15">15 min</option>
                            <option value="30">30 min</option>
                            <option value="45">45 min</option>
                            <option value="60">60 min (default)</option>
                            <option value="75">75 min</option>
                            <option value="90">90 min</option>
                            <option value="120">120 min</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            Buffer Time (min)
                          </label>
                          <select
                            value={
                              block.bufferMinutes !== undefined && block.bufferMinutes !== null
                                ? block.bufferMinutes
                                : (settings.bufferMinutes !== undefined ? settings.bufferMinutes : 15)
                            }
                            onChange={(e) =>
                              handleUpdateBlock(index, 'bufferMinutes', Number(e.target.value))
                            }
                            className="w-full rounded-lg border border-slate-200 p-1 text-xs text-slate-700 outline-none focus:border-emerald-500 bg-white font-bold"
                          >
                            <option value="0">0 min (none)</option>
                            <option value="5">5 min</option>
                            <option value="10">10 min</option>
                            <option value="15">15 min (default)</option>
                            <option value="20">20 min</option>
                            <option value="30">30 min</option>
                            <option value="45">45 min</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Copy to Rest of the Week */}
            {blocks.length > 0 && (
              <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={copyToWholeWeek}
                    onChange={(e) => setCopyToWholeWeek(e.target.checked)}
                    className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                  />
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Copy className="h-3.5 w-3.5 text-emerald-600" />
                    Copy this schedule to all weekdays of this week (Mon - Fri)
                  </span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SCHEDULE HOLIDAY & TIME OFF */}
        {activeTab === 'vacation' && (
          <form onSubmit={handleSaveVacation} className="mt-4 space-y-4">
            {/* Vacation Banner */}
            <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950 flex items-start gap-3">
              <Palmtree className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-900">
                  Ad Hoc Holiday &amp; Calendar Blocks
                </div>
                <div className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  Scheduled holiday dates are immediately marked on the calendar. Clients cannot book appointments on these days and no time slots will be generated.
                </div>
              </div>
            </div>

            {/* Error Banner */}
            {vacationError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{vacationError}</span>
              </div>
            )}

            {/* Title / Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Holiday Title / Description
                </label>
                <div className="flex items-center gap-1.5">
                  {['🌴 Holiday', '🏖️ Time Off', '👤 Day Off', '🤒 Sick'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setVacationTitle(tag)}
                      className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-amber-100 hover:text-amber-800 transition"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                required
                value={vacationTitle}
                onChange={(e) => {
                  setVacationTitle(e.target.value);
                  setVacationError('');
                }}
                placeholder="e.g. Summer Holiday, Workshop, Day Off"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 outline-none focus:border-amber-500 transition shadow-2xs font-semibold"
              />
            </div>

            {/* Date Range Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Start Date (From)
                </label>
                <input
                  type="date"
                  required
                  value={vacationStartDate}
                  onChange={(e) => {
                    setVacationStartDate(e.target.value);
                    if (vacationEndDate < e.target.value) {
                      setVacationEndDate(e.target.value);
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-800 outline-none focus:border-amber-500 shadow-2xs"
                />
                <div className="text-[10px] text-slate-400 mt-1 font-medium">
                  {formatHumanDate(vacationStartDate)}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  End Date (Up to &amp; including)
                </label>
                <input
                  type="date"
                  required
                  value={vacationEndDate}
                  min={vacationStartDate}
                  onChange={(e) => setVacationEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-800 outline-none focus:border-amber-500 shadow-2xs"
                />
                <div className="text-[10px] text-slate-400 mt-1 font-medium">
                  {formatHumanDate(vacationEndDate)}
                </div>
              </div>

              {/* Quick Period Buttons */}
              <div className="sm:col-span-2 pt-1 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium mr-1">
                  Quick duration:
                </span>
                <button
                  type="button"
                  onClick={() => handleSetVacationDuration(0)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-800 transition"
                >
                  1 day
                </button>
                <button
                  type="button"
                  onClick={() => handleSetVacationDuration(2)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-800 transition"
                >
                  Long weekend (3d)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetVacationDuration(6)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-800 transition"
                >
                  1 week (7d)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetVacationDuration(13)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-800 transition"
                >
                  2 weeks (14d)
                </button>
              </div>
            </div>

            {/* Reason & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Type / Reason
                </label>
                <select
                  value={vacationReason}
                  onChange={(e) =>
                    setVacationReason(
                      e.target.value as 'vacation' | 'sick' | 'personal' | 'blocked'
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-800 outline-none focus:border-amber-500 shadow-2xs"
                >
                  <option value="vacation">🌴 Holiday (Time off)</option>
                  <option value="personal">👤 Personal / Day off</option>
                  <option value="sick">🤒 Sick leave</option>
                  <option value="blocked">🚫 Blocked (Workshop / External)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Internal Note (Optional)
                </label>
                <input
                  type="text"
                  value={vacationNotes}
                  onChange={(e) => setVacationNotes(e.target.value)}
                  placeholder="e.g. Out of office, phone off"
                  className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-800 outline-none focus:border-amber-500 shadow-2xs"
                />
              </div>
            </div>

            {/* Active exceptions in current list */}
            {activeExceptionsOnDate.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Active blocks around this date:
                </div>
                {activeExceptionsOnDate.map((exc) => (
                  <div
                    key={exc.id}
                    className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-950"
                  >
                    <div>
                      <span className="font-bold">{exc.title}</span>
                      <span className="text-amber-800 text-[11px] ml-2">
                        {exc.startDate} to {exc.endDate}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteException(exc.id)}
                      className="text-rose-600 hover:text-rose-800 p-1 font-bold text-[11px] flex items-center gap-1 hover:bg-rose-50 rounded-lg transition"
                      title="Delete this holiday / block"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </form>
        )}

        {/* Success Banner */}
        {successMsg && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold animate-fadeIn">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div>
            {activeTab === 'vacation' ? (
              <button
                type="button"
                onClick={() => setActiveTab('availability')}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 transition flex items-center gap-1"
              >
                ← Back to working hours
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('vacation')}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 transition flex items-center gap-1"
              >
                <Palmtree className="h-3.5 w-3.5" />
                Schedule holiday →
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Close
            </button>

            {activeTab === 'availability' ? (
              <button
                type="button"
                onClick={handleSaveAvailability}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                {t.saveChanges}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSaveVacation()}
                className="rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-500 shadow-md shadow-amber-600/20 transition flex items-center gap-1.5"
              >
                <Palmtree className="h-4 w-4" />
                Save Holiday &amp; Block Dates
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
