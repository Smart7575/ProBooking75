import React, { useState, useMemo } from 'react';
import { useBooking } from '../../context/BookingContext';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Plus,
  X,
  Check,
  Ban,
  Sliders,
  Info,
  CalendarCheck2,
  Pencil,
  Palmtree,
  Trash2,
  Eye,
  Settings2,
  Coffee,
  CalendarRange,
  Users,
} from 'lucide-react';
import {
  formatDateISO,
  parseDateISO,
  formatHumanDate,
  formatFullHumanDate,
  getTodayISO,
  getDaysInWeek,
  getMonthDays,
  addDays,
  timeToMinutes,
  endTimeToMinutes,
  minutesToTime,
} from '../../utils/dateUtils';
import { Appointment, AppointmentStatus, ScheduleException, GroupSession } from '../../types';
import { AdHocAvailabilityModal } from './AdHocAvailabilityModal';
import { GoogleCalendarTimeBlockModal } from './GoogleCalendarTimeBlockModal';
import { FixedWeeklyScheduleModal } from './FixedWeeklyScheduleModal';
import { CreateGroupSessionModal } from './CreateGroupSessionModal';
import { GroupSessionDetailsModal } from './GroupSessionDetailsModal';

type CalendarViewMode = 'month' | 'week' | 'day';

export const CalendarView: React.FC = () => {
  const {
    appointments,
    groupSessions,
    clients,
    settings,
    updateAppointmentStatus,
    updateAppointment,
    deleteAppointment,
    cancelAppointment,
    formatPrice,
    availabilityMode,
    setAvailabilityMode,
    isDateTimeAvailable,
    getWorkingBlockForDateTime,
    getDateAvailabilityInfo,
    setAdHocBlocksForDate,
    deleteException,
    language,
    t,
  } = useBooking();
  

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isEditingAppointment, setIsEditingAppointment] = useState(false);
  const [editApptForm, setEditApptForm] = useState<{
    date: string;
    startTime: string;
    serviceId: string;
    price: number | string;
  }>({
    date: '',
    startTime: '09:00',
    serviceId: '',
    price: 0,
  });

  // Group Session modal states
  const [isCreateGroupSessionOpen, setIsCreateGroupSessionOpen] = useState(false);
  const [selectedGroupSession, setSelectedGroupSession] = useState<GroupSession | null>(null);

  // Calendar time view range state (Default: 06:00 - 00:00 / 24:00)
  const [startHour, setStartHour] = useState<number>(() => {
    const saved = localStorage.getItem('probooking_calendar_start_hour');
    return saved !== null ? Number(saved) : 6;
  });
  const [endHour, setEndHour] = useState<number>(() => {
    const saved = localStorage.getItem('probooking_calendar_end_hour');
    return saved !== null ? Number(saved) : 24; // 24 represents 00:00 (midnight)
  });
  const [isTimeRangeMenuOpen, setIsTimeRangeMenuOpen] = useState(false);

  // Ad Hoc Availability & Vacation Modal state
  const [isAdHocModalOpen, setIsAdHocModalOpen] = useState(false);
  const [adHocModalTab, setAdHocModalTab] = useState<'availability' | 'vacation'>('availability');
  const [targetAdHocDate, setTargetAdHocDate] = useState<string>(getTodayISO());
  const [isFixedScheduleModalOpen, setIsFixedScheduleModalOpen] = useState(false);

  // Selected exception modal for viewing/deleting existing vacations
  const [selectedException, setSelectedException] = useState<ScheduleException | null>(null);

  // Google Calendar style direct touch & mouse time block modal state
  const [timeBlockModalState, setTimeBlockModalState] = useState<{
    isOpen: boolean;
    dateStr: string;
    initialStartTime: string;
    initialEndTime: string;
    mode: 'create' | 'edit';
    existingBlockId?: string;
    existingBreakStart?: string;
    existingBreakEnd?: string;
    existingNotes?: string;
    existingSlotDuration?: number;
    existingBufferMinutes?: number;
    isSyntheticWeekly?: boolean;
  }>({
    isOpen: false,
    dateStr: getTodayISO(),
    initialStartTime: '09:00',
    initialEndTime: '17:00',
    mode: 'create',
  });

  const todayStr = getTodayISO();
  const currentDateStr = formatDateISO(currentDate);

  const handleOpenAdHocModal = (
    dateStr?: string,
    tab: 'availability' | 'vacation' = 'availability'
  ) => {
    setTargetAdHocDate(dateStr || currentDateStr);
    setAdHocModalTab(tab);
    setIsAdHocModalOpen(true);
  };

  const handleSetTimeRange = (start: number, end: number) => {
    setStartHour(start);
    setEndHour(end);
    localStorage.setItem('probooking_calendar_start_hour', String(start));
    localStorage.setItem('probooking_calendar_end_hour', String(end));
    setIsTimeRangeMenuOpen(false);
  };

  // Direct Google Calendar touch/click handler
  const handleCellClick = (dStr: string, hour: string) => {
    const [hNumStr, mNumStr] = hour.split(':');
    const hNum = parseInt(hNumStr, 10);
    const mNum = parseInt(mNumStr || '0', 10);
    const startTotalMin = (hNum || 0) * 60 + (mNum || 0);
    const endTotalMin = Math.min(1440, startTotalMin + (settings.standardSlotDuration || 60));
    const nextTimeStr = minutesToTime(endTotalMin);

    const existingInfo = getWorkingBlockForDateTime(dStr, hour);
    if (existingInfo) {
      // Existing working block covering this hour -> EDIT mode!
      setTimeBlockModalState({
        isOpen: true,
        dateStr: dStr,
        initialStartTime: existingInfo.block.startTime,
        initialEndTime: existingInfo.block.endTime,
        mode: 'edit',
        existingBlockId: existingInfo.block.id,
        existingBreakStart: existingInfo.block.breakStart,
        existingBreakEnd: existingInfo.block.breakEnd,
        existingNotes: existingInfo.block.notes,
        existingSlotDuration: existingInfo.block.slotDuration,
        existingBufferMinutes: existingInfo.block.bufferMinutes,
        isSyntheticWeekly: existingInfo.isSyntheticWeekly,
      });
    } else {
      // Free slot -> CREATE mode! (Google Calendar behavior)
      setTimeBlockModalState({
        isOpen: true,
        dateStr: dStr,
        initialStartTime: hour.includes(':') ? hour : `${hour}:00`,
        initialEndTime: nextTimeStr,
        mode: 'create',
        existingSlotDuration: undefined,
        existingBufferMinutes: undefined,
      });
    }
  };

  // Helper to split any day's availability into exact minute-positioned slots, buffers, and breaks
  const getDayTimelineSegments = (dStr: string) => {
    const availInfo = getDateAvailabilityInfo(dStr);
    if (!availInfo.isAvailable || availInfo.isException) {
      return { slots: [], buffers: [], breaks: [] };
    }

    const slots: {
      startMin: number;
      endMin: number;
      startTimeStr: string;
      endTimeStr: string;
      duration: number;
      block: any;
      isSyntheticWeekly: boolean;
    }[] = [];

    const buffers: {
      startMin: number;
      endMin: number;
      duration: number;
    }[] = [];

    const breaks: {
      startMin: number;
      endMin: number;
      startTimeStr: string;
      endTimeStr: string;
      duration: number;
      block: any;
      isSyntheticWeekly: boolean;
    }[] = [];

    const isSynthetic = availInfo.mode === 'weekly';

    availInfo.blocks.forEach((b) => {
      const bStart = timeToMinutes(b.startTime);
      const bEnd = endTimeToMinutes(b.endTime);
      if (bEnd <= bStart) return;

      const slotDur = b.slotDuration || settings.standardSlotDuration || 60;
      const bufMin =
        b.bufferMinutes !== undefined && b.bufferMinutes !== null
          ? b.bufferMinutes
          : settings.bufferMinutes !== undefined
          ? settings.bufferMinutes
          : 15;

      const rawBreak = Boolean(b.breakStart && b.breakEnd);
      const brkStart = rawBreak ? timeToMinutes(b.breakStart!) : null;
      const brkEnd = rawBreak ? endTimeToMinutes(b.breakEnd!) : null;
      const hasBreak =
        rawBreak &&
        brkStart !== null &&
        brkEnd !== null &&
        brkEnd > brkStart &&
        brkStart > bStart &&
        brkEnd < bEnd;

      if (hasBreak && brkStart !== null && brkEnd !== null) {
        breaks.push({
          startMin: brkStart,
          endMin: brkEnd,
          startTimeStr: b.breakStart!,
          endTimeStr: b.breakEnd!,
          duration: brkEnd - brkStart,
          block: b,
          isSyntheticWeekly: isSynthetic,
        });
      }

      type Window = { start: number; end: number };
      let windows: Window[] = [];

      if (hasBreak && brkStart !== null && brkEnd !== null) {
        windows = [
          { start: bStart, end: brkStart },
          { start: brkEnd, end: bEnd },
        ];
      } else {
        windows = [{ start: bStart, end: bEnd }];
      }

      // Active appointments on this day (reserved, delivered)
      const dayActiveAppts = appointments.filter(
        (a) => a.date === dStr && a.status !== 'cancelled'
      );

      windows.forEach((win) => {
        const winDuration = win.end - win.start;
        if (winDuration <= 0) return;

        // If the working window is shorter than slotDur (e.g. a 45-min block when standard slot is 60 min),
        // use the window's actual duration so it is always added to the calendar.
        const effectiveSlotDur = Math.min(slotDur, winDuration);
        let curr = win.start;

        while (curr + effectiveSlotDur <= win.end) {
          const slotStart = curr;
          const slotEnd = curr + effectiveSlotDur;

          // Check if this slot is booked by an active appointment
          const isBooked = dayActiveAppts.some((appt) => {
            const apptStart = timeToMinutes(appt.startTime);
            const apptEnd = endTimeToMinutes(appt.endTime);
            return Math.max(slotStart, apptStart) < Math.min(slotEnd, apptEnd);
          });

          const hasFollowingBuffer = bufMin > 0 && slotEnd + bufMin + 5 <= win.end;

          // Only display as available slot if not booked by an active appointment
          // When an appointment is cancelled, this slot automatically reappears as available!
          if (!isBooked) {
            slots.push({
              startMin: slotStart,
              endMin: slotEnd,
              startTimeStr: minutesToTime(slotStart),
              endTimeStr: minutesToTime(slotEnd),
              duration: effectiveSlotDur,
              block: b,
              isSyntheticWeekly: isSynthetic,
            });

            if (hasFollowingBuffer) {
              buffers.push({
                startMin: slotEnd,
                endMin: slotEnd + bufMin,
                duration: bufMin,
              });
            }
          }

          curr = hasFollowingBuffer ? slotEnd + bufMin : slotEnd;
        }

        // If there is remaining working time at the end of the window (e.g., 45 min left after 1-hour slots),
        // also add it to the calendar so no configured working time is hidden.
        const remainingMin = win.end - curr;
        if (remainingMin >= 5) {
          const slotStart = curr;
          const slotEnd = win.end;
          const isBooked = dayActiveAppts.some((appt) => {
            const apptStart = timeToMinutes(appt.startTime);
            const apptEnd = endTimeToMinutes(appt.endTime);
            return Math.max(slotStart, apptStart) < Math.min(slotEnd, apptEnd);
          });

          if (!isBooked) {
            slots.push({
              startMin: slotStart,
              endMin: slotEnd,
              startTimeStr: minutesToTime(slotStart),
              endTimeStr: minutesToTime(slotEnd),
              duration: remainingMin,
              block: b,
              isSyntheticWeekly: isSynthetic,
            });
          }
        }
      });
    });

    return { slots, buffers, breaks };
  };

  // Navigate functions
  const handlePrev = () => {
    if (viewMode === 'day') {
      setCurrentDate((d) => addDays(d, -1));
    } else if (viewMode === 'week') {
      setCurrentDate((d) => addDays(d, -7));
    } else {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'day') {
      setCurrentDate((d) => addDays(d, 1));
    } else if (viewMode === 'week') {
      setCurrentDate((d) => addDays(d, 7));
    } else {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Open modal handler for appointment
  const handleSelectAppointment = (appt: Appointment) => {
    setSelectedAppointment(appt);
    setCompletionNotes(appt.completionNotes || '');
    setCancellationReason('');
    setIsCancelConfirmOpen(false);
    setIsEditingAppointment(false);
    setEditApptForm({
      date: appt.date,
      startTime: appt.startTime,
      serviceId: appt.serviceId,
      price: appt.price,
    });
  };

  const handleSaveAppointmentEdit = () => {
    if (!selectedAppointment) return;
    updateAppointment(selectedAppointment.id, {
      date: editApptForm.date,
      startTime: editApptForm.startTime,
      serviceId: editApptForm.serviceId,
      price: Number(editApptForm.price),
      completionNotes,
    });
    setIsEditingAppointment(false);
    setSelectedAppointment(null);
  };

  const handleDeleteAppointment = () => {
    if (!selectedAppointment) return;
    deleteAppointment(selectedAppointment.id);
    setSelectedAppointment(null);
  };

  // Status handlers
  const handleSaveDelivered = () => {
    if (selectedAppointment) {
      updateAppointmentStatus(selectedAppointment.id, 'delivered', completionNotes);
      setSelectedAppointment(null);
    }
  };

  const handleMarkNoShow = () => {
    if (selectedAppointment) {
      updateAppointmentStatus(selectedAppointment.id, 'no-show');
      setSelectedAppointment(null);
    }
  };

  const handleConfirmCancel = () => {
    if (selectedAppointment) {
      cancelAppointment(selectedAppointment.id, cancellationReason, true);
      setSelectedAppointment(null);
      setIsCancelConfirmOpen(false);
    }
  };

  // Month grid data
  const monthCells = useMemo(() => {
    return getMonthDays(currentDate.getFullYear(), currentDate.getMonth());
  }, [currentDate]);

  // Week days
  const weekDays = useMemo(() => {
    return getDaysInWeek(currentDate);
  }, [currentDate]);

  // Dynamic hours based on trainer view settings (Default: 06:00 to 00:00 / 24:00)
  // Each slot represents a 1-hour block [h:00 - (h+1):00].
  // When endHour is 24 (00:00 midnight), the last 1-hour slot is 23:00 (covering 23:00 - 00:00).
  // There is NO slot starting at 00:00 (which would be 00:00 - 01:00).
  const hourSlots = useMemo(() => {
    const hours: string[] = [];
    const effectiveEnd = endHour === 0 ? 24 : endHour;

    if (effectiveEnd < startHour) {
      for (let h = startHour; h < 24; h++) {
        hours.push(`${h < 10 ? '0' + h : h}:00`);
      }
      for (let h = 0; h < effectiveEnd; h++) {
        hours.push(`${h < 10 ? '0' + h : h}:00`);
      }
    } else {
      for (let h = startHour; h < effectiveEnd; h++) {
        hours.push(`${h < 10 ? '0' + h : h}:00`);
      }
    }
    return hours;
  }, [startHour, endHour]);

  const visibleStartMin = startHour * 60;
  const visibleEndMin = (endHour === 0 || endHour === 24) ? 1440 : endHour * 60;
  const totalTimelineHeight = Math.max(300, visibleEndMin - visibleStartMin);

  const getStatusBadgeClass = (status: AppointmentStatus) => {
    switch (status) {
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'reserved':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'no-show':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'cancelled':
        return 'bg-slate-200 text-slate-500 line-through border-slate-300';
    }
  };

  const formatHourLabel = (h: number) => {
    if (h === 24 || h === 0) return '00:00';
    return `${String(h).padStart(2, '0')}:00`;
  };

  return (
    <div className="space-y-5">
      {/* Calendar Header Controls with Geometric Balance */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xl shadow-slate-200/50">
        {/* Navigation */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleToday}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
          >
            {t.today}
          </button>
          <div className="flex items-center">
            <button
              onClick={handlePrev}
              className="rounded-l-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleNext}
              className="rounded-r-xl border-y border-r border-slate-200 p-2 text-slate-600 hover:bg-slate-50 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 ml-2 tracking-tight">
            {currentDate.toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </h2>
        </div>

        {/* View Switcher, Time Range & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Create Group Session Button */}
          <button
            onClick={() => setIsCreateGroupSessionOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-md shadow-purple-600/20 transition cursor-pointer"
            title={
              'Define a new group session with max capacity'
            }
          >
            <Users className="h-4 w-4" />
            <span>{'+ Group Session'}</span>
          </button>

          {/* Ad Hoc Vacation Planning Button */}
          <button
            onClick={() => handleOpenAdHocModal(currentDateStr, 'vacation')}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-1.5 text-xs font-bold shadow-md shadow-amber-500/20 transition"
            title={
              'Plan a vacation or time-off period directly via the calendar'
            }
          >
            <Palmtree className="h-4 w-4" />
            <span>{t.planVacation || ('Plan Vacation')}</span>
          </button>

          {/* Quick Add Ad Hoc Availability button */}
          <button
            onClick={() => handleOpenAdHocModal(currentDateStr, 'availability')}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition"
            title={
              'Set or adjust availability for a day'
            }
          >
            <Plus className="h-4 w-4" />
            <span>{t.addAdHocAvailability || ('Set Availability')}</span>
          </button>

          {/* Time Range Selector Popover Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTimeRangeMenuOpen(!isTimeRangeMenuOpen)}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition shadow-2xs"
              title={
                'Change visible hours in the calendar (Default: 06:00 - 00:00)'
              }
            >
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span>{formatHourLabel(startHour)} - {formatHourLabel(endHour)}</span>
              <span className="text-[10px] text-slate-400">▾</span>
            </button>

            {/* Time Range Menu Dropdown */}
            {isTimeRangeMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-white p-4 shadow-2xl border border-slate-200 z-50 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Sliders className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-900">
                      {'Calendar Time Range'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTimeRangeMenuOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                  {'Choose which hours are visible in the day and week view.'}
                </p>

                {/* Preset Buttons */}
                <div className="space-y-1.5 mb-3">
                  <button
                    type="button"
                    onClick={() => handleSetTimeRange(6, 24)}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                      startHour === 6 && endHour === 24
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>06:00 - 00:00</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                      {'Default'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetTimeRange(7, 22)}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                      startHour === 7 && endHour === 22
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>07:00 - 22:00</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {'Extended'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetTimeRange(8, 20)}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                      startHour === 8 && endHour === 20
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>08:00 - 20:00</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {'Classic'}
                    </span>
                  </button>
                </div>

                {/* Custom Range Sliders / Inputs */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-600 block mb-2">
                    {'Custom Range:'}
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1 font-semibold">
                        {'Start Hour'}
                      </label>
                      <select
                        value={startHour}
                        onChange={(e) => handleSetTimeRange(Number(e.target.value), endHour)}
                        className="w-full rounded-xl border border-slate-200 bg-white p-1.5 text-xs font-bold text-slate-800"
                      >
                        {Array.from({ length: 24 }).map((_, h) => (
                          <option key={h} value={h}>
                            {String(h).padStart(2, '0')}:00
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1 font-semibold">
                        {'End Hour'}
                      </label>
                      <select
                        value={endHour}
                        onChange={(e) => handleSetTimeRange(startHour, Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-200 bg-white p-1.5 text-xs font-bold text-slate-800"
                      >
                        {Array.from({ length: 24 }).map((_, h) => (
                          <option key={h + 1} value={h + 1}>
                            {h + 1 === 24
                              ? '00:00 (midnight)'
                              : `${String(h + 1).padStart(2, '0')}:00`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex rounded-2xl bg-slate-100 p-1 border border-slate-200/60">
            <button
              onClick={() => setViewMode('day')}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                viewMode === 'day'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.viewDay}
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                viewMode === 'week'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.viewWeek}
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                viewMode === 'month'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.viewMonth}
            </button>
          </div>
        </div>
      </div>

      {/* Availability Strategy & Visual Color Legend Bar */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-lg shadow-slate-200/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Standard Ad Hoc badge & Fixed Weekly Schedule Popup trigger */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              <CalendarCheck2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t.activeAvailabilityMode || ('Active Scheduling Mode')}
              </div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-emerald-700 font-extrabold">
                  {t.adhocScheduleMode || ('Ad Hoc Flexible Schedule')}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsFixedScheduleModalOpen(true)}
            className="ml-0 sm:ml-2 rounded-xl border border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100 px-3.5 py-1.5 text-xs font-bold text-emerald-900 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title={
              'Set a fixed weekly schedule for a specific start date to end date'
            }
          >
            <CalendarRange className="h-3.5 w-3.5 text-emerald-700" />
            <span>{'Add Fixed Schedule'}</span>
          </button>
        </div>

        {/* Right: Color Legend showing exact meaning of colors on the calendar */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[11px] font-semibold text-slate-600 bg-slate-50/90 py-2 px-3.5 rounded-2xl border border-slate-200/70">
          <span className="text-slate-400 font-bold uppercase text-[10px]">
            {'Legend:'}
          </span>
          {/* Green: Available (Solid) */}
          <span className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-md bg-emerald-200 border-2 border-emerald-600 shadow-2xs"></span>
            <span className="text-emerald-950 font-extrabold">
              {t.calendarAvailableTime || ('Available Working Hours')}
            </span>
          </span>
          {/* Purple: Pauze */}
          <span className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-md bg-purple-200 border-2 border-purple-500 shadow-2xs"></span>
            <span className="text-purple-950 font-extrabold flex items-center gap-1">
              <Coffee className="h-3 w-3 text-purple-700" />
              {'Break / Rest Time'}
            </span>
          </span>
          {/* Slate: Off */}
          <span className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-md bg-slate-100 border border-dashed border-slate-300"></span>
            <span className="text-slate-500">
              {t.calendarUnavailableTime || ('Unavailable / Off')}
            </span>
          </span>
          {/* Amber: Blocked */}
          <span className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-md bg-amber-200 border border-amber-400"></span>
            <span className="text-amber-800 font-medium">
              {'Blocked / Vacation'}
            </span>
          </span>
          {/* Blue: Booked */}
          <span className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-md bg-blue-500"></span>
            <span className="text-blue-800 font-medium">
              {'Booked Sessions'}
            </span>
          </span>

          {/* Purple: Group Sessions */}
          <span className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-md bg-purple-600"></span>
            <span className="text-purple-800 font-medium">
              {'Group Sessions'}
            </span>
          </span>
        </div>
      </div>

      {/* VIEW: MONTH */}
      {viewMode === 'month' && (
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-900 text-center text-xs font-bold text-slate-300 py-3">
            <div>{'Mon'}</div>
            <div>{'Tue'}</div>
            <div>{'Wed'}</div>
            <div>{'Thu'}</div>
            <div>{'Fri'}</div>
            <div>{'Sat'}</div>
            <div>{'Sun'}</div>
          </div>

          {/* Month day cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 min-h-[600px]">
            {monthCells.map(({ date, inMonth }, idx) => {
              const dateStr = formatDateISO(date);
              const isToday = dateStr === todayStr;
              const dayAppts = appointments.filter((a) => a.date === dateStr);
              const availInfo = getDateAvailabilityInfo(dateStr);

              return (
                <div
                  key={idx}
                  onClick={() => availabilityMode === 'adhoc' && handleOpenAdHocModal(dateStr)}
                  className={`p-2.5 min-h-[110px] flex flex-col justify-between transition relative group cursor-pointer ${
                    !inMonth
                      ? 'bg-slate-50/30 text-slate-400'
                      : availInfo.isException
                      ? 'bg-amber-100/50'
                      : availInfo.isAvailable
                      ? 'bg-emerald-100/70 hover:bg-emerald-200/80 border-emerald-300'
                      : 'bg-slate-50/60 hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-xl text-xs font-bold ${
                          isToday
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : inMonth
                            ? 'text-slate-800'
                            : 'text-slate-400'
                        }`}
                      >
                        {date.getDate()}
                      </span>

                      {/* Clear Availability Tag (Solid, Non-transparent) */}
                      {availInfo.isException ? (
                        <span className="text-[9px] text-amber-900 font-bold bg-amber-200 px-1.5 py-0.5 rounded-md border border-amber-300">
                          {'Blocked'}
                        </span>
                      ) : availInfo.isAvailable ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center gap-1">
                            <span
                              className="text-[9px] font-extrabold text-emerald-950 bg-emerald-200 px-2 py-0.5 rounded-md border border-emerald-400 flex items-center gap-1 shadow-2xs"
                              title={
                                `Available: ${availInfo.description}`
                              }
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-700"></span>
                              {availInfo.description}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAdHocBlocksForDate(dateStr, []);
                              }}
                              className="p-0.5 rounded-md bg-rose-100 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-300 transition cursor-pointer shadow-2xs"
                              title={
                                'Clear all available times for this day (booked sessions are preserved)'
                              }
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                          {availInfo.blocks.some((b) => b.breakStart && b.breakEnd) && (
                            <span
                              className="text-[8px] font-bold text-purple-950 bg-purple-200/90 px-1 py-0.2 rounded border border-purple-300 flex items-center gap-0.5 shadow-2xs"
                              title={`${'Break'}: ${availInfo.blocks
                                .filter((b) => b.breakStart && b.breakEnd)
                                .map((b) => `${b.breakStart} - ${b.breakEnd}`)
                                .join(', ')}`}
                            >
                              <Coffee className="h-2 w-2 text-purple-700 shrink-0" />
                              <span>{'Break'}</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[9px] font-medium text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded-md">
                          {'Off'}
                        </span>
                      )}
                    </div>

                    {/* Appointments list in day cell */}
                    <div className="space-y-1 overflow-y-auto max-h-[70px] scrollbar-none mt-1">
                      {/* Group Sessions badges in Month day cell */}
                      {(() => {
                        const dayGroupSessions = (groupSessions || []).filter(
                          (gs) => gs.date === dateStr && gs.status !== 'cancelled'
                        );
                        return dayGroupSessions.map((gs) => {
                          const confirmedCount = (gs.participants || []).filter(
                            (p) => p.status === 'confirmed'
                          ).length;
                          const isFull = confirmedCount >= gs.maxParticipants;
                          return (
                            <button
                              key={gs.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGroupSession(gs);
                              }}
                              className={`w-full text-left truncate rounded-lg px-2 py-0.5 text-[10px] font-bold border transition shadow-2xs ${
                                isFull
                                  ? 'bg-purple-200 text-purple-950 border-purple-400'
                                  : 'bg-purple-100 text-purple-900 border-purple-300 hover:bg-purple-200'
                              }`}
                              title={`Group Session: ${gs.title} (${confirmedCount}/${gs.maxParticipants} participants)`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="truncate">👥 {gs.startTime} {gs.title}</span>
                                <span className="text-[9px] shrink-0 font-extrabold px-1 rounded bg-purple-300/80">
                                  {confirmedCount}/{gs.maxParticipants}
                                </span>
                              </div>
                            </button>
                          );
                        });
                      })()}

                      {dayAppts.map((appt) => {
                        const client = clients.find((c) => c.id === appt.clientId);
                        const service = settings.services.find((s) => s.id === appt.serviceId);
                        return (
                          <button
                            key={appt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectAppointment(appt);
                            }}
                            className={`w-full text-left truncate rounded-lg px-2 py-0.5 text-[10px] font-medium border transition shadow-2xs ${getStatusBadgeClass(
                              appt.status
                            )}`}
                            title={`${appt.startTime} - ${client?.name || ('Client')} (${service?.name})`}
                          >
                            <span className="font-bold">{appt.startTime}</span>{' '}
                            <span>{client?.name || ('Client')}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Ad hoc quick hover button in Month cell */}
                  {availabilityMode === 'adhoc' && inMonth && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity pt-1 flex justify-end">
                      <span className="text-[9px] font-bold text-emerald-700 bg-white/90 border border-emerald-200 px-1.5 py-0.5 rounded-md shadow-2xs">
                        {'Edit hours ✏️'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: WEEK */}
      {viewMode === 'week' && (
        <div className="overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50">
          <div className="min-w-[850px]">
            {/* Week Header */}
            <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-900 text-center text-xs font-semibold text-slate-300 py-3.5">
              <div className="text-slate-400 font-medium flex items-center justify-center">
                {t.timeHeader || ('Time')}
              </div>
              {weekDays.map((d, i) => {
                const dStr = formatDateISO(d);
                const isToday = dStr === todayStr;
                const availInfo = getDateAvailabilityInfo(dStr);

                return (
                  <div
                    key={i}
                    onClick={() => availabilityMode === 'adhoc' && handleOpenAdHocModal(dStr)}
                    className={`flex flex-col items-center py-1 px-1 rounded-xl transition ${
                      availabilityMode === 'adhoc'
                        ? 'cursor-pointer hover:bg-slate-800'
                        : ''
                    }`}
                    title={
                      availabilityMode === 'adhoc'
                        ? 'Click to set availability for this day'
                        : ''
                    }
                  >
                    <span className="text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                      {d.toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                    <span
                      className={`mt-1 flex h-7 w-7 items-center justify-center rounded-xl text-xs font-bold ${
                        isToday ? 'bg-emerald-500 text-white shadow-xs' : 'text-white'
                      }`}
                    >
                      {d.getDate()}
                    </span>

                    {/* Day Availability Tag */}
                    <div className="mt-1">
                      {availInfo.isException ? (
                        <span className="text-[9px] font-bold text-amber-300 bg-amber-900/60 px-1.5 py-0.5 rounded border border-amber-700">
                          {'Blocked'}
                        </span>
                      ) : availInfo.isAvailable ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[9px] font-bold text-emerald-300 bg-emerald-900/60 px-1.5 py-0.5 rounded border border-emerald-700 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                            {availInfo.description}
                          </span>
                          {availInfo.blocks.some((b) => b.breakStart && b.breakEnd) && (
                            <span
                              className="text-[8px] font-bold text-purple-200 bg-purple-950/80 px-1.5 py-0.2 rounded border border-purple-700/80 flex items-center gap-0.5 shadow-2xs"
                              title={`${'Break'}: ${availInfo.blocks
                                .filter((b) => b.breakStart && b.breakEnd)
                                .map((b) => `${b.breakStart} - ${b.breakEnd}`)
                                .join(', ')}`}
                            >
                              <Coffee className="h-2 w-2 text-purple-300 shrink-0" />
                              <span>
                                {availInfo.blocks.find((b) => b.breakStart && b.breakEnd)?.breakStart}-
                                {availInfo.blocks.find((b) => b.breakStart && b.breakEnd)?.breakEnd}
                              </span>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAdHocBlocksForDate(dStr, []);
                            }}
                            className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-rose-500/20 hover:bg-rose-600 border border-rose-400/40 hover:border-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-rose-200 hover:text-white transition cursor-pointer shadow-2xs"
                            title={
                              'Clear all available times for this day in 1 click (booked sessions are preserved)'
                            }
                          >
                            <Trash2 className="h-2.5 w-2.5 shrink-0" />
                            <span>{'Clear hours'}</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[9px] font-medium text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                          {'Off'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Week Continuous Timeline Grid with Exact Minute Positioning */}
            <div className="relative overflow-x-auto">
              <div
                className="grid grid-cols-8 divide-x divide-slate-100 relative select-none"
                style={{ height: `${totalTimelineHeight}px`, minWidth: '760px' }}
              >
                {/* Column 0: Time Gutter */}
                <div className="relative bg-slate-50/70 border-r border-slate-100">
                  {hourSlots.map((hour, hIdx) => (
                    <div
                      key={hour}
                      style={{ top: `${hIdx * 60}px`, height: '60px' }}
                      className="absolute inset-x-0 border-b border-slate-100/90 pr-2 pt-1 text-right"
                    >
                      <span className="text-[11px] font-bold text-slate-400 font-mono">
                        {hour}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Columns 1-7: Days */}
                {weekDays.map((d) => {
                  const dStr = formatDateISO(d);
                  const isToday = dStr === todayStr;
                  const availInfo = getDateAvailabilityInfo(dStr);
                  const dayTimeline = getDayTimelineSegments(dStr);
                  const dayAppts = appointments.filter(
                    (a) => a.date === dStr && a.status !== 'cancelled'
                  );

                  return (
                    <div
                      key={dStr}
                      className="relative h-full group/col"
                    >
                      {/* Background hour grid rows & half-hour guidelines */}
                      {hourSlots.map((hour, hIdx) => (
                        <div
                          key={hour}
                          style={{ top: `${hIdx * 60}px`, height: '60px' }}
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickOffset = e.clientY - rect.top;
                            const quarter = Math.min(3, Math.max(0, Math.floor(clickOffset / 15)));
                            const clickedMinute = String(quarter * 15).padStart(2, '0');
                            const [h] = hour.split(':');
                            handleCellClick(dStr, `${h}:${clickedMinute}`);
                          }}
                          className="absolute inset-x-0 border-b border-slate-100/90 hover:bg-emerald-50/20 transition cursor-pointer"
                          title={
                            `Click to set availability at ${hour}`
                          }
                        >
                          {/* 30-minute subtle dashed guideline */}
                          <div className="absolute top-[30px] inset-x-0 border-b border-dashed border-slate-100/70 pointer-events-none" />
                        </div>
                      ))}

                      {/* Vacation / Blocked Overlay */}
                      {availInfo.isException && (
                        <div
                          onClick={() => {
                            const exc = (settings.exceptions || []).find(
                              (ex) => dStr >= ex.startDate && dStr <= ex.endDate
                            );
                            if (exc) setSelectedException(exc);
                          }}
                          className="absolute inset-x-1 top-1 bottom-1 rounded-2xl bg-amber-100/90 border-2 border-amber-400 p-2.5 shadow-xs cursor-pointer z-20 flex flex-col items-center justify-center text-center group/vacation transition hover:bg-amber-200/90"
                          title={
                            'Blocked due to vacation / time off. Click to manage.'
                          }
                        >
                          <Palmtree className="h-6 w-6 text-amber-600 mb-1" />
                          <span className="text-xs font-black text-amber-950 block truncate max-w-full">
                            {(settings.exceptions || []).find(
                              (ex) => dStr >= ex.startDate && dStr <= ex.endDate
                            )?.title || ('Vacation')}
                          </span>
                          <span className="text-[10px] text-amber-800 font-bold mt-0.5">
                            {'Blocked'}
                          </span>
                        </div>
                      )}

                      {/* Working availability slot segments (Green) */}
                      {!availInfo.isException &&
                        dayTimeline.slots.map((slot, sIdx) => {
                          const topPx = Math.max(0, slot.startMin - visibleStartMin);
                          const heightPx = Math.max(20, slot.duration - 2);

                          if (topPx + heightPx <= 0 || topPx >= totalTimelineHeight) return null;

                          return (
                            <div
                              key={`slot-${sIdx}-${slot.startMin}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTimeBlockModalState({
                                  isOpen: true,
                                  dateStr: dStr,
                                  initialStartTime: slot.block.startTime,
                                  initialEndTime: slot.block.endTime,
                                  mode: 'edit',
                                  existingBlockId: slot.block.id,
                                  existingBreakStart: slot.block.breakStart,
                                  existingBreakEnd: slot.block.breakEnd,
                                  existingNotes: slot.block.notes,
                                  existingSlotDuration: slot.block.slotDuration,
                                  existingBufferMinutes: slot.block.bufferMinutes,
                                  isSyntheticWeekly: slot.isSyntheticWeekly,
                                });
                              }}
                              style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                              className="absolute inset-x-1 rounded-xl bg-emerald-100/95 border-2 border-emerald-500 text-emerald-950 p-1.5 shadow-2xs hover:bg-emerald-200 hover:border-emerald-600 cursor-pointer z-10 transition flex flex-col justify-between overflow-hidden group/slot"
                              title={
                                `Available slot: ${slot.startTimeStr} - ${slot.endTimeStr} (${slot.duration}m). Click to edit.`
                              }
                            >
                              <div className="flex items-center justify-between gap-1 leading-tight">
                                <span className="text-[10px] font-black text-emerald-950 flex items-center gap-1 truncate">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-700 shrink-0" />
                                  {slot.startTimeStr} - {slot.endTimeStr}
                                </span>
                                <span className="text-[9px] font-bold text-emerald-800 bg-white/80 border border-emerald-300 px-1 py-0.2 rounded shrink-0">
                                  {slot.duration}m
                                </span>
                              </div>
                              {heightPx >= 36 && (
                                <div className="flex items-center justify-between text-[9px] text-emerald-900 font-semibold truncate mt-0.5">
                                  <span className="truncate">
                                    {'Available'}
                                  </span>
                                  <span className="opacity-0 group-hover/slot:opacity-100 text-emerald-700 font-bold underline transition">
                                    {'Edit'}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}

                      {/* Buffers / Tussenruimtes (Clean subtle strip) */}
                      {!availInfo.isException &&
                        dayTimeline.buffers.map((buf, bIdx) => {
                          const topPx = Math.max(0, buf.startMin - visibleStartMin);
                          const heightPx = Math.max(8, buf.duration - 1);

                          if (topPx + heightPx <= 0 || topPx >= totalTimelineHeight) return null;

                          return (
                            <div
                              key={`buf-${bIdx}-${buf.startMin}`}
                              style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                              className="absolute inset-x-2 rounded-md bg-slate-100/90 border-y border-dashed border-slate-300/80 text-[8px] font-bold text-slate-500 flex items-center justify-center pointer-events-none z-10 overflow-hidden"
                              title={
                                `Buffer / rest time: ${buf.duration} min`
                              }
                            >
                              {heightPx >= 12 && (
                                <span>
                                  +{buf.duration}m {'buffer'}
                                </span>
                              )}
                            </div>
                          );
                        })}

                      {/* Break Blocks (PAUZE) - Positioned at exact fractional minutes (e.g. 12:30 - 13:15) */}
                      {!availInfo.isException &&
                        dayTimeline.breaks.map((brk, brkIdx) => {
                          const topPx = Math.max(0, brk.startMin - visibleStartMin);
                          const heightPx = Math.max(24, brk.duration - 2);

                          if (topPx + heightPx <= 0 || topPx >= totalTimelineHeight) return null;

                          return (
                            <div
                              key={`brk-${brkIdx}-${brk.startMin}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTimeBlockModalState({
                                  isOpen: true,
                                  dateStr: dStr,
                                  initialStartTime: brk.block.startTime,
                                  initialEndTime: brk.block.endTime,
                                  mode: 'edit',
                                  existingBlockId: brk.block.id,
                                  existingBreakStart: brk.block.breakStart,
                                  existingBreakEnd: brk.block.breakEnd,
                                  existingNotes: brk.block.notes,
                                  existingSlotDuration: brk.block.slotDuration,
                                  existingBufferMinutes: brk.block.bufferMinutes,
                                  isSyntheticWeekly: brk.isSyntheticWeekly,
                                });
                              }}
                              style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                              className="absolute inset-x-1 rounded-xl bg-purple-200/95 border-2 border-purple-500 text-purple-950 hover:bg-purple-300 hover:border-purple-600 p-1.5 shadow-xs cursor-pointer z-15 transition flex flex-col justify-center overflow-hidden group/break"
                              title={
                                `Break from ${brk.startTimeStr} to ${brk.endTimeStr} (${brk.duration} min). Click to edit.`
                              }
                            >
                              <div className="flex items-center justify-between gap-1 leading-tight">
                                <span className="text-[10px] font-black text-purple-950 flex items-center gap-1 truncate">
                                  <Coffee className="h-3 w-3 text-purple-700 shrink-0" />
                                  {'Break'} {brk.startTimeStr} - {brk.endTimeStr}
                                </span>
                                <span className="text-[9px] font-extrabold text-purple-900 bg-white/80 border border-purple-300 px-1 py-0.2 rounded shrink-0">
                                  {brk.duration}m
                                </span>
                              </div>
                              {heightPx >= 38 && (
                                <div className="flex items-center justify-between text-[9px] text-purple-900 font-bold truncate mt-0.5">
                                  <span>
                                    {'Break / No bookings'}
                                  </span>
                                  <span className="opacity-0 group-hover/break:opacity-100 underline text-purple-800 transition">
                                    {'Edit'}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}

                      {/* Booked Appointments */}
                      {dayAppts.map((appt) => {
                        const apptStart = timeToMinutes(appt.startTime);
                        const apptDur = appt.durationMinutes || 60;
                        const topPx = Math.max(0, apptStart - visibleStartMin);
                        const heightPx = Math.max(34, apptDur - 2);
                        const client = clients.find((c) => c.id === appt.clientId);
                        const service = settings.services.find((s) => s.id === appt.serviceId);

                        if (topPx + heightPx <= 0 || topPx >= totalTimelineHeight) return null;

                        return (
                          <div
                            key={appt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectAppointment(appt);
                            }}
                            style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                            className={`absolute inset-x-0.5 rounded-xl p-1.5 text-xs shadow-md border z-25 cursor-pointer transition flex flex-col justify-between overflow-hidden ${getStatusBadgeClass(
                              appt.status
                            )}`}
                          >
                            <div className="flex items-center justify-between leading-tight font-black text-[10px]">
                              <span>{appt.startTime} - {appt.endTime}</span>
                              <span>{appt.packageId ? 'Credit' : formatPrice(appt.price)}</span>
                            </div>
                            <div className="font-bold text-[11px] truncate">
                              {client?.name || ('Client')}
                            </div>
                            {heightPx >= 48 && (
                              <div className="text-[9px] opacity-80 truncate">
                                {service?.name}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Group Sessions on Week Timeline */}
                      {(() => {
                        const dayGroupSessions = (groupSessions || []).filter(
                          (gs) => gs.date === dStr && gs.status !== 'cancelled'
                        );
                        return dayGroupSessions.map((gs) => {
                          const gsStart = timeToMinutes(gs.startTime);
                          const gsDur = gs.durationMinutes || 60;
                          const topPx = Math.max(0, gsStart - visibleStartMin);
                          const heightPx = Math.max(34, gsDur - 2);
                          const confirmedCount = (gs.participants || []).filter(
                            (p) => p.status === 'confirmed'
                          ).length;
                          const isFull = confirmedCount >= gs.maxParticipants;

                          if (topPx + heightPx <= 0 || topPx >= totalTimelineHeight) return null;

                          return (
                            <div
                              key={gs.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGroupSession(gs);
                              }}
                              style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                              className="absolute inset-x-0.5 rounded-xl p-1.5 text-xs shadow-md border-2 z-25 cursor-pointer transition flex flex-col justify-between overflow-hidden bg-purple-600 text-white border-purple-400 hover:bg-purple-700"
                            >
                              <div className="flex items-center justify-between leading-tight font-black text-[10px]">
                                <span className="flex items-center gap-1 truncate">
                                  <Users className="h-3 w-3 inline shrink-0" />
                                  <span>{gs.startTime} - {gs.endTime}</span>
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${
                                    isFull ? 'bg-rose-500 text-white' : 'bg-purple-800 text-purple-100'
                                  }`}
                                >
                                  {confirmedCount}/{gs.maxParticipants}
                                </span>
                              </div>
                              <div className="font-bold text-[11px] truncate">
                                {gs.title}
                              </div>
                              {heightPx >= 48 && (
                                <div className="text-[9px] text-purple-200 truncate flex items-center justify-between">
                                  <span>{formatPrice(gs.price)} p.p.</span>
                                  <span className="font-semibold">
                                    {isFull
                                      ? ('Full')
                                      : `${gs.maxParticipants - confirmedCount} ${'open'}`}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}

                      {/* Current Time Indicator for Today */}
                      {isToday && (() => {
                        const now = new Date();
                        const nowMinutes = now.getHours() * 60 + now.getMinutes();
                        if (nowMinutes >= visibleStartMin && nowMinutes <= visibleEndMin) {
                          const nowTop = nowMinutes - visibleStartMin;
                          return (
                            <div
                              style={{ top: `${nowTop}px` }}
                              className="absolute inset-x-0 border-t-2 border-rose-500 z-30 pointer-events-none flex items-center"
                            >
                              <div className="h-2 w-2 rounded-full bg-rose-500 -ml-1" />
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: DAY */}
      {viewMode === 'day' && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-6">
          {/* Day Header with Availability Status & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-5 gap-4">
            <div>
              <span className="text-xs text-emerald-600 font-bold uppercase tracking-wider">
                {'Daily Overview & Schedule'}
              </span>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                {formatFullHumanDate(currentDateStr)}
              </h3>
            </div>

            {/* Availability info pill & Edit button */}
            {(() => {
              const dayInfo = getDateAvailabilityInfo(currentDateStr);
              return (
                <div className="flex items-center gap-3">
                  <div
                    className={`px-3.5 py-1.5 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
                      dayInfo.isException
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : dayInfo.isAvailable
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        dayInfo.isException
                          ? 'bg-amber-500'
                          : dayInfo.isAvailable
                          ? 'bg-emerald-500'
                          : 'bg-slate-400'
                      }`}
                    ></span>
                    <span>
                      {dayInfo.isException
                        ? 'Vacation / Blocked'
                        : dayInfo.isAvailable
                        ? `Available: ${dayInfo.description} (${dayInfo.totalHours} h)`
                        : 'No availability (Off)'}
                    </span>
                  </div>

                  {dayInfo.isAvailable && dayInfo.blocks.some((b) => b.breakStart && b.breakEnd) && (
                    <div className="px-3 py-1.5 rounded-2xl border text-xs font-bold flex items-center gap-1.5 bg-purple-100 text-purple-900 border-purple-300 shadow-2xs">
                      <Coffee className="h-3.5 w-3.5 text-purple-700" />
                      <span>
                        {'Break:'}{' '}
                        {dayInfo.blocks
                          .filter((b) => b.breakStart && b.breakEnd)
                          .map((b) => `${b.breakStart} - ${b.breakEnd}`)
                          .join(', ')}
                      </span>
                    </div>
                  )}

                  {dayInfo.isAvailable && !dayInfo.isException && (
                    <button
                      type="button"
                      onClick={() => setAdHocBlocksForDate(currentDateStr, [])}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
                      title={
                        'Clear all available times for this day in 1 click (booked sessions are preserved)'
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{'Clear Hours'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenAdHocModal(currentDateStr)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs flex items-center gap-1.5"
                  >
                    <Sliders className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{'Edit Hours'}</span>
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Group Sessions on this day */}
          {(() => {
            const dayGroupSessions = (groupSessions || []).filter(
              (gs) => gs.date === currentDateStr && gs.status !== 'cancelled'
            );
            if (dayGroupSessions.length === 0) return null;

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-800 flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    <span>{'Group Sessions on this day'} ({dayGroupSessions.length})</span>
                  </h4>
                  <button
                    onClick={() => setIsCreateGroupSessionOpen(true)}
                    className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{'New Group Session'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dayGroupSessions.map((gs) => {
                    const confirmedCount = (gs.participants || []).filter(
                      (p) => p.status === 'confirmed'
                    ).length;
                    const spotsLeft = Math.max(0, gs.maxParticipants - confirmedCount);
                    const isFull = spotsLeft === 0;

                    return (
                      <div
                        key={gs.id}
                        onClick={() => setSelectedGroupSession(gs)}
                        className="cursor-pointer p-4 rounded-2xl border-2 border-purple-200 bg-purple-50/70 hover:bg-purple-100/70 transition flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center justify-center rounded-xl bg-purple-700 px-3 py-2 text-white min-w-[70px]">
                            <span className="font-bold text-xs text-purple-100">{gs.startTime}</span>
                            <span className="text-[10px] text-purple-300">{gs.endTime}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="text-sm font-bold text-slate-900">{gs.title}</h5>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                                  isFull
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                }`}
                              >
                                {isFull ? ('Full') : `${spotsLeft} ${'open'}`}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">
                              {confirmedCount} / {gs.maxParticipants} {'participants'} • {formatPrice(gs.price)} p.p.
                            </p>
                            {gs.location && (
                              <p className="text-[11px] text-slate-500 mt-0.5">📍 {gs.location}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-purple-700 bg-white border border-purple-300 px-2.5 py-1 rounded-xl shadow-2xs">
                            {'Manage 👥'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Appointments on this day */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {'Appointments on this day'} ({appointments.filter((a) => a.date === currentDateStr).length})
            </h4>

            {appointments.filter((a) => a.date === currentDateStr).length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                {'No appointments scheduled for this day.'}
              </div>
            ) : (
              appointments
                .filter((a) => a.date === currentDateStr)
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map((appt) => {
                  const client = clients.find((c) => c.id === appt.clientId);
                  const service = settings.services.find((s) => s.id === appt.serviceId);

                  return (
                    <div
                      key={appt.id}
                      onClick={() => handleSelectAppointment(appt)}
                      className="cursor-pointer flex items-center justify-between p-4.5 rounded-2xl border border-slate-100 bg-slate-50/80 hover:bg-white hover:border-emerald-300 hover:shadow-md transition"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center justify-center rounded-xl bg-slate-900 px-3.5 py-2 text-white min-w-[80px]">
                          <span className="font-bold text-sm text-emerald-400">{appt.startTime}</span>
                          <span className="text-[10px] text-slate-400">{appt.endTime}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-slate-900">
                              {client?.name}
                            </h4>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${getStatusBadgeClass(
                                appt.status
                              )}`}
                            >
                              {appt.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {service?.name} • {appt.durationMinutes} min •{' '}
                            {appt.packageId ? (
                              <span className="text-emerald-700 font-semibold">Package Credit</span>
                            ) : (
                              formatPrice(appt.price)
                            )}
                          </p>
                          {appt.completionNotes && (
                            <p className="text-xs italic text-slate-500 mt-1">
                              "{appt.completionNotes}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-bold text-slate-900">
                          {appt.packageId ? (
                            <span className="text-emerald-700 text-xs font-bold">Package Credit</span>
                          ) : (
                            formatPrice(appt.price)
                          )}
                        </span>
                        <div className="text-[11px] text-emerald-600 font-semibold mt-1">
                          Click to manage
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          {/* Daily Continuous Timeline Visualization with Exact Minute Coordinates */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {'Hourly Schedule & Working Hours (Minute-Accurate Positioning)'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {'Time slots and breaks are positioned accurately based on your configured slot duration and buffer time.'}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                {'Click or tap to edit'}
              </span>
            </div>

            {/* Continuous Day Timeline */}
            <div className="relative rounded-2xl border border-slate-200 overflow-hidden bg-slate-50/40">
              <div
                className="relative select-none"
                style={{ height: `${totalTimelineHeight}px` }}
              >
                {/* Time Gutter on left */}
                <div className="absolute left-0 top-0 bottom-0 w-16 bg-slate-50/90 border-r border-slate-200/80 z-20 pointer-events-none">
                  {hourSlots.map((hour, hIdx) => (
                    <div
                      key={hour}
                      style={{ top: `${hIdx * 60}px`, height: '60px' }}
                      className="absolute inset-x-0 border-b border-slate-100/90 pr-2 pt-1 text-right"
                    >
                      <span className="text-[11px] font-bold text-slate-400 font-mono">
                        {hour}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Day content column (left: 64px) */}
                <div className="absolute left-16 right-0 top-0 bottom-0">
                  {/* Background hour grid lines */}
                  {hourSlots.map((hour, hIdx) => (
                    <div
                      key={hour}
                      style={{ top: `${hIdx * 60}px`, height: '60px' }}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickOffset = e.clientY - rect.top;
                        const quarter = Math.min(3, Math.max(0, Math.floor(clickOffset / 15)));
                        const clickedMinute = String(quarter * 15).padStart(2, '0');
                        const [h] = hour.split(':');
                        handleCellClick(currentDateStr, `${h}:${clickedMinute}`);
                      }}
                      className="absolute inset-x-0 border-b border-slate-100/90 hover:bg-emerald-50/20 transition cursor-pointer"
                      title={
                        `Click to set availability at ${hour}`
                      }
                    >
                      <div className="absolute top-[30px] inset-x-0 border-b border-dashed border-slate-100/70 pointer-events-none" />
                    </div>
                  ))}

                  {/* Check for vacation */}
                  {(() => {
                    const dayInfo = getDateAvailabilityInfo(currentDateStr);
                    const dayTimeline = getDayTimelineSegments(currentDateStr);
                    const dayAppts = appointments.filter(
                      (a) => a.date === currentDateStr && a.status !== 'cancelled'
                    );

                    if (dayInfo.isException) {
                      const exc = (settings.exceptions || []).find(
                        (ex) => currentDateStr >= ex.startDate && currentDateStr <= ex.endDate
                      );
                      return (
                        <div
                          onClick={() => exc && setSelectedException(exc)}
                          className="absolute inset-x-2 top-2 bottom-2 rounded-2xl bg-amber-100/95 border-2 border-amber-400 p-4 shadow-sm cursor-pointer z-20 flex flex-col items-center justify-center text-center hover:bg-amber-200 transition"
                        >
                          <Palmtree className="h-8 w-8 text-amber-600 mb-2" />
                          <h4 className="text-base font-black text-amber-950">
                            {exc?.title || ('Vacation / Blocked')}
                          </h4>
                          <p className="text-xs text-amber-800 font-semibold mt-1">
                            {'No appointments possible on this day. Click to manage.'}
                          </p>
                        </div>
                      );
                    }

                    return (
                      <>
                        {/* Slots */}
                        {dayTimeline.slots.map((slot, sIdx) => {
                          const topPx = Math.max(0, slot.startMin - visibleStartMin);
                          const heightPx = Math.max(24, slot.duration - 2);

                          if (topPx + heightPx <= 0 || topPx >= totalTimelineHeight) return null;

                          return (
                            <div
                              key={`day-slot-${sIdx}-${slot.startMin}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTimeBlockModalState({
                                  isOpen: true,
                                  dateStr: currentDateStr,
                                  initialStartTime: slot.block.startTime,
                                  initialEndTime: slot.block.endTime,
                                  mode: 'edit',
                                  existingBlockId: slot.block.id,
                                  existingBreakStart: slot.block.breakStart,
                                  existingBreakEnd: slot.block.breakEnd,
                                  existingNotes: slot.block.notes,
                                  existingSlotDuration: slot.block.slotDuration,
                                  existingBufferMinutes: slot.block.bufferMinutes,
                                  isSyntheticWeekly: slot.isSyntheticWeekly,
                                });
                              }}
                              style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                              className="absolute inset-x-2 rounded-xl bg-emerald-100/95 border-2 border-emerald-500 text-emerald-950 p-2 shadow-2xs hover:bg-emerald-200 hover:border-emerald-600 cursor-pointer z-10 transition flex items-center justify-between overflow-hidden group/slot"
                              title={
                                `Available slot: ${slot.startTimeStr} - ${slot.endTimeStr} (${slot.duration} min). Click to edit.`
                              }
                            >
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-700 shrink-0" />
                                <span className="text-xs font-black text-emerald-950">
                                  {slot.startTimeStr} - {slot.endTimeStr}
                                </span>
                                <span className="text-[10px] font-bold text-emerald-800 bg-white border border-emerald-300 px-1.5 py-0.5 rounded">
                                  {slot.duration} min {'time slot'}
                                </span>
                                {slot.block.notes && (
                                  <span className="text-[11px] text-emerald-900 font-medium italic truncate max-w-xs">
                                    "{slot.block.notes}"
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-bold text-emerald-800 bg-white/90 border border-emerald-300 px-2 py-0.5 rounded-md shadow-2xs flex items-center gap-1 group-hover/slot:bg-emerald-700 group-hover/slot:text-white transition">
                                <Pencil className="h-3 w-3" />
                                <span>{'Edit'}</span>
                              </span>
                            </div>
                          );
                        })}

                        {/* Buffers */}
                        {dayTimeline.buffers.map((buf, bIdx) => {
                          const topPx = Math.max(0, buf.startMin - visibleStartMin);
                          const heightPx = Math.max(10, buf.duration - 1);

                          if (topPx + heightPx <= 0 || topPx >= totalTimelineHeight) return null;

                          return (
                            <div
                              key={`day-buf-${bIdx}-${buf.startMin}`}
                              style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                              className="absolute inset-x-4 rounded-md bg-slate-100/90 border-y border-dashed border-slate-300/80 text-[9px] font-bold text-slate-500 flex items-center justify-center pointer-events-none z-10 overflow-hidden"
                            >
                              +{buf.duration} min {'buffer / rest time'}
                            </div>
                          );
                        })}

                        {/* Break (PAUZE) */}
                        {dayTimeline.breaks.map((brk, brkIdx) => {
                          const topPx = Math.max(0, brk.startMin - visibleStartMin);
                          const heightPx = Math.max(26, brk.duration - 2);

                          if (topPx + heightPx <= 0 || topPx >= totalTimelineHeight) return null;

                          return (
                            <div
                              key={`day-brk-${brkIdx}-${brk.startMin}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTimeBlockModalState({
                                  isOpen: true,
                                  dateStr: currentDateStr,
                                  initialStartTime: brk.block.startTime,
                                  initialEndTime: brk.block.endTime,
                                  mode: 'edit',
                                  existingBlockId: brk.block.id,
                                  existingBreakStart: brk.block.breakStart,
                                  existingBreakEnd: brk.block.breakEnd,
                                  existingNotes: brk.block.notes,
                                  existingSlotDuration: brk.block.slotDuration,
                                  existingBufferMinutes: brk.block.bufferMinutes,
                                  isSyntheticWeekly: brk.isSyntheticWeekly,
                                });
                              }}
                              style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                              className="absolute inset-x-2 rounded-xl bg-purple-200/95 border-2 border-purple-500 text-purple-950 hover:bg-purple-300 hover:border-purple-600 p-2 shadow-xs cursor-pointer z-15 transition flex items-center justify-between overflow-hidden group/break"
                              title={
                                `Break from ${brk.startTimeStr} to ${brk.endTimeStr} (${brk.duration} min). Click to edit.`
                              }
                            >
                              <div className="flex items-center gap-2">
                                <Coffee className="h-4 w-4 text-purple-700 shrink-0" />
                                <span className="text-xs font-black text-purple-950">
                                  {'Break:'} {brk.startTimeStr} - {brk.endTimeStr}
                                </span>
                                <span className="text-[10px] font-extrabold text-purple-900 bg-white border border-purple-300 px-1.5 py-0.5 rounded">
                                  {brk.duration} min {'break'}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-purple-900 bg-white/90 border border-purple-300 px-2 py-0.5 rounded-md shadow-2xs flex items-center gap-1 group-hover/break:bg-purple-800 group-hover/break:text-white transition">
                                <Pencil className="h-3 w-3" />
                                <span>{'Edit Break'}</span>
                              </span>
                            </div>
                          );
                        })}

                        {/* Appointments */}
                        {dayAppts.map((appt) => {
                          const apptStart = timeToMinutes(appt.startTime);
                          const apptDur = appt.durationMinutes || 60;
                          const topPx = Math.max(0, apptStart - visibleStartMin);
                          const heightPx = Math.max(36, apptDur - 2);
                          const client = clients.find((c) => c.id === appt.clientId);
                          const service = settings.services.find((s) => s.id === appt.serviceId);

                          if (topPx + heightPx <= 0 || topPx >= totalTimelineHeight) return null;

                          return (
                            <div
                              key={appt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectAppointment(appt);
                              }}
                              style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                              className={`absolute inset-x-2 rounded-xl p-2 text-xs shadow-md border z-25 cursor-pointer transition flex items-center justify-between overflow-hidden ${getStatusBadgeClass(
                                appt.status
                              )}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="font-mono font-black text-xs">
                                  {appt.startTime} - {appt.endTime}
                                </div>
                                <div className="font-bold text-sm">
                                  {client?.name || ('Client')}
                                </div>
                                <div className="text-[11px] opacity-85">
                                  ({service?.name})
                                </div>
                              </div>
                              <div className="font-bold text-xs">
                                {appt.packageId ? 'Credit' : formatPrice(appt.price)}
                              </div>
                            </div>
                          );
                        })}

                        {/* Group Sessions on Day Timeline */}
                        {(() => {
                          const dayGroupSessions = (groupSessions || []).filter(
                            (gs) => gs.date === currentDateStr && gs.status !== 'cancelled'
                          );
                          return dayGroupSessions.map((gs) => {
                            const gsStart = timeToMinutes(gs.startTime);
                            const gsDur = gs.durationMinutes || 60;
                            const topPx = Math.max(0, gsStart - visibleStartMin);
                            const heightPx = Math.max(36, gsDur - 2);
                            const confirmedCount = (gs.participants || []).filter(
                              (p) => p.status === 'confirmed'
                            ).length;
                            const isFull = confirmedCount >= gs.maxParticipants;

                            if (topPx + heightPx <= 0 || topPx >= totalTimelineHeight) return null;

                            return (
                              <div
                                key={gs.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedGroupSession(gs);
                                }}
                                style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                                className="absolute inset-x-2 rounded-xl p-2 text-xs shadow-md border-2 z-25 cursor-pointer transition flex items-center justify-between overflow-hidden bg-purple-600 text-white border-purple-400 hover:bg-purple-700"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1 font-mono font-black text-xs">
                                    <Users className="h-3.5 w-3.5 shrink-0" />
                                    <span>{gs.startTime} - {gs.endTime}</span>
                                  </div>
                                  <div className="font-bold text-sm">
                                    {gs.title}
                                  </div>
                                  <div className="text-[11px] text-purple-200">
                                    ({confirmedCount}/{gs.maxParticipants} {'participants'})
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    isFull ? 'bg-rose-500 text-white' : 'bg-purple-800 text-purple-100'
                                  }`}>
                                    {isFull ? ('Full') : `${gs.maxParticipants - confirmedCount} ${'open'}`}
                                  </span>
                                  <span className="font-bold text-xs">
                                    {formatPrice(gs.price)} p.p.
                                  </span>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </>
                    );
                  })()}

                  {/* Current Time Red Line */}
                  {currentDateStr === todayStr && (() => {
                    const now = new Date();
                    const nowMinutes = now.getHours() * 60 + now.getMinutes();
                    if (nowMinutes >= visibleStartMin && nowMinutes <= visibleEndMin) {
                      const nowTop = nowMinutes - visibleStartMin;
                      return (
                        <div
                          style={{ top: `${nowTop}px` }}
                          className="absolute inset-x-0 border-t-2 border-rose-500 z-30 pointer-events-none flex items-center"
                        >
                          <div className="h-2.5 w-2.5 rounded-full bg-rose-500 -ml-1.5" />
                          <span className="ml-2 text-[9px] font-bold text-white bg-rose-500 px-1.5 py-0.2 rounded shadow-2xs">
                            {'Now'}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Detail / Management Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-emerald-400">
                  <CalendarIcon className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {t.appointmentDetails}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Client and Service Information (FR-3.4, FR-4.4) */}
            {(() => {
              const client = clients.find((c) => c.id === selectedAppointment.clientId);
              const service = settings.services.find((s) => s.id === selectedAppointment.serviceId);

              return (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3.5 border border-slate-200/80">
                    <span className="text-xs font-semibold text-slate-600">Current Status:</span>
                    <span
                      className={`rounded-full px-3 py-0.5 text-xs font-bold border ${getStatusBadgeClass(
                        selectedAppointment.status
                      )}`}
                    >
                      {selectedAppointment.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Client Card */}
                  <div className="rounded-2xl border border-slate-200/80 p-4.5 bg-white shadow-xs">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      {t.clientInfo}
                    </h4>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-base font-bold text-slate-900">
                          {client?.name || 'Unknown Client'}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          {client?.email} • {client?.phone}
                        </div>
                        {client?.city && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            {client.address}, {client.city}
                          </div>
                        )}
                      </div>
                      {client?.customHourlyRate && (
                        <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                          Custom Rate: {formatPrice(client.customHourlyRate)}/h
                        </span>
                      )}
                    </div>
                    {client?.notes && (
                      <div className="mt-3 rounded-xl bg-amber-50/70 p-3 text-xs text-amber-900 border border-amber-200/60">
                        <strong>Client notes:</strong> {client.notes}
                      </div>
                    )}
                  </div>

                  {/* Booking Specifics / Edit Form */}
                  {isEditingAppointment ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-950">
                          {'Edit Appointment'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsEditingAppointment(false)}
                          className="text-slate-400 hover:text-slate-600 font-semibold"
                        >
                          {'Close'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            {'Date'}
                          </label>
                          <input
                            type="date"
                            value={editApptForm.date}
                            onChange={(e) => setEditApptForm({ ...editApptForm, date: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-white p-2 text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            {'Start Time'}
                          </label>
                          <input
                            type="time"
                            value={editApptForm.startTime}
                            onChange={(e) => setEditApptForm({ ...editApptForm, startTime: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-white p-2 text-slate-900"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            {'Service'}
                          </label>
                          <select
                            value={editApptForm.serviceId}
                            onChange={(e) => setEditApptForm({ ...editApptForm, serviceId: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-white p-2 text-slate-900"
                          >
                            {settings.services.map((srv) => (
                              <option key={srv.id} value={srv.id}>
                                {srv.name} ({srv.durationMinutes} min)
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            {'Price'}
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            value={editApptForm.price}
                            onChange={(e) => setEditApptForm({ ...editApptForm, price: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-white p-2 text-slate-900"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleSaveAppointmentEdit}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-xs"
                        >
                          {'Save Changes'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-2xl border border-slate-200/80 p-3.5 bg-slate-50/50">
                        <span className="text-slate-400 block mb-1">{t.serviceType}</span>
                        <strong className="text-slate-900 text-sm block">
                          {service?.name}
                        </strong>
                        <span className="text-slate-500">{selectedAppointment.durationMinutes} min</span>
                      </div>
                      <div className="rounded-2xl border border-slate-200/80 p-3.5 bg-slate-50/50">
                        <span className="text-slate-400 block mb-1">{t.sessionPrice}</span>
                        <strong className="text-slate-900 text-sm block">
                          {selectedAppointment.packageId ? (
                            <span className="text-emerald-700">Covered by Package</span>
                          ) : (
                            formatPrice(selectedAppointment.price)
                          )}
                        </strong>
                        <span className="text-slate-500">
                          {selectedAppointment.packageId && (
                            <span className="block text-[11px] text-emerald-600 font-semibold mb-0.5">
                              {selectedAppointment.packageName}
                            </span>
                          )}
                          {selectedAppointment.date} ({selectedAppointment.startTime} - {selectedAppointment.endTime})
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Completion Notes (FR-5.2) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {t.addCompletionNotes}
                    </label>
                    <textarea
                      value={completionNotes}
                      onChange={(e) => setCompletionNotes(e.target.value)}
                      placeholder={t.completionNotesPlaceholder}
                      rows={3}
                      className="w-full rounded-2xl border border-slate-200 p-3 text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                    />
                  </div>

                  {/* Actions / Status Controls (FR-5.2, FR-5.3, FR-6.4) */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleSaveDelivered}
                        className="flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 transition"
                      >
                        <Check className="h-4 w-4" />
                        <span>{t.markDelivered}</span>
                      </button>
                      <button
                        onClick={handleMarkNoShow}
                        className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                      >
                        <Ban className="h-4 w-4" />
                        <span>{t.markNoShow}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingAppointment((prev) => !prev)}
                        className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>{'Edit'}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setIsCancelConfirmOpen(true)}
                        className="text-xs font-semibold text-slate-500 hover:text-amber-600 transition"
                      >
                        {'Cancel Booking'}
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteAppointment}
                        className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 transition"
                        title={
                          'Permanently delete appointment from calendar and database'
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>{'Delete'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Cancellation prompt */}
                  {isCancelConfirmOpen && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 space-y-3">
                      <p className="text-xs font-bold text-rose-900">
                        Confirm cancellation? This will notify the client and immediately reopen this slot.
                      </p>
                      <input
                        type="text"
                        placeholder="Reason for cancellation (optional)"
                        value={cancellationReason}
                        onChange={(e) => setCancellationReason(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 outline-none focus:border-rose-400"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setIsCancelConfirmOpen(false)}
                          className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                        >
                          Keep
                        </button>
                        <button
                          onClick={handleConfirmCancel}
                          className="rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition"
                        >
                          Confirm Cancellation
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Ad Hoc Availability Management Modal (Full day overview and Vacation Planning) */}
      <AdHocAvailabilityModal
        isOpen={isAdHocModalOpen}
        onClose={() => setIsAdHocModalOpen(false)}
        initialDateStr={targetAdHocDate}
        initialTab={adHocModalTab}
      />

      {/* Google Calendar Direct Touch & Mouse Time Block Modal */}
      <GoogleCalendarTimeBlockModal
        isOpen={timeBlockModalState.isOpen}
        onClose={() => setTimeBlockModalState((prev) => ({ ...prev, isOpen: false }))}
        dateStr={timeBlockModalState.dateStr}
        initialStartTime={timeBlockModalState.initialStartTime}
        initialEndTime={timeBlockModalState.initialEndTime}
        mode={timeBlockModalState.mode}
        existingBlockId={timeBlockModalState.existingBlockId}
        existingBreakStart={timeBlockModalState.existingBreakStart}
        existingBreakEnd={timeBlockModalState.existingBreakEnd}
        existingNotes={timeBlockModalState.existingNotes}
        existingSlotDuration={timeBlockModalState.existingSlotDuration}
        existingBufferMinutes={timeBlockModalState.existingBufferMinutes}
        isSyntheticWeekly={timeBlockModalState.isSyntheticWeekly}
        onPlanVacation={(dStr) => handleOpenAdHocModal(dStr, 'vacation')}
      />

      {/* Fixed Weekly Schedule Date-Range Popup Modal */}
      <FixedWeeklyScheduleModal
        isOpen={isFixedScheduleModalOpen}
        onClose={() => setIsFixedScheduleModalOpen(false)}
        initialStartDate={currentDateStr}
      />

      {/* Vacation Detail & Delete Modal */}
      {selectedException && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
                  <Palmtree className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedException.title}
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                    {selectedException.reason}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedException(null)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-950 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">{'Period:'}</span>
                  <span className="font-bold text-slate-900">
                    {formatHumanDate(selectedException.startDate)} {'to'} {formatHumanDate(selectedException.endDate)}
                  </span>
                </div>
                {selectedException.notes && (
                  <div className="flex items-start justify-between gap-2 pt-1.5 border-t border-amber-200/60">
                    <span className="text-slate-500 font-medium shrink-0">{'Notes:'}</span>
                    <span className="font-semibold text-right text-slate-800">{selectedException.notes}</span>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {'During this vacation period, the calendar is blocked and clients cannot book appointments.'}
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  deleteException(selectedException.id);
                  setSelectedException(null);
                }}
                className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition flex items-center gap-1.5 shadow-2xs"
              >
                <Trash2 className="h-4 w-4" />
                <span>{'Delete Vacation'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedException(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs"
              >
                {'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Session Modal */}
      <CreateGroupSessionModal
        isOpen={isCreateGroupSessionOpen}
        onClose={() => setIsCreateGroupSessionOpen(false)}
        initialDate={currentDateStr}
      />

      {/* Group Session Details & Management Modal */}
      {selectedGroupSession && (
        <GroupSessionDetailsModal
          session={selectedGroupSession}
          onClose={() => setSelectedGroupSession(null)}
        />
      )}
    </div>
  );
};
