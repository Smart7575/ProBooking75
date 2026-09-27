import React, { useState, useEffect, useMemo } from 'react';
import { useBooking } from '../../context/BookingContext';
import {
  X,
  Clock,
  Calendar as CalendarIcon,
  Trash2,
  Check,
  Coffee,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Info,
  Palmtree,
  Sliders,
} from 'lucide-react';
import { formatFullHumanDate, parseDateISO, timeToMinutes, endTimeToMinutes, minutesToTime } from '../../utils/dateUtils';

interface GoogleCalendarTimeBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  initialStartTime?: string;
  initialEndTime?: string;
  mode: 'create' | 'edit';
  existingBlockId?: string;
  existingBreakStart?: string;
  existingBreakEnd?: string;
  existingNotes?: string;
  existingSlotDuration?: number;
  existingBufferMinutes?: number;
  isSyntheticWeekly?: boolean;
  onPlanVacation?: (dateStr: string) => void;
}

export const GoogleCalendarTimeBlockModal: React.FC<GoogleCalendarTimeBlockModalProps> = ({
  isOpen,
  onClose,
  dateStr,
  initialStartTime = '09:00',
  initialEndTime = '17:00',
  mode,
  existingBlockId,
  existingBreakStart = '',
  existingBreakEnd = '',
  existingNotes = '',
  existingSlotDuration,
  existingBufferMinutes,
  isSyntheticWeekly = false,
  onPlanVacation,
}) => {
  const { saveWorkingBlock, removeWorkingBlock, settings, t } = useBooking();

  const defaultTrainerSlot = settings.standardSlotDuration || 60;
  const defaultTrainerBuffer =
    settings.bufferMinutes !== undefined && settings.bufferMinutes !== null
      ? settings.bufferMinutes
      : 15;

  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [hasBreak, setHasBreak] = useState(Boolean(existingBreakStart && existingBreakEnd));
  const [breakStart, setBreakStart] = useState(existingBreakStart || '12:30');
  const [breakEnd, setBreakEnd] = useState(existingBreakEnd || '13:15');
  const [notes, setNotes] = useState(existingNotes || '');
  const [copyToWeek, setCopyToWeek] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Custom slot duration & buffer overrides
  const [useCustomSlotConfig, setUseCustomSlotConfig] = useState(
    mode === 'edit' &&
      Boolean(
        existingSlotDuration ||
          (existingBufferMinutes !== undefined && existingBufferMinutes !== null)
      )
  );
  const [customSlotDuration, setCustomSlotDuration] = useState<number>(
    existingSlotDuration || defaultTrainerSlot
  );
  const [customBufferMinutes, setCustomBufferMinutes] = useState<number>(
    existingBufferMinutes !== undefined && existingBufferMinutes !== null
      ? existingBufferMinutes
      : defaultTrainerBuffer
  );

  // Reset state on open or change of props
  useEffect(() => {
    if (!isOpen) return;
    setStartTime(initialStartTime || '09:00');
    setEndTime(initialEndTime || '17:00');
    setHasBreak(Boolean(existingBreakStart && existingBreakEnd));
    setBreakStart(existingBreakStart || '12:30');
    setBreakEnd(existingBreakEnd || '13:15');
    setNotes(existingNotes || '');
    setCopyToWeek(false);
    setErrorMsg('');

    const hasCustom =
      mode === 'edit' &&
      Boolean(
        existingSlotDuration ||
          (existingBufferMinutes !== undefined && existingBufferMinutes !== null)
      );
    setUseCustomSlotConfig(hasCustom);
    setCustomSlotDuration(existingSlotDuration || defaultTrainerSlot);
    setCustomBufferMinutes(
      existingBufferMinutes !== undefined && existingBufferMinutes !== null
        ? existingBufferMinutes
        : defaultTrainerBuffer
    );
  }, [
    isOpen,
    mode,
    initialStartTime,
    initialEndTime,
    existingBreakStart,
    existingBreakEnd,
    existingNotes,
    existingSlotDuration,
    existingBufferMinutes,
    defaultTrainerSlot,
    defaultTrainerBuffer,
  ]);

  // Generate preview of individual slots based on current configuration
  const previewSlots = useMemo(() => {
    const sMin = timeToMinutes(startTime);
    const eMin = endTimeToMinutes(endTime);
    if (eMin <= sMin) return [];

    const slotDur = useCustomSlotConfig ? customSlotDuration : defaultTrainerSlot;
    const buf = useCustomSlotConfig ? customBufferMinutes : defaultTrainerBuffer;

    const bStart = hasBreak && breakStart ? timeToMinutes(breakStart) : null;
    const bEnd = hasBreak && breakEnd ? endTimeToMinutes(breakEnd) : null;

    const windows: { start: number; end: number }[] = [];
    if (bStart !== null && bEnd !== null && bStart > sMin && bEnd < eMin && bEnd > bStart) {
      windows.push({ start: sMin, end: bStart });
      windows.push({ start: bEnd, end: eMin });
    } else {
      windows.push({ start: sMin, end: eMin });
    }

    const items: { type: 'slot' | 'buffer' | 'break'; startStr: string; endStr: string; duration: number }[] = [];

    windows.forEach((win, wIdx) => {
      const winDur = win.end - win.start;
      if (winDur <= 0) return;

      const effectiveSlotDur = Math.min(slotDur, winDur);
      let curr = win.start;
      while (curr + effectiveSlotDur <= win.end) {
        items.push({
          type: 'slot',
          startStr: minutesToTime(curr),
          endStr: minutesToTime(curr + effectiveSlotDur),
          duration: effectiveSlotDur,
        });
        curr += effectiveSlotDur;
        if (buf > 0 && curr + buf + 5 <= win.end) {
          items.push({
            type: 'buffer',
            startStr: minutesToTime(curr),
            endStr: minutesToTime(curr + buf),
            duration: buf,
          });
          curr += buf;
        }
      }

      const remainingMin = win.end - curr;
      if (remainingMin >= 5) {
        items.push({
          type: 'slot',
          startStr: minutesToTime(curr),
          endStr: minutesToTime(win.end),
          duration: remainingMin,
        });
      }

      if (wIdx === 0 && bStart !== null && bEnd !== null && bStart > sMin && bEnd < eMin) {
        items.push({
          type: 'break',
          startStr: minutesToTime(bStart),
          endStr: minutesToTime(bEnd),
          duration: bEnd - bStart,
        });
      }
    });

    return items;
  }, [
    startTime,
    endTime,
    hasBreak,
    breakStart,
    breakEnd,
    useCustomSlotConfig,
    customSlotDuration,
    customBufferMinutes,
    defaultTrainerSlot,
    defaultTrainerBuffer,
  ]);

  if (!isOpen) return null;

  // Step adjustment helpers for finger touch (+/- 15 minutes)
  const adjustTime = (current: string, deltaMinutes: number): string => {
    const mins = timeToMinutes(current);
    const newMins = Math.max(0, Math.min(24 * 60 - 15, mins + deltaMinutes));
    return minutesToTime(newMins);
  };

  const handleStartTimeChange = (nextStart: string) => {
    const prevStartMin = timeToMinutes(startTime);
    const prevEndMin = endTimeToMinutes(endTime);
    const currentDur = Math.max(15, prevEndMin - prevStartMin);
    const nextStartMin = timeToMinutes(nextStart);
    setStartTime(nextStart);

    // In create mode (when single block) or if start >= end, preserve duration
    if ((mode === 'create' && currentDur <= 120) || nextStartMin >= prevEndMin) {
      const nextEndMin = Math.min(1440, nextStartMin + currentDur);
      setEndTime(minutesToTime(nextEndMin === 1440 ? 23 * 60 + 59 : nextEndMin));
    }
  };

  const handleAdjustStart = (delta: number) => {
    const nextStart = adjustTime(startTime, delta);
    handleStartTimeChange(nextStart);
  };

  const handleAdjustEnd = (delta: number) => {
    const currentEndMin = endTimeToMinutes(endTime);
    const nextEndMin = Math.max(15, Math.min(1440, currentEndMin + delta));
    if (nextEndMin > timeToMinutes(startTime)) {
      const nextEnd = nextEndMin === 1440 ? '00:00' : minutesToTime(nextEndMin);
      setEndTime(nextEnd);
      const newTotal = nextEndMin - timeToMinutes(startTime);
      if (useCustomSlotConfig && newTotal < customSlotDuration) {
        setCustomSlotDuration(newTotal);
      }
    }
  };

  // Quick 1-tap duration buttons (relative to startTime in minutes)
  const setDurationMinutesFromStart = (minutes: number) => {
    const sMin = timeToMinutes(startTime);
    const eMin = Math.min(23 * 60 + 45, sMin + minutes);
    setEndTime(minutesToTime(eMin));
    if (useCustomSlotConfig && minutes < customSlotDuration) {
      setCustomSlotDuration(minutes);
    }
  };

  // Quick presets
  const applyPreset = (s: string, e: string, bStart?: string, bEnd?: string) => {
    setStartTime(s);
    setEndTime(e);
    if (bStart && bEnd) {
      setHasBreak(true);
      setBreakStart(bStart);
      setBreakEnd(bEnd);
    } else {
      setHasBreak(false);
    }
  };

  // Calculate total working hours
  const calculateTotalHours = (): string => {
    const sMin = timeToMinutes(startTime);
    const eMin = endTimeToMinutes(endTime);
    if (eMin <= sMin) return '0';
    let diff = eMin - sMin;
    if (hasBreak && breakStart && breakEnd) {
      const bsMin = timeToMinutes(breakStart);
      const beMin = endTimeToMinutes(breakEnd);
      if (beMin > bsMin && bsMin >= sMin && beMin <= eMin) {
        diff -= (beMin - bsMin);
      }
    }
    diff = Math.max(0, diff);
    if (diff < 60) {
      return `${diff} min`;
    }
    const hours = Math.round((diff / 60) * 100) / 100;
    return `${hours} uur`;
  };

  const handleSave = () => {
    setErrorMsg('');
    const sMin = timeToMinutes(startTime);
    const eMin = endTimeToMinutes(endTime);

    if (eMin <= sMin) {
      setErrorMsg('Eindtijd moet na de starttijd liggen.');
      return;
    }

    if (hasBreak && breakStart && breakEnd) {
      const bsMin = timeToMinutes(breakStart);
      const beMin = endTimeToMinutes(breakEnd);
      if (beMin <= bsMin) {
        setErrorMsg('Pauze eindtijd moet na de pauze starttijd liggen.');
        return;
      }
    }

    const blockTotalMin = eMin - sMin;
    const effectiveSlotDuration = useCustomSlotConfig
      ? Math.min(customSlotDuration, blockTotalMin)
      : blockTotalMin < defaultTrainerSlot
      ? blockTotalMin
      : undefined;

    saveWorkingBlock(
      {
        date: dateStr,
        startTime,
        endTime,
        breakStart: hasBreak ? breakStart : undefined,
        breakEnd: hasBreak ? breakEnd : undefined,
        slotDuration: effectiveSlotDuration,
        bufferMinutes: useCustomSlotConfig ? customBufferMinutes : undefined,
        notes: notes.trim() || undefined,
      },
      existingBlockId,
      copyToWeek
    );

    onClose();
  };

  const handleDelete = () => {
    removeWorkingBlock(dateStr, existingBlockId, startTime);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {mode === 'create' ? 'Beschikbare Werktijd Invoeren' : 'Werktijdblok Aanpassen'}
                </h3>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                  Google Calendar Stijl
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                {formatFullHumanDate(dateStr)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center justify-center touch-manipulation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-700 flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isSyntheticWeekly && mode === 'edit' && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
              <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <span className="font-bold block">Vast Weekrooster Blok</span>
                <span>
                  Dit blok is overgenomen van je wekelijkse rooster. Als je dit wijzigt, wordt deze specifieke datum ({formatFullHumanDate(dateStr)}) direct aangepast zonder andere weken te verstoren.
                </span>
              </div>
            </div>
          )}

          {/* Time Picker Controls (iPad Touch Steppers) */}
          <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/40 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-emerald-600" />
                Werktijd & Uren
              </span>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-200/80 px-2.5 py-1 rounded-lg">
                Totaal: {calculateTotalHours()}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Start Time Stepper */}
              <div className="bg-white rounded-xl border border-emerald-200 p-3 shadow-2xs">
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Starttijd
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAdjustStart(-15)}
                    className="h-11 w-11 rounded-xl bg-slate-100 hover:bg-emerald-100 active:bg-emerald-200 text-slate-800 font-bold text-xs flex items-center justify-center transition border border-slate-200 touch-manipulation active:scale-95"
                    title="-15 minuten"
                  >
                    -15m
                  </button>
                  <input
                    type="time"
                    step="900"
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    className="flex-1 h-11 rounded-xl border border-slate-200 px-3 text-center text-base font-bold text-slate-950 focus:border-emerald-500 focus:outline-hidden bg-slate-50/50"
                  />
                  <button
                    type="button"
                    onClick={() => handleAdjustStart(15)}
                    className="h-11 w-11 rounded-xl bg-slate-100 hover:bg-emerald-100 active:bg-emerald-200 text-slate-800 font-bold text-xs flex items-center justify-center transition border border-slate-200 touch-manipulation active:scale-95"
                    title="+15 minuten"
                  >
                    +15m
                  </button>
                </div>
              </div>

              {/* End Time Stepper */}
              <div className="bg-white rounded-xl border border-emerald-200 p-3 shadow-2xs">
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Eindtijd
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAdjustEnd(-15)}
                    className="h-11 w-11 rounded-xl bg-slate-100 hover:bg-emerald-100 active:bg-emerald-200 text-slate-800 font-bold text-xs flex items-center justify-center transition border border-slate-200 touch-manipulation active:scale-95"
                    title="-15 minuten"
                  >
                    -15m
                  </button>
                  <input
                    type="time"
                    step="900"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="flex-1 h-11 rounded-xl border border-slate-200 px-3 text-center text-base font-bold text-slate-950 focus:border-emerald-500 focus:outline-hidden bg-slate-50/50"
                  />
                  <button
                    type="button"
                    onClick={() => handleAdjustEnd(15)}
                    className="h-11 w-11 rounded-xl bg-slate-100 hover:bg-emerald-100 active:bg-emerald-200 text-slate-800 font-bold text-xs flex items-center justify-center transition border border-slate-200 touch-manipulation active:scale-95"
                    title="+15 minuten"
                  >
                    +15m
                  </button>
                </div>
              </div>
            </div>

            {/* 1-Tap Quick Duration Pills */}
            <div>
              <span className="block text-[11px] font-bold text-slate-600 mb-1.5">
                Snelle Tijdsduur (vanaf starttijd):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '+30m', mins: 30 },
                  { label: '+45m', mins: 45 },
                  { label: '+1 uur', mins: 60 },
                  { label: '+1,5 uur', mins: 90 },
                  { label: '+2 uur', mins: 120 },
                  { label: '+4 uur', mins: 240 },
                  { label: '+8 uur', mins: 480 },
                ].map((item) => (
                  <button
                    key={item.mins}
                    type="button"
                    onClick={() => setDurationMinutesFromStart(item.mins)}
                    className="rounded-lg bg-white border border-emerald-200 px-2.5 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 active:bg-emerald-200 transition shadow-2xs touch-manipulation active:scale-95 cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setEndTime('17:30')}
                  className="rounded-lg bg-white border border-emerald-200 px-2.5 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 active:bg-emerald-200 transition shadow-2xs touch-manipulation active:scale-95"
                >
                  Tot 17:30
                </button>
                <button
                  type="button"
                  onClick={() => setEndTime('20:00')}
                  className="rounded-lg bg-white border border-emerald-200 px-2.5 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 active:bg-emerald-200 transition shadow-2xs touch-manipulation active:scale-95"
                >
                  Tot 20:00
                </button>
              </div>
            </div>
          </div>

          {/* 1-Tap Quick Presets */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
              Snelle Dagtemplates (1-Tik)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('08:30', '17:30', '12:30', '13:15')}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-emerald-50 hover:border-emerald-300 text-left transition touch-manipulation active:scale-95"
              >
                <div className="text-xs font-bold text-slate-900">☀️ Hele Dag</div>
                <div className="text-[10px] text-slate-500 font-medium">08:30 - 17:30</div>
              </button>
              <button
                type="button"
                onClick={() => applyPreset('08:30', '12:30')}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-emerald-50 hover:border-emerald-300 text-left transition touch-manipulation active:scale-95"
              >
                <div className="text-xs font-bold text-slate-900">🌅 Ochtend</div>
                <div className="text-[10px] text-slate-500 font-medium">08:30 - 12:30</div>
              </button>
              <button
                type="button"
                onClick={() => applyPreset('13:00', '17:30')}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-emerald-50 hover:border-emerald-300 text-left transition touch-manipulation active:scale-95"
              >
                <div className="text-xs font-bold text-slate-900">☕ Middag</div>
                <div className="text-[10px] text-slate-500 font-medium">13:00 - 17:30</div>
              </button>
              <button
                type="button"
                onClick={() => applyPreset('17:00', '21:00')}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-emerald-50 hover:border-emerald-300 text-left transition touch-manipulation active:scale-95"
              >
                <div className="text-xs font-bold text-slate-900">🌙 Avond</div>
                <div className="text-[10px] text-slate-500 font-medium">17:00 - 21:00</div>
              </button>
            </div>
          </div>

          {/* Pause / Break Toggle & Settings */}
          <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coffee className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-bold text-slate-900">Pauze inplannen</span>
              </div>
              <button
                type="button"
                onClick={() => setHasBreak(!hasBreak)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition touch-manipulation ${
                  hasBreak
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {hasBreak ? 'Pauze Actief ✓' : '+ Pauze toevoegen'}
              </button>
            </div>

            {hasBreak && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 animate-in fade-in">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Pauze Start
                  </label>
                  <input
                    type="time"
                    value={breakStart}
                    onChange={(e) => setBreakStart(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Pauze Eind
                  </label>
                  <input
                    type="time"
                    value={breakEnd}
                    onChange={(e) => setBreakEnd(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Slot Duration & Buffer Configuration */}
          <div className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">
                  Tijdsblokduur & Tussenruimte (Sessies)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setUseCustomSlotConfig(!useCustomSlotConfig)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition touch-manipulation ${
                  useCustomSlotConfig
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {useCustomSlotConfig ? 'Afwijkend ✓' : 'Volg trainer standaard'}
              </button>
            </div>

            {!useCustomSlotConfig ? (
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>
                  Volgt standaard instellingen van trainer: <strong>{defaultTrainerSlot} min</strong> per blok + <strong>{defaultTrainerBuffer} min</strong> tussentijd.
                </span>
              </div>
            ) : (
              <div className="space-y-3 pt-2 border-t border-slate-200/80 animate-in fade-in">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Blokduur per sessie
                    </label>
                    <select
                      value={customSlotDuration}
                      onChange={(e) => {
                        const newDur = Number(e.target.value);
                        setCustomSlotDuration(newDur);
                        const sMin = timeToMinutes(startTime);
                        const eMin = endTimeToMinutes(endTime);
                        if (!hasBreak && eMin - sMin <= 120) {
                          const nextEnd = Math.min(23 * 60 + 45, sMin + newDur);
                          setEndTime(minutesToTime(nextEnd));
                        }
                      }}
                      className="w-full h-10 rounded-xl border border-slate-200 px-2.5 text-xs font-bold text-slate-900 bg-white focus:border-emerald-500 focus:outline-hidden"
                    >
                      <option value="15">15 minuten</option>
                      <option value="30">30 minuten</option>
                      <option value="45">45 minuten</option>
                      <option value="60">60 minuten (1 uur)</option>
                      <option value="75">75 minuten</option>
                      <option value="90">90 minuten (1,5 uur)</option>
                      <option value="120">120 minuten (2 uur)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Tussenruimte / Buffertijd
                    </label>
                    <select
                      value={customBufferMinutes}
                      onChange={(e) => setCustomBufferMinutes(Number(e.target.value))}
                      className="w-full h-10 rounded-xl border border-slate-200 px-2.5 text-xs font-bold text-slate-900 bg-white focus:border-emerald-500 focus:outline-hidden"
                    >
                      <option value="0">0 minuten (geen)</option>
                      <option value="5">5 minuten</option>
                      <option value="10">10 minuten</option>
                      <option value="15">15 minuten</option>
                      <option value="20">20 minuten</option>
                      <option value="30">30 minuten</option>
                      <option value="45">45 minuten</option>
                    </select>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Hiermee worden de afzonderlijke tijdsblokken nauwkeurig op de kalender gepositioneerd.
                </p>
              </div>
            )}

            {/* Live slot segments preview */}
            {previewSlots.length > 0 && (
              <div className="pt-2 border-t border-slate-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Resultaat op kalender ({previewSlots.filter((p) => p.type === 'slot').length} boekbare tijdsblokken):
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white rounded-xl border border-slate-200/80">
                  {previewSlots.map((item, idx) => {
                    if (item.type === 'slot') {
                      return (
                        <span
                          key={idx}
                          className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg flex items-center gap-1"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          {item.startStr} - {item.endStr}
                        </span>
                      );
                    }
                    if (item.type === 'break') {
                      return (
                        <span
                          key={idx}
                          className="text-[10px] font-bold text-purple-800 bg-purple-100 border border-purple-300 px-2 py-0.5 rounded-lg flex items-center gap-1"
                        >
                          <Coffee className="h-2.5 w-2.5 text-purple-600" />
                          Pauze {item.startStr} - {item.endStr}
                        </span>
                      );
                    }
                    return (
                      <span
                        key={idx}
                        className="text-[9px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-lg"
                      >
                        +{item.duration}m rust
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Multi-day Copy Checkbox */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={copyToWeek}
                onChange={(e) => setCopyToWeek(e.target.checked)}
                className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 mt-0.5"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Toepassen op alle werkdagen van deze week (Ma t/m Vr)
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Kopieert dit werktijdenblok automatisch naar de andere doordeweekse dagen van deze week.
                </span>
              </div>
            </label>
          </div>

          {/* Ad Hoc Vacation Planning Shortcut */}
          {onPlanVacation && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Palmtree className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-xs font-semibold text-amber-900 truncate">
                  Liever deze dag blokkeren wegens vakantie of verlof?
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onPlanVacation(dateStr);
                }}
                className="shrink-0 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] px-3 py-1.5 transition shadow-2xs"
              >
                🌴 Vakantie Inplannen
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-4 flex items-center justify-between gap-3 shrink-0">
          <div>
            {mode === 'edit' && (
              <button
                type="button"
                onClick={handleDelete}
                className="h-11 rounded-xl bg-rose-50 border border-rose-200 px-4 text-xs font-bold text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition flex items-center gap-1.5 touch-manipulation active:scale-95 shadow-2xs"
              >
                <Trash2 className="h-4 w-4" />
                <span>Blok Verwijderen (Vrijmaken)</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-100 transition touch-manipulation active:scale-95"
            >
              Annuleren
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 px-5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition flex items-center gap-2 touch-manipulation active:scale-95"
            >
              <Check className="h-4 w-4" />
              <span>{mode === 'create' ? 'Werktijd Toevoegen' : 'Wijzigingen Opslaan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
