import React, { useState, useEffect, useMemo } from 'react';
import { useBooking } from '../../context/BookingContext';
import {
  X,
  Users,
  Calendar,
  Clock,
  MapPin,
  Plus,
  Sparkles,
  AlertCircle,
  Repeat,
  Check,
  Edit2,
  Trash2,
  Settings2,
  BookmarkPlus,
  Link as LinkIcon,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  getTodayISO,
  addDaysToISO,
  minutesToTime,
  timeToMinutes,
  parseDateISO,
  formatDateISO,
  formatHumanDate,
} from '../../utils/dateUtils';
import { GroupSession, GroupSessionParticipant, GroupSessionTemplate } from '../../types';

interface CreateGroupSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  initialStartTime?: string;
}

const WEEKDAYS = [
  { key: 1, labelNl: 'Ma', labelEn: 'Mon', fullNl: 'Maandag', fullEn: 'Monday' },
  { key: 2, labelNl: 'Di', labelEn: 'Tue', fullNl: 'Dinsdag', fullEn: 'Tuesday' },
  { key: 3, labelNl: 'Wo', labelEn: 'Wed', fullNl: 'Woensdag', fullEn: 'Wednesday' },
  { key: 4, labelNl: 'Do', labelEn: 'Thu', fullNl: 'Thu', fullEn: 'Thursday' },
  { key: 5, labelNl: 'Vr', labelEn: 'Fri', fullNl: 'Vrijdag', fullEn: 'Friday' },
  { key: 6, labelNl: 'Za', labelEn: 'Sat', fullNl: 'Zaterdag', fullEn: 'Saturday' },
  { key: 0, labelNl: 'Zo', labelEn: 'Sun', fullNl: 'Zondag', fullEn: 'Sunday' },
];

export const CreateGroupSessionModal: React.FC<CreateGroupSessionModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  initialStartTime = '18:00',
}) => {
  const {
    addGroupSession,
    addGroupSessionsBatch,
    services,
    clients,
    currency,
    formatPrice,
    language,
    groupSessionTemplates,
    addGroupSessionTemplate,
    updateGroupSessionTemplate,
    deleteGroupSessionTemplate,
  } = useBooking();

  const isNl = language === 'nl';
  const todayStr = getTodayISO();
  const defaultDate = initialDate || addDaysToISO(todayStr, 1);

  // Form states
  const [title, setTitle] = useState('Small Group Strength Training');
  const [serviceId, setServiceId] = useState(services[0]?.id || '');
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [maxParticipants, setMaxParticipants] = useState<number | string>(6);
  const [price, setPrice] = useState<number | string>(20);
  const [location, setLocation] = useState('Jansen Studio - Strength Zone');
  const [description, setDescription] = useState('Targeted strength training in a small group.');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  // Recurring states
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [recurringEndDate, setRecurringEndDate] = useState(addDaysToISO(defaultDate, 42)); // 6 weeks default

  // Template Manager Modal state
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<GroupSessionTemplate | null>(null);
  const [isCreatingNewTemplate, setIsCreatingNewTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  // Save current values as quick template prompt state
  const [isSaveAsTemplateOpen, setIsSaveAsTemplateOpen] = useState(false);
  const [saveTemplateTitle, setSaveTemplateTitle] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Template edit form states
  const [tmplFormTitle, setTmplFormTitle] = useState('');
  const [tmplFormDuration, setTmplFormDuration] = useState(60);
  const [tmplFormMax, setTmplFormMax] = useState<number | string>(6);
  const [tmplFormPrice, setTmplFormPrice] = useState<number | string>(20);
  const [tmplFormLocation, setTmplFormLocation] = useState('');
  const [tmplFormServiceId, setTmplFormServiceId] = useState('');
  const [tmplFormNotes, setTmplFormNotes] = useState('');

  // Update initial props when opening
  useEffect(() => {
    if (isOpen) {
      if (initialDate) {
        setDate(initialDate);
        setRecurringEndDate(addDaysToISO(initialDate, 42));
        const initDay = parseDateISO(initialDate).getDay();
        setSelectedWeekdays([initDay]);
      } else {
        const initDay = parseDateISO(defaultDate).getDay();
        setSelectedWeekdays([initDay]);
      }
      if (initialStartTime) {
        setStartTime(initialStartTime);
      }
    }
  }, [isOpen, initialDate, initialStartTime]);

  // Keep default weekday matched when date changes
  useEffect(() => {
    if (date) {
      const day = parseDateISO(date).getDay();
      if (selectedWeekdays.length === 0) {
        setSelectedWeekdays([day]);
      }
    }
  }, [date]);

  // Calculated end time
  const startMin = timeToMinutes(startTime);
  const endMin = startMin + durationMinutes;
  const endTime = minutesToTime(Math.min(1439, endMin));

  // Compute list of recurring dates
  const calculatedRecurringDates = useMemo(() => {
    if (!isRecurring || selectedWeekdays.length === 0 || recurringEndDate < date) {
      return [date];
    }
    const dates: string[] = [];
    let curr = parseDateISO(date);
    const end = parseDateISO(recurringEndDate);
    while (curr <= end) {
      if (selectedWeekdays.includes(curr.getDay())) {
        dates.push(formatDateISO(curr));
      }
      curr = new Date(curr.getTime() + 24 * 60 * 60 * 1000);
    }
    return dates.length > 0 ? dates : [date];
  }, [isRecurring, selectedWeekdays, date, recurringEndDate]);

  if (!isOpen) return null;

  // Apply a template to the main form
  const handleApplyTemplate = (tmpl: GroupSessionTemplate) => {
    setTitle(tmpl.title);
    setDurationMinutes(tmpl.durationMinutes);
    setMaxParticipants(tmpl.maxParticipants);
    setPrice(tmpl.price);
    setLocation(tmpl.location || '');
    setServiceId(tmpl.serviceId || '');
    setDescription(tmpl.notes || '');
    setActiveTemplateId(tmpl.id);
  };

  const handleToggleWeekday = (dayKey: number) => {
    setSelectedWeekdays((prev) => {
      if (prev.includes(dayKey)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((d) => d !== dayKey);
      }
      return [...prev, dayKey];
    });
  };

  const handleTogglePreselectedClient = (cId: string) => {
    setSelectedClientIds((prev) => {
      if (prev.includes(cId)) {
        return prev.filter((id) => id !== cId);
      }
      if (prev.length >= maxParticipants) {
        setErrorMsg(
          `You can only pre-select up to ${maxParticipants} participants.`
        );
        return prev;
      }
      setErrorMsg(null);
      return [...prev, cId];
    });
  };

  // Open Template Manager with Edit Form
  const handleStartEditTemplate = (tmpl: GroupSessionTemplate) => {
    setEditingTemplate(tmpl);
    setIsCreatingNewTemplate(false);
    setTmplFormTitle(tmpl.title);
    setTmplFormDuration(tmpl.durationMinutes);
    setTmplFormMax(tmpl.maxParticipants);
    setTmplFormPrice(tmpl.price);
    setTmplFormLocation(tmpl.location || '');
    setTmplFormServiceId(tmpl.serviceId || '');
    setTmplFormNotes(tmpl.notes || '');
  };

  // Open Template Manager with New Form
  const handleStartCreateTemplate = () => {
    setEditingTemplate(null);
    setIsCreatingNewTemplate(true);
    setTmplFormTitle(title || (isNl ? 'Nieuwe Groepssessie Template' : 'New Group Session Template'));
    setTmplFormDuration(durationMinutes);
    setTmplFormMax(maxParticipants);
    setTmplFormPrice(price);
    setTmplFormLocation(location);
    setTmplFormServiceId(serviceId);
    setTmplFormNotes(description);
  };

  // Save changes to template
  const handleSaveTemplateForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tmplFormTitle.trim()) return;

    const pMax = parseInt(String(tmplFormMax), 10) || 6;
    const pPrice = tmplFormPrice === '' ? 0 : parseFloat(String(tmplFormPrice)) || 0;

    if (editingTemplate) {
      updateGroupSessionTemplate(editingTemplate.id, {
        title: tmplFormTitle.trim(),
        durationMinutes: tmplFormDuration,
        maxParticipants: pMax,
        price: pPrice,
        location: tmplFormLocation.trim() || undefined,
        serviceId: tmplFormServiceId || undefined,
        notes: tmplFormNotes.trim() || undefined,
      });
      setEditingTemplate(null);
    } else {
      addGroupSessionTemplate({
        title: tmplFormTitle.trim(),
        durationMinutes: tmplFormDuration,
        maxParticipants: pMax,
        price: pPrice,
        location: tmplFormLocation.trim() || undefined,
        serviceId: tmplFormServiceId || undefined,
        notes: tmplFormNotes.trim() || undefined,
      });
      setIsCreatingNewTemplate(false);
    }
  };

  // Quick Save Current Form as New Template
  const handleQuickSaveCurrentAsTemplate = () => {
    if (!saveTemplateTitle.trim()) return;
    const pMax = parseInt(String(maxParticipants), 10) || 6;
    const pPrice = price === '' ? 0 : parseFloat(String(price)) || 0;

    const newTmpl = addGroupSessionTemplate({
      title: saveTemplateTitle.trim(),
      durationMinutes,
      maxParticipants: pMax,
      price: pPrice,
      location: location.trim() || undefined,
      serviceId: serviceId || undefined,
      notes: description.trim() || undefined,
    });
    setActiveTemplateId(newTmpl.id);
    setIsSaveAsTemplateOpen(false);
    setSaveTemplateTitle('');
    setSaveSuccessMsg(
      isNl ? `Template "${newTmpl.title}" opgeslagen!` : `Template "${newTmpl.title}" saved!`
    );
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Main Submit (Single or Recurring)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please enter a title for the group session.');
      return;
    }
    const parsedMax = parseInt(String(maxParticipants), 10) || 6;
    const parsedPrice = price === '' ? 0 : parseFloat(String(price)) || 0;

    if (parsedMax < 2) {
      setErrorMsg('A group session requires at least 2 participants.');
      return;
    }

    const preParticipants: GroupSessionParticipant[] = selectedClientIds.map((cId) => {
      const client = clients.find((c) => c.id === cId);
      return {
        clientId: cId,
        clientName: client?.name || 'Client',
        clientEmail: client?.email,
        clientPhone: client?.phone,
        bookedAt: new Date().toISOString(),
        price: parsedPrice,
        status: 'confirmed',
      };
    });

    if (isRecurring) {
      // Schedule multiple group sessions across recurring dates
      const sessionsToCreate = calculatedRecurringDates.map((sessionDate) => ({
        title: title.trim(),
        serviceId: serviceId || undefined,
        description: description.trim() || undefined,
        notes: description.trim() || undefined,
        date: sessionDate,
        startTime,
        endTime,
        durationMinutes,
        maxParticipants: parsedMax,
        price: parsedPrice,
        location: location.trim() || undefined,
        status: 'scheduled' as const,
        participants: preParticipants,
      }));

      if (addGroupSessionsBatch) {
        addGroupSessionsBatch(sessionsToCreate);
      } else {
        sessionsToCreate.forEach((s) => addGroupSession(s));
      }
    } else {
      // Schedule single session
      addGroupSession({
        title: title.trim(),
        serviceId: serviceId || undefined,
        description: description.trim() || undefined,
        notes: description.trim() || undefined,
        date,
        startTime,
        endTime,
        durationMinutes,
        maxParticipants: parsedMax,
        price: parsedPrice,
        location: location.trim() || undefined,
        status: 'scheduled',
        participants: preParticipants,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white p-5 sm:p-7 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-100 text-purple-700 shadow-2xs">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Schedule Group Session
              </h3>
              <p className="text-xs text-slate-500">
                Define a group session with participant capacity, quick templates, and recurrence.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {saveSuccessMsg && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Quick Templates Toolbar */}
        <div className="mb-5 rounded-2xl border border-purple-100 bg-purple-50/50 p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-600" />
              {isNl ? 'Quick Templates' : 'Quick Templates'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSaveTemplateTitle(title);
                  setIsSaveAsTemplateOpen(true);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-white border border-purple-200 px-2.5 py-1 text-[11px] font-bold text-purple-700 hover:bg-purple-100/60 transition cursor-pointer shadow-2xs"
                title="Save current values as template"
              >
                <BookmarkPlus className="h-3 w-3" />
                <span>Save as template</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeletingTemplateId(null);
                  setIsTemplateManagerOpen(true);
                  setEditingTemplate(null);
                  setIsCreatingNewTemplate(false);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-purple-600 text-white px-2.5 py-1 text-[11px] font-bold hover:bg-purple-700 transition cursor-pointer shadow-2xs"
              >
                <Settings2 className="h-3 w-3" />
                <span>Manage</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {groupSessionTemplates.map((tmpl) => {
              const isSelected = activeTemplateId === tmpl.id;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleApplyTemplate(tmpl)}
                  className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'border-purple-600 bg-purple-600 text-white shadow-xs'
                      : 'border-purple-200 bg-white hover:bg-purple-50 text-purple-950'
                  }`}
                >
                  <span>{tmpl.title}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                      isSelected ? 'bg-purple-700 text-purple-100' : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {tmpl.maxParticipants}p • {tmpl.durationMinutes}m • {formatPrice(tmpl.price)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Prompt: Save Current Form as New Template */}
        {isSaveAsTemplateOpen && (
          <div className="mb-5 rounded-2xl border-2 border-purple-400 bg-white p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                <BookmarkPlus className="h-4 w-4 text-purple-600" />
                Save current session as Quick Template
              </span>
              <button
                type="button"
                onClick={() => setIsSaveAsTemplateOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Template Title *
              </label>
              <input
                type="text"
                value={saveTemplateTitle}
                onChange={(e) => setSaveTemplateTitle(e.target.value)}
                placeholder="e.g. Small Group Strength Training"
                className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-purple-600 outline-none"
              />
            </div>
            <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-xl">
              Saved settings: <strong>{durationMinutes} min</strong> • <strong>{maxParticipants} participants</strong> • <strong>{formatPrice(price)}</strong> • <strong>{location || 'No location'}</strong>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSaveAsTemplateOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickSaveCurrentAsTemplate}
                className="rounded-lg bg-purple-600 px-3 py-1 text-xs font-bold text-white hover:bg-purple-700 shadow-2xs"
              >
                Save Template
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Title */}
          <div>
            <label className="font-bold text-slate-800 block mb-1">
              Group Session Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Small Group Strength Training"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-purple-600 outline-none"
              required
            />
          </div>

          {/* Date & Time Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 outline-none"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Start Time *
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 outline-none"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Duration
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 outline-none"
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={75}>75 min</option>
                <option value={90}>90 min</option>
                <option value={120}>120 min</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            <span>
              Time window:{' '}
              <strong className="text-slate-800">
                {startTime} - {endTime} ({durationMinutes} min)
              </strong>
            </span>
          </div>

          {/* RECURRING SECTION: Repeat weekly on specific weekdays until an end date */}
          <div className="rounded-2xl border-2 border-indigo-200/80 bg-indigo-50/40 p-4 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
              />
              <span className="font-bold text-indigo-950 flex items-center gap-1.5 text-xs">
                <Repeat className="h-4 w-4 text-indigo-600" />
                Repeat weekly on specific weekdays until an end date
              </span>
            </label>

            {isRecurring && (
              <div className="space-y-3 pt-2 border-t border-indigo-200/60 animate-in fade-in slide-in-from-top-1">
                {/* Weekday Selection */}
                <div>
                  <label className="block text-[11px] font-bold text-indigo-900 mb-1.5">
                    Select weekdays:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((w) => {
                      const isSelected = selectedWeekdays.includes(w.key);
                      return (
                        <button
                          key={w.key}
                          type="button"
                          onClick={() => handleToggleWeekday(w.key)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white text-indigo-950 border-indigo-200 hover:bg-indigo-100/50'
                          }`}
                        >
                          {w.labelEn}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                    Repeat until end date *
                  </label>
                  <input
                    type="date"
                    min={date}
                    value={recurringEndDate}
                    onChange={(e) => setRecurringEndDate(e.target.value)}
                    className="w-full sm:w-64 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-950 focus:border-indigo-600 outline-none"
                    required={isRecurring}
                  />
                </div>

                {/* Preview count */}
                <div className="rounded-xl bg-white border border-indigo-200 p-2.5 text-xs text-indigo-950 flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">
                      {calculatedRecurringDates.length} group sessions will be scheduled
                    </span>
                    <span className="text-[11px] text-indigo-700 block mt-0.5">
                      Weekly on {selectedWeekdays
                        .map((k) => WEEKDAYS.find((w) => w.key === k)?.fullEn)
                        .join(', ')} from {formatHumanDate(date)} to {formatHumanDate(recurringEndDate)}.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Capacity (Maximal Participants) & Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-purple-50/60 border border-purple-200/80">
            <div>
              <label className="font-bold text-purple-950 block mb-1 flex items-center justify-between">
                <span>Max Participants *</span>
                <span className="text-[10px] text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded font-bold">
                  {maxParticipants} spots
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                  className="w-full rounded-xl border border-purple-300 bg-white px-3 py-2 text-sm font-black text-purple-950 focus:border-purple-600 outline-none"
                  required
                />
              </div>
              <p className="text-[10px] text-purple-800 mt-1">
                Clients can book until capacity is reached.
              </p>
            </div>

            <div>
              <label className="font-bold text-purple-950 block mb-1 flex items-center justify-between">
                <span>Price per participant *</span>
                <span className="text-[10px] text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded font-bold">
                  {formatPrice(Number(price) || 0)} / person
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.50"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-xl border border-purple-300 bg-white pl-3 pr-8 py-2 text-sm font-black text-purple-950 focus:border-purple-600 outline-none"
                  required
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  {currency}
                </span>
              </div>
              <p className="text-[10px] text-purple-800 mt-1">
                Or 1 package session credit.
              </p>
            </div>
          </div>

          {/* Location & Link Service */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-800 block mb-1 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                <span>Location</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Jansen Studio or Vondelpark"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1 flex items-center gap-1">
                <LinkIcon className="h-3.5 w-3.5 text-slate-400" />
                <span>Link Service</span>
              </label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 outline-none"
              >
                <option value="">General Group</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.durationMinutes}m)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes / Instructions */}
          <div>
            <label className="font-bold text-slate-800 block mb-1 flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              <span>Notes / Instructions for Participants</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Bring a water bottle and towel. Arrive 5 minutes prior."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 outline-none"
            />
          </div>

          {/* Optional: Pre-enroll clients */}
          <div>
            <label className="font-bold text-slate-800 block mb-1 flex items-center justify-between">
              <span>Pre-enroll clients (optional)</span>
              <span className="text-[11px] text-slate-500">
                {selectedClientIds.length} / {maxParticipants} selected
              </span>
            </label>
            <div className="max-h-28 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1 bg-slate-50/50">
              {clients.map((c) => {
                const isSelected = selectedClientIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer select-none transition ${
                      isSelected
                        ? 'bg-purple-100/70 text-purple-950 font-bold'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleTogglePreselectedClient(c.id)}
                        className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="truncate">{c.name}</span>
                    </div>
                    {c.phone && <span className="text-[10px] text-slate-400 font-mono">{c.phone}</span>}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-5 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>
                {isRecurring
                  ? `Schedule ${calculatedRecurringDates.length} Group Sessions`
                  : 'Schedule Group Session'}
              </span>
            </button>
          </div>
        </form>

        {/* SUB-MODAL: Manage Quick Templates (Create, Edit, Delete) */}
        {isTemplateManagerOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
            <div className="relative w-full max-w-xl rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900">
                      Manage Quick Templates
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Create, edit, or delete reusable group session templates.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDeletingTemplateId(null);
                    setIsTemplateManagerOpen(false);
                    setEditingTemplate(null);
                    setIsCreatingNewTemplate(false);
                  }}
                  className="rounded-xl p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Form if Editing or Creating */}
              {editingTemplate || isCreatingNewTemplate ? (
                <form onSubmit={handleSaveTemplateForm} className="space-y-3 text-xs mb-4 p-4 rounded-2xl bg-purple-50/60 border border-purple-200">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-purple-950">
                      {editingTemplate
                        ? isNl
                          ? 'Template Wijzigen'
                          : 'Edit Template'
                        : isNl
                        ? 'Nieuw Template Aanmaken'
                        : 'Create New Template'}
                    </h5>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTemplate(null);
                        setIsCreatingNewTemplate(false);
                      }}
                      className="text-xs text-purple-700 hover:underline"
                    >
                      {isNl ? 'Annuleren' : 'Cancel'}
                    </button>
                  </div>

                  <div>
                    <label className="font-bold text-slate-800 block mb-1">
                      {isNl ? 'Template Titel' : 'Template Title'} *
                    </label>
                    <input
                      type="text"
                      value={tmplFormTitle}
                      onChange={(e) => setTmplFormTitle(e.target.value)}
                      placeholder="e.g. Outdoor Bootcamp"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-purple-600"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="font-bold text-slate-800 block mb-1">
                        {isNl ? 'Duur (min)' : 'Duration (min)'}
                      </label>
                      <select
                        value={tmplFormDuration}
                        onChange={(e) => setTmplFormDuration(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none"
                      >
                        <option value={30}>30m</option>
                        <option value={45}>45m</option>
                        <option value={60}>60m</option>
                        <option value={75}>75m</option>
                        <option value={90}>90m</option>
                        <option value={120}>120m</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-800 block mb-1">
                        {isNl ? 'Max Deelnemers' : 'Max Participants'}
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={50}
                        value={tmplFormMax}
                        onChange={(e) => setTmplFormMax(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-800 block mb-1">
                        {isNl ? 'Prijs / Deelnemer' : 'Price / Person'}
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        value={tmplFormPrice}
                        onChange={(e) => setTmplFormPrice(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-800 block mb-1">
                        {isNl ? 'Locatie' : 'Location'}
                      </label>
                      <input
                        type="text"
                        value={tmplFormLocation}
                        onChange={(e) => setTmplFormLocation(e.target.value)}
                        placeholder="e.g. Studio 1"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-800 block mb-1">
                        {isNl ? 'Link Service' : 'Link Service'}
                      </label>
                      <select
                        value={tmplFormServiceId}
                        onChange={(e) => setTmplFormServiceId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none"
                      >
                        <option value="">{isNl ? 'Algemeen' : 'General'}</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-800 block mb-1">
                      {isNl ? 'Notities / Instructies' : 'Notes / Instructions'}
                    </label>
                    <textarea
                      rows={2}
                      value={tmplFormNotes}
                      onChange={(e) => setTmplFormNotes(e.target.value)}
                      placeholder="e.g. Handdoek en water meenemen."
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="submit"
                      className="rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-1.5 text-xs font-bold text-white shadow-2xs cursor-pointer"
                    >
                      {editingTemplate ? (isNl ? 'Wijziging Opslaan' : 'Save Changes') : isNl ? 'Template Toevoegen' : 'Add Template'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={handleStartCreateTemplate}
                    className="w-full py-2.5 rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50/50 hover:bg-purple-100/50 text-purple-800 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{isNl ? '+ Nieuwe Template Aanmaken' : '+ Create New Template'}</span>
                  </button>
                </div>
              )}

              {/* List of existing templates */}
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {groupSessionTemplates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="p-3 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-purple-200 transition flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs truncate">
                          {tmpl.title}
                        </span>
                        <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-bold shrink-0">
                          {tmpl.maxParticipants}p • {tmpl.durationMinutes}m
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold shrink-0">
                          {formatPrice(tmpl.price)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {tmpl.location && <span>📍 {tmpl.location} • </span>}
                        {tmpl.serviceId && (
                          <span>
                            🔗 {services.find((s) => s.id === tmpl.serviceId)?.name || 'Service'} •{' '}
                          </span>
                        )}
                        <span>{tmpl.notes || 'No instructions'}</span>
                      </div>
                    </div>

                    {deletingTemplateId === tmpl.id ? (
                      <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-1 shrink-0 animate-in fade-in duration-150">
                        <span className="text-[11px] font-bold text-rose-800">Delete?</span>
                        <button
                          type="button"
                          onClick={() => {
                            deleteGroupSessionTemplate(tmpl.id);
                            if (activeTemplateId === tmpl.id) setActiveTemplateId(null);
                            setDeletingTemplateId(null);
                          }}
                          className="rounded-lg bg-rose-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-rose-700 transition shadow-xs cursor-pointer"
                        >
                          Yes, delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingTemplateId(null)}
                          className="rounded-lg bg-white border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingTemplateId(null);
                            handleStartEditTemplate(tmpl);
                          }}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-purple-700 hover:bg-purple-50 transition cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingTemplateId(tmpl.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setDeletingTemplateId(null);
                    setIsTemplateManagerOpen(false);
                  }}
                  className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-xs font-bold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
